import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { History, ArrowRight, User, Trash2, PlusCircle, Edit3 } from "lucide-react"

export default async function AuditLogsPage() {
  const supabase = await createClient()

  // Fetch logs with the name of the person who performed the action
  const { data: logs, error } = await supabase
    .from("audit_logs")
    .select(`
      *,
      performer:users!audit_logs_performed_by_fkey(full_name, email, role)
    `)
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) {
    console.error("Error fetching logs:", error)
  }

  // Helper to format values safely
  const formatValue = (val: any) => {
    if (val === null) return <span className="text-gray-400 italic">null</span>
    if (typeof val === 'boolean') return val ? 'True' : 'False'
    return String(val)
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <History className="h-8 w-8 text-blue-600" />
          Audit Logs
        </h1>
        <p className="text-gray-600">Track security events and data changes across your CRM.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-6">
              {logs?.map((log: any) => (
                <div key={log.id} className="flex gap-4 border-b pb-6 last:border-0 last:pb-0">
                  {/* Icon based on Operation */}
                  <div className={`mt-1 p-2 rounded-full h-fit
                    ${log.operation === 'INSERT' ? 'bg-green-100 text-green-600' : ''}
                    ${log.operation === 'UPDATE' ? 'bg-blue-100 text-blue-600' : ''}
                    ${log.operation === 'DELETE' ? 'bg-red-100 text-red-600' : ''}
                  `}>
                    {log.operation === 'INSERT' && <PlusCircle className="h-5 w-5" />}
                    {log.operation === 'UPDATE' && <Edit3 className="h-5 w-5" />}
                    {log.operation === 'DELETE' && <Trash2 className="h-5 w-5" />}
                  </div>

                  <div className="flex-1 space-y-2">
                    {/* Header Line */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono">
                          {log.table_name.toUpperCase()}
                        </Badge>
                        <span className="text-sm text-gray-500">
                          record: {log.record_id.slice(0, 8)}...
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>

                    {/* Description Line */}
                    <p className="text-sm text-gray-800">
                      <span className="font-semibold text-gray-900">
                        {log.performer?.full_name || 'System/Unknown'}
                      </span>
                      {" "}performed{" "}
                      <span className="font-bold">{log.operation}</span>
                    </p>

                    {/* CHANGE DETAILS (The Diff) */}
                    {log.operation === 'UPDATE' && log.changed_fields && (
                      <div className="bg-gray-50 p-3 rounded-md text-sm space-y-2 mt-2">
                        {log.changed_fields.map((field: string) => (
                          <div key={field} className="grid grid-cols-[120px_1fr_20px_1fr] items-center gap-2">
                            <span className="font-medium text-gray-600 capitalize">
                              {field.replace(/_/g, ' ')}:
                            </span>
                            <span className="text-red-600 truncate bg-red-50 px-2 py-0.5 rounded border border-red-100">
                              {formatValue(log.old_data[field])}
                            </span>
                            <ArrowRight className="h-3 w-3 text-gray-400" />
                            <span className="text-green-600 truncate bg-green-50 px-2 py-0.5 rounded border border-green-100">
                              {formatValue(log.new_data[field])}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {log.operation === 'INSERT' && (
                       <div className="text-xs text-gray-500 italic">
                         Created new record. Initial Status: {log.new_data['status'] || 'N/A'}
                       </div>
                    )}
                    
                    {log.operation === 'DELETE' && (
                       <div className="text-xs text-red-500 bg-red-50 p-2 rounded">
                         Deleted record. Previous Name: {log.old_data['full_name'] || log.old_data['name'] || 'Unknown'}
                       </div>
                    )}
                  </div>
                </div>
              ))}
              
              {(!logs || logs.length === 0) && (
                 <div className="text-center py-10 text-gray-500">No activity logs found.</div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
