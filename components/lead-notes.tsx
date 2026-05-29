// components/lead-notes.tsx
"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDistanceToNow } from "date-fns"
import { X } from "lucide-react"

interface Note {
  id: string
  content: string
  created_at: string
  user_id: string
  users: {
    full_name: string
  }
}

interface LeadNotesProps {
  leadId: string
  compact?: boolean
  onClose?: () => void
}

export function LeadNotes({ leadId, compact = false, onClose }: LeadNotesProps) {
  const [notes, setNotes] = useState<Note[]>([])
  const [newNote, setNewNote] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchNotes()
  }, [leadId])

  const fetchNotes = async () => {
    try {
      const { data, error } = await supabase
        .from("notes")
        .select(
          `
          id,
          content,
          created_at,
          user_id,
          users (
            full_name
          )
        `
        )
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })

      if (error) throw error
      setNotes(data || [])
    } catch (error) {
      console.error("Error fetching notes:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const addNote = async () => {
    if (!newNote.trim()) return

    setIsAdding(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error("User not authenticated")

      const { error } = await supabase.from("notes").insert({
        lead_id: leadId,
        content: newNote.trim(),
        user_id: user.id,
      })

      if (error) throw error

      setNewNote("")
      fetchNotes() // Refresh notes
    } catch (error) {
      console.error("Error adding note:", error)
    } finally {
      setIsAdding(false)
    }
  }

  if (isLoading) {
    return (
      <Card className={compact ? "border-0 shadow-none" : ""}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>Notes</CardTitle>
          {compact && onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Add a close button for the compact view
  const showCloseButton = compact && onClose

  return (
    <Card className={compact ? "border-0 shadow-none" : ""}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>Notes ({notes.length})</CardTitle>
        {showCloseButton && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new note */}
        <div className="space-y-2">
          <Textarea
            placeholder="Add a note about this lead..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            rows={3}
          />
          <Button onClick={addNote} disabled={isAdding || !newNote.trim()}>
            {isAdding ? "Adding..." : "Add Note"}
          </Button>
        </div>

        {/* Notes list */}
        <div className="space-y-3">
          {notes.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No notes yet. Add the first note above.</p>
          ) : (
            notes.map((note) => (
              <div key={note.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">{note.users.full_name}</Badge>
                  <span className="text-xs text-gray-500">
                    {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm">{note.content}</p>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
