// components/global-quick-actions.tsx
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Phone, MessageSquare, Mail, Plus } from "lucide-react"
import { useRouter } from "next/navigation"

export function GlobalQuickActions() {
  const router = useRouter()

  const actions = [
    { 
      icon: Phone, 
      label: "Make Call", 
      action: () => window.open('tel:'),
      variant: "outline" as const
    },
    { 
      icon: MessageSquare, 
      label: "Send Bulk SMS", 
      action: () => router.push("/bulk-sms"),
      variant: "outline" as const
    },
    { 
      icon: Mail, 
      label: "Send Bulk Email", 
      action: () => router.push("/bulk-email"),
      variant: "outline" as const
    },
    { 
      icon: Plus, 
      label: "Add New Lead", 
      action: () => router.push("/leads/new"),
      variant: "default" as const
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2">
        {actions.map((action, index) => (
          <Button
            key={index}
            variant={action.variant}
            className="flex flex-col h-16"
            onClick={action.action}
          >
            <action.icon className="h-4 w-4 mb-1" />
            <span className="text-xs">{action.label}</span>
          </Button>
        ))}
      </CardContent>
    </Card>
  )
}
