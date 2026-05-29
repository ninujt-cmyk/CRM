// components/follow-ups-list.tsx
"use client"

import { createClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"
import { Calendar, Clock, CheckCircle, XCircle, Plus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface FollowUpsListProps {
  leadId: string
}

export function FollowUpsList({ leadId }: FollowUpsListProps) {
  const [followUps, setFollowUps] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newFollowUp, setNewFollowUp] = useState({
    scheduled_date: "",
    notes: "",
    status: "scheduled"
  })

  useEffect(() => {
    fetchFollowUps()
  }, [leadId])

  const fetchFollowUps = async () => {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from("follow_ups")
      .select("*")
      .eq("lead_id", leadId)
      .order("scheduled_date", { ascending: false })

    if (error) {
      console.error("Error fetching follow-ups:", error)
    } else {
      setFollowUps(data || [])
    }
    
    setLoading(false)
  }

  const handleCreateFollowUp = async () => {
    const supabase = createClient()
    
    const { error } = await supabase
      .from("follow_ups")
      .insert({
        lead_id: leadId,
        scheduled_date: newFollowUp.scheduled_date,
        notes: newFollowUp.notes,
        status: newFollowUp.status
      })

    if (error) {
      console.error("Error creating follow-up:", error)
    } else {
      setNewFollowUp({ scheduled_date: "", notes: "", status: "scheduled" })
      setIsDialogOpen(false)
      fetchFollowUps() // Refresh the list
    }
  }

  const updateFollowUpStatus = async (id: string, status: string) => {
    const supabase = createClient()
    
    const { error } = await supabase
      .from("follow_ups")
      .update({ status })
      .eq("id", id)

    if (error) {
      console.error("Error updating follow-up status:", error)
    } else {
      fetchFollowUps() // Refresh the list
    }
  }

  if (loading) {
    return <div className="animate-pulse">Loading follow-ups...</div>
  }

  return (
    <div className="space-y-4">
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Schedule Follow-up
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule New Follow-up</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="scheduled_date">Date & Time</Label>
              <Input
                id="scheduled_date"
                type="datetime-local"
                value={newFollowUp.scheduled_date}
                onChange={(e) => setNewFollowUp({ ...newFollowUp, scheduled_date: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={newFollowUp.notes}
                onChange={(e) => setNewFollowUp({ ...newFollowUp, notes: e.target.value })}
                placeholder="Add any notes for this follow-up..."
              />
            </div>
            <Button onClick={handleCreateFollowUp}>Schedule Follow-up</Button>
          </div>
        </DialogContent>
      </Dialog>

      {followUps.length === 0 ? (
        <p className="text-gray-500">No follow-ups scheduled</p>
      ) : (
        <div className="space-y-4">
          {followUps.map((followUp) => (
            <div key={followUp.id} className="border rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-500" />
                  <span className="font-medium">
                    {new Date(followUp.scheduled_date).toLocaleDateString()}
                  </span>
                  <span className="text-sm text-gray-500">
                    {new Date(followUp.scheduled_date).toLocaleTimeString()}
                  </span>
                </div>
                <Badge variant={
                  followUp.status === 'completed' ? 'default' :
                  followUp.status === 'cancelled' ? 'destructive' :
                  'secondary'
                }>
                  {followUp.status}
                </Badge>
              </div>
              
              {followUp.notes && (
                <p className="mt-2 text-sm text-gray-600">{followUp.notes}</p>
              )}
              
              <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Created: {new Date(followUp.created_at).toLocaleString()}
                </div>
              </div>

              {followUp.status === 'scheduled' && (
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateFollowUpStatus(followUp.id, 'completed')}
                    className="flex items-center gap-1"
                  >
                    <CheckCircle className="h-3 w-3" />
                    Mark Complete
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateFollowUpStatus(followUp.id, 'cancelled')}
                    className="flex items-center gap-1"
                  >
                    <XCircle className="h-3 w-3" />
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
