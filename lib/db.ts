import { openDB, type DBSchema } from "idb"

export interface Collection {
  id: string
  name: string
  words: string[]
  wordIds: string[]
  wordRecorded: boolean[]
  createdAt: Date
  translatedWords: string[] | null
}

export interface Timestamp {
  wordId: string
  word: string
  startMs: number
  endMs: number
  recordedWord: string
}

export interface Recording {
  id: string
  collectionId: string
  createdAt: Date
  durationMs: number
  size: number
  mimeType: string
  blob: Blob
  timestamps: { word: string; wordId: string; startMs: number; endMs: number; recordedWord: string }[]
}

interface DB extends DBSchema {
  collections: {
    key: string
    value: Collection
    indexes: { "by-createdAt": Date }
  }
  recordings: {
    key: string
    value: Recording
    indexes: { "by-collectionId": string; "by-createdAt": Date }
  }
}

const DB_NAME = "recorder-db"

function openRecorderDb() {
  return openDB<DB>(DB_NAME, 4, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("collections")) {
        const collStore = db.createObjectStore("collections", { keyPath: "id" })
        collStore.createIndex("by-createdAt", "createdAt")
      }
      if (!db.objectStoreNames.contains("recordings")) {
        const recStore = db.createObjectStore("recordings", { keyPath: "id" })
        recStore.createIndex("by-collectionId", "collectionId")
        recStore.createIndex("by-createdAt", "createdAt")
      }
    },
  })
}

export async function getCollections() {
  try {
    const db = await openRecorderDb()
    const collections = await db.getAll("collections")
    return collections.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  } catch (error) {
    throw error
  }
}

export async function addCollection(collection: Collection) {
  try {
    const db = await openRecorderDb()
    await db.add("collections", collection)
  } catch (error) {
    throw error
  }
}

export async function updateCollection(collection: Collection) {
  try {
    const db = await openRecorderDb()
    await db.put("collections", collection)
  } catch (error) {
    throw error
  }
}

export async function removeCollection(collectionId: string) {
  try {
    const db = await openRecorderDb()
    await db.delete("collections", collectionId)

    // Also delete all recordings in this collection
    const tx = db.transaction("recordings", "readwrite")
    const recStore = tx.objectStore("recordings")
    const index = recStore.index("by-collectionId")
    const recordings = await index.getAll(collectionId)
    for (const rec of recordings) {
      await recStore.delete(rec.id)
    }
    await tx.done
  } catch (error) {
    throw error
  }
}

export async function getRecordings(collectionId: string) {
  try {
    const db = await openRecorderDb()
    const tx = db.transaction("recordings", "readonly")
    const index = tx.store.index("by-collectionId")
    const recordings = await index.getAll(collectionId)
    return recordings.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  } catch (error) {
    throw error
  }
}

export async function addRecording(recording: Recording) {
  try {
    const db = await openRecorderDb()
    await db.add("recordings", recording)
  } catch (error) {
    throw error
  }
}

export async function removeRecording(recordingId: string) {
  try {
    const db = await openRecorderDb()
    await db.delete("recordings", recordingId)
  } catch (error) {
    throw error
  }
}
