// components/lead-notes-dialog.tsx
"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { LeadNotes } from "@/components/lead-notes"

interface LeadNotesDialogProps {
  leadId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LeadNotesDialog({ leadId, open, onOpenChange }: LeadNotesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Lead Notes</DialogTitle>
        </DialogHeader>
        <LeadNotes leadId={leadId} />
      </DialogContent>
    </Dialog>
  )
}
