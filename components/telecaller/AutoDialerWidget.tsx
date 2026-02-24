"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PhoneForwarded, Loader2, AlertCircle } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { initiateC2CCall } from "@/app/actions/c2c-dialer"

export function AutoDialerWidget({ userId }: { userId: string }) {
  const [dialing, setDialing] = useState(false)
  const supabase = createClient()
  const router = useRouter()
  const { toast } = useToast()

  const handleDialNext = async () => {
    setDialing(true)

    try {
      // 1. Check if the agent is actually 'Ready'
      const { data: agent } = await supabase.from('users').select('current_status').eq('id', userId).single()
      if (agent?.current_status !== 'ready') {
        toast({ title: "Action Blocked", description: "You must set your status to 'Ready for Calls' first.", variant: "destructive" })
        setDialing(false)
        return
      }

      // 2. Find the Absolute Best Next Lead (New Leads or Follow Ups)
      const { data: nextLead, error } = await supabase
        .from('leads')
        .select('id, name, phone')
        .eq('assigned_to', userId)
        .in('status', ['New Lead', 'Follow Up', 'new']) // Add any other statuses that need dialing
        .order('created_at', { ascending: true }) // Oldest waiting lead first
        .limit(1)
        .maybeSingle()

      if (error || !nextLead) {
        toast({ title: "Queue Empty 🎉", description: "You have no pending leads to call right now!", className: "bg-emerald-500 text-white" })
        setDialing(false)
        return
      }

      toast({ title: "Connecting...", description: `Dialing ${nextLead.name}... Please answer your phone.` })

      // 3. Trigger the C2C API
      const res = await initiateC2CCall(nextLead.id, nextLead.phone)

      if (res.success) {
        // 4. Instantly redirect the agent to the lead's profile so they can read the details while it rings!
        router.push(`/telecaller/leads/${nextLead.id}`)
      } else {
        toast({ title: "Call Failed", description: res.error, variant: "destructive" })
      }

    } catch (err: any) {
      toast({ title: "Error", description: "Something went wrong.", variant: "destructive" })
    }
    
    setDialing(false)
  }

  return (
    <Card className="border-2 border-emerald-500 shadow-lg bg-emerald-50/30 overflow-hidden relative">
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <PhoneForwarded className="h-24 w-24 text-emerald-600" />
      </div>
      
      <CardHeader className="pb-2">
        <CardTitle className="text-xl text-emerald-800 flex items-center gap-2 z-10">
          <PhoneForwarded className="h-5 w-5" /> Progressive Auto-Dialer
        </CardTitle>
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
