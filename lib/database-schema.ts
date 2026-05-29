// Database schema definitions for attendance system

export interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
  department?: string;
  position?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AttendanceRecord {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  check_in: string | null; // ISO timestamp
  check_out: string | null; // ISO timestamp
  scheduled_check_in: string | null; // ISO timestamp
  scheduled_check_out: string | null; // ISO timestamp
  total_hours: string | null; // HH:MM format
  overtime_hours: string | null; // HH:MM format
  break_hours: string | null; // HH:MM format
  status: 'present' | 'absent' | 'late' | 'half-day' | 'leave' | 'holiday';
  location_check_in?: {
    latitude: number;
    longitude: number;
    address?: string;
  } | null;
  location_check_out?: {
    latitude: number;
    longitude: number;
    address?: string;
  } | null;
  ip_check_in?: string | null;
  ip_check_out?: string | null;
  device_info_check_in?: string | null;
  device_info_check_out?: string | null;
  notes: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BreakRecord {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  break_type: string; // 'lunch', 'tea', 'personal', etc.
  start_time: string; // ISO timestamp
  end_time: string | null; // ISO timestamp
  duration_minutes: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeaveRecord {
  id: string;
  user_id: string;
  leave_type: 'paid' | 'unpaid' | 'sick' | 'casual' | 'maternity' | 'paternity';
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  approved_by?: string | null;
  approved_at?: string | null;
  rejection_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Holiday {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  type: 'public' | 'company';
  description?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttendanceAdjustment {
  id: string;
  attendance_id: string;
  adjusted_by: string;
  reason: string;
  previous_data: any;
  new_data: any;
  created_at: string;
}

export interface AttendanceSettings {
  id: string;
  office_location?: {
    latitude: number;
    longitude: number;
    radius_meters: number; // Geofencing radius
  } | null;
  allowed_ips?: string[] | null;
  work_hours_start: string; // HH:MM format
  work_hours_end: string; // HH:MM format
  lunch_break_duration: number; // minutes
  auto_checkout_enabled: boolean;
  auto_checkout_time: string; // HH:MM format
  created_at: string;
  updated_at: string;
}