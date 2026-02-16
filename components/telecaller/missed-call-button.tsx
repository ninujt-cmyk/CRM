"use client"

import { useState } from "react"
import { PhoneMissed, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner" // or your preferred toast library
import { sendMissedCallMessage } from "@/app/actions/whatsapp"

interface MissedCallButtonProps {
  customerPhone: string;
}

export function MissedCallButton({ customerPhone }: MissedCallButtonProps) {
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!customerPhone) {
      toast.error("No phone number available");
      return;
    }

    setIsSending(true);
    try {
      const result = await sendMissedCallMessage(customerPhone);
      
      if (result.success) {
        toast.success("WhatsApp message sent!");
      } else {
        toast.error("Failed to send message: " + result.error);
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Button 
      size="sm" 
      variant="outline" 
      onClick={handleSend} 
      disabled={isSending}
      className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 border-amber-200 shadow-sm transition-all"
    >
      {isSending ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <PhoneMissed className="h-4 w-4 mr-2" />
      )}
      {isSending ? "Sending..." : "Send 'Missed Call' WA"}
    </Button>
  )
}
