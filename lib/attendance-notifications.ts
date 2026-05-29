import { createClient } from "./supabase/client";
import { format } from "date-fns";

export class AttendanceNotificationService {
  private static instance: AttendanceNotificationService;

  private constructor() {}

  static getInstance(): AttendanceNotificationService {
    if (!AttendanceNotificationService.instance) {
      AttendanceNotificationService.instance = new AttendanceNotificationService();
    }
    return AttendanceNotificationService.instance;
  }

  // Send notification to a specific user
  async sendNotification(
    userId: string,
    title: string,
    message: string,
    type: 'late_checkin' | 'early_checkout' | 'missed_punch' | 'absenteeism' | 'reminder' | 'adjustment'
  ) {
    const supabase = createClient();
    
    const { error } = await supabase
      .from("notifications")
      .insert({
        user_id: userId,
        title,
        message,
        type,
        read: false,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error("Failed to send notification:", error);
      throw error;
    }
  }

  // Send bulk notifications to multiple users
  async sendBulkNotifications(
    userIds: string[],
    title: string,
    message: string,
    type: string
  ) {
    const notifications = userIds.map(userId => ({
      user_id: userId,
      title,
      message,
      type,
      read: false,
      created_at: new Date().toISOString()
    }));

    const supabase = createClient();
    
    const { error } = await supabase
      .from("notifications")
      .insert(notifications);

    if (error) {
      console.error("Failed to send bulk notifications:", error);
      throw error;
    }
  }

  // Send late check-in alert
  async sendLateCheckInAlert(userId: string, checkInTime: string, scheduledTime: string) {
    const title = "Late Check-in Alert";
    const message = `You checked in at ${format(new Date(checkInTime), "hh:mm a")} which is later than the scheduled time of ${format(new Date(scheduledTime), "hh:mm a")}.`;
    
    await this.sendNotification(userId, title, message, 'late_checkin');
  }

  // Send early check-out alert
  async sendEarlyCheckOutAlert(userId: string, checkOutTime: string, scheduledTime: string) {
    const title = "Early Check-out Alert";
    const message = `You checked out at ${format(new Date(checkOutTime), "hh:mm a")} which is earlier than the scheduled time of ${format(new Date(scheduledTime), "hh:mm a")}.`;
    
    await this.sendNotification(userId, title, message, 'early_checkout');
  }

  // Send missed punch alert
  async sendMissedPunchAlert(userId: string, date: string) {
    const title = "Missed Punch Alert";
    const message = `You missed checking in/out on ${format(new Date(date), "MMM dd, yyyy")}. Please regularize your attendance.`;
    
    await this.sendNotification(userId, title, message, 'missed_punch');
  }

  // Send absenteeism alert
  async sendAbsenteeismAlert(userId: string, consecutiveDays: number) {
    const title = "Absenteeism Alert";
    const message = `You have been absent for ${consecutiveDays} consecutive days. Please contact HR if there are any issues.`;
    
    await this.sendNotification(userId, title, message, 'absenteeism');
  }

  // Send attendance reminder
  async sendAttendanceReminder(userId: string) {
    const title = "Attendance Reminder";
    const message = "Don't forget to mark your attendance for today.";
    
    await this.sendNotification(userId, title, message, 'reminder');
  }

  // Send adjustment notification to admin
  async sendAdjustmentNotification(adminId: string, employeeName: string, date: string, reason: string) {
    const title = "Attendance Adjustment Made";
    const message = `${employeeName}'s attendance for ${format(new Date(date), "MMM dd, yyyy")} has been adjusted. Reason: ${reason}`;
    
    await this.sendNotification(adminId, title, message, 'adjustment');
  }

  // Get unread notifications for a user
  async getUnreadNotifications(userId: string) {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .eq("read", false)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch notifications:", error);
      throw error;
    }

    return data || [];
  }

  // Mark notification as read
  async markAsRead(notificationId: string) {
    const supabase = createClient();
    
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", notificationId);

    if (error) {
      console.error("Failed to mark notification as read:", error);
      throw error;
    }
  }

  // Mark all notifications as read for a user
  async markAllAsRead(userId: string) {
    const supabase = createClient();
    
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId);

    if (error) {
      console.error("Failed to mark all notifications as read:", error);
      throw error;
    }
  }
}

export const attendanceNotificationService = AttendanceNotificationService.getInstance();