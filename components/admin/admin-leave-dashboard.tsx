"use client";

import { useState, useMemo, useEffect } from "react";
import { format, differenceInDays, startOfDay } from "date-fns";
import { 
  CheckCircle, XCircle, Clock, Search, Filter, 
  Calendar, User, MoreHorizontal, FileText, Check, X,
  AlertTriangle, Layers, ArrowUpDown, Settings
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { approveLeave, rejectLeave } from "@/app/actions/leave";
import { createClient } from "@/lib/supabase/client";

// --- Types ---
interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

interface LeaveRecord {
  id: string;
  user_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
  created_at: string;
  rejection_reason?: string;
  user?: User;
}

interface AdminLeaveDashboardProps {
  leaves: LeaveRecord[];
  currentUserId: string;
  tenantId?: string; // 🔴 NEW: Secure Tenant Prop
}

export function AdminLeaveDashboard({ leaves: initialLeaves, currentUserId, tenantId }: AdminLeaveDashboardProps) {
  const supabase = createClient();
  const [leaves, setLeaves] = useState<LeaveRecord[]>(initialLeaves);
  const [activeTab, setActiveTab] = useState("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  
  // Bulk Actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Dialogs
  const [rejectDialog, setRejectDialog] = useState<{ isOpen: boolean; leaveId: string | null; isBulk?: boolean }>({
    isOpen: false, leaveId: null, isBulk: false
  });
  const [rejectionReason, setRejectionReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Leave Policy Settings
  const [showSettings, setShowSettings] = useState(false);
  const [allowances, setAllowances] = useState({ casual: 12, sick: 8, paid: 15, emergency: 3 });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [policyId, setPolicyId] = useState<string | null>(null);

  // Fetch Policies on Mount
  useEffect(() => {
    const fetchPolicies = async () => {
      // 🔴 STRICT FILE-LEVEL FILTERING FOR POLICIES
      let query = supabase.from('leave_policies').select('*');
      if (tenantId) query = query.eq('tenant_id', tenantId);

      const { data } = await query.limit(1).maybeSingle();
      if (data) {
          setAllowances({ casual: data.casual || 12, sick: data.sick || 8, paid: data.paid || 15, emergency: data.emergency || 3 });
          setPolicyId(data.id);
      }
    };
    fetchPolicies();
  }, [supabase, tenantId]);

  // Save Policy Settings
  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      if (policyId) {
          const { error } = await supabase.from('leave_policies').update(allowances).eq('id', policyId);
          if (error) throw error;
      } else {
          // Explicitly attach the tenant_id from the file level just to be perfectly safe
          const payload = tenantId ? { ...allowances, tenant_id: tenantId } : allowances;
          const { data, error } = await supabase.from('leave_policies').insert([payload]).select('id').single();
          if (error) throw error;
          if (data) setPolicyId(data.id);
      }
      toast.success("Leave policies updated for your workspace.");
      setShowSettings(false);
    } catch (e) {
      console.error(e);
      toast.error("Failed to update settings.");
    } finally {
      setIsSavingSettings(false);
    }
  };

  // --- Filtering & Sorting ---
  const filteredLeaves = useMemo(() => {
    return leaves
      .filter((leave) => {
        const matchesTab = activeTab === "all" ? true : leave.status === activeTab;
        const matchesSearch = 
          leave.user?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          leave.leave_type?.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesTab && matchesSearch;
      })
      .sort((a, b) => {
         const dateA = new Date(a.created_at).getTime();
         const dateB = new Date(b.created_at).getTime();
         return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
      });
  }, [leaves, activeTab, searchTerm, sortOrder]);

  const checkOverlap = (startDate: string, endDate: string, currentLeaveId: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return leaves.filter(l => 
        l.id !== currentLeaveId && 
        l.status === 'approved' && 
        new Date(l.start_date) <= end && 
        new Date(l.end_date) >= start
    );
  };

  // --- Stats Calculation ---
  const stats = {
    pending: leaves.filter((l) => l.status === "pending").length,
    approved: leaves.filter((l) => l.status === "approved").length,
    todayOnLeave: leaves.filter((l) => {
      if (l.status !== "approved") return false;
      const today = startOfDay(new Date());
      const lStart = startOfDay(new Date(l.start_date));
      const lEnd = startOfDay(new Date(l.end_date));
      return lStart <= today && lEnd >= today;
    }).length,
  };

  // --- Handlers ---
  const handleApprove = async (id: string) => {
    try {
      setIsProcessing(true);
      await approveLeave(id, currentUserId);
      setLeaves(prev => prev.map(l => l.id === id ? { ...l, status: 'approved' } : l));
      toast.success("Leave approved successfully");
    } catch (error) { toast.error("Failed to approve leave"); } 
    finally { setIsProcessing(false); }
  };

  const handleBulkApprove = async () => {
      try {
          setIsProcessing(true);
          const ids = Array.from(selectedIds);
          await Promise.all(ids.map(id => approveLeave(id, currentUserId)));
          setLeaves(prev => prev.map(l => ids.includes(l.id) ? { ...l, status: 'approved' } : l));
          setSelectedIds(new Set());
          toast.success(`${ids.length} requests approved`);
      } catch (error) { toast.error("Failed to bulk approve"); }
      finally { setIsProcessing(false); }
  };

  const handleReject = async () => {
    try {
      setIsProcessing(true);
      if (rejectDialog.isBulk) {
          const ids = Array.from(selectedIds);
          await Promise.all(ids.map(id => rejectLeave(id, currentUserId, rejectionReason)));
          setLeaves(prev => prev.map(l => ids.includes(l.id) ? { ...l, status: 'rejected', rejection_reason: rejectionReason } : l));
          setSelectedIds(new Set());
          toast.success(`${ids.length} requests rejected`);
      } else if (rejectDialog.leaveId) {
          await rejectLeave(rejectDialog.leaveId, currentUserId, rejectionReason);
          setLeaves(prev => prev.map(l => l.id === rejectDialog.leaveId ? { ...l, status: 'rejected', rejection_reason: rejectionReason } : l));
          toast.success("Leave rejected");
      }
      setRejectDialog({ isOpen: false, leaveId: null });
      setRejectionReason("");
    } catch (error) { toast.error("Failed to reject leave(s)"); } 
    finally { setIsProcessing(false); }
  };

  const toggleSelection = (id: string) => {
      const newSet = new Set(selectedIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
      if (selectedIds.size === filteredLeaves.length) setSelectedIds(new Set());
      else setSelectedIds(new Set(filteredLeaves.map(l => l.id)));
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
      pending: "bg-amber-100 text-amber-700 border-amber-200",
      rejected: "bg-red-100 text-red-700 border-red-200",
    };
    const icons: Record<string, any> = { approved: CheckCircle, pending: Clock, rejected: XCircle };
    const Icon = icons[status] || Clock;
    
    return (
      <Badge variant="outline" className={`flex w-fit items-center gap-1.5 px-2.5 py-0.5 capitalize ${styles[status]}`}>
        <Icon className="h-3.5 w-3.5" /> {status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6 relative animate-in fade-in duration-300">
      
      {/* Roster Cards Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="relative overflow-hidden border border-amber-200/60 dark:border-amber-900 bg-amber-500/5 shadow-2xs hover:shadow-xs transition-all duration-300 group rounded-2xl">
          <div className="absolute top-0 left-0 w-full h-[3px] bg-amber-500" />
          <CardContent className="p-5 flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Pending Reviews</p>
              <p className="text-3xl font-extrabold tracking-tight text-amber-600 dark:text-amber-500 mt-2">{stats.pending}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 shadow-3xs">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border border-emerald-200/60 dark:border-emerald-900 bg-emerald-500/5 shadow-2xs hover:shadow-xs transition-all duration-300 group rounded-2xl">
          <div className="absolute top-0 left-0 w-full h-[3px] bg-emerald-500" />
          <CardContent className="p-5 flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Approved Requests</p>
              <p className="text-3xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-500 mt-2">{stats.approved}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 shadow-3xs">
              <CheckCircle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border border-blue-200/60 dark:border-blue-900 bg-blue-500/5 shadow-2xs hover:shadow-xs transition-all duration-300 group rounded-2xl">
          <div className="absolute top-0 left-0 w-full h-[3px] bg-blue-500" />
          <CardContent className="p-5 flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-[11px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">On Leave Today</p>
              <p className="text-3xl font-extrabold tracking-tight text-blue-600 dark:text-blue-500 mt-2 flex items-center gap-1.5">
                {stats.todayOnLeave} <User className="h-5 w-5 opacity-40 text-blue-500" />
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 shadow-3xs">
              <Calendar className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-extrabold text-slate-850 dark:text-slate-100">Leave Requests Directory</CardTitle>
              <CardDescription className="text-xs">Review, approve, and configure employee leave applications and workspace allowances.</CardDescription>
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setShowSettings(true)} className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs">
                <Settings className="h-4 w-4 text-slate-500" />
              </Button>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
                <Input
                  placeholder="Search employee names..."
                  className="pl-9 w-[190px] lg:w-[250px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl font-medium text-xs shadow-2xs focus-visible:ring-blue-500/25 h-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button variant="outline" size="icon" onClick={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')} title={`Sort: ${sortOrder}`} className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs">
                  <ArrowUpDown className="h-4 w-4 text-slate-500" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={(val) => { setActiveTab(val); setSelectedIds(new Set()); }} className="w-full">
            <div className="p-3.5 border-b border-slate-100 dark:border-slate-800/80 flex justify-between items-center bg-slate-50/20 dark:bg-slate-950/10">
                <TabsList className="bg-slate-100 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-850 rounded-xl p-1">
                  <TabsTrigger value="pending" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 font-bold text-xs rounded-lg py-1 px-3">
                    Pending <Badge className="ml-1.5 bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 hover:bg-amber-100 border-0 font-extrabold text-[10px] py-0 px-1.5 h-4 rounded">{stats.pending}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="approved" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 font-bold text-xs rounded-lg py-1 px-3">Approved</TabsTrigger>
                  <TabsTrigger value="rejected" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 font-bold text-xs rounded-lg py-1 px-3">Rejected</TabsTrigger>
                  <TabsTrigger value="all" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 font-bold text-xs rounded-lg py-1 px-3">All History</TabsTrigger>
                </TabsList>
                
                {activeTab === 'pending' && filteredLeaves.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={toggleSelectAll} className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-500/5 rounded-lg py-1 px-2.5">
                        {selectedIds.size === filteredLeaves.length ? 'Deselect All' : 'Select All'}
                    </Button>
                )}
            </div>

            <TabsContent value={activeTab} className="m-0">
              {filteredLeaves.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center text-slate-500 dark:text-slate-400 bg-slate-50/20 dark:bg-slate-950/5">
                  <FileText className="h-12 w-12 mb-3.5 opacity-20 text-slate-400" />
                  <p className="font-bold text-slate-700 dark:text-slate-350 text-sm">No leave requests found</p>
                  <p className="text-xs font-medium text-slate-400 mt-1 max-w-[240px] leading-relaxed">No leave logs match the current search filters or request statuses.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {filteredLeaves.map((leave) => {
                    const days = differenceInDays(new Date(leave.end_date), new Date(leave.start_date)) + 1;
                    const isSelected = selectedIds.has(leave.id);
                    const overlaps = checkOverlap(leave.start_date, leave.end_date, leave.id);
                    
                    return (
                      <div key={leave.id} className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${isSelected ? 'bg-blue-500/5' : 'hover:bg-slate-50/40 dark:hover:bg-slate-900/30'}`}>
                        
                        <div className="flex items-center gap-3.5 min-w-[260px]">
                          {activeTab === 'pending' && (
                             <input 
                                type="checkbox" 
                                checked={isSelected} 
                                onChange={() => toggleSelection(leave.id)}
                                className="w-4.5 h-4.5 rounded-lg border-slate-300 dark:border-slate-800 text-blue-600 focus:ring-blue-500/30 cursor-pointer bg-white dark:bg-slate-900"
                             />
                          )}
                          <Avatar className="h-10 w-10 border border-slate-200 dark:border-slate-800 shadow-2xs relative">
                            <AvatarFallback className="bg-blue-500/10 text-blue-600 dark:text-blue-400 font-extrabold text-[12px]">
                              {leave.user?.full_name?.substring(0, 2).toUpperCase() || "U"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="space-y-0.5">
                            <p className="font-bold text-[13px] text-slate-850 dark:text-slate-50 tracking-tight">{leave.user?.full_name}</p>
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider capitalize">{leave.leave_type} Leave</span>
                                <span className="h-2 w-[1px] bg-slate-200 dark:bg-slate-800"></span>
                                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded uppercase tracking-wider">{leave.user?.role}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                          <div>
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                              <Calendar className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                              <span>{format(new Date(leave.start_date), "MMM d")} - {format(new Date(leave.end_date), "MMM d, yyyy")}</span>
                              <Badge className="bg-slate-100 dark:bg-slate-850 hover:bg-slate-100 text-slate-650 dark:text-slate-400 border-0 font-extrabold text-[10px] py-0 px-2 rounded-lg ml-1 shadow-none h-5">
                                {days} Day{days > 1 ? 's' : ''}
                              </Badge>
                            </div>
                            
                            {activeTab === 'pending' && overlaps.length > 0 && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/10 px-2 py-0.5 rounded-lg cursor-help mt-1.5 shadow-3xs">
                                                <AlertTriangle className="h-3 w-3 text-amber-500" /> {overlaps.length} Overlapping approved request{overlaps.length > 1 ? 's' : ''}
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl shadow-lg p-3">
                                            <p className="font-extrabold text-xs text-slate-800 dark:text-slate-200 mb-1.5 uppercase tracking-wider">Approved overlapping staff:</p>
                                            <ul className="text-[11px] font-bold text-slate-550 list-disc pl-4 space-y-0.5">
                                                {overlaps.map(o => <li key={o.id}>{o.user?.full_name} ({format(new Date(o.start_date), "MMM d")} - {format(new Date(o.end_date), "MMM d")})</li>)}
                                            </ul>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                          </div>

                          <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-50/40 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-850 p-2.5 rounded-xl shadow-3xs leading-relaxed max-w-[320px]">
                            <p className="line-clamp-2" title={leave.reason}>
                              <span className="font-bold text-slate-400 dark:text-slate-500 text-[10px] uppercase block mb-0.5 tracking-wider">Leave Purpose</span>
                              "{leave.reason}"
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 justify-end min-w-[150px]">
                          {leave.status === "pending" ? (
                            <div className="flex gap-1.5 bg-slate-100/50 dark:bg-slate-950/40 border border-slate-250/20 dark:border-slate-850 p-1 rounded-xl shadow-3xs">
                              <Button 
                                size="sm" variant="ghost" className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/10 bg-white dark:bg-slate-900 rounded-lg shadow-3xs"
                                onClick={() => handleApprove(leave.id)} disabled={isProcessing} title="Approve Leave"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                              <Button 
                                size="sm" variant="ghost" className="h-7 w-7 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 dark:hover:bg-rose-500/10 bg-white dark:bg-slate-900 rounded-lg shadow-3xs"
                                onClick={() => setRejectDialog({ isOpen: true, leaveId: leave.id })} disabled={isProcessing} title="Reject Leave"
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            getStatusBadge(leave.status)
                          )}
                          
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600 rounded-lg">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl shadow-md border border-slate-200 dark:border-slate-800">
                              <DropdownMenuItem onClick={() => toast.info(`Details: ${leave.reason}`)} className="text-xs font-bold">View Full details</DropdownMenuItem>
                              {leave.rejection_reason && (
                                <DropdownMenuItem className="text-rose-600 dark:text-rose-455 font-bold focus:bg-rose-500/5 focus:text-rose-700 text-xs">
                                  Reason: {leave.rejection_reason}
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Floating Bulk Actions Panel */}
      {selectedIds.size > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 dark:bg-slate-950 border border-slate-800 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-5 z-50 animate-in slide-in-from-bottom-5 duration-300">
              <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-blue-400 animate-pulse" />
                  <span className="font-extrabold text-xs tracking-tight">{selectedIds.size} Requests Selected</span>
              </div>
              <div className="flex gap-2 border-l border-slate-800 pl-5">
                  <Button variant="ghost" size="sm" className="font-bold text-xs text-slate-400 hover:text-white" onClick={() => setSelectedIds(new Set())}>Cancel</Button>
                  <Button size="sm" variant="destructive" className="font-bold text-xs rounded-xl shadow-none px-4 py-1.5" onClick={() => setRejectDialog({ isOpen: true, leaveId: null, isBulk: true })}>Reject Selection</Button>
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs border-0 rounded-xl px-4 py-1.5" onClick={handleBulkApprove} disabled={isProcessing}>{isProcessing ? "Processing..." : "Approve All"}</Button>
              </div>
          </div>
      )}

      {/* Reject Modal */}
      <Dialog open={rejectDialog.isOpen} onOpenChange={(open) => !open && setRejectDialog({ isOpen: false, leaveId: null, isBulk: false })}>
        <DialogContent className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-slate-850 dark:text-slate-100">{rejectDialog.isBulk ? `Reject ${selectedIds.size} Applications` : "Reject Leave Application"}</DialogTitle>
            <DialogDescription className="text-xs">Provide a brief rejection rationale. The requestor will receive an immediate notification.</DialogDescription>
          </DialogHeader>
          <div className="py-2.5">
            <Textarea placeholder="e.g. Schedule constraints on the active shift..." value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} className="min-h-[90px] font-semibold text-xs rounded-xl shadow-3xs" />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="font-bold text-xs rounded-xl" onClick={() => setRejectDialog({ isOpen: false, leaveId: null, isBulk: false })}>Cancel</Button>
            <Button variant="destructive" className="font-bold text-xs rounded-xl shadow-none" onClick={handleReject} disabled={!rejectionReason.trim() || isProcessing}>Reject Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Policy Settings Modal */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-slate-850 dark:text-slate-100">Leave Allowances Policy</DialogTitle>
            <DialogDescription className="text-xs">Configure the total annual leave limits allocated for staff.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3.5 py-4 border-y border-slate-100 dark:border-slate-800/80 my-1">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Casual Leave (Days)</Label>
              <Input type="number" value={allowances.casual} onChange={e => setAllowances({...allowances, casual: Number(e.target.value)})} className="font-bold text-xs rounded-xl h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Sick Leave (Days)</Label>
              <Input type="number" value={allowances.sick} onChange={e => setAllowances({...allowances, sick: Number(e.target.value)})} className="font-bold text-xs rounded-xl h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Paid Leave (Days)</Label>
              <Input type="number" value={allowances.paid} onChange={e => setAllowances({...allowances, paid: Number(e.target.value)})} className="font-bold text-xs rounded-xl h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Emergency Leave (Days)</Label>
              <Input type="number" value={allowances.emergency} onChange={e => setAllowances({...allowances, emergency: Number(e.target.value)})} className="font-bold text-xs rounded-xl h-9" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="font-bold text-xs rounded-xl" onClick={() => setShowSettings(false)}>Cancel</Button>
            <Button className="bg-blue-600 hover:bg-blue-700 font-bold text-xs rounded-xl" onClick={handleSaveSettings} disabled={isSavingSettings}>
              {isSavingSettings ? "Saving..." : "Save Policy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
