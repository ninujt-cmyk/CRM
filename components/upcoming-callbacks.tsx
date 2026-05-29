// components/quick-actions.tsx
"use client"

import { Button } from "@/components/ui/button"
import { Phone, Mail } from "lucide-react"

interface QuickActionsProps {
  phone: string
  email?: string | null
  leadId: string
  onCallInitiated: (leadId: string) => void
}

export function QuickActions({ phone, email, leadId, onCallInitiated }: QuickActionsProps) {
  const handleCallClick = () => {
    // Trigger the status dialog first
    onCallInitiated(leadId)
    
    // Then initiate the call after a short delay to ensure the dialog opens
    setTimeout(() => {
      window.location.href = `tel:${phone}`
    }, 100)
  }

  return (
    <div className="space-y-3">
      <Button
        variant="outline"
        className="w-full justify-start bg-transparent"
        onClick={handleCallClick}
      >
        <Phone className="h-4 w-4 mr-2" />
        Call {phone}
      </Button>
      {email && (
        <Button
          variant="outline"
          className="w-full justify-start bg-transparent"
          onClick={() => window.open(`mailto:${email}`)}
        >
          <Mail className="h-4 w-4 mr-2" />
          Email {email}
        </Button>
      )}
    </div>
  )
}
