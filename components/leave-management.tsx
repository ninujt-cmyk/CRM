"use client";

import { useState, useEffect, useMemo } from "react";
import { format, differenceInDays, isBefore, startOfDay } from "date-fns";
import { 
  Calendar as CalendarIcon, Plus, CheckCircle, Clock, XCircle, 
  Briefcase, Palmtree, Baby, Stethoscope, AlertTriangle, HelpCircle, Activity
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { createLeaveRequest } from "@/app/actions/leave";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Types
interface LeaveRecord {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
  created_at: string;
}

// Annual Allowances Configuration
const LEAVE_ALLOWANCES: Record<string, number> = {
  casual: 12,
  sick: 8,
  paid: 15,
  emergency: 3,
};

export function LeaveManagement() {
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    type: "casual",
    start: "",
    end: "",
    reason: ""
  });

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("leaves")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
      
    if (data) setLeaves(data);
    setLoading(false);
  };

  // --- Calculations ---
  const calculatedDays = useMemo(() => {
    if (formData.start && formData.end) {
      const start = new Date(formData.start);
      const end = new Date(formData.end);
      if (!isBefore(end, start)) {
        return differenceInDays(end, start) + 1;
      }
    }
    return 0;
  }, [formData.start, formData.end]);

  const leaveBalances = useMemo(() => {
    // Calculate taken/pending leaves (excluding rejected)
    const activeLeaves = leaves.filter(l => l.status !== 'rejected');
    
    const balances: Record<string, { used: number; total: number; percent: number }> = {};
    
    Object.keys(LEAVE_ALLOWANCES).forEach(type => {
      const typeLeaves = activeLeaves.filter(l => l.leave_type === type);
      const daysUsed = typeLeaves.reduce((acc, curr) => {
         return acc + (differenceInDays(new Date(curr.end_date), new Date(curr.start_date)) + 1);
      }, 0);
      
      balances[type] = {
        used: daysUsed,
        total: LEAVE_ALLOWANCES[type],
        percent: Math.min(100, (daysUsed / LEAVE_ALLOWANCES[type]) * 100)
      };
    });
    
    return balances;
  }, [leaves]);

  const hasEnoughBalance = () => {
     if (calculatedDays === 0) return true;
     const balance = leaveBalances[formData.type];
     if (!balance) return true; // Uncapped types (maternity, etc.)
     return (balance.total - balance.used) >= calculatedDays;
  };

  // --- Handlers ---
  const handleSubmit = async () => {
    if (!formData.start || !formData.end || !formData.reason) {
      toast.error("Please fill in all fields");
      return;
    }

    if (new Date(formData.end) < new Date(formData.start)) {
        toast.error("End date cannot be before start date");
        return;
    }

    if (!hasEnoughBalance()) {
        toast.error(`Insufficient ${formData.type} leave balance.`);
        return;
    }

    try {
      setIsSubmitting(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      await createLeaveRequest(user.id, formData);
      
      toast.success("Leave request submitted successfully!");
      setShowApplyDialog(false);
      setFormData({ type: "casual", start: "", end: "", reason: "" });
      loadData(); 
    } catch (error) {
      toast.error("Failed to submit request");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Stats for the employee
  const stats = {
    pending: leaves.filter(l => l.status === 'pending').length,
    approved: leaves.filter(l => l.status === 'approved').length,
    rejected: leaves.filter(l => l.status === 'rejected').length
  };

  const getLeaveIcon = (type: string) => {
    switch(type) {
      case 'sick': return <Stethoscope className="h-4 w-4" />;
      case 'casual': return <Palmtree className="h-4 w-4" />;
      case 'maternity': case 'paternity': return <Baby className="h-4 w-4" />;
      case 'emergency': return <Activity className="h-4 w-4" />;
      default: return <Briefcase className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-8">
      
      {/* 1. Leave Balances Widget */}
      <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-4 bg-slate-50 border-b">
              <CardTitle className="text-base flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-slate-500"/> My Leave Balances
              </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                 {Object.entries(leaveBalances).map(([type, data]) => (
                    <div key={type} className="space-y-2">
                        <div className="flex justify-between items-center text-sm">
                            <span className="font-medium capitalize text-slate-700">{type}</span>
                            <span className="text-slate-500 font-mono text-xs">{data.total - data.used} / {data.total} left</span>
                        </div>
                        <Progress value={data.percent} className={`h-2 ${data.percent > 90 ? 'bg-red-100 [&>div]:bg-red-500' : data.percent > 75 ? 'bg-amber-100 [&>div]:bg-amber-500' : 'bg-emerald-100 [&>div]:bg-emerald-500'}`} />
                    </div>
                 ))}
              </div>
          </CardContent>
      </Card>

      {/* 2. Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-indigo-50 to-white border-indigo-100 shadow-sm relative overflow-hidden">
          <div className="absolute -right-4 -top-4 opacity-10"><Clock className="h-24 w-24 text-indigo-500"/></div>
          <CardContent className="p-6">
             <p className="text-sm font-medium text-indigo-600">Pending Requests</p>
             <h2 className="text-3xl font-bold text-indigo-900 mt-2">{stats.pending}</h2>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-100 shadow-sm relative overflow-hidden">
          <div className="absolute -right-4 -top-4 opacity-10"><CheckCircle className="h-24 w-24 text-emerald-500"/></div>
          <CardContent className="p-6">
             <p className="text-sm font-medium text-emerald-600">Approved Leaves</p>
             <h2 className="text-3xl font-bold text-emerald-900 mt-2">{stats.approved}</h2>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-slate-50 to-white border-slate-100 shadow-sm relative overflow-hidden">
          <div className="absolute -right-4 -top-4 opacity-10"><CalendarIcon className="h-24 w-24 text-slate-500"/></div>
          <CardContent className="p-6">
             <p className="text-sm font-medium text-slate-600">Total History</p>
             <h2 className="text-3xl font-bold text-slate-900 mt-2">{leaves.length}</h2>
          </CardContent>
        </Card>
      </div>

      {/* 3. Main Action & List */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b bg-white gap-4">
          <div>
            <CardTitle>Leave History</CardTitle>
            <CardDescription className="mt-1">View the status of your past and current requests</CardDescription>
          </div>
          
          <Dialog open={showApplyDialog} onOpenChange={setShowApplyDialog}>
            <DialogTrigger asChild>
              <Button className="bg-indigo-600 hover:bg-indigo-700 w-full sm:w-auto shadow-md">
                <Plus className="h-4 w-4 mr-2" /> New Request
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Request Time Off</DialogTitle>
                <DialogDescription>
                  Select your dates and provide a reason. Admin approval is required.
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-5 py-4">
                <div className="grid gap-2">
                  <div className="flex justify-between items-center">
                      <Label>Leave Type</Label>
                      {leaveBalances[formData.type] && (
                          <span className="text-xs text-slate-500 font-mono">
                              Balance: {leaveBalances[formData.type].total - leaveBalances[formData.type].used} Days
                          </span>
                      )}
                  </div>
                  <Select 
                    value={formData.type} 
                    onValueChange={(val) => setFormData({...formData, type: val})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="casual"><span className="flex items-center gap-2"><Palmtree className="h-4 w-4 text-emerald-500"/> Casual Leave</span></SelectItem>
                      <SelectItem value="sick"><span className="flex items-center gap-2"><Stethoscope className="h-4 w-4 text-red-500"/> Sick Leave</span></SelectItem>
                      <SelectItem value="paid"><span className="flex items-center gap-2"><Briefcase className="h-4 w-4 text-blue-500"/> Paid Leave</span></SelectItem>
                      <SelectItem value="emergency"><span className="flex items-center gap-2"><Activity className="h-4 w-4 text-orange-500"/> Emergency</span></SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Start Date</Label>
                    <Input 
                      type="date" 
                      min={format(new Date(), 'yyyy-MM-dd')}
                      value={formData.start}
                      onChange={(e) => setFormData({...formData, start: e.target.value})}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>End Date</Label>
                    <Input 
                      type="date" 
                      min={formData.start || format(new Date(), 'yyyy-MM-dd')}
                      value={formData.end}
                      onChange={(e) => setFormData({...formData, end: e.target.value})}
                    />
                  </div>
                </div>

                {calculatedDays > 0 && (
                    <div className={`p-3 rounded-md border text-sm flex items-center justify-between ${!hasEnoughBalance() ? 'bg-red-50 border-red-200 text-red-700' : 'bg-blue-50 border-blue-100 text-blue-700'}`}>
                        <div className="flex items-center gap-2">
                           <Clock className="h-4 w-4" />
                           <span className="font-medium">Requesting: {calculatedDays} Day{calculatedDays > 1 ? 's' : ''}</span>
                        </div>
                        {!hasEnoughBalance() && <AlertTriangle className="h-4 w-4" />}
                    </div>
                )}

                <div className="grid gap-2">
                  <Label>Reason</Label>
                  <Textarea 
                    placeholder="Briefly describe why you need this time off..." 
                    rows={3}
                    value={formData.reason}
                    onChange={(e) => setFormData({...formData, reason: e.target.value})}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowApplyDialog(false)}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={isSubmitting || !hasEnoughBalance() || calculatedDays === 0}>
                  {isSubmitting ? "Submitting..." : "Submit Request"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-10 text-slate-500 animate-pulse">Loading leave records...</div>
          ) : leaves.length === 0 ? (
            <div className="text-center py-16 bg-slate-50">
              <div className="bg-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border">
                 <Palmtree className="h-8 w-8 text-slate-300" />
              </div>
              <h3 className="text-lg font-medium text-slate-900">No leaves yet</h3>
              <p className="text-slate-500 max-w-sm mx-auto mt-1">You haven't requested any time off. Your history will appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {leaves.map((leave) => {
                const days = differenceInDays(new Date(leave.end_date), new Date(leave.start_date)) + 1;
                return (
                  <div key={leave.id} className="p-4 sm:p-6 hover:bg-slate-50 transition-colors group">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        
                        <div className="flex items-start gap-4">
                            <div className={`p-2.5 rounded-xl shadow-sm border mt-1 shrink-0 ${
                                leave.status === 'approved' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
                                leave.status === 'rejected' ? 'bg-red-50 border-red-100 text-red-600' :
                                'bg-amber-50 border-amber-100 text-amber-600'
                            }`}>
                                {getLeaveIcon(leave.leave_type)}
                            </div>
                            
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-semibold text-slate-900 capitalize text-base">
                                        {leave.leave_type} Leave
                                    </span>
                                    <Badge variant="outline" className={`capitalize ${
                                        leave.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                        leave.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' :
                                        'bg-amber-50 text-amber-700 border-amber-200'
                                    }`}>
                                        {leave.status}
                                    </Badge>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-slate-500 mb-2">
                                    <span className="flex items-center gap-1.5"><CalendarIcon className="h-3.5 w-3.5"/> {format(new Date(leave.start_date), "MMM d, yyyy")} — {format(new Date(leave.end_date), "MMM d, yyyy")}</span>
                                    <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5"/> {days} Day{days > 1 ? 's' : ''}</span>
                                </div>
                                <p className="text-sm text-slate-700 bg-white border border-slate-100 p-2.5 rounded-lg inline-block shadow-sm">
                                    "{leave.reason}"
                                </p>
                            </div>
                        </div>

                        <div className="text-left sm:text-right mt-2 sm:mt-0">
                            <p className="text-xs font-medium text-slate-400">Applied on {format(new Date(leave.created_at), "MMM d, yyyy")}</p>
                        </div>

                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
