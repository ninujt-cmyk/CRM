"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { PhoneCall, ShieldAlert, Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { initiateManagerConference } from "@/app/actions/conference"

interface EscalationProps {
  leadId: string;
  agentId: string;
  customerPhone: string;
}

export function ManagerEscalationButton({ leadId, agentId, customerPhone }: EscalationProps) {
  const [isEscalating, setIsEscalating] = useState(false)
  const { toast } = useToast()

  const handleEscalation = async () => {
    // Optional: Add a confirmation dialog so they don't click it accidentally
    if (!confirm("Are you sure you want to pull a Manager into this live call?")) return;

    setIsEscalating(true)
    
    const res = await initiateManagerConference(leadId, agentId, customerPhone)

    if (res.success) {
      toast({ 
        title: "Escalation Triggered! 🚨", 
        description: res.message,
        className: "bg-red-600 text-white border-none" 
      })
    } else {
      toast({ 
        title: "Escalation Failed", 
        description: res.error, 
        variant: "destructive" 
      })
    }

    setIsEscalating(false)
  }

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-3">
        <div className="bg-red-100 p-2 rounded-full">
          <ShieldAlert className="h-5 w-5 text-red-600" />
        </div>
        <div>
          <h4 className="font-bold text-red-800 text-sm">Need Help Closing?</h4>
          <p className="text-xs text-red-600">Instantly conference a manager into this call.</p>
        </div>
      </div>
      
      <Button 
        onClick={handleEscalation} 
        disabled={isEscalating}
        variant="destructive" 
        className="bg-red-600 hover:bg-red-700 font-semibold shadow-md"
      >
        {isEscalating ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Calling Manager...</>
        ) : (
          <><PhoneCall className="h-4 w-4 mr-2" /> Pull Manager In</>
        )}
      </Button>
    </div>
  )
}
