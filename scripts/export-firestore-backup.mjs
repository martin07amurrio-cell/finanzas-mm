import admin from 'firebase-admin'
import fs from 'node:fs/promises'
import path from 'node:path'

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT
const backupDir = process.env.BACKUP_DIR

if (!serviceAccountPath) throw new Error('Falta FIREBASE_SERVICE_ACCOUNT')
if (!backupDir) throw new Error('Falta BACKUP_DIR')

const serviceAccount = JSON.parse(await fs.readFile(serviceAccountPath, 'utf8'))

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
})

const db = admin.firestore()

function cleanValue(value) {
  if (value === null || value === undefined) return value

  if (Array.isArray(value)) {
    return value.map(cleanValue)
  }

  if (typeof value === 'object') {
    if (typeof value.toDate === 'function') {
      return {
        __type: 'timestamp',
        value: value.toDate().toISOString(),
      }
    }

    if (
      typeof value.latitude === 'number' &&
      typeof value.longitude === 'number'
    ) {
      return {
        __type: 'geopoint',
        latitude: value.latitude,
        longitude: value.longitude,
      }
    }

    if (value.path && value.firestore) {
      return {
        __type: 'reference',
        path: value.path,
      }
    }

    const output = {}
    for (const [key, item] of Object.entries(value)) {
      output[key] = cleanValue(item)
    }
    return output
  }

  return value
}

async function exportCollection(collectionRef) {
  const snapshot = await collectionRef.get()
  const docs = []

  for (const docSnap of snapshot.docs) {
    docs.push({
      id: docSnap.id,
      path: docSnap.ref.path,
      data: cleanValue(docSnap.data()),
    })
  }

  return {
    id: collectionRef.id,
    path: collectionRef.path,
    count: docs.length,
    docs,
  }
}

await fs.mkdir(backupDir, { recursive: true })

const collections = await db.listCollections()
const summary = {
  exported_at: new Date().toISOString(),
  project_id: serviceAccount.project_id,
  collections: [],
}

for (const collectionRef of collections) {
  const exported = await exportCollection(collectionRef)
  const fileName = `${collectionRef.id}.json`

  await fs.writeFile(
    path.join(backupDir, fileName),
    JSON.stringify(exported, null, 2),
    'utf8'
  )

  summary.collections.push({
    id: collectionRef.id,
    path: collectionRef.path,
    count: exported.count,
    file: fileName,
  })
}

await fs.writeFile(
  path.join(backupDir, 'summary.json'),
  JSON.stringify(summary, null, 2),
  'utf8'
)

console.log(JSON.stringify(summary, null, 2))
