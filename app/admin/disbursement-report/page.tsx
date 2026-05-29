"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
  Loader2, IndianRupee, Search, RefreshCw, Trophy, Medal,
  Building2, Target, PieChart as PieIcon, ArrowUpRight, Wallet, Pencil, Zap, Printer,
  Lightbulb, Crown, Trash2, Flame, Crosshair, CheckCircle2
} from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Slider } from "@/components/ui/slider"
import { 
  AreaChart, Area, PieChart, Pie, Cell, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer
} from 'recharts'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog"

import { DisbursementModal } from "@/components/admin/disbursement-modal"

// --- TYPES ---
interface LeadDisbursement {
    id: string;
    assigned_to: string; 
    disbursed_amount: number;
    disbursed_at: string;
    application_number: string;
    name: string;
    bank_name: string;
    city: string;
}

interface UserMap {
    [id: string]: string; 
}

interface AgentTarget {
    target_amount: number;
    start_date: string;
    end_date: string;
}

// --- UTILITIES ---
const formatCurrency = (value: number) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)}Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(2)}L`;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
};

const formatDate = (dateString: string) => {
    if(!dateString) return "-";
    return new Date(dateString).toLocaleDateString('en-IN', {
        year: 'numeric', month: 'short', day: 'numeric'
    });
};

const PIE_COLORS = ['#10b981', '#3b82f6', '#ec4899', '#f97316', '#eab308', '#06b6d4', '#64748b'];

// --- MAIN COMPONENT ---
export default function TelecallerDisbursementReport() {
    const supabase = createClient();
    const { toast } = useToast();
    
    // --- STATE ---
    const [filterMode, setFilterMode] = useState<'monthly' | 'custom'>('monthly');
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1; // 1-12

    const [selectedYear, setSelectedYear] = useState(String(currentYear));
    const [selectedMonth, setSelectedMonth] = useState<string>(String(currentMonth).padStart(2, '0'));
    
    const [customStart, setCustomStart] = useState("");
    const [customEnd, setCustomEnd] = useState("");

    const [searchTerm, setSearchTerm] = useState("");
    const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
    const [selectedBank, setSelectedBank] = useState<string>("all");

    const [targetAmount, setTargetAmount] = useState<number>(50000000); 
    const [isTargetEditing, setIsTargetEditing] = useState(false);
    const [commissionRate, setCommissionRate] = useState<number[]>([1.0]); 

    const [loading, setLoading] = useState(true);
    const [disbursements, setDisbursements] = useState<LeadDisbursement[]>([]);
    const [userMap, setUserMap] = useState<UserMap>({});
    
    // GAMIFICATION STATE
    const [agentTargets, setAgentTargets] = useState<Record<string, AgentTarget>>({});
    const [isTargetModalOpen, setIsTargetModalOpen] = useState(false);
    const [savingTargets, setSavingTargets] = useState(false);
    const [tempTargets, setTempTargets] = useState<Record<string, string>>({});
    
    const [targetStartDate, setTargetStartDate] = useState("");
    const [targetEndDate, setTargetEndDate] = useState("");

    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        if (isTargetModalOpen) {
            const monthIndex = selectedMonth === 'all' ? new Date().getMonth() : parseInt(selectedMonth) - 1;
            const start = new Date(Number(selectedYear), monthIndex, 1).toISOString().split('T')[0];
            const end = new Date(Number(selectedYear), monthIndex + 1, 0).toISOString().split('T')[0];
            setTargetStartDate(start);
            setTargetEndDate(end);
        }
    }, [isTargetModalOpen, selectedMonth, selectedYear]);

    const setQuickFilter = (type: 'today' | 'yesterday' | 'week' | 'lastMonth') => {
        const today = new Date();
        const y = today.getFullYear();
        let start = ""; let end = ""; 

        if (type === 'today') {
            const m = String(today.getMonth() + 1).padStart(2, '0');
            const d = String(today.getDate()).padStart(2, '0');
            start = `${y}-${m}-${d}`; end = `${y}-${m}-${d}`;
        } else if (type === 'yesterday') {
            const yest = new Date(today); yest.setDate(today.getDate() - 1);
            const yM = String(yest.getMonth() + 1).padStart(2, '0');
            const yD = String(yest.getDate()).padStart(2, '0');
            start = `${yest.getFullYear()}-${yM}-${yD}`; end = `${yest.getFullYear()}-${yM}-${yD}`;
        } else if (type === 'week') {
            const lastWeek = new Date(today); lastWeek.setDate(today.getDate() - 7);
            const wM = String(lastWeek.getMonth() + 1).padStart(2, '0');
            const wD = String(lastWeek.getDate()).padStart(2, '0');
            start = `${lastWeek.getFullYear()}-${wM}-${wD}`;
            end = `${y}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        } else if (type === 'lastMonth') {
            setFilterMode('monthly');
            let lm = today.getMonth(); let ly = today.getFullYear();
            if(lm === 0) { lm = 12; ly = ly - 1; }
            setSelectedMonth(String(lm).padStart(2, '0')); setSelectedYear(String(ly));
            return; 
        }

        if(start && end) {
            setFilterMode('custom');
            setCustomStart(start);
            setCustomEnd(end);
        }
    };

    const fetchUsersAndTargets = useCallback(async () => {
        const { data: users, error } = await supabase
            .from('users')
            .select('id, full_name')
            .eq('role', 'telecaller')
            .eq('is_active', true); 

        if (error) return;
        const map: UserMap = {};
        users.forEach((user: any) => { map[user.id] = user.full_name || `ID: ${user.id.substring(0, 5)}`; });
        setUserMap(map);

        const { data: targets } = await supabase
            .from('user_targets')
            .select('*')
            .order('created_at', { ascending: false });

        const targetMap: Record<string, AgentTarget> = {};
        const tempTargetMap: Record<string, string> = {};
        
        if (targets) {
            targets.forEach((t: any) => {
                if (!targetMap[t.user_id]) {
                    targetMap[t.user_id] = t;
                    tempTargetMap[t.user_id] = String(t.target_amount);
                }
            });
        }
        setAgentTargets(targetMap);
        setTempTargets(tempTargetMap);

    }, [supabase]);

    const fetchLeads = useCallback(async () => {
        setLoading(true);
        setSelectedAgentId(null);
        
        let startQuery: string, endQuery: string;

        if (filterMode === 'custom' && customStart && customEnd) {
            startQuery = `${customStart}T00:00:00.000Z`;
            endQuery = `${customEnd}T23:59:59.999Z`;
        } else {
            if (selectedMonth !== 'all') {
                const monthIndex = parseInt(selectedMonth) - 1;
                const startDate = new Date(Number(selectedYear), monthIndex, 1);
                const endDate = new Date(Number(selectedYear), monthIndex + 1, 0);
                
                const y = startDate.getFullYear();
                const m = String(startDate.getMonth() + 1).padStart(2, '0');
                const lastDay = endDate.getDate();
                
                startQuery = `${y}-${m}-01T00:00:00.000Z`;
                endQuery = `${y}-${m}-${lastDay}T23:59:59.999Z`;
            } else {
                startQuery = `${selectedYear}-01-01T00:00:00.000Z`;
                endQuery = `${Number(selectedYear) + 1}-01-01T00:00:00.000Z`;
            }
        }

        const { data, error } = await supabase
            .from('leads')
            .select('id, assigned_to, disbursed_amount, disbursed_at, application_number, name, bank_name, city')
            .ilike('status', 'disbursed') 
            .gte('disbursed_at', startQuery)
            .lte('disbursed_at', endQuery)
            .order('disbursed_at', { ascending: false })
            .limit(5000); 

        if (error) {
            toast({ title: "Error", description: "Failed to fetch transactions", variant: "destructive" });
            setLoading(false); return;
        }

        const safeData = (data || []).map((d: any) => ({ ...d, disbursed_amount: Number(d.disbursed_amount) || 0 }));
        setDisbursements(safeData as LeadDisbursement[]);
        setLoading(false);
    }, [supabase, filterMode, selectedYear, selectedMonth, customStart, customEnd, toast]);

    useEffect(() => {
        fetchUsersAndTargets().then(() => fetchLeads());
        
        const channel = supabase.channel('disbursement-updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, (payload: any) => {
                const newData = payload.new as any;
                if (newData?.status?.toUpperCase() === 'DISBURSED' || (payload.old as any)?.status?.toUpperCase() === 'DISBURSED') {
                    setTimeout(() => fetchLeads(), 500);
                }
            })
            .subscribe();
            
        return () => { supabase.removeChannel(channel); };
    }, [fetchUsersAndTargets, fetchLeads, refreshKey, supabase]);

    const handleDelete = async () => {
        if (!deleteId) return;
        setIsDeleting(true);
        try {
            const { error } = await supabase.from('leads').update({ status: 'Interested', disbursed_amount: null, disbursed_at: null }).eq('id', deleteId);
            if (error) throw error;
            toast({ title: "Deleted", description: "Transaction removed successfully." });
            setRefreshKey(prev => prev + 1); 
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsDeleting(false); setDeleteId(null);
        }
    };

    const handleSaveTargets = async () => {
        if (!targetStartDate || !targetEndDate) {
            toast({ title: "Error", description: "Please select both Start and End dates.", variant: "destructive" });
            return;
        }

        setSavingTargets(true);
        try {
            const inserts = Object.entries(tempTargets)
                .filter(([_, amount]) => amount !== "")
                .map(([userId, amount]) => ({
                    user_id: userId,
                    target_amount: Number(amount),
                    start_date: targetStartDate,
                    end_date: targetEndDate
                }));

            if (inserts.length === 0) throw new Error("Please enter at least one target amount.");

            const { error } = await supabase.from('user_targets').insert(inserts);
                
            if (error) throw error;
            
            toast({ title: "Success", description: "Targets saved successfully!" });
            setIsTargetModalOpen(false);
            setRefreshKey(prev => prev + 1);
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally {
            setSavingTargets(false);
        }
    };

    const { 
        filteredData, grandTotal, bankChartData, trendData, pieData, avgTicketSize, availableBanks,
        projectedRevenue, dailyVelocity, smartInsight, maxDeal
    } = useMemo(() => {
        let total = 0;
        const bankMap: Record<string, number> = {};
        const dailyMap: Record<string, number> = {};
        const cityMap: Record<string, number> = {};
        const agentMap: Record<string, number> = {};
        const uniqueBanks = new Set<string>();
        let maxDealItem: LeadDisbursement | null = null;

        disbursements.forEach(item => {
            if (item.bank_name) uniqueBanks.add(item.bank_name);
        });

        const searched = disbursements.filter(item => {
            if (selectedAgentId && item.assigned_to !== selectedAgentId) return false;
            if (selectedBank !== 'all' && item.bank_name !== selectedBank) return false;

            const term = searchTerm.toLowerCase();
            const telecallerName = userMap[item.assigned_to]?.toLowerCase() || "";
            const customerName = item.name?.toLowerCase() || "";
            const appNo = item.application_number?.toLowerCase() || "";
            return telecallerName.includes(term) || customerName.includes(term) || appNo.includes(term);
        });

        searched.forEach(d => { 
            const amt = d.disbursed_amount;
            total += amt; 
            bankMap[d.bank_name || 'Others'] = (bankMap[d.bank_name || 'Others'] || 0) + amt;
            cityMap[d.city || 'Unknown'] = (cityMap[d.city || 'Unknown'] || 0) + amt;
            agentMap[d.assigned_to] = (agentMap[d.assigned_to] || 0) + amt;
            
            if(d.disbursed_at) {
                const iso = d.disbursed_at.split('T')[0];
                dailyMap[iso] = (dailyMap[iso] || 0) + amt;
            }
            if (!maxDealItem || amt > (maxDealItem as LeadDisbursement).disbursed_amount) {
                maxDealItem = d;
            }
        });

        const avg = searched.length > 0 ? total / searched.length : 0;
        let velocity = 0; let projection = total;
        
        if (filterMode === 'monthly' && selectedMonth !== 'all') {
            const now = new Date();
            const selYear = Number(selectedYear);
            const selMonthIdx = Number(selectedMonth) - 1;
            const daysInMonth = new Date(selYear, selMonthIdx + 1, 0).getDate();
            if (selYear === now.getFullYear() && selMonthIdx === now.getMonth()) {
                const daysPassed = Math.max(1, now.getDate());
                velocity = total / daysPassed;
                projection = velocity * daysInMonth; 
            } else {
                velocity = total / daysInMonth; 
                projection = total; 
            }
        }

        let insight = "Track your daily performance metrics to achieve the active targets.";
        if (total > 0) {
            const entries = Object.entries(bankMap).sort((a,b) => b[1] - a[1]);
            if (entries.length > 0) {
                const topBankName = entries[0][0];
                const topBankShare = (entries[0][1] / total) * 100;
                if (topBankShare > 60) insight = `⚠️ High Dependency Notice: Over ${topBankShare.toFixed(0)}% of your volume lies in ${topBankName}.`;
                else if (topBankShare > 40) insight = `ℹ️ Partner Analytics: ${topBankName} currently leads all payouts with ${topBankShare.toFixed(0)}% contribution.`;
                else {
                    const agentEntries = Object.entries(agentMap).sort((a,b) => b[1] - a[1]);
                    if (agentEntries.length > 0) {
                        const topAgentName = userMap[agentEntries[0][0]]?.split(' ')[0] || 'Unknown';
                        const topAgentShare = (agentEntries[0][1] / total) * 100;
                        insight = `🚀 Leaderboard Alert: ${topAgentName} holds the leading performance record with a ${topAgentShare.toFixed(0)}% contribution share.`;
                    }
                }
            }
        }

        const bChartData = Object.entries(bankMap).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 8);
        const sortedBanks = Object.entries(bankMap).sort((a,b) => b[1] - a[1]);
        const top5 = sortedBanks.slice(0, 5).map(([name, value]) => ({ name, value }));
        const othersVal = sortedBanks.slice(5).reduce((acc, curr) => acc + curr[1], 0);
        if(othersVal > 0) top5.push({ name: 'Others', value: othersVal });
        const trendFinal = Object.keys(dailyMap).sort().map(iso => ({ date: new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }), value: dailyMap[iso] }));

        return {
            filteredData: searched, grandTotal: total, bankChartData: bChartData, pieData: top5,
            trendData: trendFinal, avgTicketSize: avg, availableBanks: Array.from(uniqueBanks).sort(),
            projectedRevenue: projection, dailyVelocity: velocity, smartInsight: insight, maxDeal: maxDealItem
        };
    }, [disbursements, searchTerm, userMap, selectedAgentId, selectedBank, filterMode, selectedYear, selectedMonth]);

    const leaderboardStats = useMemo(() => {
        const stats: Record<string, { amount: number, count: number }> = {};
        
        const dataToProcess = disbursements.filter(item => {
            if (selectedBank !== 'all' && item.bank_name !== selectedBank) return false;
            return true; 
        });

        dataToProcess.forEach(d => {
            const id = d.assigned_to;
            if(!stats[id]) stats[id] = { amount: 0, count: 0 };
            stats[id].amount += (d.disbursed_amount || 0);
            stats[id].count += 1;
        });

        return Object.keys(userMap)
            .map(id => {
                const data = stats[id] || { amount: 0, count: 0 };
                const targetObj = agentTargets[id];
                const target = targetObj ? targetObj.target_amount : 0;
                const achieved = data.amount;
                const remaining = Math.max(0, target - achieved);
                const progress = target > 0 ? Math.min(100, Math.round((achieved / target) * 100)) : 0;
                
                let daysLeft = 1;
                if (targetObj && targetObj.end_date) {
                    const endDate = new Date(targetObj.end_date);
                    const today = new Date(new Date().toISOString().split('T')[0]); 
                    const diffTime = endDate.getTime() - today.getTime();
                    daysLeft = Math.max(1, Math.ceil(diffTime / (1000 * 3600 * 24)) + 1); 
                } else {
                    const selYear = Number(selectedYear);
                    const selMonthIdx = selectedMonth === 'all' ? new Date().getMonth() : Number(selectedMonth) - 1;
                    const daysInMonth = new Date(selYear, selMonthIdx + 1, 0).getDate();
                    const daysPassed = selYear === new Date().getFullYear() && selMonthIdx === new Date().getMonth() ? new Date().getDate() : daysInMonth;
                    daysLeft = Math.max(1, daysInMonth - daysPassed);
                }

                const dailyRequired = remaining > 0 ? Math.round(remaining / daysLeft) : 0;

                return { 
                    id, name: userMap[id], amount: achieved, count: data.count,
                    avg: data.count > 0 ? achieved / data.count : 0,
                    target, remaining, progress, dailyRequired, daysLeft, hasTarget: !!targetObj
                };
            })
            .sort((a, b) => b.progress - a.progress || b.amount - a.amount);
    }, [disbursements, userMap, selectedBank, agentTargets, selectedYear, selectedMonth]);

    const getRankIcon = (index: number) => {
        if (index === 0) return <Trophy className="h-5 w-5 text-amber-500 fill-amber-100" />;
        if (index === 1) return <Medal className="h-5 w-5 text-slate-400 fill-slate-100" />;
        if (index === 2) return <Medal className="h-5 w-5 text-orange-655 fill-orange-100" />;
        return <span className="text-slate-400 font-bold text-xs font-mono">#{index + 1}</span>;
    };

    const gamificationAgents = leaderboardStats.filter(agent => agent.hasTarget && agent.target > 0);

    const companyTargetProgress = Math.min((grandTotal / targetAmount) * 100, 100);
    const estimatedCommission = grandTotal * (commissionRate[0] / 100);
    const handlePrint = () => window.print();

    return (
        <div className="p-4 md:p-8 space-y-6 bg-slate-50/60 dark:bg-slate-950/60 min-h-screen print:p-0 print:bg-white font-sans">
            
            {/* --- HEADER --- */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs print:hidden">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-emerald-600 rounded-xl text-white shadow-md shadow-emerald-500/10">
                        <IndianRupee className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                            Disbursement Intelligence
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">Real-time financial tracking, goal gamifications, and commission analysis.</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                    <Dialog open={isTargetModalOpen} onOpenChange={setIsTargetModalOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="gap-1.5 h-9 text-xs font-semibold rounded-lg border-slate-200 dark:border-slate-800 dark:text-white">
                                <Crosshair className="h-4 w-4" /> Set Targets
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-2xl">
                            <DialogHeader>
                                <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <Target className="h-5 w-5 text-indigo-500" />
                                    Set Custom Target Sprints
                                </DialogTitle>
                                <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1">Assign periodic goals and set a custom timeframe for team performance analysis.</DialogDescription>
                            </DialogHeader>
                            
                            <div className="flex gap-4 my-4 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200/60 dark:border-slate-800">
                                <div className="flex-1">
                                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Sprint Start Date</label>
                                    <Input type="date" value={targetStartDate} onChange={e => setTargetStartDate(e.target.value)} className="h-9 text-xs rounded-lg dark:text-white dark:bg-slate-900 border-slate-200 dark:border-slate-800" />
                                </div>
                                <div className="flex-1">
                                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Sprint End Date</label>
                                    <Input type="date" value={targetEndDate} onChange={e => setTargetEndDate(e.target.value)} className="h-9 text-xs rounded-lg dark:text-white dark:bg-slate-900 border-slate-200 dark:border-slate-800" />
                                </div>
                            </div>

                            <div className="max-h-[45vh] overflow-y-auto border border-slate-250 dark:border-slate-800 rounded-xl">
                                <Table>
                                    <TableHeader className="bg-slate-100/70 dark:bg-slate-800/80 sticky top-0 z-10">
                                        <TableRow className="border-b dark:border-slate-800"><TableHead className="text-xs font-semibold">Agent</TableHead><TableHead className="text-xs font-semibold">Target Amount (₹)</TableHead></TableRow>
                                    </TableHeader>
                                    <TableBody className="dark:bg-slate-900">
                                        {Object.entries(userMap).map(([id, name]) => (
                                            <TableRow key={id} className="border-b dark:border-slate-800">
                                                <TableCell className="font-semibold text-xs text-slate-700 dark:text-slate-350">{name}</TableCell>
                                                <TableCell>
                                                    <Input 
                                                        type="number" 
                                                        value={tempTargets[id] || ''} 
                                                        onChange={(e) => setTempTargets(prev => ({...prev, [id]: e.target.value}))}
                                                        placeholder="Enter 0 to hide agent"
                                                        className="h-8 text-xs font-mono rounded-md dark:text-white dark:bg-slate-950 border-slate-200 dark:border-slate-850"
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                            <div className="flex justify-between items-center pt-4 border-t dark:border-slate-850">
                                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Tip: Set target to 0 to hide an agent from the leaderboard.</p>
                                <Button onClick={handleSaveTargets} disabled={savingTargets} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold h-9 px-4">
                                    {savingTargets ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : "Save Custom Targets"}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>

                    <Button variant="outline" onClick={handlePrint} className="gap-1.5 h-9 text-xs font-semibold rounded-lg border-slate-200 dark:border-slate-800 dark:text-white">
                        <Printer className="h-4 w-4" /> Print Report
                    </Button>
                    <DisbursementModal onSuccess={() => setRefreshKey(prev => prev + 1)} />
                </div>
            </div>

            {/* --- CONTROLS --- */}
            <Card className="border-slate-100 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900 rounded-2xl print:hidden">
                <CardContent className="p-4 space-y-4">
                    {/* INSIGHTS */}
                    {grandTotal > 0 && (
                        <div className="bg-blue-50/70 dark:bg-blue-950/20 border border-blue-100/60 dark:border-blue-900/35 rounded-xl p-3.5 flex items-center gap-3">
                            <div className="p-2 bg-blue-500/10 dark:bg-blue-400/10 text-blue-600 dark:text-blue-400 rounded-lg">
                                <Lightbulb className="h-4 w-4" />
                            </div>
                            <p className="text-xs text-blue-800 dark:text-blue-300 font-semibold">{smartInsight}</p>
                        </div>
                    )}

                    <div className="flex flex-col lg:flex-row gap-4 justify-between items-end lg:items-center">
                        <div className="w-full lg:w-1/3 relative">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
                            <Input placeholder="Search Telecaller Name, Customer, App No..." className="pl-9 h-9 text-xs rounded-lg border-slate-200 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-950/50 focus-visible:ring-indigo-500 dark:text-white" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        </div>
                        
                        <div className="flex flex-wrap gap-2 items-center justify-end w-full lg:w-auto">
                             <div className="flex gap-1.5 mr-2">
                                <Badge variant="outline" className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 text-[10px] py-1 px-2.5 font-semibold text-slate-650 dark:text-slate-350" onClick={() => setQuickFilter('today')}>Today</Badge>
                                <Badge variant="outline" className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 text-[10px] py-1 px-2.5 font-semibold text-slate-650 dark:text-slate-350" onClick={() => setQuickFilter('yesterday')}>Yesterday</Badge>
                                <Badge variant="outline" className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 text-[10px] py-1 px-2.5 font-semibold text-slate-650 dark:text-slate-350" onClick={() => setQuickFilter('lastMonth')}>Last Month</Badge>
                            </div>

                            <Select value={selectedBank} onValueChange={setSelectedBank}>
                                <SelectTrigger className="w-[140px] h-9 text-xs rounded-lg border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 dark:text-white"><SelectValue placeholder="All Banks" /></SelectTrigger>
                                <SelectContent className="dark:bg-slate-900 border-slate-200 dark:border-slate-850">
                                    <SelectItem value="all" className="text-xs">All Banks</SelectItem>
                                    {availableBanks.map(bank => <SelectItem key={bank} value={bank} className="text-xs">{bank}</SelectItem>)}
                                </SelectContent>
                            </Select>

                            <Select value={filterMode} onValueChange={(v:any) => setFilterMode(v)}>
                                <SelectTrigger className="w-[110px] h-9 text-xs rounded-lg border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 dark:text-white"><SelectValue /></SelectTrigger>
                                <SelectContent className="dark:bg-slate-900 border-slate-200 dark:border-slate-850"><SelectItem value="monthly" className="text-xs">Monthly</SelectItem><SelectItem value="custom" className="text-xs">Custom Range</SelectItem></SelectContent>
                            </Select>

                            {filterMode === 'monthly' ? (
                                <>
                                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                                        <SelectTrigger className="w-[80px] h-9 text-xs rounded-lg border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 dark:text-white"><SelectValue /></SelectTrigger>
                                        <SelectContent className="dark:bg-slate-900 border-slate-200 dark:border-slate-850">
                                            {[currentYear-1, currentYear, currentYear+1].map(y => <SelectItem key={y} value={String(y)} className="text-xs">{y}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                        <SelectTrigger className="w-[120px] h-9 text-xs rounded-lg border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 dark:text-white"><SelectValue /></SelectTrigger>
                                        <SelectContent className="dark:bg-slate-900 border-slate-200 dark:border-slate-850">
                                            <SelectItem value="all" className="text-xs">Full Year</SelectItem>
                                            {Array.from({length: 12}, (_, i) => <SelectItem key={i} value={String(i+1).padStart(2,'0')} className="text-xs">{new Date(0,i).toLocaleString('default',{month:'long'})}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </>
                            ) : (
                                <div className="flex gap-2">
                                    <Input type="date" className="w-[130px] h-9 text-xs rounded-lg border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 dark:text-white" value={customStart} onChange={e => setCustomStart(e.target.value)} />
                                    <Input type="date" className="w-[130px] h-9 text-xs rounded-lg border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 dark:text-white" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
                                    <Button onClick={() => fetchLeads()} variant="secondary" size="icon" className="h-9 w-9 rounded-lg border-slate-200 dark:border-slate-800"><RefreshCw className="h-4 w-4"/></Button>
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* --- TABS --- */}
            <Tabs defaultValue="leaderboard" className="w-full">
                <TabsList className="bg-slate-100/80 dark:bg-slate-900/60 p-1 rounded-xl border border-slate-200/50 dark:border-slate-800/50 max-w-[500px] mb-6 print:hidden">
                    <TabsTrigger value="leaderboard" className="rounded-lg text-xs font-semibold py-2 px-4 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:shadow-xs">🏆 Leaderboard</TabsTrigger>
                    <TabsTrigger value="dashboard" className="rounded-lg text-xs font-semibold py-2 px-4 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:shadow-xs">Analytics Board</TabsTrigger>
                    <TabsTrigger value="data" className="rounded-lg text-xs font-semibold py-2 px-4 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:shadow-xs">Transactions</TabsTrigger>
                </TabsList>

                {/* --- TAB 1: GAMIFICATION SPRINT BOARD --- */}
                <TabsContent value="leaderboard" className="mt-4">
                    <Card className="shadow-xs border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl overflow-hidden">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-gradient-to-r from-slate-900 to-slate-950 p-5 text-white">
                            <div>
                                <h1 className="text-base font-extrabold tracking-tight flex items-center gap-2">
                                    <Trophy className="text-amber-400 w-5 h-5" /> 
                                    TARGET SPRINT LEADERBOARD
                                </h1>
                                <p className="text-[11px] text-slate-400 mt-0.5 font-medium">Tracking closed deals against active target limits.</p>
                            </div>
                            <div className="text-left sm:text-right mt-3 sm:mt-0 border-t sm:border-t-0 sm:border-l dark:border-slate-800 pt-2 sm:pt-0 sm:pl-4">
                                <div className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Accumulated Team Revenue</div>
                                <div className="text-2xl font-black text-emerald-400 tracking-tight mt-0.5">
                                    {formatCurrency(grandTotal)}
                                </div>
                            </div>
                        </div>

                        <div className="p-5 bg-slate-50/50 dark:bg-slate-950/20">
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                                {gamificationAgents.map((agent, index) => {
                                    const isWinner = index === 0 && agent.amount > 0;
                                    const isDanger = agent.progress < 30 && agent.daysLeft <= 5 && agent.hasTarget;
                                    const isComplete = agent.progress >= 100 && agent.hasTarget;

                                    return (
                                        <div key={agent.id} className={`relative bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col justify-between overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm ${isComplete ? 'bg-emerald-50/15 dark:bg-emerald-950/10 border-emerald-250 dark:border-emerald-900/40' : ''}`}>
                                            
                                            {/* Accent strip */}
                                            <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl ${isComplete ? 'bg-emerald-500 dark:bg-emerald-450' : isWinner ? 'bg-amber-500 dark:bg-amber-400 animate-pulse' : isDanger ? 'bg-red-500' : 'bg-indigo-500'}`} />
                                            
                                            {/* Top Row */}
                                            <div className="flex justify-between items-start pl-2.5 mb-3">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-extrabold text-[11px] ${
                                                        index === 0 ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30' :
                                                        index === 1 ? 'bg-slate-100 dark:bg-slate-850 text-slate-655 dark:text-slate-300' :
                                                        index === 2 ? 'bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400' : 'bg-slate-50 dark:bg-slate-800 text-slate-500'
                                                    }`}>
                                                        {index + 1}
                                                    </div>
                                                    <span className="font-extrabold text-sm text-slate-800 dark:text-slate-200 truncate max-w-[95px]" title={agent.name}>
                                                        {agent.name.split(' ')[0]}
                                                    </span>
                                                    {isComplete && <Flame className="w-3.5 h-3.5 text-orange-500 fill-orange-500 animate-pulse" />}
                                                </div>
                                                
                                                <div className="text-right">
                                                    <div className={`font-black text-sm tracking-tight ${isComplete ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                                                        {formatCurrency(agent.amount)}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 dark:text-slate-555 font-semibold mt-0.5">
                                                        Goal: {formatCurrency(agent.target)}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Progress Bar & Run Rate */}
                                            <div className="pl-2.5 mt-auto space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1">
                                                        <Progress value={agent.progress} className={`h-1.5 bg-slate-100 dark:bg-slate-800 ${isComplete ? '[&>div]:bg-emerald-500' : isWinner ? '[&>div]:bg-amber-450' : '[&>div]:bg-indigo-500'}`} />
                                                    </div>
                                                    <span className="text-[10px] font-bold text-slate-650 dark:text-slate-450 w-7 text-right">{agent.progress}%</span>
                                                </div>
                                                
                                                {!isComplete ? (
                                                    <div className="flex justify-between items-center text-[10px] font-semibold text-slate-500 dark:text-slate-400 pt-0.5">
                                                        <span>Req: <span className="text-indigo-650 dark:text-indigo-400 font-bold">{formatCurrency(agent.dailyRequired)}/day</span></span>
                                                        <span className="text-amber-600 dark:text-amber-450 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded-md font-mono text-[9px]">{agent.daysLeft}d left</span>
                                                    </div>
                                                ) : (
                                                    <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 text-center bg-emerald-100/40 dark:bg-emerald-950/20 border border-emerald-250 dark:border-emerald-900/30 rounded-lg py-1 flex items-center justify-center gap-1 mt-1 shadow-3xs">
                                                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Target Achieved 🎉
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                                
                                {gamificationAgents.length === 0 && (
                                    <div className="col-span-full text-center py-14 text-slate-450 dark:text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900/50">
                                        No active target sprints mapped. Set telecaller targets to generate the leaderboard.
                                    </div>
                                )}
                            </div>
                        </div>
                    </Card>
                </TabsContent>

                {/* --- TAB 2: ANALYTICS DASHBOARD BOARD --- */}
                <TabsContent value="dashboard" className="space-y-6 mt-4">
                    {/* STATS STRIP */}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        {/* 1. ACTUAL */}
                        <Card className="bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950 text-white shadow-lg border border-slate-800/80 md:col-span-2 rounded-2xl overflow-hidden relative">
                            <div className="absolute right-0 top-0 transform translate-x-8 -translate-y-4 opacity-5 pointer-events-none">
                                <IndianRupee className="h-64 w-64 text-emerald-500" />
                            </div>
                            <CardContent className="p-5 pt-6 flex flex-col justify-between h-full space-y-4 relative">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-emerald-450 text-[10px] font-bold uppercase tracking-widest leading-none">Actual Revenue Volume</p>
                                        <h2 className="text-3xl font-black tracking-tight mt-2 flex items-baseline gap-1">
                                            {formatCurrency(grandTotal)}
                                        </h2>
                                    </div>
                                    <div className="text-right">
                                        <div className="bg-emerald-500/10 dark:bg-emerald-400/5 border border-emerald-500/20 rounded-xl p-2.5 backdrop-blur-xs">
                                            <p className="text-[9px] text-emerald-400 uppercase tracking-wider font-bold">Daily Velocity</p>
                                            <p className="text-xs font-black text-emerald-350 mt-0.5">{formatCurrency(dailyVelocity)}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2 pt-1">
                                    <Badge className="bg-white/10 dark:bg-slate-800 text-slate-100 hover:bg-white/15 dark:hover:bg-slate-750 border-0 text-[10px] font-semibold py-0.5 px-2 rounded-full">Avg Deal: {formatCurrency(avgTicketSize)}</Badge>
                                    <Badge className="bg-indigo-500/20 text-indigo-350 hover:bg-indigo-500/25 border-0 text-[10px] font-semibold py-0.5 px-2 rounded-full">Projected: {formatCurrency(projectedRevenue)}</Badge>
                                </div>
                            </CardContent>
                        </Card>

                        {/* 2. BIG WIN */}
                        <Card className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xs rounded-2xl overflow-hidden">
                            <CardContent className="p-5 pt-6 flex flex-col justify-between h-full min-h-[145px]">
                                <div className="flex justify-between items-center mb-1">
                                    <p className="text-amber-500 dark:text-amber-450 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1"><Crown className="h-3.5 w-3.5 text-amber-500 fill-amber-500 animate-pulse"/> Top Deal</p>
                                </div>
                                {maxDeal ? (
                                    <div className="space-y-1.5 mt-2">
                                        <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">{formatCurrency((maxDeal as LeadDisbursement).disbursed_amount)}</h2>
                                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                            <Badge variant="outline" className="text-[9px] font-semibold border-slate-200 dark:border-slate-800 dark:text-slate-300">{userMap[(maxDeal as LeadDisbursement).assigned_to]?.split(' ')[0]}</Badge>
                                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium truncate max-w-[80px]">{(maxDeal as LeadDisbursement).bank_name}</span>
                                        </div>
                                    </div>
                                ) : <p className="text-xs text-slate-450 dark:text-slate-500 italic mt-3 font-medium">No deals closed yet.</p>}
                            </CardContent>
                        </Card>

                        {/* 3. OVERALL COMPANY GOAL */}
                        <Card className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xs rounded-2xl overflow-hidden">
                            <CardContent className="p-5 pt-6 flex flex-col justify-between h-full min-h-[145px]">
                                <div className="flex justify-between items-center mb-1">
                                    <p className="text-slate-450 dark:text-slate-500 text-[10px] font-bold uppercase tracking-widest">Company Goal</p>
                                    {!isTargetEditing ? (
                                        <Button size="icon" variant="ghost" className="h-6 w-6 text-slate-350 hover:text-slate-600 dark:hover:text-white rounded-md" onClick={() => setIsTargetEditing(true)}>
                                            <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                    ) : (
                                        <div className="flex gap-1 items-center">
                                            <Input type="number" className="h-6 w-20 text-[10px] p-1 font-mono border-slate-200 dark:border-slate-800 dark:text-white dark:bg-slate-950" value={targetAmount} onChange={e=>setTargetAmount(Number(e.target.value))} />
                                            <Button size="sm" className="h-6 text-[10px] px-2 bg-indigo-650 text-white rounded-md" onClick={()=>setIsTargetEditing(false)}>Save</Button>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-1 mt-2">
                                    <div className="flex justify-between items-baseline">
                                        <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">{companyTargetProgress.toFixed(0)}%</h2>
                                        <span className="text-[10px] text-slate-450 dark:text-slate-500 font-semibold">of {formatCurrency(targetAmount)}</span>
                                    </div>
                                    <Progress value={companyTargetProgress} className="h-1.5 mt-2 bg-slate-100 dark:bg-slate-800 [&>div]:bg-indigo-600" />
                                </div>
                            </CardContent>
                        </Card>

                         {/* 4. COMMISSION */}
                         <Card className="bg-blue-50/30 dark:bg-slate-900 border border-blue-100/60 dark:border-slate-800 shadow-xs rounded-2xl overflow-hidden">
                            <CardContent className="p-5 pt-6 flex flex-col justify-between h-full min-h-[145px]">
                                <div className="flex justify-between items-center mb-1">
                                    <p className="text-indigo-650 dark:text-indigo-400 text-[10px] font-bold uppercase tracking-widest">Payout Pool ({commissionRate[0]}%)</p>
                                </div>
                                <div className="space-y-2 mt-2">
                                    <h2 className="text-2xl font-black text-indigo-750 dark:text-indigo-400 tracking-tight">{formatCurrency(estimatedCommission)}</h2>
                                    <Slider defaultValue={[1.0]} max={5.0} step={0.1} value={commissionRate} onValueChange={setCommissionRate} className="mt-2 py-1 cursor-pointer" />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* CHARTS */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                        <div className="md:col-span-8 space-y-6">
                             <Card className="border-slate-100 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900 rounded-2xl overflow-hidden">
                                <CardHeader className="py-4 border-b dark:border-slate-800">
                                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-750 dark:text-slate-350 flex items-center gap-2">
                                        <ArrowUpRight className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> 
                                        Disbursement Trend Lines
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="h-[220px] pt-4 pr-4 pl-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={trendData}>
                                            <defs>
                                                <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                                                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:stroke-slate-800" />
                                            <XAxis dataKey="date" fontSize={9} axisLine={false} tickLine={false} stroke="#94a3b8" />
                                            <YAxis fontSize={9} axisLine={false} tickLine={false} stroke="#94a3b8" tickFormatter={(val) => `${val/100000}L`} />
                                            <RechartsTooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '11px', fontWeight: 'semibold' }} formatter={(value: any) => [formatCurrency(value), "Volume"]} />
                                            <Area type="monotone" dataKey="value" stroke="#4f46e5" fillOpacity={1} fill="url(#colorVal)" strokeWidth={2.5} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Card className="border-slate-100 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900 rounded-2xl overflow-hidden">
                                    <CardHeader className="py-4 border-b dark:border-slate-800">
                                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-750 dark:text-slate-350 flex items-center gap-2">
                                            <PieIcon className="h-4 w-4 text-purple-650 dark:text-purple-400" /> 
                                            Bank Disbursement Share
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="h-[210px] flex items-center justify-center">
                                         <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={pieData} cx="50%" cy="50%" innerRadius={42} outerRadius={72} paddingAngle={2.5} dataKey="value">
                                                    {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                                                </Pie>
                                                <RechartsTooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '11px' }} formatter={(value: any) => [formatCurrency(value), "Closed"]} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </CardContent>
                                </Card>

                                <Card className="border-slate-100 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900 rounded-2xl overflow-hidden">
                                    <CardHeader className="py-4 border-b dark:border-slate-800">
                                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-750 dark:text-slate-350 flex items-center gap-2">
                                            <Zap className="h-4 w-4 text-amber-500" /> 
                                            Real-Time Closed Feed
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="h-[210px] overflow-y-auto p-0 divide-y divide-slate-100 dark:divide-slate-800">
                                        {filteredData.slice(0, 5).map((item) => (
                                            <div key={item.id} className="p-3.5 hover:bg-slate-50/60 dark:hover:bg-slate-950/20 transition-colors">
                                                <div className="flex justify-between items-start mb-1 gap-2">
                                                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-450">{formatCurrency(item.disbursed_amount)}</span>
                                                    <span className="text-[10px] font-mono text-slate-400 dark:text-slate-550">{formatDate(item.disbursed_at)}</span>
                                                </div>
                                                <div className="flex justify-between items-center mt-1">
                                                    <span className="text-[11px] text-slate-600 dark:text-slate-400 font-semibold truncate w-32">{item.name}</span>
                                                    <Badge variant="outline" className="text-[9px] h-4.5 px-1.5 rounded bg-slate-50 dark:bg-slate-850 dark:text-slate-300 font-medium">{userMap[item.assigned_to]?.split(' ')[0]}</Badge>
                                                </div>
                                            </div>
                                        ))}
                                        {filteredData.length === 0 && (
                                            <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-500 italic">No operations logged.</div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </div>

                        {/* Leaderboard overview sidebar */}
                        <div className="md:col-span-4 space-y-6">
                            <Card className="border-slate-100 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900 rounded-2xl overflow-hidden h-full flex flex-col">
                                <CardHeader className="py-4 bg-slate-50/60 dark:bg-slate-800/40 border-b dark:border-slate-800">
                                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-750 dark:text-slate-350 flex items-center gap-2">
                                        <Trophy className="h-4 w-4 text-amber-500" /> Leaderboard Overview
                                    </CardTitle>
                                </CardHeader>
                                <div className="overflow-x-auto flex-1">
                                    <Table>
                                        <TableHeader className="bg-slate-50/30 dark:bg-slate-800/10 border-b dark:border-slate-800">
                                            <TableRow className="hover:bg-slate-50">
                                                <TableHead className="w-[50px] text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">Rank</TableHead>
                                                <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Agent</TableHead>
                                                <TableHead className="text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider w-[60px]">Deals</TableHead>
                                                <TableHead className="text-right text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider w-[100px]">Total</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {leaderboardStats.map((stat, idx) => (
                                                <TableRow 
                                                    key={stat.id} 
                                                    className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/20 border-b dark:border-slate-850 cursor-pointer ${selectedAgentId === stat.id ? 'bg-indigo-50/45 dark:bg-indigo-950/20' : ''}`}
                                                    onClick={() => setSelectedAgentId(stat.id === selectedAgentId ? null : stat.id)}
                                                >
                                                    <TableCell className="py-3 text-center">{getRankIcon(idx)}</TableCell>
                                                    <TableCell className="py-3 font-bold text-slate-800 dark:text-slate-200 text-xs">{stat.name}</TableCell>
                                                    <TableCell className="py-3 text-center">
                                                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] px-2 py-0.5 rounded-full font-bold">{stat.count}</span>
                                                    </TableCell>
                                                    <TableCell className="py-3 text-right font-extrabold text-emerald-600 dark:text-emerald-405 text-xs">{formatCurrency(stat.amount)}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                {/* --- TAB 3: TRANSACTION DETAILS LIST --- */}
                <TabsContent value="data" className="mt-4">
                    <Card className="border-slate-100 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900 rounded-2xl overflow-hidden">
                        <CardHeader className="border-b dark:border-slate-800">
                            <CardTitle className="text-sm font-bold text-slate-850 dark:text-slate-100">Disbursed Lead Transactions</CardTitle>
                            <CardDescription className="text-xs text-slate-400 dark:text-slate-500">Full audit log of active disbursements recorded on the server.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-slate-50/60 dark:bg-slate-800/40 border-b dark:border-slate-800">
                                        <TableRow>
                                            <TableHead className="w-[60px] text-xs font-semibold">#</TableHead>
                                            <TableHead className="text-xs font-semibold">App Number</TableHead>
                                            <TableHead className="text-xs font-semibold">Assigned Agent</TableHead>
                                            <TableHead className="text-xs font-semibold">Customer Name</TableHead>
                                            <TableHead className="text-xs font-semibold">Disbursed Date</TableHead>
                                            <TableHead className="text-xs font-semibold">Bank Name</TableHead>
                                            <TableHead className="text-right text-xs font-semibold text-emerald-600 dark:text-emerald-400">Closed Amount</TableHead>
                                            <TableHead className="text-center text-xs font-semibold w-[80px] print:hidden">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredData.map((item, index) => (
                                            <TableRow key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors border-b dark:border-slate-850">
                                                <TableCell className="text-xs text-slate-400 dark:text-slate-500 font-mono py-3.5">{index + 1}</TableCell>
                                                <TableCell className="text-xs font-mono font-bold py-3.5 dark:text-slate-300">{item.application_number}</TableCell>
                                                <TableCell className="py-3.5">
                                                    <Badge variant="outline" className="font-semibold text-xs py-0.5 px-2 rounded-full border-slate-200 dark:border-slate-800 dark:text-slate-350">{userMap[item.assigned_to] || 'Unknown'}</Badge>
                                                </TableCell>
                                                <TableCell className="py-3.5">
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{item.name}</span>
                                                        <span className="text-[10px] text-slate-400 dark:text-slate-550 mt-0.5 font-medium">{item.city}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-xs text-slate-500 dark:text-slate-400 py-3.5">{formatDate(item.disbursed_at)}</TableCell>
                                                <TableCell className="text-xs font-bold text-slate-700 dark:text-slate-300 py-3.5">{item.bank_name}</TableCell>
                                                <TableCell className="text-right font-extrabold text-emerald-600 dark:text-emerald-400 py-3.5 text-xs">{formatCurrency(item.disbursed_amount)}</TableCell>
                                                <TableCell className="text-center py-3.5 print:hidden">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-350 hover:text-red-650 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg" onClick={() => setDeleteId(item.id)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {filteredData.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={8} className="text-center py-12 text-slate-450 dark:text-slate-550 italic text-xs font-medium">No closed transactions found.</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                <AlertDialogContent className="rounded-2xl dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-lg font-bold text-slate-900 dark:text-white">Remove Status?</AlertDialogTitle>
                        <AlertDialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            This action will reverse the lead status from "Disbursed" back to "Interested" and nullify the transaction disbursement amount.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-4 gap-2 sm:gap-0">
                        <AlertDialogCancel className="rounded-lg text-xs font-semibold">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-red-650 hover:bg-red-700 text-white rounded-lg text-xs font-semibold">
                            Revert Status
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
