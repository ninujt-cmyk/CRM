"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"
import { 
  Users, Search, Filter, Loader2, Send, CheckSquare, Square, X, SplitSquareHorizontal, UserCheck, AlertOctagon, Zap
} from "lucide-react"
import { assignLeadsBulk, unassignLeadsBulk } from "@/app/actions/dialer-campaigns"

// --- TYPES ---
interface Lead {
  id: string;
  name: string;
  phone: string;
  source: string | null;
  status: string;
  created_at: string;
  priority?: string;
  assigned_to?: string | null;
}

interface Agent {
  id: string;
  full_name: string;
  pending_leads: number; 
}

export default function DialerAssignmentPage() {
  const supabase = createClient()
  const { toast } = useToast()
  
  // Data State
  const [leads, setLeads] = useState<Lead[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([])
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]) 
  
  // Injection Options State
  const [resetStatus, setResetStatus] = useState(true)
  const [assignPriority, setAssignPriority] = useState("none")

  // Filter States
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [sourceFilter, setSourceFilter] = useState("all")
  const [agentFilter, setAgentFilter] = useState("all") 
  const [priorityFilter, setPriorityFilter] = useState("all") // NEW
  const [dateRange, setDateRange] = useState("all")
  const [customStart, setCustomStart] = useState("")
  const [customEnd, setCustomEnd] = useState("")
  const [fetchLimit, setFetchLimit] = useState("500") 
  
  // UI States
  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  // 1. FETCH LOGIC
  const fetchLeadsAndAgents = useCallback(async () => {
    setLoading(true)
    
    // A. Fetch Agents
    const { data: agentsData } = await supabase
      .from('users')
      .select('id, full_name')
      .in('role', ['telecaller', 'agent'])
      .order('full_name', { ascending: true })

    // B. Fetch Active Workloads for Agents
    const { data: activeLeads } = await supabase
      .from('leads')
      .select('assigned_to')
      .in('status', ['New Lead', 'new', 'Follow Up', 'Contacted'])
      .not('assigned_to', 'is', null)

    const workloadMap: Record<string, number> = {}
    if (activeLeads) {
        activeLeads.forEach(lead => {
            if (lead.assigned_to) {
                workloadMap[lead.assigned_to] = (workloadMap[lead.assigned_to] || 0) + 1
            }
        })
    }

    if (agentsData) {
        setAgents(agentsData.map(a => ({
            ...a,
            pending_leads: workloadMap[a.id] || 0
        })))
    }

    // C. Fetch Leads dynamically based on filters
    let query = supabase
      .from('leads')
      .select('id, name, phone, source, status, created_at, priority, assigned_to')
      
    // Status Logic
    if (statusFilter === "all" && agentFilter === "all") {
      query = query.or('assigned_to.is.null,status.in.(Not Interested,Dead Bucket,nr,not_eligible,self_employed)')
    } else if (statusFilter !== "all") {
      query = query.eq('status', statusFilter)
    }

    // Agent Ownership Logic (The Sweeper)
    if (agentFilter === "unassigned") query = query.is('assigned_to', null)
    else if (agentFilter !== "all") query = query.eq('assigned_to', agentFilter)

    if (sourceFilter !== "all") query = query.eq('source', sourceFilter)
    
    if (priorityFilter !== "all") query = query.eq('priority', priorityFilter)

    // Date Logic
    if (dateRange !== "all") {
      const today = new Date();
      today.setHours(0,0,0,0);
      if (dateRange === "today") query = query.gte('created_at', today.toISOString());
      else if (dateRange === "yesterday") {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        query = query.gte('created_at', yesterday.toISOString()).lt('created_at', today.toISOString());
      } 
      else if (dateRange === "this_month") query = query.gte('created_at', new Date(today.getFullYear(), today.getMonth(), 1).toISOString());
      else if (dateRange === "custom" && customStart && customEnd) {
        query = query.gte('created_at', new Date(customStart).toISOString())
                     .lte('created_at', new Date(customEnd + 'T23:59:59').toISOString());
      }
    }

    const { data: leadsData } = await query.order('created_at', { ascending: false }).limit(parseInt(fetchLimit))

    if (leadsData) setLeads(leadsData)
    setSelectedLeadIds([]) 
    setLoading(false)
  }, [supabase, statusFilter, sourceFilter, agentFilter, priorityFilter, dateRange, customStart, customEnd, fetchLimit])

  useEffect(() => { fetchLeadsAndAgents() }, [fetchLeadsAndAgents])

  const clearFilters = () => {
    setStatusFilter("all"); setSourceFilter("all"); setAgentFilter("all"); setPriorityFilter("all"); setDateRange("all");
    setCustomStart(""); setCustomEnd(""); setSearchQuery("");
  }

  // --- SELECTION LOGIC ---
  const filteredLeads = leads.filter(l => l.name.toLowerCase().includes(searchQuery.toLowerCase()) || l.phone.includes(searchQuery))

  const toggleSelectAll = () => setSelectedLeadIds(selectedLeadIds.length === filteredLeads.length ? [] : filteredLeads.map(l => l.id))
  const toggleSelectLead = (id: string) => setSelectedLeadIds(prev => prev.includes(id) ? prev.filter(lId => lId !== id) : [...prev, id])
  const toggleSelectAgent = (id: string) => setSelectedAgentIds(prev => prev.includes(id) ? prev.filter(aId => aId !== id) : [...prev, id])

  // Quick Select Tools
  const selectTopN = (n: number) => {
    setSelectedLeadIds(filteredLeads.slice(0, n).map(l => l.id));
  }

  // --- ACTIONS ---
  const handleAssign = async () => {
    if (selectedAgentIds.length === 0 || selectedLeadIds.length === 0) {
      toast({ title: "Error", description: "Select at least one lead and one agent.", variant: "destructive" })
      return
    }

    setAssigning(true)
    
    // 🔥 TRUE ROUND-ROBIN DISTRIBUTION ALGORITHM
    const agentBatches: Record<string, string[]> = {};
    selectedAgentIds.forEach(id => agentBatches[id] = []);
    
    selectedLeadIds.forEach((leadId, index) => {
        const agentId = selectedAgentIds[index % selectedAgentIds.length];
        agentBatches[agentId].push(leadId);
    });
    
    let successCount = 0;
    let failCount = 0;

    // Send the batches
    for (const agentId of selectedAgentIds) {
        const assignedLeads = agentBatches[agentId];
        if (assignedLeads.length > 0) {
            const res = await assignLeadsBulk(assignedLeads, agentId, { resetStatus, priority: assignPriority });
            if (res.success) successCount += res.count || 0;
            else failCount += assignedLeads.length;
        }
    }
    
    if (successCount > 0) {
      toast({ title: "Distribution Complete 🚀", description: `Successfully distributed ${successCount} leads seamlessly.`, className: "bg-indigo-600 text-white" })
      setSelectedAgentIds([]); setAssignPriority("none");
      fetchLeadsAndAgents();
    }
    if (failCount > 0) toast({ title: "Partial Failure", description: `Failed to assign ${failCount} leads.`, variant: "destructive" })
    
    setAssigning(false)
  }

  const handleUnassign = async () => {
      if (selectedLeadIds.length === 0) return;
      if (!confirm(`Are you sure you want to pull ${selectedLeadIds.length} leads out of their current queues?`)) return;

      setAssigning(true);
      const res = await unassignLeadsBulk(selectedLeadIds);
      if (res.success) {
          toast({ title: "Queues Cleared", description: `Unassigned ${res.count} leads successfully.` })
          fetchLeadsAndAgents();
      } else {
          toast({ title: "Error", description: res.error, variant: "destructive" })
      }
      setAssigning(false);
  }

  return (
    <div className="space-y-6 pb-10 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <SplitSquareHorizontal className="h-8 w-8 text-indigo-600" />
            Campaign Distribution
          </h1>
          <p className="text-slate-500 mt-1">Select leads, set priority, and auto-distribute into dialer queues.</p>
        </div>
        <div className="flex items-center gap-3">
            <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 shadow-sm" onClick={handleUnassign} disabled={selectedLeadIds.length === 0 || assigning}>
                <AlertOctagon className="h-4 w-4 mr-2" /> Unassign Selected ({selectedLeadIds.length})
            </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* --- LEFT: THE ACTION PANEL --- */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="border-2 border-indigo-100 shadow-lg sticky top-6">
            <CardHeader className="bg-indigo-50 border-b border-indigo-100 pb-4">
              <CardTitle className="text-indigo-800 text-lg flex items-center gap-2">
                  <UserCheck className="h-5 w-5" /> Target Telecallers
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="bg-slate-100 p-4 rounded-lg text-center border border-slate-200 transition-all">
                <span className="text-4xl font-black text-indigo-600">{selectedLeadIds.length}</span>
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mt-1">Leads Selected</p>
                {selectedLeadIds.length > 0 && selectedAgentIds.length > 0 && (
                    <p className="text-xs text-indigo-500 font-bold mt-2">
                        ≈ {Math.ceil(selectedLeadIds.length / selectedAgentIds.length)} leads per agent
                    </p>
                )}
              </div>

              {/* Injection Options */}
              <div className="bg-white border rounded-md p-3 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between">
                      <Label htmlFor="reset-status" className="text-xs text-slate-600 font-bold flex flex-col">
                          Reset to 'New Lead'
                          <span className="font-normal text-[10px] text-slate-400">Forces dialer pickup</span>
                      </Label>
                      <Switch id="reset-status" checked={resetStatus} onCheckedChange={setResetStatus} />
                  </div>
                  <div className="space-y-1">
                      <Label className="text-xs text-slate-600 font-bold">Inject Priority</Label>
                      <Select value={assignPriority} onValueChange={setAssignPriority}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Standard Priority" /></SelectTrigger>
                          <SelectContent>
                              <SelectItem value="none">Standard Priority</SelectItem>
                              <SelectItem value="urgent">Urgent (Top of Queue)</SelectItem>
                              <SelectItem value="high">High Priority</SelectItem>
                          </SelectContent>
                      </Select>
                  </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <Label className="text-sm font-semibold text-slate-700">Select Agents</Label>
                    <span className="text-xs text-slate-400">Round-Robin</span>
                </div>
                <div className="max-h-[250px] overflow-y-auto space-y-2 border border-slate-200 rounded-md p-2 bg-slate-50">
                    {agents.map(agent => {
                        const isSelected = selectedAgentIds.includes(agent.id)
                        const isOverloaded = agent.pending_leads >= 50; // Visual warning if queue is getting full
                        
                        return (
                            <label key={agent.id} className={`flex items-center justify-between p-2 rounded-md cursor-pointer border transition-colors ${isSelected ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200 hover:border-indigo-300'}`}>
                                <div className="flex items-center gap-3">
                                    <div className={`h-4 w-4 rounded border flex items-center justify-center ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                                        {isSelected && <CheckSquare className="h-3 w-3 text-white" />}
                                    </div>
                                    <span className={`text-sm font-medium ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>{agent.full_name}</span>
                                </div>
                                <Badge variant="secondary" className={`${isOverloaded ? 'bg-red-100 text-red-700 font-bold' : 'bg-slate-100 text-slate-600'}`}>
                                    {agent.pending_leads}
                                </Badge>
                            </label>
                        )
                    })}
                </div>
              </div>

              <Button 
                onClick={handleAssign} 
                disabled={assigning || selectedLeadIds.length === 0 || selectedAgentIds.length === 0}
                className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-base shadow-md"
              >
                {assigning ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Send className="h-5 w-5 mr-2" />}
                Distribute Leads
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* --- RIGHT: THE LEAD TABLE & FILTERS --- */}
        <div className="lg:col-span-3 space-y-4">
          
          <Card className="shadow-sm border border-slate-200">
            <div className="p-4 border-b bg-slate-50 flex items-center justify-between flex-wrap gap-4">
               <div className="flex items-center gap-4 flex-1 min-w-[250px]">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input placeholder="Quick search name or phone..." className="pl-9 bg-white" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                  </div>
               </div>
               <div className="flex items-center gap-2">
                   {/* QUICK SELECT BADGES */}
                   <div className="hidden md:flex gap-1 mr-4 border-r pr-4">
                       <Button variant="ghost" size="sm" onClick={() => selectTopN(50)} className="text-xs text-indigo-600 hover:bg-indigo-50">Select 50</Button>
                       <Button variant="ghost" size="sm" onClick={() => selectTopN(100)} className="text-xs text-indigo-600 hover:bg-indigo-50">Select 100</Button>
                   </div>
                   
                   <Select value={fetchLimit} onValueChange={setFetchLimit}>
                      <SelectTrigger className="w-[120px] bg-white text-xs"><SelectValue placeholder="Limit" /></SelectTrigger>
                      <SelectContent>
                          <SelectItem value="100">Fetch 100</SelectItem>
                          <SelectItem value="500">Fetch 500</SelectItem>
                          <SelectItem value="1000">Fetch 1000</SelectItem>
                          <SelectItem value="2000">Fetch 2000</SelectItem>
                          <SelectItem value="3000">Fetch 3000</SelectItem>
                      </SelectContent>
                   </Select>
                   <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-2">
                     <Filter className="h-4 w-4" /> {showFilters ? 'Hide Filters' : 'Advanced Filters'}
                   </Button>
               </div>
            </div>

            {/* Advanced Filters */}
            {showFilters && (
              <div className="p-4 bg-white grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 border-b shadow-inner">
                
                {/* Agent Sweeper */}
                <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Current Assignee</Label>
                    <Select value={agentFilter} onValueChange={setAgentFilter}>
                        <SelectTrigger><SelectValue placeholder="All Agents" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Any / Default</SelectItem>
                            <SelectItem value="unassigned">Unassigned Only</SelectItem>
                            {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.full_name}'s Queue</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Lead Status</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger><SelectValue placeholder="Lead Status" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Any Status</SelectItem>
                        <SelectItem value="New Lead">New Lead</SelectItem>
                        <SelectItem value="Contacted">Contacted</SelectItem>
                        <SelectItem value="Follow Up">Follow Up</SelectItem>
                        <SelectItem value="Dead Bucket">Dead Bucket</SelectItem>
                    </SelectContent>
                    </Select>
                </div>

                <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Priority Level</Label>
                    <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger><SelectValue placeholder="Any Priority" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Any Priority</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                    </Select>
                </div>

                <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Date Added</Label>
                    <Select value={dateRange} onValueChange={setDateRange}>
                    <SelectTrigger><SelectValue placeholder="Date Added" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Time</SelectItem>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="yesterday">Yesterday</SelectItem>
                        <SelectItem value="this_month">This Month</SelectItem>
                        <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                    </Select>
                </div>

                {dateRange === "custom" && (
                  <div className="lg:col-span-4 flex items-center gap-4 p-3 bg-slate-50 border rounded-md mt-2">
                    <div className="flex items-center gap-2"><Label>From:</Label><Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="w-auto"/></div>
                    <div className="flex items-center gap-2"><Label>To:</Label><Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="w-auto"/></div>
                  </div>
                )}

                <div className="lg:col-span-4 flex justify-end gap-2 mt-2 pt-2 border-t">
                  <Button variant="ghost" size="sm" onClick={clearFilters}><X className="h-4 w-4 mr-2" /> Clear Filters</Button>
                </div>
              </div>
            )}
            
            {/* THE DATA TABLE */}
            <div className="overflow-x-auto max-h-[600px]">
              <table className="w-full text-sm text-left relative">
                <thead className="text-xs text-slate-500 bg-slate-100 uppercase font-semibold sticky top-0 z-10 shadow-sm">
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
                    <th className="py-3 px-4">Assignee</th>
                    <th className="py-3 px-4">Current Status</th>
                    <th className="py-3 px-4">Date Added</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={5} className="text-center p-12"><Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-500" /></td></tr>
                  ) : filteredLeads.length === 0 ? (
                    <tr><td colSpan={5} className="text-center p-12 text-slate-500">No leads found matching your filters.</td></tr>
                  ) : (
                    filteredLeads.map(lead => {
                      const isSelected = selectedLeadIds.includes(lead.id)
                      const owner = agents.find(a => a.id === lead.assigned_to)?.full_name || "Unassigned";

                      return (
                        <tr key={lead.id} className={`border-b transition-colors hover:bg-slate-50 cursor-pointer ${isSelected ? 'bg-indigo-50/50' : ''}`} onClick={() => toggleSelectLead(lead.id)}>
                          <td className="p-4 text-center">
                            {isSelected ? <CheckSquare className="h-5 w-5 text-indigo-600 mx-auto" /> : <Square className="h-5 w-5 text-slate-300 mx-auto" />}
                          </td>
                          <td className="py-3 px-4 flex items-center gap-2">
                             <div>
                                <p className="font-semibold text-slate-800">{lead.name}</p>
                                <p className="text-xs text-slate-500">{lead.phone}</p>
                             </div>
                             {['urgent', 'high'].includes(lead.priority || "") && <Badge className="bg-red-100 text-red-700 ml-2 uppercase text-[10px]">{lead.priority}</Badge>}
                          </td>
                          <td className="py-3 px-4 text-slate-600 font-medium">
                            {owner}
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant="outline" className={['New Lead', 'new'].includes(lead.status) ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-100 text-slate-600'}>
                              {lead.status || "Unknown"}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-slate-500">{new Date(lead.created_at).toLocaleDateString()}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="p-4 bg-slate-50 border-t flex items-center justify-between text-xs text-slate-500">
                <span>Showing {filteredLeads.length} leads</span>
                <span>Database Limit: {fetchLimit} rows</span>
            </div>
          </Card>
        </div>

      </div>
    </div>
  )
}
