import { offlineDB, type OfflineLead, type OfflineNote, type OfflineCallLog } from "./db"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

export class OfflineSync {
  private supabase = createClient()
  private isOnline = navigator.onLine
  private syncInProgress = false

  constructor() {
    // Listen for online/offline events
    window.addEventListener("online", this.handleOnline.bind(this))
    window.addEventListener("offline", this.handleOffline.bind(this))

    // Register for background sync if supported
    if ("serviceWorker" in navigator && "sync" in window.ServiceWorkerRegistration.prototype) {
      navigator.serviceWorker.ready.then((registration: any) => {
        // Register background sync
        registration.sync.register("sync-data").catch(console.error)
      })
    }

    // Initial sync check
    this.checkAndSync()
  }

  private handleOnline() {
    this.isOnline = true
    console.log("[Sync] Back online, starting sync...")
    toast.success("Back online! Syncing your data...")
    this.checkAndSync()
  }

  private handleOffline() {
    this.isOnline = false
    console.log("[Sync] Gone offline")
    toast.info("You are now offline. Changes will be saved locally.")
  }

  private async checkAndSync(): Promise<void> {
    if (this.isOnline && !this.syncInProgress) {
      const pendingCount = await this.getPendingSyncCount()
      if (pendingCount > 0) {
        this.syncAll()
      }
    }
  }

  async syncAll(): Promise<void> {
    if (!this.isOnline || this.syncInProgress) {
      return
    }

    this.syncInProgress = true

    try {
      console.log("[Sync] Starting full sync...")

      await Promise.all([this.syncLeads(), this.syncNotes(), this.syncCallLogs()])

      console.log("[Sync] Full sync completed")
      toast.success("All data synced successfully!")
    } catch (error) {
      console.error("[Sync] Sync failed:", error)
      toast.error("Sync failed. Will retry automatically.")
    } finally {
      this.syncInProgress = false
    }
  }

  async syncLeads(): Promise<void> {
    try {
      const unsyncedLeads = await offlineDB.getUnsyncedLeads()
      console.log(`[Sync] Syncing ${unsyncedLeads.length} leads...`)

      for (const lead of unsyncedLeads) {
        try {
          const { error } = await this.supabase.from("leads").insert(lead.data)

          if (!error) {
            await offlineDB.markLeadSynced(lead.id)
            console.log(`[Sync] Lead ${lead.id} synced successfully`)
          } else {
            console.error(`[Sync] Failed to sync lead ${lead.id}:`, error)
          }
        } catch (error) {
          console.error(`[Sync] Error syncing lead ${lead.id}:`, error)
        }
      }
    } catch (error) {
      console.error("[Sync] Error getting unsynced leads:", error)
    }
  }

  async syncNotes(): Promise<void> {
    try {
      const unsyncedNotes = await offlineDB.getUnsyncedNotes()
      console.log(`[Sync] Syncing ${unsyncedNotes.length} notes...`)

      for (const note of unsyncedNotes) {
        try {
          const { error } = await this.supabase.from("notes").insert(note.data)

          if (!error) {
            await offlineDB.markNoteSynced(note.id)
            console.log(`[Sync] Note ${note.id} synced successfully`)
          } else {
            console.error(`[Sync] Failed to sync note ${note.id}:`, error)
          }
        } catch (error) {
          console.error(`[Sync] Error syncing note ${note.id}:`, error)
        }
      }
    } catch (error) {
      console.error("[Sync] Error getting unsynced notes:", error)
    }
  }

  async syncCallLogs(): Promise<void> {
    try {
      const unsyncedCallLogs = await offlineDB.getUnsyncedCallLogs()
      console.log(`[Sync] Syncing ${unsyncedCallLogs.length} call logs...`)

      for (const callLog of unsyncedCallLogs) {
        try {
          const { error } = await this.supabase.from("call_logs").insert(callLog.data)

          if (!error) {
            await offlineDB.markCallLogSynced(callLog.id)
            console.log(`[Sync] Call log ${callLog.id} synced successfully`)
          } else {
            console.error(`[Sync] Failed to sync call log ${callLog.id}:`, error)
          }
        } catch (error) {
          console.error(`[Sync] Error syncing call log ${callLog.id}:`, error)
        }
      }
    } catch (error) {
      console.error("[Sync] Error getting unsynced call logs:", error)
    }
  }

  // Save data offline when network is unavailable
  async saveLeadOffline(leadData: any): Promise<string> {
    const id = `offline_lead_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const offlineLead: OfflineLead = {
      id,
      data: leadData,
      timestamp: Date.now(),
      synced: false,
    }

    await offlineDB.addLead(offlineLead)

    toast.info("Lead saved offline. Will sync when connection is restored.")
    return id
  }

  async saveNoteOffline(noteData: any): Promise<string> {
    const id = `offline_note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const offlineNote: OfflineNote = {
      id,
      leadId: noteData.lead_id,
      data: noteData,
      timestamp: Date.now(),
      synced: false,
    }

    await offlineDB.addNote(offlineNote)

    toast.info("Note saved offline. Will sync when connection is restored.")
    return id
  }

  async saveCallLogOffline(callLogData: any): Promise<string> {
    const id = `offline_call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const offlineCallLog: OfflineCallLog = {
      id,
      leadId: callLogData.lead_id,
      data: callLogData,
      timestamp: Date.now(),
      synced: false,
    }

    await offlineDB.addCallLog(offlineCallLog)

    toast.info("Call log saved offline. Will sync when connection is restored.")
    return id
  }

  // Check if we're online
  get online(): boolean {
    return this.isOnline
  }

  // Get pending sync count
  async getPendingSyncCount(): Promise<number> {
    try {
      const [leads, notes, callLogs] = await Promise.all([
        offlineDB.getUnsyncedLeads(),
        offlineDB.getUnsyncedNotes(),
        offlineDB.getUnsyncedCallLogs(),
      ])

      return leads.length + notes.length + callLogs.length
    } catch (error) {
      console.error("[Sync] Error getting pending sync count:", error)
      return 0
    }
  }
}

export const offlineSync = new OfflineSync()
