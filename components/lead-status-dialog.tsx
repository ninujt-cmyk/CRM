// components/lead-status-dialog.tsx
"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { LeadStatusUpdater } from "@/components/lead-status-updater"

interface LeadStatusDialogProps {
  leadId: string
  currentStatus: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onStatusUpdate?: (newStatus: string) => void
  title?: string
  description?: string
  isCallInitiated?: boolean // New prop to indicate if this is for a call
  onCallLogged?: (callLogId: string) => void // New prop to notify when call is logged
  
  // ADDED PROPS FOR WHATSAPP FEATURES
  leadPhoneNumber?: string | null 
  telecallerName?: string | null
}

export function LeadStatusDialog({ 
  leadId, 
  currentStatus, 
  open, 
  onOpenChange, 
  onStatusUpdate,
  title = "Update Lead Status",
  description = "Update the status of this lead.",
  isCallInitiated = false,
  onCallLogged,
  leadPhoneNumber, // Destructure new prop
  telecallerName   // Destructure new prop
}: LeadStatusDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <LeadStatusUpdater 
          leadId={leadId} 
          currentStatus={currentStatus} 
          onStatusUpdate={onStatusUpdate}
          isCallInitiated={isCallInitiated}
          onCallLogged={onCallLogged}
          
          // PASS PROPS DOWN TO UPDATER
          leadPhoneNumber={leadPhoneNumber}
          telecallerName={telecallerName}
        />
      </DialogContent>
    </Dialog>
  )
}
