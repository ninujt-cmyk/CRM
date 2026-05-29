// components/simple-status-dialog.tsx
"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface SimpleStatusDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: () => void
  phone: string
}

export function SimpleStatusDialog({ open, onOpenChange, onSave, phone }: SimpleStatusDialogProps) {
  const handleCall = () => {
    // First execute the onSave callback
    onSave()
    
    // Then redirect to phone dialer
    window.location.href = `tel:${phone}`
    
    // Close the dialog
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set Initial Status</DialogTitle>
          <DialogDescription>
            Set the initial status before making the call to {phone}
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 justify-end pt-4">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleCall}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Set as Contacted & Call
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
