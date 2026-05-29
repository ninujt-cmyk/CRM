// components/follow-up-dialog.tsx
"use client"

import { useState } from "react"
import { Calendar, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface FollowUpDialogProps {
  onSave: (followUpRequired: boolean, nextCallDate: string | null, callResult: string) => void
  children: React.ReactNode
}

export function FollowUpDialog({ onSave, children }: FollowUpDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [followUpRequired, setFollowUpRequired] = useState(false)
  const [nextCallDate, setNextCallDate] = useState("")
  const [nextCallTime, setNextCallTime] = useState("09:00")
  const [callResult, setCallResult] = useState("")

  const handleSave = () => {
    let formattedDate = null
    if (followUpRequired && nextCallDate) {
      formattedDate = `${nextCallDate}T${nextCallTime}:00.000Z`
    }
    
    onSave(followUpRequired, formattedDate, callResult)
    setIsOpen(false)
    // Reset form
    setFollowUpRequired(false)
    setNextCallDate("")
    setNextCallTime("09:00")
    setCallResult("")
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log Call Details</DialogTitle>
          <DialogDescription>
            Add follow-up information and call result.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="call-result">Call Result</Label>
            <Select value={callResult} onValueChange={setCallResult}>
              <SelectTrigger>
                <SelectValue placeholder="Select call result" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="successful">Successful</SelectItem>
                <SelectItem value="no_answer">No Answer</SelectItem>
                <SelectItem value="busy">Busy</SelectItem>
                <SelectItem value="wrong_number">Wrong Number</SelectItem>
                <SelectItem value="not_interested">Not Interested</SelectItem>
                <SelectItem value="callback_requested">Callback Requested</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center space-x-2">
            <Switch
              id="follow-up"
              checked={followUpRequired}
              onCheckedChange={setFollowUpRequired}
            />
            <Label htmlFor="follow-up">Follow-up Required</Label>
          </div>

          {followUpRequired && (
            <div className="space-y-2">
              <Label htmlFor="next-call">Next Call Scheduled</Label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={nextCallDate}
                  onChange={(e) => setNextCallDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
                <Input
                  type="time"
                  value={nextCallTime}
                  onChange={(e) => setNextCallTime(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Details
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
