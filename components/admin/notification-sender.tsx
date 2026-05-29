"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Send, Bell } from "lucide-react"
import { toast } from "sonner"

export function NotificationSender() {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: "",
    body: "",
    url: "",
    userId: "all", // Updated default value to be a non-empty string
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch("/api/notifications/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: formData.title,
          body: formData.body,
          url: formData.url || "/",
          userId: formData.userId === "all" ? null : formData.userId,
        }),
      })

      const result = await response.json()

      if (response.ok) {
        toast.success(result.message || "Notifications sent successfully!")
        setFormData({ title: "", body: "", url: "", userId: "all" }) // Reset userId to default value
      } else {
        toast.error(result.error || "Failed to send notifications")
      }
    } catch (error) {
      console.error("Error sending notifications:", error)
      toast.error("Failed to send notifications")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Send Push Notification
        </CardTitle>
        <CardDescription>Send notifications to users who have enabled push notifications</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Notification title"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Message</Label>
            <Textarea
              id="body"
              value={formData.body}
              onChange={(e) => setFormData({ ...formData, body: e.target.value })}
              placeholder="Notification message"
              rows={3}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="url">Action URL (optional)</Label>
            <Input
              id="url"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              placeholder="/telecaller or /admin/leads"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="target">Send To</Label>
            <Select value={formData.userId} onValueChange={(value) => setFormData({ ...formData, userId: value })}>
              <SelectTrigger>
                <SelectValue placeholder="All users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users</SelectItem> {/* Updated value prop */}
                <SelectItem value="specific">Specific user (enter ID below)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.userId === "specific" && (
            <div className="space-y-2">
              <Label htmlFor="userId">User ID</Label>
              <Input
                id="userId"
                value={formData.userId}
                onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                placeholder="Enter user UUID"
              />
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            <Send className="h-4 w-4 mr-2" />
            {loading ? "Sending..." : "Send Notification"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
