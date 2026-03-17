// components/notification-permission.tsx
"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

export function NotificationPermission() {
  const [isSupported, setIsSupported] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if notifications are supported
    const supported = "Notification" in window;
    setIsSupported(supported);

    if (!supported) {
      console.log("Notifications not supported in this browser");
      return;
    }

    const requestNotificationPermission = async () => {
      try {
        const permission = await Notification.requestPermission();
        
        if (permission === "granted") {
          console.log("Notification permission granted");
          // Create a welcome notification
          new Notification("Welcome to Hanva CRM", {
            body: "You'll receive notifications for follow-ups and reminders",
            icon: "/icon-192.png",
            tag: "welcome"
          });
        } else if (permission === "denied") {
          console.log("Notification permission denied");
          toast.info("Notifications blocked", {
            description: "Enable notifications in browser settings to receive reminders"
          });
        }
      } catch (error) {
        console.error("Error requesting notification permission:", error);
      }
    };

    // Only request permission if it hasn't been decided yet
    if (Notification.permission === "default") {
      // Request after a short delay to avoid blocking initial render
      const timer = setTimeout(requestNotificationPermission, 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  // Return null safely - this is what was causing the error
  return null;
}
