// lib/attendance-permissions.ts
import { createClient } from "@/lib/supabase/client"

export interface AttendancePermissions {
  canViewAll: boolean
  canAdjust: boolean
  canExport: boolean
  canViewAuditTrail: boolean
  canManageSettings: boolean
}

export class AttendancePermissionManager {
  private supabase = createClient()

  async checkPermissions(): Promise<AttendancePermissions> {
    try {
      const {
        data: { user },
      } = await this.supabase.auth.getUser()

      if (!user) {
        return this.getDefaultPermissions()
      }

      // Get user role
      const { data: userData } = await this.supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single()

      if (!userData) {
        return this.getDefaultPermissions()
      }

      const permissions: AttendancePermissions = {
        canViewAll: false,
        canAdjust: false,
        canExport: false,
        canViewAuditTrail: false,
        canManageSettings: false,
      }

      // Role-based permissions
      switch (userData.role) {
        case "admin":
          permissions.canViewAll = true
          permissions.canAdjust = true
          permissions.canExport = true
          permissions.canViewAuditTrail = true
          permissions.canManageSettings = true
          break

        case "telecaller":
          // Telecallers can only view their own attendance
          permissions.canViewAll = false
          permissions.canAdjust = false
          permissions.canExport = false
          permissions.canViewAuditTrail = false
          permissions.canManageSettings = false
          break

        default:
          return this.getDefaultPermissions()
      }

      return permissions
    } catch (error) {
      console.error("Error checking attendance permissions:", error)
      return this.getDefaultPermissions()
    }
  }

  private getDefaultPermissions(): AttendancePermissions {
    return {
      canViewAll: false,
      canAdjust: false,
      canExport: false,
      canViewAuditTrail: false,
      canManageSettings: false,
    }
  }

  // Check if user can view a specific attendance record
  async canViewAttendanceRecord(attendanceUserId: string): Promise<boolean> {
    try {
      const {
        data: { user },
      } = await this.supabase.auth.getUser()

      if (!user) return false

      // User can always view their own attendance
      if (user.id === attendanceUserId) return true

      // Check if user is admin
      const { data: userData } = await this.supabase.from("users").select("role").eq("id", user.id).single()

      // Admins can view all attendance records
      return userData?.role === "admin"
    } catch {
      return false
    }
  }

  // Check if user can adjust a specific attendance record
  async canAdjustAttendanceRecord(attendanceUserId: string): Promise<boolean> {
    try {
      const {
        data: { user },
      } = await this.supabase.auth.getUser()

      if (!user) return false

      // Only admins can adjust attendance records
      const { data: userData } = await this.supabase.from("users").select("role").eq("id", user.id).single()

      return userData?.role === "admin"
    } catch {
      return false
    }
  }

  // Check if user can view audit trail for an attendance record
  async canViewAuditTrail(attendanceId: string): Promise<boolean> {
    try {
      const {
        data: { user },
      } = await this.supabase.auth.getUser()

      if (!user) return false

      // Check if user is admin
      const { data: userData } = await this.supabase.from("users").select("role").eq("id", user.id).single()

      // Only admins can view audit trails
      return userData?.role === "admin"
    } catch {
      return false
    }
  }
}

export const attendancePermissions = new AttendancePermissionManager()