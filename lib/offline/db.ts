// IndexedDB wrapper for offline storage
export interface OfflineLead {
  id: string
  data: any
  timestamp: number
  synced: boolean
}

export interface OfflineNote {
  id: string
  leadId: string
  data: any
  timestamp: number
  synced: boolean
}

export interface OfflineCallLog {
  id: string
  leadId: string
  data: any
  timestamp: number
  synced: boolean
}

class OfflineDB {
  private db: IDBDatabase | null = null
  private readonly dbName = "HanvaCRM"
  private readonly version = 3 // Bumped version again for new approach

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        const oldVersion = event.oldVersion

        // Create or upgrade object stores
        if (!db.objectStoreNames.contains("leads") || oldVersion < 1) {
          if (db.objectStoreNames.contains("leads")) {
            db.deleteObjectStore("leads")
          }
          const leadsStore = db.createObjectStore("leads", { keyPath: "id" })
          leadsStore.createIndex("synced", "synced", { unique: false })
          leadsStore.createIndex("timestamp", "timestamp", { unique: false })
        }

        if (!db.objectStoreNames.contains("notes") || oldVersion < 1) {
          if (db.objectStoreNames.contains("notes")) {
            db.deleteObjectStore("notes")
          }
          const notesStore = db.createObjectStore("notes", { keyPath: "id" })
          notesStore.createIndex("leadId", "leadId", { unique: false })
          notesStore.createIndex("synced", "synced", { unique: false })
        }

        if (!db.objectStoreNames.contains("callLogs") || oldVersion < 1) {
          if (db.objectStoreNames.contains("callLogs")) {
            db.deleteObjectStore("callLogs")
          }
          const callLogsStore = db.createObjectStore("callLogs", { keyPath: "id" })
          callLogsStore.createIndex("leadId", "leadId", { unique: false })
          callLogsStore.createIndex("synced", "synced", { unique: false })
        }

        if (!db.objectStoreNames.contains("settings") || oldVersion < 1) {
          if (db.objectStoreNames.contains("settings")) {
            db.deleteObjectStore("settings")
          }
          db.createObjectStore("settings", { keyPath: "key" })
        }
      }
    })
  }

  // Ensure database is initialized
  private async ensureInit(): Promise<void> {
    if (!this.db) {
      await this.init()
    }
  }

  // Safe method to get unsynced items using getAll and manual filtering
  private async getUnsyncedItemsSafe<T>(storeName: string): Promise<T[]> {
    await this.ensureInit()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], "readonly")
      const store = transaction.objectStore(storeName)
      const request = store.getAll()

      request.onsuccess = () => {
        const allItems: T[] = request.result
        const unsyncedItems = allItems.filter((item: any) => item.synced === false)
        resolve(unsyncedItems)
      }
      
      request.onerror = () => reject(request.error)
    })
  }

  // Leads operations
  async addLead(lead: OfflineLead): Promise<void> {
    await this.ensureInit()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["leads"], "readwrite")
      const store = transaction.objectStore("leads")
      const request = store.add(lead)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getUnsyncedLeads(): Promise<OfflineLead[]> {
    return this.getUnsyncedItemsSafe<OfflineLead>("leads")
  }

  async markLeadSynced(id: string): Promise<void> {
    await this.ensureInit()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["leads"], "readwrite")
      const store = transaction.objectStore("leads")
      const getRequest = store.get(id)

      getRequest.onsuccess = () => {
        const lead = getRequest.result
        if (lead) {
          lead.synced = true
          const putRequest = store.put(lead)
          putRequest.onsuccess = () => resolve()
          putRequest.onerror = () => reject(putRequest.error)
        } else {
          resolve()
        }
      }
      getRequest.onerror = () => reject(getRequest.error)
    })
  }

  async getLead(id: string): Promise<OfflineLead | null> {
    await this.ensureInit()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["leads"], "readonly")
      const store = transaction.objectStore("leads")
      const request = store.get(id)

      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }

  // Notes operations
  async addNote(note: OfflineNote): Promise<void> {
    await this.ensureInit()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["notes"], "readwrite")
      const store = transaction.objectStore("notes")
      const request = store.add(note)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getUnsyncedNotes(): Promise<OfflineNote[]> {
    return this.getUnsyncedItemsSafe<OfflineNote>("notes")
  }

  async markNoteSynced(id: string): Promise<void> {
    await this.ensureInit()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["notes"], "readwrite")
      const store = transaction.objectStore("notes")
      const getRequest = store.get(id)

      getRequest.onsuccess = () => {
        const note = getRequest.result
        if (note) {
          note.synced = true
          const putRequest = store.put(note)
          putRequest.onsuccess = () => resolve()
          putRequest.onerror = () => reject(putRequest.error)
        } else {
          resolve()
        }
      }
      getRequest.onerror = () => reject(getRequest.error)
    })
  }

  async getNote(id: string): Promise<OfflineNote | null> {
    await this.ensureInit()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["notes"], "readonly")
      const store = transaction.objectStore("notes")
      const request = store.get(id)

      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }

  // Call logs operations
  async addCallLog(callLog: OfflineCallLog): Promise<void> {
    await this.ensureInit()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["callLogs"], "readwrite")
      const store = transaction.objectStore("callLogs")
      const request = store.add(callLog)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getUnsyncedCallLogs(): Promise<OfflineCallLog[]> {
    return this.getUnsyncedItemsSafe<OfflineCallLog>("callLogs")
  }

  async markCallLogSynced(id: string): Promise<void> {
    await this.ensureInit()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["callLogs"], "readwrite")
      const store = transaction.objectStore("callLogs")
      const getRequest = store.get(id)

      getRequest.onsuccess = () => {
        const callLog = getRequest.result
        if (callLog) {
          callLog.synced = true
          const putRequest = store.put(callLog)
          putRequest.onsuccess = () => resolve()
          putRequest.onerror = () => reject(putRequest.error)
        } else {
          resolve()
        }
      }
      getRequest.onerror = () => reject(getRequest.error)
    })
  }

  async getCallLog(id: string): Promise<OfflineCallLog | null> {
    await this.ensureInit()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["callLogs"], "readonly")
      const store = transaction.objectStore("callLogs")
      const request = store.get(id)

      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }

  // Settings operations
  async setSetting(key: string, value: any): Promise<void> {
    await this.ensureInit()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["settings"], "readwrite")
      const store = transaction.objectStore("settings")
      const request = store.put({ key, value })

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getSetting(key: string): Promise<any> {
    await this.ensureInit()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["settings"], "readonly")
      const store = transaction.objectStore("settings")
      const request = store.get(key)

      request.onsuccess = () => resolve(request.result?.value || null)
      request.onerror = () => reject(request.error)
    })
  }

  // Clear all data
  async clearAll(): Promise<void> {
    await this.ensureInit()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["leads", "notes", "callLogs", "settings"], "readwrite")
      
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)

      transaction.objectStore("leads").clear()
      transaction.objectStore("notes").clear()
      transaction.objectStore("callLogs").clear()
      transaction.objectStore("settings").clear()
    })
  }

  // Get total count of items (for debugging)
  async getTotalCount(storeName: string): Promise<number> {
    await this.ensureInit()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], "readonly")
      const store = transaction.objectStore(storeName)
      const request = store.count()

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }
}

export const offlineDB = new OfflineDB()
