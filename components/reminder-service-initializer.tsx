"use client";

import { useEffect } from "react";
import { reminderService } from "@/lib/reminder-service";

export function ReminderServiceInitializer() {
  useEffect(() => {
    // Initialize reminder service
    reminderService.start();

    // Cleanup on unmount
    return () => {
      reminderService.stop();
    };
  }, []);

  return null;
}