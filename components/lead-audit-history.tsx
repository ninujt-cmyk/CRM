"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, Edit3, PlusCircle, Trash2, User, Clock, AlertCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface AuditLog {
  id: string
  table_name: string
  operation: "INSERT" | "UPDATE" | "DELETE"
  old_data: any
  new_data: any
  changed_fields: string[] | null
  performed_by: string
  created_at: string
  performer: {
    full_name: string
    email: string
    role: string
  } | null
}

export function LeadAuditHistory({ leadId }: { leadId: string }) {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetchLogs = async () => {
      // 1. Fetch logs specifically for this record ID
      const { data, error } = await supabase
        .from("audit_logs")
        .select(`
          *,
          performer:users!audit_logs_performed_by_fkey(full_name, email, role)
        `)
        .eq("record_id", leadId) // <--- Key Filter
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Error fetching audit logs:", error)
      } else {
        setLogs(data as AuditLog[])
      }
      setLoading(false)
    }

    fetchLogs()
  }, [leadId, supabase])

  const formatValue = (val: any) => {
    if (val === null) return <span className="text-gray-400 italic text-xs">empty</span>
    if (typeof val === "boolean") return val ? "True" : "False"
    return String(val)
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-500 animate-pulse">Loading history...</div>
  }

  if (logs.length === 0) {
    return (
      <div className="p-8 text-center flex flex-col items-center gap-2 text-gray-500">
        <AlertCircle className="h-8 w-8 opacity-20" />
        <p>No audit history found for this lead yet.</p>
      </div>
    )
  }

  return (
    <ScrollArea className="h-[600px] pr-4">
      <div className="relative space-y-8 pl-6 before:absolute before:inset-0 before:ml-2.5 before:h-full before:w-0.5 before:-translate-x-1/2 before:bg-slate-200 before:content-['']">
        {logs.map((log) => (
          <div key={log.id} className="relative group">
            {/* Timeline Dot */}
            <div className={`absolute -left-[29px] top-1 h-5 w-5 rounded-full border-4 border-white shadow-sm flex items-center justify-center
              ${log.operation === 'INSERT' ? 'bg-green-500' : ''}
              ${log.operation === 'UPDATE' ? 'bg-blue-500' : ''}
              ${log.operation === 'DELETE' ? 'bg-red-500' : ''}
            `}>
                {log.operation === 'UPDATE' && <Edit3 className="h-2.5 w-2.5 text-white" />}
                {log.operation === 'INSERT' && <PlusCircle className="h-2.5 w-2.5 text-white" />}
                {log.operation === 'DELETE' && <Trash2 className="h-2.5 w-2.5 text-white" />}
            </div>

            <Card className="shadow-sm border-slate-200 transition-all hover:shadow-md">
              <CardContent className="p-4 space-y-3">
                
                {/* Header: Who and When */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-slate-400" />
                    <span className="font-semibold text-sm text-slate-800">
                      {log.performer?.full_name || "System/Unknown"}
                    </span>
                    <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-normal text-slate-500">
                      {log.performer?.role || 'System'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Clock className="h-3 w-3" />
                    {new Date(log.created_at).toLocaleString()}
                  </div>
                </div>

                {/* Operation Summary */}
                <div className="text-sm">
                    {log.operation === 'INSERT' && (
                        <p className="text-green-700 font-medium flex items-center gap-2">
                            <PlusCircle className="h-4 w-4"/> Created Lead Record
                        </p>
                    )}
                    {log.operation === 'DELETE' && (
                        <p className="text-red-700 font-medium flex items-center gap-2">
                            <Trash2 className="h-4 w-4"/> Deleted Lead Record
                        </p>
                    )}
                    {log.operation === 'UPDATE' && (
                        <p className="text-slate-600 font-medium mb-2">Updated the following fields:</p>
                    )}
                </div>

                {/* Change Diff (Only for Updates) */}
                {log.operation === 'UPDATE' && log.changed_fields && (
                  <div className="bg-slate-50 rounded-md border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                    {log.changed_fields.map((field) => (
                      <div key={field} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 p-2 text-sm">
                        
                        {/* Old Value */}
                        <div className="flex flex-col items-end text-right min-w-0">
                            <span className="text-[10px] uppercase font-bold text-slate-400 mb-0.5 tracking-wider">{field.replace(/_/g, ' ')}</span>
                            <span className="text-red-600 bg-red-50 px-1.5 py-0.5 rounded break-all line-through decoration-red-300 decoration-2 opacity-70">
                                {formatValue(log.old_data[field])}
                            </span>
                        </div>

                        {/* Arrow */}
                        <ArrowRight className="h-3 w-3 text-slate-300 flex-shrink-0" />

                        {/* New Value */}
                        <div className="flex flex-col items-start min-w-0">
                            <span className="text-[10px] uppercase font-bold text-slate-400 mb-0.5 tracking-wider">New Value</span>
                            <span className="text-green-700 bg-green-50 px-1.5 py-0.5 rounded break-all font-medium border border-green-100">
                                {formatValue(log.new_data[field])}
                            </span>
                        </div>

                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}
