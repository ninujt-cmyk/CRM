"use client"

import type React from "react"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MessageSquare, Plus } from "lucide-react"
import { toast } from "sonner"

interface AddNoteModalProps {
  leadId: string
  userId: string
  leadName: string
  onNoteAdded?: () => void
  trigger?: React.ReactNode
}

export function AddNoteModal({ leadId, userId, leadName, onNoteAdded, trigger }: AddNoteModalProps) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState("")
  const [noteType, setNoteType] = useState("general")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!note.trim()) return

    setIsSubmitting(true)
    const supabase = createClient()

    try {
      const { error } = await supabase.from("notes").insert({
        lead_id: leadId,
        user_id: userId,
        note: note.trim(),
        note_type: noteType,
      })

      if (error) throw error

      toast.success("Note added successfully")
      setNote("")
      setNoteType("general")
      setOpen(false)
      onNoteAdded?.()
    } catch (error) {
      console.error("Error adding note:", error)
      toast.error("Failed to add note")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Note
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Add Note for {leadName}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="noteType">Note Type</Label>
            <Select value={noteType} onValueChange={setNoteType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General Note</SelectItem>
                <SelectItem value="call">Call Summary</SelectItem>
                <SelectItem value="meeting">Meeting Notes</SelectItem>
                <SelectItem value="follow_up">Follow-up Required</SelectItem>
                <SelectItem value="concern">Concern/Issue</SelectItem>
                <SelectItem value="opportunity">Opportunity</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="note">Note</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Enter your note here..."
              rows={4}
              required
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !note.trim()}>
              {isSubmitting ? "Adding..." : "Add Note"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
