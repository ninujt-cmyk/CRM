// components/quick-actions.tsx
"use client"

import { Button } from "@/components/ui/button"
import { Phone, PhoneOutgoing, Mail } from "lucide-react"

interface QuickActionsProps {
  phone: string
  email?: string | null
  leadId: string
  onCallInitiated: (leadId: string) => void
  onC2CCallInitiated?: (leadId: string, phone: string) => void // New prop for C2C
}

export function QuickActions({ phone, email, leadId, onCallInitiated, onC2CCallInitiated }: QuickActionsProps) {
  
  // Standard Tel link behavior
  const handleStandardCallClick = () => {
    onCallInitiated(leadId)
    setTimeout(() => {
      window.location.href = `tel:${phone}`
    }, 100)
  }

  // Cloud Telephony behavior
  const handleC2CCallClick = () => {
    if (onC2CCallInitiated) {
        onC2CCallInitiated(leadId, phone)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {/* 1. Original Phone Number Button (Tel Link) */}
      <Button
        variant="outline"
        size="sm"
        className="justify-start bg-slate-50 border-slate-200 text-slate-700 hover:text-slate-900"
        onClick={handleStandardCallClick}
      >
        <Phone className="h-3.5 w-3.5 mr-2 text-slate-400" />
        {phone}
      </Button>

      {/* 2. New C2C Call Button */}
      <Button
        variant="default"
        size="sm"
        className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm px-3"
        onClick={handleC2CCallClick}
      >
        <PhoneOutgoing className="h-3.5 w-3.5 mr-1.5" />
        Call
      </Button>
    </div>
  )
}
