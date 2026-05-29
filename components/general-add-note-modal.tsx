"use client"

import type React from "react"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MessageSquare, Plus, Check, ChevronsUpDown } from "lucide-react"
import { toast } from "sonner"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"

interface Lead {
  id: string
  name: string
  company: string | null
}

interface GeneralAddNoteModalProps {
  leads: Lead[]
  userId: string
  trigger?: React.ReactNode
}

export function GeneralAddNoteModal({ leads, userId, trigger }: GeneralAddNoteModalProps) {
  const [open, setOpen] = useState(false)
  const [leadId, setLeadId] = useState("")
  const [leadOpen, setLeadOpen] = useState(false)
  const [note, setNote] = useState("")
  const [noteType, setNoteType] = useState("general")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  const selectedLead = leads.find((lead) => lead.id === leadId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!leadId) {
      toast.error("Please select a lead")
      return
    }
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
      setLeadId("")
      setNoteType("general")
      setOpen(false)
      router.refresh()
    } catch (error) {
      console.error("Error adding note:", error)
      toast.error("Failed to add note")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleQuickNote = (text: string) => {
    setNote((prev) => {
      const trimmed = prev.trim()
      if (!trimmed) return text
      return `${trimmed}, ${text}`
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all duration-200">
            <Plus className="h-4 w-4" />
            Add Quick Note
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl overflow-visible">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-950 dark:text-slate-50 font-bold">
            <MessageSquare className="h-5 w-5 text-indigo-500" />
            Add Standalone Note
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-3">
          {/* Lead Selector Combobox */}
          <div className="grid gap-2 relative">
            <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Select Lead</Label>
            <Popover open={leadOpen} onOpenChange={setLeadOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={leadOpen}
                  className="w-full justify-between h-10 border-slate-200 dark:border-slate-800 text-left font-normal bg-white dark:bg-slate-950"
                >
                  {selectedLead ? selectedLead.name : "Search assigned leads..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[380px] sm:w-[410px] p-0 z-[9999]" align="start">
                <Command className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <CommandInput placeholder="Search lead name..." className="border-0 focus:ring-0" />
                  <CommandList className="max-h-[220px]">
                    <CommandEmpty>No leads found.</CommandEmpty>
                    <CommandGroup heading="Assigned Leads" className="text-slate-500 dark:text-slate-400">
                      {leads.map((lead) => (
                        <CommandItem
                          key={lead.id}
                          value={lead.name}
                          onSelect={() => {
                            setLeadId(lead.id)
                            setLeadOpen(false)
                          }}
                          className="hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4 text-indigo-600",
                              leadId === lead.id ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <div className="flex flex-col">
                            <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">
                              {lead.name}
                            </span>
                            {lead.company && (
                              <span className="text-xs text-slate-500 dark:text-slate-400">{lead.company}</span>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Note Type Selector */}
          <div className="grid gap-2">
            <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Note Type</Label>
            <Select value={noteType} onValueChange={setNoteType}>
              <SelectTrigger className="h-10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[9999]">
                <SelectItem value="general">General Note 📁</SelectItem>
                <SelectItem value="call">Call Summary 📞</SelectItem>
                <SelectItem value="meeting">Meeting Notes 🤝</SelectItem>
                <SelectItem value="follow_up">Follow-up Required ⏰</SelectItem>
                <SelectItem value="concern">Concern/Issue ⚠️</SelectItem>
                <SelectItem value="opportunity">Opportunity ✨</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Text Input with Quick Chips */}
          <div className="grid gap-2">
            <div className="flex justify-between items-center">
              <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Note Remarks</Label>
              <div className="flex gap-1.5 flex-wrap">
                {["Busy", "Callback Scheduled", "Docs Pending", "Rate Issue"].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => handleQuickNote(q)}
                    className="text-[10px] px-2 py-0.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full border border-slate-200 dark:border-slate-700 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Enter your structured note remarks here..."
              rows={4}
              required
              className="resize-none border border-slate-200 dark:border-slate-800 focus-visible:ring-indigo-500"
            />
          </div>

          {/* Footer controls */}
          <div className="flex gap-2 justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
              className="h-10 px-4 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !leadId || !note.trim()}
              className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
            >
              {isSubmitting ? "Saving Note..." : "Save Note"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
