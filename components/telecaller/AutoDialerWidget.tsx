"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PhoneForwarded, Loader2, AlertCircle, ListOrdered } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { initiateC2CCall } from "@/app/actions/c2c-dialer"

export function AutoDialerWidget({ userId }: { userId: string }) {
  const [dialing, setDialing] = useState(false)
  const [queueSize, setQueueSize] = useState<number | null>(null)
  const supabase = createClient()
  const router = useRouter()
  const { toast } = useToast()

  // Fetch queue size for visual feedback
  useEffect(() => {
    const fetchQueueSize = async () => {
        const { count } = await supabase
            .from('leads')
            .select('*', { count: 'exact', head: true })
            .eq('assigned_to', userId)
            .in('status', ['New Lead', 'Follow Up', 'new', 'Contacted'])
        
        setQueueSize(count);
    }
    fetchQueueSize();
  }, [userId, supabase])

  const handleDialNext = async () => {
    setDialing(true)

    try {
      const { data: agent } = await supabase.from('users').select('current_status').eq('id', userId).single()
      if (agent?.current_status !== 'ready') {
        toast({ title: "Action Blocked", description: "You must set your status to 'Ready for Calls' first.", variant: "destructive" })
        setDialing(false)
        return
      }

      const { data: potentialLeads, error } = await supabase
        .from('leads')
        .select('id, name, phone, priority, created_at')
        .eq('assigned_to', userId)
        .in('status', ['New Lead', 'Follow Up', 'new']) 
        .limit(50) 

      if (error || !potentialLeads || potentialLeads.length === 0) {
        toast({ title: "Queue Empty 🎉", description: "You have no pending leads to call right now!", className: "bg-emerald-500 text-white" })
        setDialing(false)
        return
      }

      const priorityWeights: Record<string, number> = { "urgent": 4, "high": 3, "medium": 2, "low": 1, "none": 0 };
      
      const sortedLeads = potentialLeads.sort((a, b) => {
          const weightA = priorityWeights[a.priority || "none"] || 0;
          const weightB = priorityWeights[b.priority || "none"] || 0;
          if (weightA !== weightB) return weightB - weightA; 
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); 
      });

      const nextLead = sortedLeads[0];

      toast({ title: "Connecting...", description: `Dialing ${nextLead.name}... Please answer your phone.` })

      // 💡 THE DEBUGGING LOGS:
      console.log("👉 [FRONTEND] Sending to Server Action:", { leadId: nextLead.id, phone: nextLead.phone });

      // Trigger the C2C API
      const res = await initiateC2CCall(nextLead.id, nextLead.phone);
      
      console.log("👈 [FRONTEND] Server Action Returned:", res);

      if (res.success) {
        // Stop dialing spinner BEFORE redirecting
        setDialing(false);
        router.push(`/telecaller/leads/${nextLead.id}`)
      } else {
        toast({ title: "Call Failed", description: res.error, variant: "destructive" })
        setDialing(false)
      }

    } catch (err: any) {
      console.error("🔥 [FRONTEND CRASH]:", err);
      toast({ title: "Critical Error", description: err.message || "Failed to connect to the server.", variant: "destructive" })
      setDialing(false)
    }
  }

  return (
    <Card className="border-2 border-emerald-500 shadow-lg bg-emerald-50/30 overflow-hidden relative">
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <PhoneForwarded className="h-24 w-24 text-emerald-600" />
      </div>
      
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-xl text-emerald-800 flex items-center gap-2 z-10">
          <PhoneForwarded className="h-5 w-5" /> Auto-Dialer
        </CardTitle>
        {queueSize !== null && (
          <div className="bg-white border border-emerald-200 text-emerald-700 text-xs font-bold px-2 py-1 rounded-md shadow-sm z-10 flex items-center gap-1">
             <ListOrdered className="h-3 w-3" /> Queue: {queueSize}
          </div>
        )}
      </CardHeader>
      
      <CardContent className="z-10 relative space-y-4">
        <p className="text-sm text-slate-600">
          Click below to automatically find and connect to your next highest-priority lead.
        </p>
        
        <Button 
          onClick={handleDialNext} 
          disabled={dialing}
          className="w-full h-14 text-lg bg-emerald-600 hover:bg-emerald-700 shadow-md transition-all hover:scale-[1.02]"
        >
          {dialing ? (
            <><Loader2 className="mr-3 h-6 w-6 animate-spin" /> Connecting Call...</>
          ) : (
            <><PhoneForwarded className="mr-3 h-6 w-6" /> Dial Next Lead</>
          )}
        </Button>

        <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-100 p-2 rounded-md">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <p>Ensure your mobile phone is off silent. Fonada will ring your device first.</p>
        </div>
      </CardContent>
    </Card>
  )
}
