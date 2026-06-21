import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, '..', 'firebase-service-account.json'), 'utf8')
)

initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en el entorno.')
  process.exit(1)
}

async function fetchTable(table) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    }
  })
  if (!res.ok) throw new Error(`Error fetching "${table}": HTTP ${res.status}`)
  return res.json()
}

async function migrateTable(tableName) {
  console.log(`  Leyendo "${tableName}" de Supabase...`)
  const rows = await fetchTable(tableName)

  if (rows.length === 0) {
    console.log(`  ⚠️  "${tableName}" está vacío — sin cambios.`)
    return
  }

  const BATCH_SIZE = 400
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE)
    const batch = db.batch()
    for (const row of chunk) {
      const { id, ...data } = row
      batch.set(db.collection(tableName).doc(String(id)), data)
    }
    await batch.commit()
  }

  console.log(`  ✓ ${rows.length} registros migrados a Firestore.`)
}

async function main() {
  console.log('🚀 Iniciando migración Supabase → Firebase Firestore...\n')
  for (const table of ['users', 'accounts', 'categories', 'transactions']) {
    console.log(`\n[${table}]`)
    await migrateTable(table)
  }
  console.log('\n✅ Migración completa. Verificá los datos en Firebase Console.')
}

main().catch(err => {
  console.error('\n❌ Error durante la migración:', err.message)
  process.exit(1)
})
