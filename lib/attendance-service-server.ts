import { createClient } from "@/lib/supabase/server"

export class AttendanceServiceServer {
  
  static async getTodayAttendance(userId: string) {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from("attendance")
      .select()
      .eq("user_id", userId)
      .eq("date", new Date().toISOString().split('T')[0])
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data;
  }

  static async getTeamAttendance(date: string) {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from("attendance")
      .select(`
        *,
        user:users!attendance_user_id_fkey(full_name, email, role)
      `)
      .eq("date", date)
      .order("check_in", { ascending: false });

    if (error) throw error;
    return data || [];
  }
}
