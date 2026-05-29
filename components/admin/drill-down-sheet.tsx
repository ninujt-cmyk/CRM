"use client"

import { useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { createClient } from "@/lib/supabase/client"
import { Loader2, ExternalLink } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

interface DrillDownProps {
  agentId: string;
  agentName: string;
  status: string;
  count: number;
}

export function DrillDownSheet({ agentId, agentName, status, count }: DrillDownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLeads = async () => {
    if (leads.length > 0) return; // Cache check
    setLoading(true);
    const supabase = createClient();
    
    // Fetch specific leads for this cell
    const { data } = await supabase
      .from("leads")
      .select("id, name, application_number, disbursed_amount, created_at")
      .eq("assigned_to", agentId)
      .eq("status", status)
      .order("created_at", { ascending: false })
      .limit(50); // Safety limit

    setLeads(data || []);
    setLoading(false);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <button 
          onClick={fetchLeads}
          disabled={count === 0}
          className={`hover:underline decoration-dotted underline-offset-4 ${count > 0 ? 'cursor-pointer' : 'cursor-default'}`}
        >
          {count > 0 ? count : "-"}
        </button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex flex-col gap-1">
            <span>{agentName}</span>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{status.replace(/_/g, " ")}</Badge>
              <span className="text-sm text-gray-500">{count} Leads</span>
            </div>
          </SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        ) : (
          <div className="space-y-3">
            {leads.map((lead) => (
              <div key={lead.id} className="p-3 border rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors flex justify-between items-center group">
                <div>
                  <p className="font-semibold text-sm text-gray-900">{lead.name}</p>
                  <p className="text-xs text-gray-500 font-mono">{lead.application_number || "No App #"}</p>
                  {lead.disbursed_amount > 0 && (
                    <p className="text-xs font-bold text-green-600 mt-1">
                      ₹{lead.disbursed_amount.toLocaleString('en-IN')}
                    </p>
                  )}
                </div>
                <Link href={`/admin/leads/${lead.id}`} target="_blank">
                  <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-blue-600" />
                </Link>
              </div>
            ))}
            {leads.length === 0 && <p className="text-center text-gray-400 py-4">No leads found.</p>}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
