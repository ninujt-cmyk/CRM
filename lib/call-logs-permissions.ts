// lib/call-logs-permissions.ts
import { createClient } from "@/lib/supabase/client"

export interface CallLogPermissions {
  canView: boolean
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
  canExport: boolean
}

export class CallLogsPermissionManager {
  private supabase = createClient()

  async checkPermissions(callLogId?: string): Promise<CallLogPermissions> {
    try {
      const {
        data: { user },
      } = await this.supabase.auth.getUser()

      if (!user) {
        return this.getDefaultPermissions()
      }

      // Get user role and details
      const { data: userData } = await this.supabase
        .from("users")
        .select("role, team_id, department")
        .eq("id", user.id)
        .single()

      if (!userData) {
        return this.getDefaultPermissions()
      }

      const permissions: CallLogPermissions = {
        canView: true, // Basic view permission for authenticated users
        canCreate: true, // Users can create call logs for their leads
        canUpdate: false,
        canDelete: false,
        canExport: false,
      }

      // Role-based permissions
      switch (userData.role) {
        case "admin":
          permissions.canUpdate = true
          permissions.canDelete = true
          permissions.canExport = true
          break

        case "manager":
          permissions.canUpdate = true
          permissions.canExport = true
          break

        case "team_lead":
          permissions.canUpdate = true
          permissions.canExport = true
          break

        case "telecaller":
          // Telecallers can update their own call logs
          if (callLogId) {
            const canUpdate = await this.canUpdateCallLog(callLogId, user.id)
            permissions.canUpdate = canUpdate
          }
          break
      }

      return permissions
    } catch (error) {
      console.error("Error checking call log permissions:", error)
      return this.getDefaultPermissions()
    }
  }

  private async canUpdateCallLog(callLogId: string, userId: string): Promise<boolean> {
    try {
      const { data } = await this.supabase
        .from("call_logs")
        .select("user_id")
        .eq("id", callLogId)
        .eq("user_id", userId)
        .single()

      return !!data
    } catch {
      return false
    }
  }

  private getDefaultPermissions(): CallLogPermissions {
    return {
      canView: false,
      canCreate: false,
      canUpdate: false,
      canDelete: false,
      canExport: false,
    }
  }

  async validateCallLogAccess(leadId: string): Promise<boolean> {
    try {
      const {
        data: { user },
      } = await this.supabase.auth.getUser()

      if (!user) return false

      // Check if user has access to the lead
      const { data } = await this.supabase.from("leads").select("assigned_to").eq("id", leadId).single()

      if (!data) return false

      // User can access if lead is assigned to them
      if (data.assigned_to === user.id) return true

      // Check if user is admin/manager
      const { data: userData } = await this.supabase.from("users").select("role").eq("id", user.id).single()

      return userData?.role === "admin" || userData?.role === "manager"
    } catch {
      return false
    }
  }
}

export const callLogsPermissions = new CallLogsPermissionManager()
