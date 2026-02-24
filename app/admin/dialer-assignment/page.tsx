"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { 
  Users, Search, Filter, Loader2, Send, CheckSquare, Square
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
  
  // State
  const [leads, setLeads] = useState<Lead[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState<string>("")
  const [searchQuery, setSearchQuery] = useState("")
  
  // Loading States
  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState(false)

  const fetchLeadsAndAgents = async () => {
    setLoading(true)
    
    // 1. Fetch Agents
    const { data: agentsData } = await supabase
      .from('users')
      .select('id, full_name')
      .in('role', ['telecaller', 'agent'])
      .order('full_name', { ascending: true })
      
    if (agentsData) setAgents(agentsData)

    // 2. Fetch Leads (Unassigned OR Dead/Recycled leads that need calling)
    // We look for leads where assigned_to is null, OR status is a dead status
    const { data: leadsData } = await supabase
      .from('leads')
      .select('id, name, phone, source, status, created_at')
      .or('assigned_to.is.null,status.in.(Not Interested,Dead Bucket)')
      .order('created_at', { ascending: false })
      .limit(200)

    if (leadsData) setLeads(leadsData)
    setLoading(false)
  }

  useEffect(() => {
    fetchLeadsAndAgents()
  }, [supabase])

  // --- SELECTION LOGIC ---
  const toggleSelectAll = () => {
    if (selectedLeadIds.length === filteredLeads.length) {
      setSelectedLeadIds([]) // Deselect all
    } else {
      setSelectedLeadIds(filteredLeads.map(l => l.id)) // Select all visible
    }
  }

  const toggleSelectLead = (id: string) => {
    setSelectedLeadIds(prev => 
      prev.includes(id) ? prev.filter(leadId => leadId !== id) : [...prev, id]
    )
  }

  // --- ASSIGN LOGIC ---
  const handleAssign = async () => {
    if (!selectedAgentId) {
      toast({ title: "Error", description: "Please select a Telecaller first.", variant: "destructive" })
      return
    }
    if (selectedLeadIds.length === 0) {
      toast({ title: "Error", description: "Please select at least one lead.", variant: "destructive" })
      return
    }

    setAssigning(true)
    const res = await assignLeadsBulk(selectedLeadIds, selectedAgentId)
    
    if (res.success) {
      toast({ 
        title: "Success! 🚀", 
        description: `${res.count} leads have been injected into the dialer queue.`,
        className: "bg-indigo-600 text-white"
      })
      // Clear selection and refresh list
      setSelectedLeadIds([])
      fetchLeadsAndAgents()
    } else {
      toast({ title: "Assignment Failed", description: res.error, variant: "destructive" })
    }
    setAssigning(false)
  }

  // Filter Leads by Search
  const filteredLeads = leads.filter(l => 
    l.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    l.phone.includes(searchQuery) ||
    (l.source && l.source.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  return (
    <div className="space-y-6 pb-10 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <Users className="h-8 w-8 text-indigo-600" />
            Dialer Queue Management
          </h1>
          <p className="text-slate-500 mt-1">Select leads and inject them directly into a telecaller's Auto-Dialer.</p>
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
              <div className="bg-slate-100 p-4 rounded-lg text-center border border-slate-200">
                <span className="text-4xl font-black text-indigo-600">{selectedLeadIds.length}</span>
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mt-1">Leads Selected</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Select Target Telecaller</label>
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

        {/* --- RIGHT: THE LEAD TABLE --- */}
        <div className="lg:col-span-3">
          <Card className="shadow-sm">
            <div className="p-4 border-b flex items-center gap-4 bg-slate-50">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Search by name, phone, or source..." 
                  className="pl-9 bg-white"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button variant="outline" className="flex items-center gap-2">
                <Filter className="h-4 w-4" /> Filter Options
              </Button>
            </div>

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
                    <tr><td colSpan={5} className="text-center p-8 text-slate-500">No leads available for assignment.</td></tr>
                  ) : (
                    filteredLeads.map(lead => {
                      const isSelected = selectedLeadIds.includes(lead.id)
                      return (
                        <tr 
                          key={lead.id} 
                          className={`border-b transition-colors hover:bg-slate-50 cursor-pointer ${isSelected ? 'bg-indigo-50/50' : ''}`}
                          onClick={() => toggleSelectLead(lead.id)}
                        >
                          <td className="p-4 text-center">
                            {isSelected ? <CheckSquare className="h-5 w-5 text-indigo-600 mx-auto" /> : <Square className="h-5 w-5 text-slate-300 mx-auto" />}
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-semibold text-slate-800">{lead.name}</p>
                            <p className="text-xs text-slate-500">{lead.phone}</p>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant="outline" className={lead.status === 'New Lead' || lead.status === 'new' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-100 text-slate-600'}>
                              {lead.status || "Unassigned"}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {lead.source || "Unknown"}
                          </td>
                          <td className="py-3 px-4 text-slate-500">
                            {new Date(lead.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

      </div>
    </div>
  )
}
