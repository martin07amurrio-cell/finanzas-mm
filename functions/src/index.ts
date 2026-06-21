import { onRequest } from 'firebase-functions/v2/https'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

initializeApp()

const db = getFirestore()

// Token del bot — se setea con: firebase functions:secrets:set TELEGRAM_TOKEN
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || ''

async function sendMessage(chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  })
}

// Vincula un Telegram chat_id a un usuario de la app (verificando PIN)
async function vincularUsuario(chatId: number, nombre: string, pin: string): Promise<string> {
  const snap = await db.collection('users').get()
  const user = snap.docs.find(d => {
    const data = d.data()
    return data.name.toLowerCase() === nombre.toLowerCase() && data.pin_hash === pin
  })
  if (!user) return '❌ Nombre o PIN incorrecto. Intentá de nuevo.'
  await db.collection('users').doc(user.id).update({ telegram_chat_id: chatId })
  return `✅ ¡Cuenta vinculada! Hola <b>${user.data().name}</b>, ya podés registrar movimientos.`
}

async function getUserByChatId(chatId: number) {
  const snap = await db.collection('users').where('telegram_chat_id', '==', chatId).limit(1).get()
  if (snap.empty) return null
  const doc = snap.docs[0]
  return { id: doc.id, ...doc.data() } as any
}

async function getDefaultAccount(userId: string) {
  const snap = await db.collection('accounts').where('owner_user_id', '==', userId).limit(1).get()
  if (snap.empty) return null
  const doc = snap.docs[0]
  return { id: doc.id, ...doc.data() } as any
}

async function findCategory(name: string, type: 'gasto' | 'ingreso' | 'reserva') {
  const snap = await db.collection('categories').where('type', '==', type).get()
  const cats = snap.docs.map(d => ({ id: d.id, ...d.data() } as any))
  // Buscar por coincidencia parcial (case-insensitive)
  const match = cats.find((c: any) => c.name.toLowerCase().includes(name.toLowerCase()))
  return match || cats[0] || null
}

async function registrarMovimiento(
  chatId: number,
  txType: 'gasto' | 'ingreso',
  catType: 'gasto' | 'ingreso' | 'reserva',
  amount: number,
  catName: string,
  description: string | null
): Promise<string> {
  const user = await getUserByChatId(chatId)
  if (!user) return '❌ No estás vinculado. Enviá /vincular [nombre] [PIN]'

  const account = await getDefaultAccount(user.id)
  if (!account) return '❌ No tenés ninguna cuenta creada en la app.'

  const balance = Number(account.current_balance)
  if (txType === 'gasto' && balance < amount) {
    return `❌ Saldo insuficiente. Tu cuenta <b>${account.name}</b> tiene $${balance.toLocaleString('es-AR')} y el movimiento es por $${amount.toLocaleString('es-AR')}.`
  }

  const category = await findCategory(catName, catType)
  if (!category) return `❌ No encontré una categoría de tipo "${catType}" con ese nombre. Creala desde la app.`

  const amountChange = txType === 'ingreso' ? amount : -amount
  await db.collection('transactions').add({
    type: txType,
    amount,
    currency: 'ARS',
    description: description || null,
    category_id: category.id,
    account_id: account.id,
    user_id: user.id,
    transaction_date: Timestamp.now().toDate().toISOString(),
  })
  await db.collection('accounts').doc(account.id).update({
    current_balance: balance + amountChange,
  })

  const emoji = txType === 'ingreso' ? '📈' : catType === 'reserva' ? '🏦' : '📉'
  const label = catType === 'reserva' ? `Reserva → ${category.name}` : category.name
  return `${emoji} <b>${txType === 'ingreso' ? 'Ingreso' : 'Gasto'} registrado</b>\n💰 $${amount.toLocaleString('es-AR')} ARS\n📂 ${label}${description ? `\n📝 ${description}` : ''}\n🏦 Cuenta: ${account.name} → Saldo: $${(balance + amountChange).toLocaleString('es-AR')}`
}

function parseAmount(str: string): number | null {
  const cleaned = str.replace(/\./g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return isNaN(n) || n <= 0 ? null : n
}

const AYUDA = `<b>Comandos disponibles:</b>

/gasto [monto] [categoría] [descripción]
  Ej: <code>/gasto 5000 comida almuerzo</code>

/ingreso [monto] [categoría] [descripción]
  Ej: <code>/ingreso 200000 sueldo mayo</code>

/reserva [monto] [fondo] [descripción]
  Ej: <code>/reserva 10000 emergencia</code>

/retirar [monto] [fondo] [motivo]
  Ej: <code>/retirar 5000 emergencia pago médico</code>

/saldo — Ver saldo de tus cuentas

/vincular [nombre] [PIN] — Vincular tu cuenta
  Ej: <code>/vincular Martín 1234</code>`

export const telegramWebhook = onRequest(
  { region: 'us-central1' },
  async (req, res) => {
    res.sendStatus(200) // Telegram requiere respuesta inmediata

    const { message } = req.body
    if (!message?.text) return

    const chatId: number = message.chat.id
    const text: string = message.text.trim()
    const parts = text.split(/\s+/)
    const cmd = parts[0].toLowerCase()

    if (cmd === '/start' || cmd === '/ayuda' || cmd === '/help') {
      await sendMessage(chatId, AYUDA)
      return
    }

    if (cmd === '/vincular') {
      if (parts.length < 3) {
        await sendMessage(chatId, '❌ Formato: /vincular [nombre] [PIN]\nEj: /vincular Martín 1234')
        return
      }
      const pin = parts[parts.length - 1]
      const nombre = parts.slice(1, -1).join(' ')
      await sendMessage(chatId, await vincularUsuario(chatId, nombre, pin))
      return
    }

    if (cmd === '/saldo') {
      const user = await getUserByChatId(chatId)
      if (!user) { await sendMessage(chatId, '❌ No estás vinculado. Enviá /vincular [nombre] [PIN]'); return }
      const snap = await db.collection('accounts').where('owner_user_id', '==', user.id).get()
      if (snap.empty) { await sendMessage(chatId, '❌ No tenés cuentas creadas en la app.'); return }
      const lines = snap.docs.map(d => {
        const a = d.data()
        return `• <b>${a.name}</b>: $${Number(a.current_balance).toLocaleString('es-AR')} ${a.currency}`
      })
      await sendMessage(chatId, `💳 <b>Tus saldos:</b>\n${lines.join('\n')}`)
      return
    }

    if (cmd === '/gasto' || cmd === '/ingreso' || cmd === '/reserva' || cmd === '/retirar') {
      if (parts.length < 3) {
        await sendMessage(chatId, `❌ Formato: ${cmd} [monto] [categoría] [descripción opcional]`)
        return
      }
      const amount = parseAmount(parts[1])
      if (!amount) { await sendMessage(chatId, '❌ Monto inválido.'); return }

      const catName = parts[2]
      const description = parts.length > 3 ? parts.slice(3).join(' ') : null

      if (cmd === '/gasto') {
        await sendMessage(chatId, await registrarMovimiento(chatId, 'gasto', 'gasto', amount, catName, description))
      } else if (cmd === '/ingreso') {
        await sendMessage(chatId, await registrarMovimiento(chatId, 'ingreso', 'ingreso', amount, catName, description))
      } else if (cmd === '/reserva') {
        await sendMessage(chatId, await registrarMovimiento(chatId, 'gasto', 'reserva', amount, catName, description))
      } else if (cmd === '/retirar') {
        if (!description) { await sendMessage(chatId, '❌ El retiro requiere un motivo. Ej: /retirar 5000 emergencia pago médico'); return }
        await sendMessage(chatId, await registrarMovimiento(chatId, 'ingreso', 'reserva', amount, catName, description))
      }
      return
    }

    await sendMessage(chatId, '❓ No entendí el comando. Enviá /ayuda para ver los disponibles.')
  }
)
