import { createClient } from "@/lib/supabase/client";
import { addMinutes, isAfter, isBefore } from "date-fns";

export class ReminderService {
  private static instance: ReminderService;
  private checkInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  static getInstance(): ReminderService {
    if (!ReminderService.instance) {
      ReminderService.instance = new ReminderService();
    }
    return ReminderService.instance;
  }

  async start() {
    // Only run in browser environment
    if (typeof window === "undefined") return;

    // Check for due follow-ups every minute
    this.checkInterval = setInterval(() => {
      this.checkDueFollowUps();
    }, 60000); // 1 minute

    // Initial check
    await this.checkDueFollowUps();
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  private async checkDueFollowUps() {
    const supabase = createClient();
    const now = new Date();
    const reminderWindowStart = addMinutes(now, 5); // 5 minutes from now

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Find follow-ups that are due within the next 5 minutes and haven't had reminders sent
      const { data: dueFollowUps, error } = await supabase
        .from("follow_ups")
        .select(`
          id,
          lead_id,
          user_id,
          scheduled_at,
          notes,
          status,
          lead:leads(name, phone),
          user:users(id, email, full_name)
        `)
        .eq("user_id", user.id)
        .eq("status", "pending")
        .lte("scheduled_at", reminderWindowStart.toISOString())
        .gte("scheduled_at", now.toISOString());

      if (error) {
        console.error("Error checking due follow-ups:", error);
        return;
      }

      for (const followUp of dueFollowUps || []) {
        await this.sendReminder(followUp);
      }

      // Check for missed follow-ups (overdue by more than 5 minutes)
      const overdueThreshold = addMinutes(now, -5);
      const { data: missedFollowUps } = await supabase
        .from("follow_ups")
        .select(`
          id,
          lead_id,
          user_id,
          scheduled_at,
          notes,
          status,
          lead:leads(name, phone),
          user:users(id, email, full_name)
        `)
        .eq("user_id", user.id)
        .eq("status", "pending")
        .lt("scheduled_at", overdueThreshold.toISOString());

      for (const followUp of missedFollowUps || []) {
        await this.sendMissedReminder(followUp);
        
        // Update status to cancelled (since it's missed)
        await supabase
          .from("follow_ups")
          .update({ status: "cancelled" })
          .eq("id", followUp.id);
      }
    } catch (error) {
      console.error("Error in reminder service:", error);
    }
  }

  private async sendReminder(followUp: any) {
    // Create browser notification
    if ("Notification" in window && Notification.permission === "granted") {
      const notification = new Notification("Follow-up Reminder", {
        body: `Call ${followUp.lead?.name || "your lead"} at ${followUp.lead?.phone || ""} in 5 minutes`,
        icon: "/icons/icon-192x192.png",
        tag: `follow-up-${followUp.id}`
      });

      // Handle notification click
      notification.onclick = () => {
        // Focus the window
        window.focus();
        // Close the notification
        notification.close();
      };
    }

    // Create in-app notification
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      await supabase.from("notification_history").insert({
        user_id: followUp.user_id,
        type: "follow_up_reminder",
        title: "Upcoming Follow-up",
        message: `Call ${followUp.lead?.name || "your lead"} in 5 minutes`,
        data: {
          follow_up_id: followUp.id,
          lead_id: followUp.lead_id
        }
      });
    }
  }

  private async sendMissedReminder(followUp: any) {
    // Create browser notification for missed follow-up
    if ("Notification" in window && Notification.permission === "granted") {
      const notification = new Notification("Missed Follow-up", {
        body: `You missed a follow-up with ${followUp.lead?.name || "your lead"}`,
        icon: "/icons/icon-192x192.png",
        tag: `missed-${followUp.id}`
      });

      // Handle notification click
      notification.onclick = () => {
        // Focus the window
        window.focus();
        // Close the notification
        notification.close();
      };
    }

    // Create in-app notification
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      await supabase.from("notification_history").insert({
        user_id: followUp.user_id,
        type: "follow_up_missed",
        title: "Missed Follow-up",
        message: `You missed a follow-up with ${followUp.lead?.name || "your lead"}`,
        data: {
          follow_up_id: followUp.id,
          lead_id: followUp.lead_id
        }
      });
    }
  }
}

// Initialize the service
export const reminderService = ReminderService.getInstance();