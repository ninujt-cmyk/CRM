"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { 
  Users, Search, Filter, Loader2, Send, CheckSquare, Square, Calendar, X
} from "lucide-react"
import { assignLeadsBulk } from "@/app/actions/dialer-campaigns"

// --- TYPES ---
interface Lead {
  id: string;
  name: string;
  phone: string;
  source: string | null;
  status: string;
  created_at: string;
}

interface Agent {
  id: string;
  full_name: string;
}

export default function DialerAssignmentPage() {
  const supabase = createClient()
  const { toast } = useToast()
  
  // Data State
  const [leads, setLeads] = useState<Lead[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState<string>("")
  
  // Filter States
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [sourceFilter, setSourceFilter] = useState("all")
  const [dateRange, setDateRange] = useState("all")
  const [customStart, setCustomStart] = useState("")
  const [customEnd, setCustomEnd] = useState("")
  
  // UI States
  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  // 1. FETCH LOGIC (Now heavily tied to Database-Level Filters)
  const fetchLeadsAndAgents = useCallback(async () => {
    setLoading(true)
    
    // Fetch Agents
    const { data: agentsData } = await supabase
      .from('users')
      .select('id, full_name')
      .in('role', ['telecaller', 'agent'])
      .order('full_name', { ascending: true })
      
    if (agentsData) setAgents(agentsData)

    // Fetch Leads dynamically based on filters
    let query = supabase
      .from('leads')
      .select('id, name, phone, source, status, created_at')
      
    // Status Logic
    if (statusFilter === "all") {
      // Default: Show Unassigned OR Dead Bucket leads
      query = query.or('assigned_to.is.null,status.in.(Not Interested,Dead Bucket,nr,not_eligible,self_employed)')
    } else {
      query = query.eq('status', statusFilter)
    }

    // Source Logic
    if (sourceFilter !== "all") {
      query = query.eq('source', sourceFilter)
    }

    // Date Logic
    if (dateRange !== "all") {
      const today = new Date();
      today.setHours(0,0,0,0);
      
      if (dateRange === "today") {
        query = query.gte('created_at', today.toISOString());
      } else if (dateRange === "yesterday") {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        query = query.gte('created_at', yesterday.toISOString()).lt('created_at', today.toISOString());
      } else if (dateRange === "this_month") {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        query = query.gte('created_at', firstDay.toISOString());
      } else if (dateRange === "custom" && customStart && customEnd) {
        query = query.gte('created_at', new Date(customStart).toISOString())
                     .lte('created_at', new Date(customEnd + 'T23:59:59').toISOString());
      }
    }

    // Execute query with a high limit for bulk operations
    const { data: leadsData } = await query.order('created_at', { ascending: false }).limit(500)

    if (leadsData) setLeads(leadsData)
    setSelectedLeadIds([]) // Reset selections when data changes
    setLoading(false)
  }, [supabase, statusFilter, sourceFilter, dateRange, customStart, customEnd])

  // Initial Load
  useEffect(() => {
    fetchLeadsAndAgents()
  }, [fetchLeadsAndAgents])

  const clearFilters = () => {
    setStatusFilter("all")
    setSourceFilter("all")
    setDateRange("all")
    setCustomStart("")
    setCustomEnd("")
    setSearchQuery("")
  }

  // --- SELECTION LOGIC ---
  const toggleSelectAll = () => {
    if (selectedLeadIds.length === filteredLeads.length) {
      setSelectedLeadIds([]) 
    } else {
      setSelectedLeadIds(filteredLeads.map(l => l.id)) 
    }
  }

  const toggleSelectLead = (id: string) => {
    setSelectedLeadIds(prev => prev.includes(id) ? prev.filter(leadId => leadId !== id) : [...prev, id])
  }

  // --- ASSIGN LOGIC ---
  const handleAssign = async () => {
    if (!selectedAgentId || selectedLeadIds.length === 0) {
      toast({ title: "Error", description: "Select at least one lead and an agent.", variant: "destructive" })
      return
    }

    setAssigning(true)
    const res = await assignLeadsBulk(selectedLeadIds, selectedAgentId)
    
    if (res.success) {
      toast({ title: "Success! 🚀", description: `${res.count} leads injected into the dialer.`, className: "bg-indigo-600 text-white" })
      fetchLeadsAndAgents() // Refresh table
    } else {
      toast({ title: "Assignment Failed", description: res.error, variant: "destructive" })
    }
    setAssigning(false)
  }

  // Client-side text search filter
  const filteredLeads = leads.filter(l => 
    l.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    l.phone.includes(searchQuery)
  )

  return (
    <div className="space-y-6 pb-10 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <Users className="h-8 w-8 text-indigo-600" />
            Dialer Queue Management
          </h1>
          <p className="text-slate-500 mt-1">Select and filter leads to inject them into a telecaller's Auto-Dialer.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* --- LEFT: THE ACTION PANEL --- */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="border-2 border-indigo-100 shadow-lg sticky top-6">
            <CardHeader className="bg-indigo-50 border-b border-indigo-100 pb-4">
              <CardTitle className="text-indigo-800 text-lg">Assign Selected Leads</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="bg-slate-100 p-4 rounded-lg text-center border border-slate-200 transition-all">
                <span className="text-4xl font-black text-indigo-600">{selectedLeadIds.length}</span>
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mt-1">Leads Selected</p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700">Target Telecaller</Label>
                <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                  <SelectTrigger className="w-full bg-white border-slate-300">
                    <SelectValue placeholder="Choose an agent..." />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map(agent => (
                      <SelectItem key={agent.id} value={agent.id}>{agent.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button 
                onClick={handleAssign} 
                disabled={assigning || selectedLeadIds.length === 0 || !selectedAgentId}
                className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-base"
              >
                {assigning ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Send className="h-5 w-5 mr-2" />}
                Inject into Dialer
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* --- RIGHT: THE LEAD TABLE & FILTERS --- */}
        <div className="lg:col-span-3 space-y-4">
          
          {/* ADVANCED FILTER PANEL */}
          <Card className="shadow-sm border border-slate-200">
            <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
               <div className="flex items-center gap-4 flex-1 mr-4">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input placeholder="Quick search name or phone..." className="pl-9 bg-white" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                  </div>
               </div>
               <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-2">
                 <Filter className="h-4 w-4" /> {showFilters ? 'Hide Filters' : 'Advanced Filters'}
               </Button>
            </div>

            {showFilters && (
              <div className="p-4 bg-white grid grid-cols-1 md:grid-cols-3 gap-4 border-b">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger><SelectValue placeholder="Lead Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Default (Unassigned / Dead)</SelectItem>
                    <SelectItem value="New Lead">New Lead</SelectItem>
                    <SelectItem value="Contacted">Contacted</SelectItem>
                    <SelectItem value="Interested">Interested</SelectItem>
                    <SelectItem value="Not Interested">Not Interested</SelectItem>
                    <SelectItem value="Dead Bucket">Dead Bucket</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                  <SelectTrigger><SelectValue placeholder="Lead Source" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    <SelectItem value="website">Website</SelectItem>
                    <SelectItem value="facebook">Facebook Ads</SelectItem>
                    <SelectItem value="referral">Referral</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger><div className="flex items-center gap-2"><Calendar className="h-4 w-4" /><SelectValue placeholder="Date Added" /></div></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="yesterday">Yesterday</SelectItem>
                    <SelectItem value="this_month">This Month</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>

                {dateRange === "custom" && (
                  <div className="md:col-span-3 flex items-center gap-4 p-3 bg-slate-50 border rounded-md">
                    <div className="flex items-center gap-2"><Label>From:</Label><Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="w-auto"/></div>
                    <div className="flex items-center gap-2"><Label>To:</Label><Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="w-auto"/></div>
                  </div>
                )}

                <div className="md:col-span-3 flex justify-end gap-2 mt-2">
                  <Button variant="ghost" onClick={clearFilters}><X className="h-4 w-4 mr-2" /> Clear All</Button>
                  {/* Note: Fetch happens automatically due to useEffect dependency array! */}
                </div>
              </div>
            )}
            
            {/* THE DATA TABLE */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 bg-slate-100 uppercase font-semibold">
                  <tr>
                    <th className="p-4 w-12 text-center">
                      <button onClick={toggleSelectAll} className="text-slate-400 hover:text-indigo-600">
                        {selectedLeadIds.length === filteredLeads.length && filteredLeads.length > 0 ? (
                          <CheckSquare className="h-5 w-5 text-indigo-600" />
                        ) : (
                          <Square className="h-5 w-5" />
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-4">Customer Details</th>
                    <th className="py-3 px-4">Current Status</th>
                    <th className="py-3 px-4">Source</th>
                    <th className="py-3 px-4">Date Added</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={5} className="text-center p-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-indigo-500" /></td></tr>
                  ) : filteredLeads.length === 0 ? (
                    <tr><td colSpan={5} className="text-center p-8 text-slate-500">No leads found matching your filters.</td></tr>
                  ) : (
                    filteredLeads.map(lead => {
                      const isSelected = selectedLeadIds.includes(lead.id)
                      return (
                        <tr key={lead.id} className={`border-b transition-colors hover:bg-slate-50 cursor-pointer ${isSelected ? 'bg-indigo-50/50' : ''}`} onClick={() => toggleSelectLead(lead.id)}>
                          <td className="p-4 text-center">
                            {isSelected ? <CheckSquare className="h-5 w-5 text-indigo-600 mx-auto" /> : <Square className="h-5 w-5 text-slate-300 mx-auto" />}
                          </td>
                          <td className="py-3 px-4"><p className="font-semibold text-slate-800">{lead.name}</p><p className="text-xs text-slate-500">{lead.phone}</p></td>
                          <td className="py-3 px-4">
                            <Badge variant="outline" className={['New Lead', 'new'].includes(lead.status) ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-100 text-slate-600'}>
                              {lead.status || "Unassigned"}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-slate-600">{lead.source || "Unknown"}</td>
                          <td className="py-3 px-4 text-slate-500">{new Date(lead.created_at).toLocaleDateString()}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="p-4 bg-slate-50 border-t text-xs text-slate-400 text-right">
                Showing {filteredLeads.length} leads
            </div>
          </Card>
        </div>

      </div>
    </div>
  )
}
