import { createClient } from "./supabase/client";
import { differenceInMinutes, parseISO, isWithinInterval, addMinutes } from "date-fns";
import { 
  AttendanceRecord, 
  BreakRecord, 
  LeaveRecord, 
  Holiday, 
  AttendanceAdjustment,
  AttendanceSettings 
} from "./database-schema";
import { attendanceNotificationService } from "./attendance-notifications";

export class EnhancedAttendanceService {
  private static instance: EnhancedAttendanceService;

  private constructor() {}

  static getInstance(): EnhancedAttendanceService {
    if (!EnhancedAttendanceService.instance) {
      EnhancedAttendanceService.instance = new EnhancedAttendanceService();
    }
    return EnhancedAttendanceService.instance;
  }

  // Get attendance settings
  async getAttendanceSettings(): Promise<AttendanceSettings | null> {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from("attendance_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    return data || null;
  }

  // Check if user is within office location (geofencing)
  isWithinOfficeLocation(
    userLat: number, 
    userLng: number, 
    officeLat: number, 
    officeLng: number, 
    radiusMeters: number
  ): boolean {
    // Simplified distance calculation (inaccurate for large distances)
    const R = 6371e3; // Earth radius in meters
    const φ1 = officeLat * Math.PI/180;
    const φ2 = userLat * Math.PI/180;
    const Δφ = (userLat-officeLat) * Math.PI/180;
    const Δλ = (userLng-officeLng) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    const distance = R * c;
    return distance <= radiusMeters;
  }

  // Check if IP is allowed
  async isIpAllowed(ip: string): Promise<boolean> {
    const settings = await this.getAttendanceSettings();
    if (!settings?.allowed_ips || settings.allowed_ips.length === 0) {
      return true; // No IP restrictions
    }
    return settings.allowed_ips.includes(ip);
  }

  // Enhanced check-in with location and IP tracking
  async checkIn(
    userId: string, 
    location?: { latitude: number; longitude: number; address?: string },
    ip?: string,
    deviceInfo?: string,
    notes?: string
  ): Promise<AttendanceRecord> {
    const supabase = createClient();
    const now = new Date().toISOString();
    const date = now.split("T")[0];
    
    // Get attendance settings
    const settings = await this.getAttendanceSettings();
    
    // Validate location if required
    if (settings?.office_location) {
      if (!location) {
        throw new Error("Location is required for check-in");
      }
      
      const isWithin = this.isWithinOfficeLocation(
        location.latitude,
        location.longitude,
        settings.office_location.latitude,
        settings.office_location.longitude,
        settings.office_location.radius_meters
      );
      
      if (!isWithin) {
        throw new Error("You are not within the office location for check-in");
      }
    }
    
    // Validate IP if required
    if (ip) {
      const isAllowed = await this.isIpAllowed(ip);
      if (!isAllowed) {
        throw new Error("Your IP address is not allowed for check-in");
      }
    }
    
    // Determine if late
    let status: AttendanceRecord['status'] = 'present';
    let isLate = false;
    if (settings?.work_hours_start) {
      const [hours, minutes] = settings.work_hours_start.split(':').map(Number);
      const scheduledTime = new Date(date);
      scheduledTime.setHours(hours, minutes, 0, 0);
      
      const checkInTime = new Date(now);
      if (checkInTime > scheduledTime) {
        status = 'late';
        isLate = true;
      }
    }
    
    const { data, error } = await supabase
      .from("attendance")
      .upsert(
        {
          user_id: userId,
          date: date,
          check_in: now,
          scheduled_check_in: settings?.work_hours_start 
            ? `${date}T${settings.work_hours_start}:00` 
            : null,
          scheduled_check_out: settings?.work_hours_end 
            ? `${date}T${settings.work_hours_end}:00` 
            : null,
          status: status,
          location_check_in: location,
          ip_check_in: ip,
          device_info_check_in: deviceInfo,
          notes: notes || null,
          updated_at: now,
        },
        {
          onConflict: "user_id, date",
        }
      )
      .select()
      .maybeSingle();

    if (error) throw error;
    
    // Send late check-in notification if applicable
    if (isLate && settings?.work_hours_start) {
      const scheduledTime = `${date}T${settings.work_hours_start}:00`;
      attendanceNotificationService.sendLateCheckInAlert(userId, now, scheduledTime);
    }
    
    return data;
  }

  // Enhanced check-out
  async checkOut(
    userId: string,
    location?: { latitude: number; longitude: number; address?: string },
    ip?: string,
    deviceInfo?: string,
    notes?: string
  ): Promise<AttendanceRecord> {
    const supabase = createClient();
    const now = new Date().toISOString();
    const date = now.split("T")[0];

    // Get today's attendance record
    const { data: attendance } = await supabase
      .from("attendance")
      .select()
      .eq("user_id", userId)
      .eq("date", date)
      .maybeSingle();

    if (!attendance) {
      throw new Error("No check-in record found for today");
    }

    // Calculate total hours
    const checkInTime = new Date(attendance.check_in!);
    const checkOutTime = new Date(now);
    const totalMinutes = differenceInMinutes(checkOutTime, checkInTime);

    // Calculate break time
    let breakMinutes = 0;
    const breakRecords = await this.getBreakRecords(userId, date);
    breakRecords.forEach(record => {
      if (record.end_time) {
        breakMinutes += differenceInMinutes(
          new Date(record.end_time),
          new Date(record.start_time)
        );
      }
    });

    const workingMinutes = totalMinutes - breakMinutes;
    
    // Calculate overtime
    let overtimeMinutes = 0;
    const settings = await this.getAttendanceSettings();
    if (settings?.work_hours_start && settings?.work_hours_end) {
      const [startHours, startMinutes] = settings.work_hours_start.split(':').map(Number);
      const [endHours, endMinutes] = settings.work_hours_end.split(':').map(Number);
      
      const scheduledStart = new Date(date);
      scheduledStart.setHours(startHours, startMinutes, 0, 0);
      
      const scheduledEnd = new Date(date);
      scheduledEnd.setHours(endHours, endMinutes, 0, 0);
      
      const scheduledMinutes = differenceInMinutes(scheduledEnd, scheduledStart);
      overtimeMinutes = Math.max(0, workingMinutes - scheduledMinutes);
      
      // Check if checkout is early
      if (checkOutTime < scheduledEnd) {
        const scheduledTime = `${date}T${settings.work_hours_end}:00`;
        attendanceNotificationService.sendEarlyCheckOutAlert(userId, now, scheduledTime);
      }
    }

    const totalHours = `${Math.floor(workingMinutes / 60)}:${(workingMinutes % 60).toString().padStart(2, "0")}`;
    const overtimeHours = `${Math.floor(overtimeMinutes / 60)}:${(overtimeMinutes % 60).toString().padStart(2, "0")}`;

    const { data, error } = await supabase
      .from("attendance")
      .update({
        check_out: now,
        total_hours: totalHours,
        overtime_hours: overtimeHours,
        break_hours: breakMinutes > 0
          ? `${Math.floor(breakMinutes / 60)}:${(breakMinutes % 60).toString().padStart(2, "0")}`
          : null,
        location_check_out: location,
        ip_check_out: ip,
        device_info_check_out: deviceInfo,
        notes: notes || attendance.notes,
        updated_at: now,
      })
      .eq("id", attendance.id)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  // Start break
  async startBreak(
    userId: string,
    breakType: string,
    notes?: string
  ): Promise<BreakRecord> {
    const supabase = createClient();
    const now = new Date().toISOString();
    const date = now.split("T")[0];

    const { data, error } = await supabase
      .from("breaks")
      .insert({
        user_id: userId,
        date: date,
        break_type: breakType,
        start_time: now,
        notes: notes || null,
        created_at: now,
        updated_at: now,
      })
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  // End break
  async endBreak(breakId: string, notes?: string): Promise<BreakRecord> {
    const supabase = createClient();
    const now = new Date().toISOString();

    // Get the break record
    const { data: breakRecord } = await supabase
      .from("breaks")
      .select()
      .eq("id", breakId)
      .maybeSingle();

    if (!breakRecord) {
      throw new Error("Break record not found");
    }

    const durationMinutes = differenceInMinutes(
      new Date(now),
      new Date(breakRecord.start_time)
    );

    const { data, error } = await supabase
      .from("breaks")
      .update({
        end_time: now,
        duration_minutes: durationMinutes,
        notes: notes || breakRecord.notes,
        updated_at: now,
      })
      .eq("id", breakId)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  // Get break records for a user on a specific date
  async getBreakRecords(userId: string, date: string): Promise<BreakRecord[]> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("breaks")
      .select()
      .eq("user_id", userId)
      .eq("date", date)
      .order("start_time", { ascending: true });

    if (error) throw error;
    return data || [];
  }

  // Get today's attendance
  async getTodayAttendance(userId: string): Promise<AttendanceRecord | null> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("attendance")
      .select()
      .eq("user_id", userId)
      .eq("date", new Date().toISOString().split("T")[0])
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    return data;
  }

  // Get attendance history
  async getAttendanceHistory(
    userId: string, 
    startDate: string, 
    endDate: string
  ): Promise<AttendanceRecord[]> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("attendance")
      .select()
      .eq("user_id", userId)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // Get team attendance for a specific date
  async getTeamAttendance(date: string): Promise<any[]> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("attendance")
      .select(`
        *,
        user:users!attendance_user_id_fkey(full_name, email, role, department)
      `)
      .eq("date", date)
      .order("check_in", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // Get leave records for a user
  async getLeaveRecords(userId: string): Promise<LeaveRecord[]> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("leaves")
      .select()
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // Apply for leave
  async applyForLeave(
    userId: string,
    leaveType: LeaveRecord['leave_type'],
    startDate: string,
    endDate: string,
    reason: string
  ): Promise<LeaveRecord> {
    const supabase = createClient();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("leaves")
      .insert({
        user_id: userId,
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        reason: reason,
        status: 'pending',
        created_at: now,
        updated_at: now,
      })
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  // Get holidays
  async getHolidays(year: number): Promise<Holiday[]> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("holidays")
      .select()
      .gte("date", `${year}-01-01`)
      .lte("date", `${year}-12-31`)
      .order("date", { ascending: true });

    if (error) throw error;
    return data || [];
  }

  // Get attendance statistics
  async getAttendanceStats(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<{
    present: number;
    absent: number;
    late: number;
    halfDay: number;
    leave: number;
    overtimeHours: number;
  }> {
    const attendanceRecords = await this.getAttendanceHistory(userId, startDate, endDate);
    
    let present = 0;
    let absent = 0;
    let late = 0;
    let halfDay = 0;
    let leave = 0;
    let overtimeHours = 0;

    attendanceRecords.forEach(record => {
      switch (record.status) {
        case 'present':
          present++;
          break;
        case 'absent':
          absent++;
          break;
        case 'late':
          late++;
          present++; // Late is still present
          break;
        case 'half-day':
          halfDay++;
          break;
        case 'leave':
          leave++;
          break;
      }
      
      if (record.overtime_hours) {
        const [hours, minutes] = record.overtime_hours.split(':').map(Number);
        overtimeHours += hours + (minutes / 60);
      }
    });

    return {
      present,
      absent,
      late,
      halfDay,
      leave,
      overtimeHours
    };
  }

  // Manual attendance adjustment (admin only)
  async adjustAttendance(
    adminId: string,
    attendanceId: string,
    newData: Partial<AttendanceRecord>,
    reason: string
  ): Promise<AttendanceRecord> {
    const supabase = createClient();
    
    // Get the current attendance record
    const { data: currentRecord, error: fetchError } = await supabase
      .from("attendance")
      .select()
      .eq("id", attendanceId)
      .maybeSingle();
    
    if (fetchError) throw fetchError;
    if (!currentRecord) {
      throw new Error("Attendance record not found");
    }
    
    // Save adjustment to audit trail
    const now = new Date().toISOString();
    const { error: auditError } = await supabase.from("attendance_adjustments").insert({
      attendance_id: attendanceId,
      adjusted_by: adminId,
      reason: reason,
      previous_data: currentRecord,
      new_data: { ...currentRecord, ...newData },
      created_at: now
    });
    
    if (auditError) throw auditError;
    
    // Update the attendance record
    const { data, error: updateError } = await supabase
      .from("attendance")
      .update({
        ...newData,
        updated_at: now
      })
      .eq("id", attendanceId)
      .select()
      .maybeSingle();
    
    if (updateError) throw updateError;
    
    // Send adjustment notification to the employee
    attendanceNotificationService.sendAdjustmentNotification(
      adminId, 
      currentRecord.user_id, 
      currentRecord.date, 
      reason
    );
    
    return data;
  }

  // Get attendance adjustments for a record
  async getAttendanceAdjustments(attendanceId: string): Promise<AttendanceAdjustment[]> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("attendance_adjustments")
      .select(`
        *,
        adjusted_by_user:users(full_name, email)
      `)
      .eq("attendance_id", attendanceId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // Export attendance data
  async exportAttendanceData(
    userIds: string[],
    startDate: string,
    endDate: string
  ): Promise<any[]> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("attendance")
      .select(`
        *,
        user:users(full_name, email, role, department),
        breaks:breaks(*)
      `)
      .in("user_id", userIds)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // Get currently clocked-in users
  async getClockedInUsers(): Promise<any[]> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("attendance")
      .select(`
        *,
        user:users(full_name, email, role, department)
      `)
      .neq("check_in", null)
      .is("check_out", null)
      .order("check_in", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // Get users on break
  async getUsersOnBreak(): Promise<any[]> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("breaks")
      .select(`
        *,
        user:users(full_name, email, role, department),
        attendance:attendance(date)
      `)
      .is("end_time", null)
      .order("start_time", { ascending: false });

    if (error) throw error;
    return data || [];
  }
}

export const enhancedAttendanceService = EnhancedAttendanceService.getInstance();
