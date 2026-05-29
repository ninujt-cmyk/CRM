"use client"

interface NotificationAction {
  action: string
  title: string
}

interface NotificationOptions {
  title: string
  body: string
  icon?: string
  tag?: string
  requireInteraction?: boolean
  actions?: NotificationAction[]
}

export class NotificationService {
  private static instance: NotificationService

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService()
    }
    return NotificationService.instance
  }

  // Check if notifications are supported and permitted
  isSupported(): boolean {
    return typeof window !== "undefined" && "Notification" in window
  }

  isPermissionGranted(): boolean {
    return this.isSupported() && Notification.permission === "granted"
  }

  // Show browser notification
  async showBrowserNotification(options: NotificationOptions): Promise<void> {
    console.log("Attempting to show browser notification:", options)
    
    if (!this.isPermissionGranted()) {
      console.warn("Notification permission not granted")
      return
    }

    const { title, body, icon = "/icon-192.png", tag, requireInteraction = false, actions } = options

    const notification = new Notification(title, {
      body,
      icon,
      tag,
      requireInteraction,
      actions,
    } as any)

    // Handle notification click
    notification.onclick = () => {
      if (typeof window !== "undefined") {
        window.focus()
      }
      notification.close()
    }

    // Auto-close after 10 seconds unless requireInteraction is true
    if (!requireInteraction) {
      setTimeout(() => {
        notification.close()
      }, 10000)
    }
  }

  // Show follow-up reminder notification
  async showFollowUpReminder(leadName: string, phone: string, scheduledTime: Date): Promise<void> {
    const formattedTime = scheduledTime.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })

    await this.showBrowserNotification({
      title: "📞 Follow-up Reminder",
      body: `Call ${leadName} (${phone}) at ${formattedTime}`,
      tag: `followup-${leadName}-${scheduledTime.getTime()}`,
      requireInteraction: true,
      actions: [
        {
          action: "call",
          title: "📞 Call Now",
        },
        {
          action: "snooze",
          title: "⏰ Snooze 15min",
        },
      ],
    })
  }

  // Show overdue follow-up notification
  async showOverdueFollowUp(leadName: string, phone: string): Promise<void> {
    await this.showBrowserNotification({
      title: "⚠️ Overdue Follow-up",
      body: `Missed call with ${leadName} (${phone})`,
      tag: `overdue-${leadName}`,
      requireInteraction: true,
      actions: [
        {
          action: "call",
          title: "📞 Call Now",
        },
        {
          action: "reschedule",
          title: "📅 Reschedule",
        },
      ],
    })
  }

  // Show check-in/check-out notification
  async showAttendanceNotification(type: "checkin" | "checkout" | "break-start" | "break-end"): Promise<void> {
    const messages = {
      checkin: { title: "✅ Checked In", body: "You have successfully checked in" },
      checkout: { title: "✅ Checked Out", body: "You have successfully checked out" },
      "break-start": { title: "☕ Break Started", body: "Your break has started" },
      "break-end": { title: "☕ Break Ended", body: "Your break has ended" },
    }

    await this.showBrowserNotification(messages[type])
  }

  // Show general CRM notification
  async showGeneralNotification(title: string, message: string, urgent = false): Promise<void> {
    await this.showBrowserNotification({
      title,
      body: message,
      requireInteraction: urgent,
      tag: `general-${Date.now()}`,
    })
  }

  // Request notification permission with custom messaging
  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) {
      return "denied"
    }

    try {
      return await Notification.requestPermission()
    } catch (error) {
      console.error("Error requesting notification permission:", error)
      return "denied"
    }
  }
}

export const notificationService = NotificationService.getInstance()
