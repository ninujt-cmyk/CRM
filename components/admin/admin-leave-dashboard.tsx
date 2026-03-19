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
    <div className="space-y-6 relative">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-amber-500 shadow-sm">
          <CardHeader className="pb-4">
            <CardDescription className="font-medium">Pending Reviews</CardDescription>
            <CardTitle className="text-3xl font-bold text-amber-600">{stats.pending}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-emerald-500 shadow-sm">
          <CardHeader className="pb-4">
            <CardDescription className="font-medium">Approved (All Time)</CardDescription>
            <CardTitle className="text-3xl font-bold text-emerald-600">{stats.approved}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-blue-500 shadow-sm bg-blue-50/30">
          <CardHeader className="pb-4">
            <CardDescription className="font-medium text-blue-800">On Leave Today (Approved)</CardDescription>
            <CardTitle className="text-3xl font-bold text-blue-600 flex items-center gap-2">
                {stats.todayOnLeave} <User className="h-5 w-5 opacity-50"/>
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-4 border-b bg-slate-50">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Leave Requests</CardTitle>
              <CardDescription>Review and manage employee time off</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setShowSettings(true)} className="bg-white">
                <Settings className="h-4 w-4 text-slate-600" />
              </Button>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search employees..."
                  className="pl-9 w-[200px] lg:w-[260px] bg-white"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button variant="outline" size="icon" onClick={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')} title={`Sort: ${sortOrder}`} className="bg-white">
                  <ArrowUpDown className="h-4 w-4 text-slate-500" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={(val) => { setActiveTab(val); setSelectedIds(new Set()); }} className="w-full">
            <div className="p-4 border-b flex justify-between items-center">
                <TabsList className="bg-slate-100">
                  <TabsTrigger value="pending" className="data-[state=active]:bg-white">Pending <Badge variant="secondary" className="ml-2 bg-amber-100 text-amber-700">{stats.pending}</Badge></TabsTrigger>
                  <TabsTrigger value="approved" className="data-[state=active]:bg-white">Approved</TabsTrigger>
                  <TabsTrigger value="rejected" className="data-[state=active]:bg-white">Rejected</TabsTrigger>
                  <TabsTrigger value="all" className="data-[state=active]:bg-white">All History</TabsTrigger>
                </TabsList>
                
                {activeTab === 'pending' && filteredLeaves.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={toggleSelectAll} className="text-xs text-blue-600">
                        {selectedIds.size === filteredLeaves.length ? 'Deselect All' : 'Select All'}
                    </Button>
                )}
            </div>

            <TabsContent value={activeTab} className="m-0">
              {filteredLeaves.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground bg-slate-50/50">
                  <FileText className="h-12 w-12 mb-3 opacity-20 text-slate-400" />
                  <p className="font-medium text-slate-600">No leave records found</p>
                  <p className="text-sm">Try adjusting your filters or search term.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredLeaves.map((leave) => {
                    const days = differenceInDays(new Date(leave.end_date), new Date(leave.start_date)) + 1;
                    const isSelected = selectedIds.has(leave.id);
                    const overlaps = checkOverlap(leave.start_date, leave.end_date, leave.id);
                    
                    return (
                      <div key={leave.id} className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50'}`}>
                        
                        <div className="flex items-center gap-4 min-w-[250px]">
                          {activeTab === 'pending' && (
                             <input 
                                type="checkbox" 
                                checked={isSelected} 
                                onChange={() => toggleSelection(leave.id)}
                                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                             />
                          )}
                          <Avatar className="h-10 w-10 border border-slate-200">
                            <AvatarFallback className="bg-indigo-50 text-indigo-700 font-bold">
                              {leave.user?.full_name?.substring(0, 2).toUpperCase() || "U"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold text-sm text-slate-900">{leave.user?.full_name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs font-medium text-slate-500 capitalize">{leave.leave_type} Leave</span>
                                <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 rounded">{leave.user?.role}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                          <div>
                            <div className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1">
                              <Calendar className="h-4 w-4 text-slate-400" />
                              <span>{format(new Date(leave.start_date), "MMM d")} - {format(new Date(leave.end_date), "MMM d, yyyy")}</span>
                              <Badge variant="secondary" className="text-[10px] ml-1 bg-slate-100 text-slate-600">{days} Day{days > 1 ? 's' : ''}</Badge>
                            </div>
                            
                            {activeTab === 'pending' && overlaps.length > 0 && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded cursor-help">
                                                <AlertTriangle className="h-3 w-3" /> {overlaps.length} Overlapping Approved Leave{overlaps.length > 1 ? 's' : ''}
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p className="font-bold mb-1">Also off during this time:</p>
                                            <ul className="text-xs list-disc pl-3">
                                                {overlaps.map(o => <li key={o.id}>{o.user?.full_name} ({format(new Date(o.start_date), "MMM d")} - {format(new Date(o.end_date), "MMM d")})</li>)}
                                            </ul>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                          </div>

                          <div className="text-sm text-slate-600 bg-white border border-slate-100 p-2.5 rounded-md shadow-sm">
                            <p className="line-clamp-2" title={leave.reason}>
                              <span className="font-semibold text-slate-400 text-xs uppercase block mb-0.5">Reason</span>
                              "{leave.reason}"
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 justify-end min-w-[140px]">
                          {leave.status === "pending" ? (
                            <div className="flex gap-2 bg-slate-100 p-1 rounded-lg">
                              <Button 
                                size="sm" variant="ghost" className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 bg-white shadow-sm"
                                onClick={() => handleApprove(leave.id)} disabled={isProcessing} title="Approve"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 bg-white shadow-sm"
                                onClick={() => setRejectDialog({ isOpen: true, leaveId: leave.id })} disabled={isProcessing} title="Reject"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            getStatusBadge(leave.status)
                          )}
                          
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => toast.info(`Details: ${leave.reason}`)}>View Full Details</DropdownMenuItem>
                              {leave.rejection_reason && (
                                <DropdownMenuItem className="text-red-600 font-medium focus:bg-red-50 focus:text-red-700">
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

      {selectedIds.size > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-4 rounded-full shadow-2xl flex items-center gap-6 z-50 animate-in slide-in-from-bottom-5">
              <div className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-blue-400" />
                  <span className="font-medium">{selectedIds.size} Requests Selected</span>
              </div>
              <div className="flex gap-2 border-l border-slate-700 pl-6">
                  <Button variant="outline" size="sm" className="bg-transparent border-slate-600 hover:bg-slate-800 hover:text-white" onClick={() => setSelectedIds(new Set())}>Cancel</Button>
                  <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white border-0" onClick={() => setRejectDialog({ isOpen: true, leaveId: null, isBulk: true })}>Reject</Button>
                  <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white border-0" onClick={handleBulkApprove} disabled={isProcessing}>{isProcessing ? "Processing..." : "Approve All"}</Button>
              </div>
          </div>
      )}

      <Dialog open={rejectDialog.isOpen} onOpenChange={(open) => !open && setRejectDialog({ isOpen: false, leaveId: null, isBulk: false })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{rejectDialog.isBulk ? `Reject ${selectedIds.size} Requests` : "Reject Leave Application"}</DialogTitle>
            <DialogDescription>Please provide a reason for rejecting {rejectDialog.isBulk ? 'these requests' : 'this request'}. The employee will see this note.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea placeholder="e.g. Too many people off this week..." value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} className="min-h-[100px]" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog({ isOpen: false, leaveId: null, isBulk: false })}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectionReason.trim() || isProcessing}>Confirm Rejection</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave Policy Settings</DialogTitle>
            <DialogDescription>Adjust the annual leave allowances for your workspace.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2"><Label>Casual Leave (Days)</Label><Input type="number" value={allowances.casual} onChange={e => setAllowances({...allowances, casual: Number(e.target.value)})} /></div>
            <div className="space-y-2"><Label>Sick Leave (Days)</Label><Input type="number" value={allowances.sick} onChange={e => setAllowances({...allowances, sick: Number(e.target.value)})} /></div>
            <div className="space-y-2"><Label>Paid Leave (Days)</Label><Input type="number" value={allowances.paid} onChange={e => setAllowances({...allowances, paid: Number(e.target.value)})} /></div>
            <div className="space-y-2"><Label>Emergency Leave (Days)</Label><Input type="number" value={allowances.emergency} onChange={e => setAllowances({...allowances, emergency: Number(e.target.value)})} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettings(false)}>Cancel</Button>
            <Button onClick={handleSaveSettings} disabled={isSavingSettings}>{isSavingSettings ? "Saving..." : "Save Policies"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
