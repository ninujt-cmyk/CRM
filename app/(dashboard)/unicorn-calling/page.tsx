"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { 
  Sparkles, Phone, Search, Loader2, AlertCircle, CheckCircle2, RefreshCw, Bot
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getUnicornBalance, getUnicornScripts, createUnicornCallCampaign } from "@/app/actions/unicorn-ai";
import Link from "next/link";
import { Plus, Edit } from "lucide-react";

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

export default function UnicornCallingPage() {
  const supabase = createClient();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [telecallers, setTelecallers] = useState<Telecaller[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  
  // Unicorn State
  const [balance, setBalance] = useState<any>(null);
  const [scripts, setScripts] = useState<any[]>([]);
  const [selectedScriptId, setSelectedScriptId] = useState<string>("");
  const [loadingUnicorn, setLoadingUnicorn] = useState(true);
  const [campaignLoading, setCampaignLoading] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState("new");
  const [assignedToFilter, setAssignedToFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  const [notification, setNotification] = useState<{type: 'success'|'error', msg: string} | null>(null);

  useEffect(() => {
    const fetchInitData = async () => {
      setLoadingUnicorn(true);
      
      // Fetch Telecallers
      const { data: tcData } = await supabase.from('users').select('id, full_name');
      if (tcData) setTelecallers(tcData);

      // Fetch Unicorn Data
      const balanceRes = await getUnicornBalance();
      if (balanceRes.success) {
        setBalance(balanceRes.balance);
      } else {
        setNotification({ type: 'error', msg: `Balance Error: ${balanceRes.error}` });
      }
      
      const scriptsRes = await getUnicornScripts();
      if (scriptsRes.success) {
        setScripts(scriptsRes.scripts);
      } else if (!balanceRes.error) { // Only show script error if balance didn't already error
        setNotification({ type: 'error', msg: `Scripts Error: ${scriptsRes.error}` });
      }

      setLoadingUnicorn(false);
    };
    fetchInitData();
  }, [supabase]);

  const fetchLeads = async () => {
    setLoadingLeads(true);
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
      setLoadingLeads(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [statusFilter, assignedToFilter, searchQuery]);

  // Real-time Database Status Subscription
  useEffect(() => {
    const channel = supabase
      .channel('unicorn_leads_updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads' }, (payload: any) => {
        setLeads((currentLeads) => 
          currentLeads.map(lead => 
            lead.id === payload.new.id ? { ...lead, status: payload.new.status } : lead
          )
        );
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase]);

  const handleToggleLead = (id: string) => {
    setSelectedLeads(prev => 
      prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id]
    );
  };

  const handleLaunchCampaign = async () => {
    if (!selectedScriptId) {
      setNotification({ type: 'error', msg: "Please select a script first." });
      return;
    }
    if (selectedLeads.length === 0) {
      setNotification({ type: 'error', msg: "Please select at least one lead." });
      return;
    }

    setCampaignLoading(true);
    setNotification(null);

    try {
      const leadsToCall = leads.filter(l => selectedLeads.includes(l.id));
      const res = await createUnicornCallCampaign(
        selectedScriptId, 
        `Campaign ${new Date().toLocaleString()}`, 
        leadsToCall
      );

      if (res.success) {
        setNotification({ type: 'success', msg: `Campaign launched successfully for ${leadsToCall.length} leads!` });
        setSelectedLeads([]); // clear selection
      } else {
        setNotification({ type: 'error', msg: res.error || "Failed to launch campaign" });
      }
    } catch (err: any) {
      setNotification({ type: 'error', msg: err.message || "An unexpected error occurred" });
    } finally {
      setCampaignLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'AI Dialing') return 'bg-indigo-100 text-indigo-800 animate-pulse';
    if (status === 'Not_Interested') return 'bg-red-100 text-red-800';
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
            <Bot className="h-6 w-6 text-indigo-600" />
            Unicorn AI Calling
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Dispatch bulk AI voice calls using Unicorn AI Solution.
          </p>
        </div>
        
        {loadingUnicorn ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
             <Loader2 className="h-4 w-4 animate-spin" /> Fetching Unicorn Data...
          </div>
        ) : (
          <div className="flex gap-4">
            <Card className="shadow-sm">
              <CardContent className="p-4 flex flex-col justify-center">
                <p className="text-xs text-slate-500 font-medium uppercase">Wallet Balance</p>
                <p className="text-lg font-bold text-slate-900">
                  {balance !== null && balance !== undefined ? (
                    typeof balance === 'object' 
                      ? (balance.balance !== undefined ? `₹${balance.balance}` : (balance.walletBalance !== undefined ? `₹${balance.walletBalance}` : JSON.stringify(balance)))
                      : `₹${balance}`
                  ) : "N/A"}
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {notification && (
        <div className={`p-4 rounded-lg flex items-center gap-3 text-sm font-medium transition-all ${
          notification.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {notification.type === 'success' ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          {notification.msg}
        </div>
      )}

      {/* Campaign Controls */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
           <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2 flex-1 min-w-[250px]">
                <label className="text-sm font-medium text-slate-700">Select Script</label>
                <Select value={selectedScriptId} onValueChange={setSelectedScriptId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an AI Script..." />
                  </SelectTrigger>
                  <SelectContent>
                    {scripts && scripts.length > 0 ? (
                      scripts.map((script) => (
                        <SelectItem key={script.id} value={String(script.id)}>
                          {script.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>No scripts available</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {selectedScriptId && selectedScriptId !== "none" && (
                 <Link href={`/unicorn-calling/scripts/${selectedScriptId}`}>
                    <Button variant="outline" size="icon" className="mb-0.5">
                       <Edit className="h-4 w-4 text-slate-600" />
                    </Button>
                 </Link>
              )}
              
              <Link href="/unicorn-calling/scripts/new">
                <Button variant="outline" className="mb-0.5 border-dashed border-indigo-200 text-indigo-600 hover:bg-indigo-50">
                   <Plus className="h-4 w-4 mr-2" />
                   New Script
                </Button>
              </Link>
              
              <Button 
                onClick={handleLaunchCampaign} 
                disabled={campaignLoading || selectedLeads.length === 0}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {campaignLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Launch Campaign ({selectedLeads.length})
              </Button>
           </div>
        </CardContent>
      </Card>

      <div className="flex gap-3 flex-wrap bg-slate-50 p-3 rounded-lg border border-slate-200">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <Input 
            placeholder="Search phone..." 
            className="pl-9 w-40 bg-white"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <Select value={assignedToFilter} onValueChange={setAssignedToFilter}>
          <SelectTrigger className="w-40 bg-white">
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
          <SelectTrigger className="w-36 bg-white">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="AI Dialing">AI Dialing</SelectItem>
            <SelectItem value="nr">Not Reachable</SelectItem>
            <SelectItem value="Interested">Interested</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" size="icon" onClick={fetchLeads} className="bg-white">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead className="w-[50px]">
                <input 
                  type="checkbox" 
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedLeads(leads.filter(l => l.status !== 'AI Dialing').map(l => l.id));
                    } else {
                      setSelectedLeads([]);
                    }
                  }}
                  checked={selectedLeads.length > 0 && selectedLeads.length === leads.filter(l => l.status !== 'AI Dialing').length}
                />
              </TableHead>
              <TableHead>Customer Info</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Assignee</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingLeads ? (
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
                const isSelected = selectedLeads.includes(lead.id);
                
                return (
                  <TableRow key={lead.id} className={`hover:bg-gray-50 transition-colors ${isSelected ? 'bg-indigo-50/30' : ''}`}>
                    <TableCell>
                      <input 
                        type="checkbox" 
                        disabled={lead.status === 'AI Dialing'}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                        checked={isSelected}
                        onChange={() => handleToggleLead(lead.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-gray-900">{lead.name || "Customer"}</div>
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
