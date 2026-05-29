"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Phone, Mail, Eye } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import Link from "next/link"

interface Lead {
  id: string
  name: string
  email: string
  phone: string
  company: string
  status: string
  priority: string
  created_at: string
}

export function RecentLeads({ userId }: { userId: string }) {
  const [leads, setLeads] = useState<Lead[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetchLeads = async () => {
      try {
        const { data } = await supabase
          .from("leads")
          .select("id, name, email, phone, company, status, priority, created_at")
          .eq("assigned_to", userId)
          .order("created_at", { ascending: false })
          .limit(5)

        setLeads(data || [])
      } catch (error) {
        console.error("Error fetching leads:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchLeads()
  }, [userId, supabase])

  const getStatusColor = (status: string) => {
    const colors = {
      new: "bg-blue-100 text-blue-800",
      contacted: "bg-yellow-100 text-yellow-800",
      Interested: "bg-green-100 text-green-800",
      Documents_Sent: "bg-purple-100 text-purple-800",
      Login: "bg-orange-100 text-orange-800",
      Disbursed: "bg-emerald-100 text-emerald-800",
      Not_Interested: "bg-red-100 text-red-800",
      Call_Back: "bg-indigo-100 text-indigo-800",
      not_eligible: "bg-red-100 text-red-800",
      nr: "bg-gray-100 text-gray-800",
      self_employed: "bg-amber-100 text-amber-800",
      
    }
    return colors[status as keyof typeof colors] || "bg-gray-100 text-amber-800"
  }

  const makeCall = (phone: string) => {
    window.open(`tel:${phone}`, "_self")
  }

  const sendEmail = (email: string) => {
    window.open(`mailto:${email}`, "_blank")
  }

  if (isLoading) {
    return <div className="text-center py-4">Loading leads...</div>
  }

  return (
    <div className="space-y-3">
      {leads.length === 0 ? (
        <p className="text-gray-500 text-center py-4">No leads assigned yet</p>
      ) : (
        leads.map((lead) => (
          <div key={lead.id} className="p-4 border rounded-lg hover:bg-gray-50">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-semibold text-gray-900">{lead.name}</h4>
                  <Badge className={getStatusColor(lead.status)}>{lead.status.replace("_", " ").toUpperCase()}</Badge>
                </div>
                {lead.company && <p className="text-sm text-gray-600 mb-1">{lead.company}</p>}
                <p className="text-xs text-gray-500">
                  Added {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                </p>
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => makeCall(lead.phone)}
                  className="flex items-center gap-1"
                >
                  <Phone className="h-3 w-3" />
                </Button>
                {lead.email && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => sendEmail(lead.email)}
                    className="flex items-center gap-1"
                  >
                    <Mail className="h-3 w-3" />
                  </Button>
                )}
                <Link href={`/telecaller/leads/${lead.id}`}>
                  <Button size="sm" variant="outline" className="flex items-center gap-1 bg-transparent">
                    <Eye className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
