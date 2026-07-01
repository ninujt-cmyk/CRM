"use client"

import { useState, useEffect } from "react"
import { History, PhoneCall, CheckCircle2, XCircle, Search, RefreshCw, Download, FileSpreadsheet } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export default function CallLogsPage() {
  const [activeTab, setActiveTab] = useState("completed")
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  const [completedLogs, setCompletedLogs] = useState<any[]>([])
  const [activeCalls, setActiveCalls] = useState<any[]>([])

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true)
      try {
        setTimeout(() => {
          setCompletedLogs([
            { id: "call_1", to: "+1234567890", name: "John Doe", duration: "1m 45s", status: "completed", cost: "$0.14", date: new Date().toISOString() },
            { id: "call_2", to: "+1987654321", name: "Jane Smith", duration: "0m 30s", status: "failed", cost: "$0.02", date: new Date().toISOString() }
          ])
          setActiveCalls([])
          setLoading(false)
        }, 800)
      } catch (error) {
        console.error("Error fetching logs", error)
        setLoading(false)
      }
    }
    fetchLogs()
  }, [activeTab])

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <History className="h-6 w-6 text-blue-600" />
            Call Logs & History
          </h1>
          <p className="text-slate-500 mt-1">View the status and transcripts of all AI calls.</p>
        </div>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <Tabs defaultValue="completed" onValueChange={setActiveTab}>
          <div className="p-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex flex-wrap gap-4 justify-between items-center">
            <TabsList className="bg-slate-200/50 dark:bg-slate-800">
              <TabsTrigger value="completed">Completed</TabsTrigger>
              <TabsTrigger value="active">In Progress (0)</TabsTrigger>
              <TabsTrigger value="test">Test Calls</TabsTrigger>
            </TabsList>
            
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Search phone number or name..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>
          
          <TabsContent value="completed" className="m-0 p-0">
            {loading ? (
              <div className="p-12 text-center text-slate-500">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-slate-300" />
                Loading call history...
              </div>
            ) : completedLogs.length === 0 ? (
              <div className="p-16 text-center">
                <div className="h-16 w-16 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileSpreadsheet className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-medium mb-1">No Call History</h3>
                <p className="text-slate-500">Completed calls will appear here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Contact</th>
                      <th className="px-6 py-4 font-semibold">Date & Time</th>
                      <th className="px-6 py-4 font-semibold">Duration</th>
                      <th className="px-6 py-4 font-semibold">Status</th>
                      <th className="px-6 py-4 font-semibold text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {completedLogs.filter(l => l.name.toLowerCase().includes(search.toLowerCase()) || l.to.includes(search)).map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-900 dark:text-white">{log.name}</div>
                          <div className="text-slate-500">{log.to}</div>
                        </td>
                        <td className="px-6 py-4 text-slate-500">
                          {new Date(log.date).toLocaleString()}
                        </td>
                        <td className="px-6 py-4">{log.duration}</td>
                        <td className="px-6 py-4">
                          {log.status === "completed" ? (
                            <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Completed
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800">
                              <XCircle className="h-3 w-3 mr-1" />
                              Failed
                            </Badge>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-slate-900 dark:text-white">
                          {log.cost}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="active" className="m-0 p-0">
             <div className="p-16 text-center">
                <div className="h-16 w-16 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 relative">
                  <PhoneCall className="h-8 w-8 relative z-10" />
                  <div className="absolute inset-0 bg-blue-400 rounded-full animate-ping opacity-20"></div>
                </div>
                <h3 className="text-lg font-medium mb-1">No Active Calls</h3>
                <p className="text-slate-500">Calls currently in progress will appear here in real-time.</p>
              </div>
          </TabsContent>

          <TabsContent value="test" className="m-0 p-0">
             <div className="p-16 text-center">
                <div className="h-16 w-16 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4">
                  <History className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-medium mb-1">No Test Calls</h3>
                <p className="text-slate-500">You haven't made any test calls from the script builder yet.</p>
              </div>
          </TabsContent>
          
        </Tabs>
      </div>
    </div>
  )
}
