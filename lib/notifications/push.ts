"use client"

export interface PushSubscriptionData {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

export class PushNotificationManager {
  private vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ""

  isAvailable(): boolean {
    return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (typeof window === "undefined" || !("Notification" in window)) {
      throw new Error("This browser does not support notifications")
    }

    if (!("serviceWorker" in navigator)) {
      throw new Error("This browser does not support service workers")
    }

    const permission = await Notification.requestPermission()
    return permission
  }

  async subscribe(): Promise<PushSubscriptionData | null> {
    try {
      if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
        return null
      }

      const registration = await navigator.serviceWorker.ready

      // Check if already subscribed
      const existingSubscription = await registration.pushManager.getSubscription()
      if (existingSubscription) {
        return this.subscriptionToData(existingSubscription)
      }

      // Create new subscription
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey) as any,
      })

      const subscriptionData = this.subscriptionToData(subscription)

      // Send subscription to server
      await this.sendSubscriptionToServer(subscriptionData)

      return subscriptionData
    } catch (error) {
      console.error("Failed to subscribe to push notifications:", error)
      return null
    }
  }

  async unsubscribe(): Promise<boolean> {
    try {
      if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
        return true
      }

      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        const success = await subscription.unsubscribe()
        if (success) {
          // Remove subscription from server
          await this.removeSubscriptionFromServer(this.subscriptionToData(subscription))
        }
        return success
      }

      return true
    } catch (error) {
      console.error("Failed to unsubscribe from push notifications:", error)
      return false
    }
  }

  async getSubscription(): Promise<PushSubscriptionData | null> {
    try {
      if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
        return null
      }

      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      return subscription ? this.subscriptionToData(subscription) : null
    } catch (error) {
      console.error("Failed to get push subscription:", error)
      return null
    }
  }

  private subscriptionToData(subscription: PushSubscription): PushSubscriptionData {
    const keys = subscription.getKey
      ? {
          p256dh: this.arrayBufferToBase64(subscription.getKey("p256dh")!),
          auth: this.arrayBufferToBase64(subscription.getKey("auth")!),
        }
      : { p256dh: "", auth: "" }

    return {
      endpoint: subscription.endpoint,
      keys,
    }
  }

  private async sendSubscriptionToServer(subscription: PushSubscriptionData): Promise<void> {
    try {
      const response = await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(subscription),
      })

      if (!response.ok) {
        throw new Error("Failed to send subscription to server")
      }
    } catch (error) {
      console.error("Error sending subscription to server:", error)
      throw error
    }
  }

  private async removeSubscriptionFromServer(subscription: PushSubscriptionData): Promise<void> {
    try {
      const response = await fetch("/api/notifications/unsubscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(subscription),
      })

      if (!response.ok) {
        throw new Error("Failed to remove subscription from server")
      }
    } catch (error) {
      console.error("Error removing subscription from server:", error)
    }
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")

    if (typeof window === "undefined") {
      throw new Error("Cannot decode base64 on server side")
    }

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ""
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }

    if (typeof window === "undefined") {
      throw new Error("Cannot encode base64 on server side")
    }

    return window.btoa(binary)
  }

  // Show local notification (for testing)
  async showLocalNotification(title: string, options?: NotificationOptions): Promise<void> {
    if (typeof window !== "undefined" && Notification.permission === "granted") {
      new Notification(title, {
        icon: "/icons/icon-192x192.png",
        badge: "/icons/icon-72x72.png",
        ...options,
      })
    }
  }
}

export const pushManager = new PushNotificationManager()

export async function subscribeUser(): Promise<PushSubscriptionData | null> {
  return await pushManager.subscribe()
}

export async function unsubscribeUser(): Promise<boolean> {
  return await pushManager.unsubscribe()
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  return await pushManager.requestPermission()
}

export async function getUserSubscription(): Promise<PushSubscriptionData | null> {
  return await pushManager.getSubscription()
}

export async function showLocalNotification(title: string, options?: NotificationOptions): Promise<void> {
  return await pushManager.showLocalNotification(title, options)
}
