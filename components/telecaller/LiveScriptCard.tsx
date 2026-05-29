"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Bot, Quote } from "lucide-react"

interface LiveScriptProps {
  leadName: string;
  loanType: string | null;
  status: string;
  agentName: string;
}

export function LiveScriptCard({ leadName, loanType, status, agentName }: LiveScriptProps) {
  
  // Clean up data for the script
  const firstName = leadName.split(' ')[0] || "Customer";
  const type = (loanType || "Personal").toLowerCase();
  
  // Determine the best script based on the Lead's current status and loan type
  let scriptContent = "";

  if (status === 'New Lead' || status === 'new') {
      scriptContent = `Hi, am I speaking with ${firstName}? \n\nMy name is ${agentName} calling from the Hanva approvals desk. I'm calling because you recently checked your eligibility for a ${type} loan. \n\nI have your file open right here, and I just need 60 seconds to verify two quick details so we can process your instant approval. Is now a good time?`;
  } 
  else if (status === 'Follow Up') {
      scriptContent = `Hi ${firstName}, this is ${agentName} from Hanva returning your call. \n\nI’m following up on your ${type} loan application. We are holding a special interest rate for you, but it expires soon. Do you have any quick questions I can clear up for you right now?`;
  }
  else if (status === 'Documents_Sent') {
      scriptContent = `Hi ${firstName}, ${agentName} here from Hanva. \n\nGreat news—your initial approval for the ${type} loan is secure. To get the funds disbursed to your account, we just need you to upload your PAN and Aadhar card. I sent you a WhatsApp link earlier. Were you able to open it?`;
  }
  else {
      scriptContent = `Hi ${firstName}, this is ${agentName} from Hanva regarding your ${type} loan application. How can I assist you today?`;
  }

  return (
    <Card className="bg-blue-50/50 border-blue-200 shadow-sm relative overflow-hidden">
      <div className="absolute top-0 right-0 p-3 opacity-5">
        <Quote className="h-16 w-16 text-blue-900" />
      </div>
      <CardHeader className="py-3 border-b bg-blue-100/50">
        <CardTitle className="text-sm font-bold text-blue-800 flex items-center gap-2">
          <Bot className="h-4 w-4" /> Live Call Script
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 pb-5">
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-700 font-medium italic">
          "{scriptContent}"
        </p>
      </CardContent>
    </Card>
  )
}
