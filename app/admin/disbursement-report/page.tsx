"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
  Loader2, IndianRupee, TrendingUp, Search, RefreshCw, X, Users, Trophy, Medal,
  Calculator, Building2, Target, PieChart as PieIcon, ArrowUpRight, Wallet, Pencil, Zap, Printer, Gauge,
  Lightbulb, Crown, Calendar, Trash2, Flame, Crosshair
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
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
  AreaChart, Area, PieChart, Pie
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

const PIE_COLORS = ['#16a34a', '#2563eb', '#db2777', '#ea580c', '#ca8a04', '#0891b2', '#4b5563'];

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

    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    // --- QUICK FILTER HANDLERS ---
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

    // 1. Fetch Users & Targets
    const fetchUsersAndTargets = useCallback(async () => {
        const { data: users, error } = await supabase
            .from('users')
            .select('id, full_name')
            .in('role', ['telecaller', 'agent', 'team_leader']); 

        if (error) return;
        const map: UserMap = {};
        users.forEach(user => { map[user.id] = user.full_name || `ID: ${user.id.substring(0, 5)}`; });
        setUserMap(map);

        // Fetch Targets for current period
        const today = new Date().toISOString().split('T')[0];
        const { data: targets } = await supabase
            .from('user_targets')
            .select('*')
            .gte('end_date', today)
            .order('created_at', { ascending: false });

        const targetMap: Record<string, AgentTarget> = {};
        const tempTargetMap: Record<string, string> = {};
        if (targets) {
            targets.forEach(t => {
                if (!targetMap[t.user_id]) {
                    targetMap[t.user_id] = t;
                    tempTargetMap[t.user_id] = String(t.target_amount);
                }
            });
        }
        setAgentTargets(targetMap);
        setTempTargets(tempTargetMap);

    }, [supabase]);

    // 2. Fetch Leads
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
            .ilike('status', 'disbursed') // 🔴 FIX 1: This makes it perfectly case-insensitive (matches DISBURSED or Disbursed)
            .gte('disbursed_at', startQuery)
            .lte('disbursed_at', endQuery)
            .order('disbursed_at', { ascending: false })
            .limit(5000); 

        if (error) {
            toast({ title: "Error", description: "Failed to fetch transactions", variant: "destructive" });
            setLoading(false); return;
        }

        const safeData = (data || []).map(d => ({ ...d, disbursed_amount: Number(d.disbursed_amount) || 0 }));
        setDisbursements(safeData as LeadDisbursement[]);
        setLoading(false);
    }, [supabase, filterMode, selectedYear, selectedMonth, customStart, customEnd, toast]);

    // 🔴 FIX 2: Restored your realtime channel listener!
    useEffect(() => {
        fetchUsersAndTargets().then(() => fetchLeads());
        
        const channel = supabase.channel('disbursement-updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, (payload) => {
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
        setSavingTargets(true);
        try {
            // Determine current month dates
            const monthIndex = selectedMonth === 'all' ? new Date().getMonth() : parseInt(selectedMonth) - 1;
            const startDate = new Date(Number(selectedYear), monthIndex, 1).toISOString().split('T')[0];
            const endDate = new Date(Number(selectedYear), monthIndex + 1, 0).toISOString().split('T')[0];

            const inserts = Object.entries(tempTargets).map(([userId, amount]) => ({
                user_id: userId,
                target_amount: Number(amount),
                start_date: startDate,
                end_date: endDate
            }));

            const { error } = await supabase.from('user_targets').insert(inserts);
            if (error) throw error;
            
            toast({ title: "Success", description: "Targets updated successfully!" });
            setIsTargetModalOpen(false);
            setRefreshKey(prev => prev + 1);
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally {
            setSavingTargets(false);
        }
    };

    // --- AGGREGATION & ANALYTICS ---
    const { 
        filteredData, grandTotal, bankChartData, trendData, pieData, avgTicketSize, cityStats, availableBanks,
        projectedRevenue, dailyVelocity, smartInsight, maxDeal
    } = useMemo(() => {
        let total = 0;
        const bankMap: Record<string, number> = {};
        const dailyMap: Record<string, number> = {};
        const cityMap: Record<string, number> = {};
        const agentMap: Record<string, number> = {};
        const uniqueBanks = new Set<string>();
        
        let maxDealItem: LeadDisbursement | null = null;

        const searched = disbursements.filter(item => {
            if(item.bank_name) uniqueBanks.add(item.bank_name);
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
        
        let velocity = 0;
        let projection = total;
        
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

        let insight = "Track your daily performance to hit targets.";
        if (total > 0) {
            const entries = Object.entries(bankMap).sort((a,b) => b[1] - a[1]);
            if (entries.length > 0) {
                const topBankName = entries[0][0];
                const topBankShare = (entries[0][1] / total) * 100;
                
                if (topBankShare > 60) insight = `⚠️ High dependency on ${topBankName} (${topBankShare.toFixed(0)}% of volume). Consider diversifying.`;
                else if (topBankShare > 40) insight = `ℹ️ ${topBankName} is your leading partner, driving ${topBankShare.toFixed(0)}% of sales.`;
                else {
                    const agentEntries = Object.entries(agentMap).sort((a,b) => b[1] - a[1]);
                    if (agentEntries.length > 0) {
                        const topAgentName = userMap[agentEntries[0][0]]?.split(' ')[0] || 'Unknown';
                        const topAgentShare = (agentEntries[0][1] / total) * 100;
                        insight = `🚀 ${topAgentName} is leading the pack with ${topAgentShare.toFixed(0)}% contribution.`;
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
        const cityFinal = Object.entries(cityMap).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 5);

        return {
            filteredData: searched, grandTotal: total, bankChartData: bChartData, pieData: top5,
            trendData: trendFinal, avgTicketSize: avg, cityStats: cityFinal, availableBanks: Array.from(uniqueBanks).sort(),
            projectedRevenue: projection, dailyVelocity: velocity, smartInsight: insight, maxDeal: maxDealItem
        };
    }, [disbursements, searchTerm, userMap, selectedAgentId, selectedBank, filterMode, selectedYear, selectedMonth]);

    // --- LEADERBOARD & GAMIFICATION STATS ---
    const leaderboardStats = useMemo(() => {
        const stats: Record<string, { amount: number, count: number }> = {};
        
        // Only calculate for the selected bank/filters
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

        // Current Month Date Logic for Daily Required calculation
        const now = new Date();
        const selYear = Number(selectedYear);
        const selMonthIdx = selectedMonth === 'all' ? now.getMonth() : Number(selectedMonth) - 1;
        const daysInMonth = new Date(selYear, selMonthIdx + 1, 0).getDate();
        const daysPassed = selYear === now.getFullYear() && selMonthIdx === now.getMonth() ? now.getDate() : daysInMonth;
        const daysLeft = Math.max(1, daysInMonth - daysPassed);

        return Object.keys(userMap)
            .map(id => {
                const data = stats[id] || { amount: 0, count: 0 };
                const targetObj = agentTargets[id];
                const target = targetObj ? targetObj.target_amount : 0;
                const achieved = data.amount;
                const remaining = Math.max(0, target - achieved);
                const progress = target > 0 ? Math.min(100, Math.round((achieved / target) * 100)) : 0;
                const dailyRequired = remaining > 0 ? Math.round(remaining / daysLeft) : 0;

                return { 
                    id, name: userMap[id], amount: achieved, count: data.count,
                    avg: data.count > 0 ? achieved / data.count : 0,
                    target, remaining, progress, dailyRequired, daysLeft, hasTarget: !!targetObj
                };
            })
            // Only show agents who have a target OR have achieved something
            .filter(a => a.hasTarget || a.amount > 0)
            .sort((a, b) => b.progress - a.progress || b.amount - a.amount);
    }, [disbursements, userMap, selectedBank, agentTargets, selectedYear, selectedMonth]);

    const getRankIcon = (index: number) => {
        if (index === 0) return <Trophy className="h-5 w-5 text-yellow-500 fill-yellow-100" />;
        if (index === 1) return <Medal className="h-5 w-5 text-gray-400 fill-gray-100" />;
        if (index === 2) return <Medal className="h-5 w-5 text-orange-600 fill-orange-100" />;
        return <span className="text-gray-400 font-bold text-sm">#{index + 1}</span>;
    };

    const companyTargetProgress = Math.min((grandTotal / targetAmount) * 100, 100);
    const estimatedCommission = grandTotal * (commissionRate[0] / 100);
    const handlePrint = () => window.print();

    return (
        <div className="p-4 md:p-8 space-y-6 bg-slate-50 min-h-screen print:p-0 print:bg-white">
            
            {/* --- HEADER --- */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
                        <IndianRupee className="h-8 w-8 text-green-600" />
                        Disbursement Intelligence
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Real-time financial tracking and commission analysis</p>
                </div>
                <div className="flex gap-2">
                    <Dialog open={isTargetModalOpen} onOpenChange={setIsTargetModalOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                                <Crosshair className="h-4 w-4" /> Set Targets
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>Set Monthly Targets</DialogTitle>
                                <AlertDialogDescription>Assign goals for the currently selected month ({selectedMonth}/{selectedYear})</AlertDialogDescription>
                            </DialogHeader>
                            <div className="max-h-[60vh] overflow-y-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow><TableHead>Agent</TableHead><TableHead>Target Amount (₹)</TableHead></TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {Object.entries(userMap).map(([id, name]) => (
                                            <TableRow key={id}>
                                                <TableCell className="font-medium text-xs">{name}</TableCell>
                                                <TableCell>
                                                    <Input 
                                                        type="number" 
                                                        value={tempTargets[id] || ''} 
                                                        onChange={(e) => setTempTargets(prev => ({...prev, [id]: e.target.value}))}
                                                        placeholder="e.g. 5000000"
                                                        className="h-8 text-xs font-mono"
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                            <div className="flex justify-end pt-4">
                                <Button onClick={handleSaveTargets} disabled={savingTargets} className="bg-indigo-600">
                                    {savingTargets ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : "Save Targets"}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>

                    <Button variant="outline" onClick={handlePrint} className="gap-2">
                        <Printer className="h-4 w-4" /> Print Report
                    </Button>
                    <DisbursementModal onSuccess={() => setRefreshKey(prev => prev + 1)} />
                </div>
            </div>

            {/* --- CONTROLS --- */}
            <Card className="border-slate-200 shadow-sm print:hidden">
                <CardContent className="p-4">
                    {/* INSIGHTS */}
                    {grandTotal > 0 && (
                        <div className="mb-4 bg-blue-50 border border-blue-100 rounded-md p-3 flex items-center gap-3">
                            <Lightbulb className="h-5 w-5 text-blue-600" />
                            <p className="text-sm text-blue-800 font-medium">{smartInsight}</p>
                        </div>
                    )}

                    <div className="flex flex-col lg:flex-row gap-4 justify-between items-end lg:items-center">
                        <div className="w-full lg:w-1/3 relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                            <Input placeholder="Search Name, App No..." className="pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        </div>
                        
                        <div className="flex flex-wrap gap-2 items-end">
                             <div className="flex gap-1 mb-1 lg:mb-0 mr-2">
                                <Badge variant="outline" className="cursor-pointer hover:bg-slate-100" onClick={() => setQuickFilter('today')}>Today</Badge>
                                <Badge variant="outline" className="cursor-pointer hover:bg-slate-100" onClick={() => setQuickFilter('yesterday')}>Yesterday</Badge>
                                <Badge variant="outline" className="cursor-pointer hover:bg-slate-100" onClick={() => setQuickFilter('lastMonth')}>Last Month</Badge>
                            </div>

                            <Select value={selectedBank} onValueChange={setSelectedBank}>
                                <SelectTrigger className="w-[140px] border-slate-300"><SelectValue placeholder="All Banks" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Banks</SelectItem>
                                    {availableBanks.map(bank => <SelectItem key={bank} value={bank}>{bank}</SelectItem>)}
                                </SelectContent>
                            </Select>

                            <Select value={filterMode} onValueChange={(v:any) => setFilterMode(v)}>
                                <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="custom">Custom</SelectItem></SelectContent>
                            </Select>

                            {filterMode === 'monthly' ? (
                                <>
                                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                                        <SelectTrigger className="w-[80px]"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {[currentYear-1, currentYear, currentYear+1].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                        <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Full Year</SelectItem>
                                            {Array.from({length: 12}, (_, i) => <SelectItem key={i} value={String(i+1).padStart(2,'0')}>{new Date(0,i).toLocaleString('default',{month:'long'})}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </>
                            ) : (
                                <div className="flex gap-2">
                                    <Input type="date" className="w-[130px]" value={customStart} onChange={e => setCustomStart(e.target.value)} />
                                    <Input type="date" className="w-[130px]" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
                                    <Button onClick={() => fetchLeads()} variant="secondary" size="icon"><RefreshCw className="h-4 w-4"/></Button>
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* --- TABS --- */}
            <Tabs defaultValue="leaderboard" className="w-full">
                <TabsList className="grid w-full max-w-[600px] grid-cols-3 print:hidden">
                    <TabsTrigger value="leaderboard" className="text-indigo-600 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">🏆 Gamification</TabsTrigger>
                    <TabsTrigger value="dashboard">Analytics Board</TabsTrigger>
                    <TabsTrigger value="data">Data List</TabsTrigger>
                </TabsList>

                {/* 🔴 NEW: GAMIFICATION LEADERBOARD TAB (Perfect for WhatsApp Screenshots) */}
                <TabsContent value="leaderboard" className="mt-6">
                    <div className="max-w-4xl mx-auto p-4 space-y-6 bg-white rounded-xl shadow-sm border border-slate-100">
                        {/* WhatsApp Header */}
                        <div className="flex items-center justify-between bg-gradient-to-r from-blue-900 to-indigo-800 p-6 rounded-xl shadow-md text-white">
                            <div>
                                <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                                    <Trophy className="text-yellow-400 w-8 h-8" /> 
                                    DISBURSEMENT LEADERBOARD
                                </h1>
                                <p className="text-blue-200 text-sm mt-1 font-medium tracking-wide">
                                    Live Performance Tracking & Targets
                                </p>
                            </div>
                            <div className="text-right hidden sm:block">
                                <div className="text-xs text-blue-200 uppercase font-bold tracking-widest">Team Total</div>
                                <div className="text-3xl font-black text-emerald-400">
                                    {formatCurrency(grandTotal)}
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-4">
                            {leaderboardStats.map((agent, index) => {
                                const isWinner = index === 0 && agent.progress > 0;
                                const isDanger = agent.progress < 30 && agent.daysLeft <= 5;
                                const isComplete = agent.progress >= 100;

                                return (
                                    <Card key={agent.id} className={`overflow-hidden border-l-4 shadow-sm hover:shadow-md transition-all ${
                                        isComplete ? 'border-l-emerald-500 bg-emerald-50/30' : 
                                        isWinner ? 'border-l-yellow-400' : 
                                        isDanger ? 'border-l-red-500 bg-red-50/30' : 'border-l-blue-500'
                                    }`}>
                                    <CardContent className="p-4 sm:p-5">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${
                                                    index === 0 ? 'bg-yellow-100 text-yellow-700' :
                                                    index === 1 ? 'bg-slate-200 text-slate-700' :
                                                    index === 2 ? 'bg-orange-100 text-orange-800' : 'bg-slate-100 text-slate-500'
                                                }`}>
                                                    {index + 1}
                                                </div>
                                                <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                                    {agent.name}
                                                    {isComplete && <Flame className="w-5 h-5 text-orange-500 fill-orange-500 animate-pulse" />}
                                                </h3>
                                            </div>
                                            <Badge variant={isComplete ? "default" : "secondary"} className={isComplete ? "bg-emerald-500" : ""}>
                                                {agent.daysLeft} Days Left
                                            </Badge>
                                        </div>

                                        {agent.hasTarget ? (
                                            <>
                                                <div className="space-y-2 mb-4">
                                                    <div className="flex justify-between text-sm font-semibold">
                                                        <span className="text-slate-600">Progress</span>
                                                        <span className={isComplete ? "text-emerald-600 font-black" : "text-blue-600"}>{agent.progress}%</span>
                                                    </div>
                                                    <Progress value={agent.progress} className={`h-3 ${isComplete ? '[&>div]:bg-emerald-500' : ''}`} />
                                                </div>
                                                <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-4 pt-4 border-t border-slate-100">
                                                    <div>
                                                        <p className="text-[10px] uppercase font-bold text-slate-400">Target</p>
                                                        <p className="font-semibold text-slate-700 text-sm sm:text-base">{formatCurrency(agent.target)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] uppercase font-bold text-slate-400">Achieved</p>
                                                        <p className={`font-black text-sm sm:text-base ${isComplete ? 'text-emerald-600' : 'text-slate-800'}`}>
                                                            {formatCurrency(agent.amount)}
                                                        </p>
                                                    </div>
                                                    <div className="bg-slate-50 rounded-md p-2 -my-2 border border-slate-100 text-center">
                                                        <p className="text-[9px] sm:text-[10px] uppercase font-bold text-indigo-500 flex items-center justify-center gap-1">
                                                            <TrendingUp className="w-3 h-3 hidden sm:block" /> Daily Req.
                                                        </p>
                                                        <p className="font-bold text-indigo-700 text-sm sm:text-base">
                                                            {isComplete ? 'Done 🎉' : formatCurrency(agent.dailyRequired)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-center p-4 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                                                <p className="text-sm text-slate-500">No target set. Total Achieved: <span className="font-bold text-slate-800">{formatCurrency(agent.amount)}</span></p>
                                            </div>
                                        )}
                                    </CardContent>
                                    </Card>
                                )
                            })}
                            {leaderboardStats.length === 0 && (
                                <div className="text-center p-10 text-slate-400 border border-dashed rounded-xl">No disbursements found for the selected period.</div>
                            )}
                        </div>
                    </div>
                </TabsContent>

                {/* --- EXISTING DASHBOARD TAB --- */}
                <TabsContent value="dashboard" className="space-y-6 mt-4">
                    {/* STATS STRIP */}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        {/* 1. ACTUAL */}
                        <Card className="bg-gradient-to-br from-green-600 to-emerald-800 text-white shadow-md border-0 md:col-span-2">
                            <CardContent className="p-4 pt-6">
                                <div className="flex justify-between">
                                    <div>
                                        <p className="text-emerald-100 text-xs font-medium uppercase tracking-wider">Actual Revenue</p>
                                        <h2 className="text-3xl font-bold mt-1">{formatCurrency(grandTotal)}</h2>
                                    </div>
                                    <div className="text-right">
                                        <div className="bg-white/10 rounded-lg p-2 backdrop-blur-sm">
                                            <p className="text-[10px] text-emerald-100">Daily Speed</p>
                                            <p className="text-sm font-bold">{formatCurrency(dailyVelocity)}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-4 flex gap-2">
                                    <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/30 border-0 text-[10px]">Ticket: {formatCurrency(avgTicketSize)}</Badge>
                                    <Badge variant="secondary" className="bg-blue-500/50 text-white hover:bg-blue-500/60 border-0 text-[10px]">Projected: {formatCurrency(projectedRevenue)}</Badge>
                                </div>
                            </CardContent>
                        </Card>

                        {/* 2. BIG WIN */}
                        <Card className="bg-white shadow-sm border-slate-200">
                            <CardContent className="p-4 pt-6 flex flex-col justify-between h-full">
                                <div className="flex justify-between items-center mb-1">
                                    <p className="text-amber-500 text-xs font-bold uppercase tracking-wider flex items-center gap-1"><Crown className="h-3 w-3"/> Top Deal</p>
                                </div>
                                {maxDeal ? (
                                    <div>
                                        <h2 className="text-xl font-bold text-slate-800">{formatCurrency((maxDeal as LeadDisbursement).disbursed_amount)}</h2>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Badge variant="outline" className="text-[10px] px-1">{userMap[(maxDeal as LeadDisbursement).assigned_to]?.split(' ')[0]}</Badge>
                                            <span className="text-[10px] text-slate-400 truncate w-16">{(maxDeal as LeadDisbursement).bank_name}</span>
                                        </div>
                                    </div>
                                ) : <p className="text-sm text-slate-400 italic">No data</p>}
                            </CardContent>
                        </Card>

                        {/* 3. OVERALL COMPANY GOAL */}
                        <Card className="bg-white shadow-sm border-slate-200">
                            <CardContent className="p-4 pt-6">
                                <div className="flex justify-between items-center mb-1">
                                    <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Company Goal</p>
                                    {!isTargetEditing ? (
                                        <Pencil className="h-3 w-3 text-slate-300 cursor-pointer" onClick={() => setIsTargetEditing(true)}/>
                                    ) : (
                                        <div className="flex gap-1"><Input type="number" className="h-5 w-16 text-[10px]" value={targetAmount} onChange={e=>setTargetAmount(Number(e.target.value))} /><Button size="sm" className="h-5 text-[10px] px-1" onClick={()=>setIsTargetEditing(false)}>OK</Button></div>
                                    )}
                                </div>
                                <div className="flex justify-between items-end">
                                    <h2 className="text-xl font-bold text-slate-800">{companyTargetProgress.toFixed(0)}%</h2>
                                    <span className="text-xs text-slate-400 mb-1">of {formatCurrency(targetAmount)}</span>
                                </div>
                                <Progress value={companyTargetProgress} className="h-1.5 mt-2 bg-slate-100" indicatorClassName={companyTargetProgress >= 100 ? 'bg-green-500' : 'bg-slate-900'}/>
                            </CardContent>
                        </Card>

                         {/* 4. COMMISSION */}
                         <Card className="bg-blue-50/50 border-blue-100 shadow-sm">
                            <CardContent className="p-4 pt-6">
                                <div className="flex justify-between items-center mb-1">
                                    <p className="text-blue-600 text-xs font-medium uppercase tracking-wider">Payout ({commissionRate[0]}%)</p>
                                </div>
                                <h2 className="text-xl font-bold text-blue-700">{formatCurrency(estimatedCommission)}</h2>
                                <Slider defaultValue={[1]} max={5} step={0.1} value={commissionRate} onValueChange={setCommissionRate} className="mt-3 py-1" />
                            </CardContent>
                        </Card>
                    </div>

                    {/* CHARTS */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                        <div className="md:col-span-8 space-y-6">
                             <Card className="shadow-sm border-slate-200">
                                <CardHeader className="py-4"><CardTitle className="text-sm font-semibold flex items-center gap-2"><ArrowUpRight className="h-4 w-4 text-indigo-500"/> Daily Trend</CardTitle></CardHeader>
                                <CardContent className="h-[200px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={trendData}>
                                            <defs><linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient></defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="date" fontSize={10} axisLine={false} tickLine={false} />
                                            <YAxis fontSize={10} axisLine={false} tickLine={false} tickFormatter={(val) => `${val/1000}k`} />
                                            <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                                            <Area type="monotone" dataKey="value" stroke="#6366f1" fillOpacity={1} fill="url(#colorVal)" strokeWidth={2} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Card className="shadow-sm border-slate-200">
                                    <CardHeader className="py-4"><CardTitle className="text-sm font-semibold flex gap-2"><PieIcon className="h-4 w-4 text-purple-500"/> Bank Share</CardTitle></CardHeader>
                                    <CardContent className="h-[200px]">
                                         <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2} dataKey="value">
                                                    {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                                                </Pie>
                                                <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </CardContent>
                                </Card>
                                <Card className="shadow-sm border-slate-200">
                                    <CardHeader className="py-4"><CardTitle className="text-sm font-semibold flex gap-2"><Zap className="h-4 w-4 text-orange-500"/> Live Feed</CardTitle></CardHeader>
                                    <CardContent className="h-[200px] overflow-y-auto p-0">
                                        <div className="divide-y divide-slate-100">
                                            {filteredData.slice(0, 5).map((item) => (
                                                <div key={item.id} className="p-3 hover:bg-slate-50">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <span className="text-xs font-bold text-slate-800">{formatCurrency(item.disbursed_amount)}</span>
                                                        <span className="text-[10px] text-slate-400">{formatDate(item.disbursed_at)}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-[10px] text-slate-500 truncate w-24">{item.name}</span>
                                                        <Badge variant="outline" className="text-[9px] h-4 px-1">{userMap[item.assigned_to]?.split(' ')[0]}</Badge>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>

                        <div className="md:col-span-4 space-y-6">
                            {/* MATCHED LEADERBOARD CARD */}
                            <Card className="shadow-sm border-slate-200 h-full">
                                <CardHeader className="py-4 bg-slate-50 border-b">
                                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                        <Trophy className="h-4 w-4 text-yellow-500" /> Basic Overview
                                    </CardTitle>
                                </CardHeader>
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader className="bg-slate-50">
                                            <TableRow className="hover:bg-slate-50">
                                                <TableHead className="w-[40px] text-xs font-bold text-slate-600">#</TableHead>
                                                <TableHead className="text-xs font-bold text-slate-600">Agent</TableHead>
                                                <TableHead className="text-center text-xs font-bold text-slate-600">Count</TableHead>
                                                <TableHead className="text-right text-xs font-bold text-green-600">Total</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {leaderboardStats.map((stat, idx) => (
                                                <TableRow 
                                                    key={stat.id} 
                                                    className={`hover:bg-slate-50 border-b border-slate-100 ${selectedAgentId === stat.id ? 'bg-green-50' : ''}`}
                                                    onClick={() => setSelectedAgentId(stat.id === selectedAgentId ? null : stat.id)}
                                                >
                                                    <TableCell className="py-3">{getRankIcon(idx)}</TableCell>
                                                    <TableCell className="py-3 font-semibold text-slate-700 text-xs">{stat.name}</TableCell>
                                                    <TableCell className="py-3 text-center">
                                                        <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded-md font-medium">{stat.count}</span>
                                                    </TableCell>
                                                    <TableCell className="py-3 text-right font-bold text-green-700 text-xs">{formatCurrency(stat.amount)}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                {/* --- DATA LIST TAB --- */}
                <TabsContent value="data" className="mt-4">
                    <Card className="shadow-sm">
                        <CardHeader><CardTitle className="text-base">Transactions</CardTitle></CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader className="bg-slate-50">
                                    <TableRow><TableHead>#</TableHead><TableHead>App No</TableHead><TableHead>Agent</TableHead><TableHead>Customer</TableHead><TableHead>Date</TableHead><TableHead>Bank</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-center">Action</TableHead></TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredData.map((item, index) => (
                                        <TableRow key={item.id} className="hover:bg-slate-50">
                                            <TableCell className="text-xs text-slate-500">{index+1}</TableCell>
                                            <TableCell className="text-xs font-mono">{item.application_number}</TableCell>
                                            <TableCell><Badge variant="outline" className="font-normal text-xs">{userMap[item.assigned_to]}</Badge></TableCell>
                                            <TableCell><div className="flex flex-col"><span className="text-sm font-medium">{item.name}</span><span className="text-[10px] text-slate-400">{item.city}</span></div></TableCell>
                                            <TableCell className="text-sm text-slate-500">{formatDate(item.disbursed_at)}</TableCell>
                                            <TableCell className="text-sm">{item.bank_name}</TableCell>
                                            <TableCell className="text-right font-bold text-green-700">{formatCurrency(item.disbursed_amount)}</TableCell>
                                            <TableCell className="text-center"><Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600" onClick={() => setDeleteId(item.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Delete?</AlertDialogTitle><AlertDialogDescription>This removes the disbursement status.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-red-600">Delete</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
