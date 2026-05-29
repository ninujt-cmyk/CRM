"use client";

import { useState } from "react";
import { useNotifications } from "@/hooks/use-notifications";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, BellOff, CheckCircle, XCircle } from "lucide-react";

export function NotificationSettings() {
  const { requestPermission, isPermissionGranted, isSupported } = useNotifications();
  const [isLoading, setIsLoading] = useState(false);

  const handlePermissionRequest = async () => {
    setIsLoading(true);
    try {
      await requestPermission();
    } finally {
      setIsLoading(false);
    }
  };

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff className="h-5 w-5" />
            Notifications Not Supported
          </CardTitle>
          <CardDescription>
            Your browser does not support notifications.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notification Settings
        </CardTitle>
        <CardDescription>
          Manage how you receive notifications and reminders
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="browser-notifications">Browser Notifications</Label>
            <p className="text-sm text-muted-foreground">
              Receive desktop notifications for reminders and updates
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isPermissionGranted ? (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm">Enabled</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-orange-600">
                <XCircle className="h-4 w-4" />
                <span className="text-sm">Disabled</span>
              </div>
            )}
            <Button
              variant={isPermissionGranted ? "outline" : "default"}
              size="sm"
              onClick={handlePermissionRequest}
              disabled={isLoading}
            >
              {isPermissionGranted ? "Change Settings" : "Enable Notifications"}
            </Button>
          </div>
        </div>

        <div className="space-y-3 pt-4 border-t">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="followup-reminders">Follow-up Reminders</Label>
              <p className="text-sm text-muted-foreground">
                Get notified before scheduled callbacks
              </p>
            </div>
            <Switch id="followup-reminders" defaultChecked />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="overdue-alerts">Overdue Alerts</Label>
              <p className="text-sm text-muted-foreground">
                Notifications for missed follow-ups
              </p>
            </div>
            <Switch id="overdue-alerts" defaultChecked />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="attendance-notifications">Attendance Updates</Label>
              <p className="text-sm text-muted-foreground">
                Notifications for check-in/check-out
              </p>
            </div>
            <Switch id="attendance-notifications" defaultChecked />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
