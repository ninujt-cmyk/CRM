"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { 
  Sparkles, Phone, Search, Loader2, AlertCircle, CheckCircle2, RefreshCw, X, User, Bot
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Lead {
  id: string;
  name: string;
  phone: string;
  status: string;
  created_at: string;
  assigned_to?: string | null;
}

interface Telecaller {
  id: string;
  full_name: string;
}

export default function AICallingPage() {
  const supabase = createClient();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [telecallers, setTelecallers] = useState<Telecaller[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState("new");
  const [assignedToFilter, setAssignedToFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  const [notification, setNotification] = useState<{type: 'success'|'error', msg: string} | null>(null);

  // 🔴 CONCURRENCY STATES: Arrays and Maps to handle multiple calls
  const [activeCallIds, setActiveCallIds] = useState<string[]>([]);
  const [liveMessagesMap, setLiveMessagesMap] = useState<Record<string, {role: string, message: string}[]>>({});
  
  // Dynamic refs for auto-scrolling multiple chat windows
  const chatScrollRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const fetchTelecallers = async () => {
      const { data } = await supabase.from('users').select('id, full_name');
      if (data) setTelecallers(data);
    };
    fetchTelecallers();
  }, [supabase]);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('leads')
        .select('id, name, phone, status, created_at, assigned_to')
        .order('created_at', { ascending: false })
        .limit(100);

      if (statusFilter !== "all") query = query.eq('status', statusFilter);
      if (assignedToFilter !== "all") {
        if (assignedToFilter === "unassigned") query = query.is('assigned_to', null);
        else query = query.eq('assigned_to', assignedToFilter);
      }
      if (searchQuery) query = query.ilike('phone', `%${searchQuery}%`);

      const { data, error } = await query;
      if (error) throw error;
      setLeads(data || []);
    } catch (err) {
      console.error("Error fetching leads:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [statusFilter, assignedToFilter, searchQuery]);

  // Real-time Database Status Subscription
  useEffect(() => {
    const channel = supabase
      .channel('ai_leads_updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads' }, (payload: any) => {
        setLeads((currentLeads) => 
          currentLeads.map(lead => 
            lead.id === payload.new.id ? { ...lead, status: payload.new.status } : lead
          )
        );
        
        // If an active call's status changes from 'AI Dialing', it means the call ended.
        // Keep the monitor open for 5 seconds to read the final intent, then close it.
        if (payload.new.status !== 'AI Dialing') {
           setTimeout(() => {
              setActiveCallIds(prev => prev.filter(id => id !== payload.new.id));
           }, 5000);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase]);

  // 🔴 REAL-TIME BROADCAST (Handles MULTIPLE transcripts safely)
  useEffect(() => {
    const channel = supabase.channel('live-transcripts')
      .on('broadcast', { event: 'transcript' }, (payload: any) => {
        const { leadId, role, message } = payload.payload;
        
        // Append the message to the specific lead's message array
        setLiveMessagesMap(prev => ({
            ...prev,
            [leadId]: [...(prev[leadId] || []), { role, message }]
        }));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase]);

  // Auto-scroll ALL active chat windows
  useEffect(() => {
    activeCallIds.forEach(id => {
        const el = chatScrollRefs.current[id];
        if (el) el.scrollTop = el.scrollHeight;
    });
  }, [liveMessagesMap, activeCallIds]);

  const handle1ClickCall = async (lead: Lead) => {
    // Add to active calls & initialize empty message array
    setActiveCallIds(prev => [...prev, lead.id]);
    setLiveMessagesMap(prev => ({ ...prev, [lead.id]: [] }));
    setNotification(null);

    try {
      const response = await fetch('/api/admin/ai-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: lead.id,
          phoneNumber: lead.phone,
          leadName: lead.name
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to start call");

      setNotification({ type: 'success', msg: `Ringing ${lead.name}...` });
      setLeads(current => current.map(l => l.id === lead.id ? { ...l, status: 'AI Dialing' } : l));

    } catch (error: any) {
      setNotification({ type: 'error', msg: error.message });
      // Remove from active calls if it failed to dial
      setActiveCallIds(prev => prev.filter(id => id !== lead.id));
    }
  };

  const manuallyCloseMonitor = (leadId: string) => {
    setActiveCallIds(prev => prev.filter(id => id !== leadId));
  };

  const getStatusColor = (status: string) => {
    if (status === 'AI Dialing') return 'bg-indigo-100 text-indigo-800 animate-pulse';
    if (status === 'Not_Interested') return 'bg-red-100 text-red-800';
    if (status === 'self_employed') return 'bg-amber-100 text-amber-800';
    if (status === 'Interested' || status === 'Documents_Sent') return 'bg-green-100 text-green-800';
    if (status === 'nr') return 'bg-gray-200 text-gray-800';
    if (status === 'new') return 'bg-blue-100 text-blue-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6 mt-4 relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-indigo-600" />
            1-Click AI Calling Hub
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manually select leads and dispatch the AI bot. View live transcripts in real-time.
          </p>
        </div>
        
        <div className="flex gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <Input 
              placeholder="Search phone..." 
              className="pl-9 w-40"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <Select value={assignedToFilter} onValueChange={setAssignedToFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Assignees</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {telecallers.map((tc) => (
                <SelectItem key={tc.id} value={tc.id}>
                  {tc.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="AI Dialing">AI Dialing</SelectItem>
              <SelectItem value="nr">Not Reachable</SelectItem>
              <SelectItem value="follow_up">Follow Up</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="icon" onClick={fetchLeads}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {notification && activeCallIds.length === 0 && (
        <div className={`p-4 rounded-lg flex items-center gap-3 text-sm font-medium transition-all ${
          notification.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {notification.type === 'success' ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          {notification.msg}
        </div>
      )}

      {/* 🔴 MULTI-CALL GRID (Adapts based on active call count) */}
      {activeCallIds.length > 0 && (
        <div className={`grid gap-4 mb-6 ${
            activeCallIds.length === 1 ? 'grid-cols-1' : 
            activeCallIds.length === 2 ? 'grid-cols-2' : 
            'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
        }`}>
            {activeCallIds.map((leadId) => {
                const lead = leads.find(l => l.id === leadId);
                const messages = liveMessagesMap[leadId] || [];

                return (
                    <div key={leadId} className="bg-slate-900 rounded-xl shadow-2xl border border-slate-700 overflow-hidden flex flex-col h-80 transition-all duration-300">
                        <div className="bg-slate-950 p-3 border-b border-slate-800 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="relative flex h-3 w-3">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                </div>
                                <h3 className="text-white font-medium text-sm flex items-center gap-2 truncate max-w-[200px]">
                                    {lead?.name || "Customer"}
                                    <span className="text-slate-400 text-xs font-normal">({lead?.phone})</span>
                                </h3>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => manuallyCloseMonitor(leadId)} className="h-6 w-6 p-0 text-slate-400 hover:text-white hover:bg-slate-800">
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                        
                        <div 
                            ref={(el) => { chatScrollRefs.current[leadId] = el }} 
                            className="flex-1 p-4 overflow-y-auto space-y-3"
                        >
                            {messages.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2">
                                    <Loader2 className="h-6 w-6 animate-spin text-slate-600" />
                                    <p className="text-xs">Connecting call...</p>
                                </div>
                            ) : (
                                messages.map((msg, i) => (
                                    <div key={i} className={`flex gap-2 max-w-[85%] ${msg.role === 'ai' ? 'mr-auto' : 'ml-auto flex-row-reverse'}`}>
                                        <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'ai' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
                                            {msg.role === 'ai' ? <Bot className="h-3 w-3" /> : <User className="h-3 w-3" />}
                                        </div>
                                        <div className={`p-2 rounded-lg text-xs leading-relaxed ${msg.role === 'ai' ? 'bg-slate-800 text-slate-200 rounded-tl-none' : 'bg-blue-600 text-white rounded-tr-none'}`}>
                                            {msg.message}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead>Customer Info</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Assignee</TableHead>
              <TableHead>AI Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto" />
                  <p className="text-sm text-gray-500 mt-2">Loading leads...</p>
                </TableCell>
              </TableRow>
            ) : leads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-gray-500">
                  No leads found. Adjust your filters.
                </TableCell>
              </TableRow>
            ) : (
              leads.map((lead) => {
                const isCurrentlyCalling = activeCallIds.includes(lead.id);
                
                return (
                  <TableRow key={lead.id} className="hover:bg-gray-50 transition-colors">
                    <TableCell>
                      <div className="font-medium text-gray-900">{lead.name}</div>
                      <div className="text-xs text-gray-500">
                        Added {new Date(lead.created_at).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="h-3 w-3" />
                        {lead.phone}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-gray-600">
                        {lead.assigned_to 
                          ? telecallers.find(t => t.id === lead.assigned_to)?.full_name || "Unknown"
                          : "Unassigned"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`${getStatusColor(lead.status)} border-0`}>
                        {lead.status.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        onClick={() => handle1ClickCall(lead)}
                        disabled={isCurrentlyCalling || lead.status === 'AI Dialing'}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                      >
                        {isCurrentlyCalling ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Live Now
                          </>
                        ) : lead.status === 'AI Dialing' ? (
                          "Dialing..."
                        ) : (
                          <>
                            <Sparkles className="mr-2 h-4 w-4" />
                            Trigger AI Bot
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
