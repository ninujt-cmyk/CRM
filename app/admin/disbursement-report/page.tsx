"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
  Loader2, IndianRupee, Search, RefreshCw, Trophy, Medal,
  PieChart as PieIcon, ArrowUpRight, Printer, Lightbulb, Crown, 
  Download, ChevronLeft, ChevronRight, BarChart3
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
  AreaChart, Area, PieChart, Pie, Legend
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

import { DisbursementModal } from "@/components/admin/disbursement-modal"

// --- TYPES ---
interface LeadDisbursement {
    id: string;
    assigned_to: string; 
    disbursed_amount: number;
    disbursed_at: string;
    application_number: string;
    name: string;
    phone: string; // Added Phone
    bank_name: string;
    city: string;
    DSA: string;
}

interface UserMap {
    [id: string]: string; 
}

// --- UTILITIES ---
const formatCurrency = (value: number) => {
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
const BAR_COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042'];

// --- MAIN COMPONENT ---
export default function TelecallerDisbursementReport() {
    const supabase = createClient();
    const { toast } = useToast();
    
    // --- STATE ---
    const [filterMode, setFilterMode] = useState<'monthly' | 'custom'>('monthly');
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1; 

    const [selectedYear, setSelectedYear] = useState(String(currentYear));
    const [selectedMonth, setSelectedMonth] = useState<string>(String(currentMonth).padStart(2, '0'));
    
    const [customStart, setCustomStart] = useState("");
    const [customEnd, setCustomEnd] = useState("");

    const [searchTerm, setSearchTerm] = useState("");
    const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
    const [selectedBank, setSelectedBank] = useState<string>("all");
    const [selectedDSA, setSelectedDSA] = useState<string>("all"); // NEW: DSA Filter

    const [targetAmount, setTargetAmount] = useState<number>(50000000); 
    const [isTargetEditing, setIsTargetEditing] = useState(false);
    const [commissionRate, setCommissionRate] = useState<number[]>([1.0]); 

    const [loading, setLoading] = useState(true);
    const [disbursements, setDisbursements] = useState<LeadDisbursement[]>([]);
    const [userMap, setUserMap] = useState<UserMap>({});
    
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // --- QUICK FILTER HANDLERS ---
    const setQuickFilter = (type: 'today' | 'yesterday' | 'week' | 'lastMonth') => {
        const today = new Date();
        const y = today.getFullYear();
        
        let start = "";
        let end = ""; 

        if (type === 'today') {
            const m = String(today.getMonth() + 1).padStart(2, '0');
            const d = String(today.getDate()).padStart(2, '0');
            start = `${y}-${m}-${d}`;
            end = `${y}-${m}-${d}`;
        } else if (type === 'yesterday') {
            const yest = new Date(today);
            yest.setDate(today.getDate() - 1);
            const yM = String(yest.getMonth() + 1).padStart(2, '0');
            const yD = String(yest.getDate()).padStart(2, '0');
            start = `${yest.getFullYear()}-${yM}-${yD}`;
            end = `${yest.getFullYear()}-${yM}-${yD}`;
        } else if (type === 'week') {
            const lastWeek = new Date(today);
            lastWeek.setDate(today.getDate() - 7);
            const wM = String(lastWeek.getMonth() + 1).padStart(2, '0');
            const wD = String(lastWeek.getDate()).padStart(2, '0');
            start = `${lastWeek.getFullYear()}-${wM}-${wD}`;
            end = `${y}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        } else if (type === 'lastMonth') {
            setFilterMode('monthly');
            let lm = today.getMonth(); 
            let ly = today.getFullYear();
            if(lm === 0) { lm = 12; ly = ly - 1; }
            setSelectedMonth(String(lm).padStart(2, '0'));
            setSelectedYear(String(ly));
            return; 
        }

        if(start && end) {
            setFilterMode('custom');
            setCustomStart(start);
            setCustomEnd(end);
        }
    };

    // 1. Fetch Users
    const fetchUsers = useCallback(async () => {
        const { data, error } = await supabase
            .from('users')
            .select('id, full_name')
            .in('role', ['telecaller', 'team_leader']); 

        if (error) console.error('Error fetching users:', error);
        
        const map: UserMap = {};
        (data || []).forEach(user => {
            map[user.id] = user.full_name || `ID: ${user.id.substring(0, 5)}`;
        });
        setUserMap(map);
    }, [supabase]);

    // 2. Fetch Leads
    const fetchLeads = useCallback(async () => {
        setLoading(true);
        setSelectedAgentId(null);
        setCurrentPage(1); // Reset pagination on new fetch
        
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
            // UPGRADE: Added 'phone' to fetch
            .select('id, assigned_to, disbursed_amount, disbursed_at, application_number, name, phone, bank_name, city, DSA')
            .eq('status', 'DISBURSED') 
            .gte('disbursed_at', startQuery)
            .lte('disbursed_at', endQuery)
            .order('disbursed_at', { ascending: false })
            .limit(5000); 

        if (error) {
            toast({ title: "Error", description: "Failed to fetch transactions", variant: "destructive" });
            setLoading(false);
            return;
        }

        const safeData = (data || []).map(d => ({
            ...d,
            disbursed_amount: Number(d.disbursed_amount) || 0,
            DSA: d.DSA || 'Direct' // Normalize empty DSA
        }));

        setDisbursements(safeData as LeadDisbursement[]);
        setLoading(false);
    }, [supabase, filterMode, selectedYear, selectedMonth, customStart, customEnd, toast]);

    useEffect(() => {
        fetchUsers().then(() => fetchLeads());
        // Real-time subscription
        const channel = supabase.channel('disbursement-updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, (payload) => {
                const newData = payload.new as any;
                if (newData.status === 'DISBURSED' || (payload.old as any)?.status === 'DISBURSED') {
                    // Debounce fetch
                    setTimeout(() => fetchLeads(), 1000);
                }
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [fetchUsers, fetchLeads, refreshKey, supabase]);

    const handleDelete = async () => {
        if (!deleteId) return;
        setIsDeleting(true);
        try {
            const { error } = await supabase.from('leads')
                .update({ status: 'Interested', disbursed_amount: null, disbursed_at: null, DSA: null })
                .eq('id', deleteId);
            if (error) throw error;
            toast({ title: "Deleted", description: "Transaction removed successfully." });
            setRefreshKey(prev => prev + 1); 
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsDeleting(false);
            setDeleteId(null);
        }
    };

    // --- AGGREGATION & ANALYTICS ---
    const { 
        filteredData, grandTotal, displayLabel, bankChartData, trendData, 
        pieData, dsaChartData, avgTicketSize, cityStats, availableBanks, availableDSAs,
        projectedRevenue, dailyVelocity,
        smartInsight, maxDeal
    } = useMemo(() => {
        let total = 0;
        const bankMap: Record<string, number> = {};
        const dailyMap: Record<string, number> = {};
        const cityMap: Record<string, number> = {};
        const agentMap: Record<string, number> = {};
        const dsaMap: Record<string, number> = {}; // UPGRADE: DSA Stats
        const uniqueBanks = new Set<string>();
        const uniqueDSAs = new Set<string>();
        
        let maxDealItem: LeadDisbursement | null = null;

        // 1. Filter
        const searched = disbursements.filter(item => {
            if(item.bank_name) uniqueBanks.add(item.bank_name);
            if(item.DSA) uniqueDSAs.add(item.DSA);

            if (selectedAgentId && item.assigned_to !== selectedAgentId) return false;
            if (selectedBank !== 'all' && item.bank_name !== selectedBank) return false;
            if (selectedDSA !== 'all' && item.DSA !== selectedDSA) return false;

            const term = searchTerm.toLowerCase();
            const telecallerName = userMap[item.assigned_to]?.toLowerCase() || "";
            const customerName = item.name?.toLowerCase() || "";
            const appNo = item.application_number?.toLowerCase() || "";
            const dsaName = item.DSA?.toLowerCase() || "";
            return telecallerName.includes(term) || customerName.includes(term) || appNo.includes(term) || dsaName.includes(term);
        });

        // 2. Aggregate
        searched.forEach(d => { 
            const amt = d.disbursed_amount;
            total += amt; 
            
            // Stats Building
            bankMap[d.bank_name || 'Others'] = (bankMap[d.bank_name || 'Others'] || 0) + amt;
            cityMap[d.city || 'Unknown'] = (cityMap[d.city || 'Unknown'] || 0) + amt;
            agentMap[d.assigned_to] = (agentMap[d.assigned_to] || 0) + amt;
            dsaMap[d.DSA] = (dsaMap[d.DSA] || 0) + amt; // Accumulate DSA
            
            if(d.disbursed_at) {
                const iso = d.disbursed_at.split('T')[0];
                dailyMap[iso] = (dailyMap[iso] || 0) + amt;
            }

            if (!maxDealItem || amt > maxDealItem.disbursed_amount) {
                maxDealItem = d;
            }
        });

        const avg = searched.length > 0 ? total / searched.length : 0;
        
        // 3. Projections
        let velocity = 0;
        let projection = total;
        if (filterMode === 'monthly' && selectedMonth !== 'all') {
            const now = new Date();
            const selYear = Number(selectedYear);
            const selMonthIdx = Number(selectedMonth) - 1;
            const daysInMonth = new Date(selYear, selMonthIdx + 1, 0).getDate();
            if (selYear === now.getFullYear() && selMonthIdx === now.getMonth()) {
                const daysPassed = now.getDate();
                velocity = total / daysPassed;
                projection = velocity * daysInMonth; 
            } else {
                velocity = total / daysInMonth; 
                projection = total; 
            }
        }

        // 4. Smart Insights
        let insight = "Track your daily performance to hit targets.";
        if (total > 0) {
            const entries = Object.entries(bankMap).sort((a,b) => b[1] - a[1]);
            if (entries.length > 0) {
                const topBankName = entries[0][0];
                const topBankShare = (entries[0][1] / total) * 100;
                if (topBankShare > 60) {
                    insight = `⚠️ High dependency on ${topBankName} (${topBankShare.toFixed(0)}% of volume). Consider diversifying.`;
                } else if (topBankShare > 40) {
                    insight = `ℹ️ ${topBankName} is your leading partner, driving ${topBankShare.toFixed(0)}% of sales.`;
                }
            }
        }

        let label = "Total Revenue";
        if (selectedAgentId) label = `${userMap[selectedAgentId]}'s Revenue`;

        // Charts
        const bChartData = Object.entries(bankMap).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 8);
        const dChartData = Object.entries(dsaMap).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value); // DSA Chart Data
        
        const sortedBanks = Object.entries(bankMap).sort((a,b) => b[1] - a[1]);
        const top5 = sortedBanks.slice(0, 5).map(([name, value]) => ({ name, value }));
        
        const trendFinal = Object.keys(dailyMap).sort().map(iso => ({
            date: new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
            value: dailyMap[iso]
        }));
        
        const cityFinal = Object.entries(cityMap).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 5);
        const banksList = Array.from(uniqueBanks).sort();
        const dsasList = Array.from(uniqueDSAs).sort();

        return {
            filteredData: searched,
            grandTotal: total,
            displayLabel: label,
            bankChartData: bChartData,
            dsaChartData: dChartData, // Exporting this
            pieData: top5,
            trendData: trendFinal,
            avgTicketSize: avg,
            cityStats: cityFinal,
            availableBanks: banksList,
            availableDSAs: dsasList,
            projectedRevenue: projection,
            dailyVelocity: velocity,
            smartInsight: insight,
            maxDeal: maxDealItem
        };
    }, [disbursements, searchTerm, userMap, selectedAgentId, selectedBank, selectedDSA, filterMode, selectedYear, selectedMonth]);

    // Leaderboard
    const telecallerStats = useMemo(() => {
        const stats: Record<string, { amount: number, count: number }> = {};
        filteredData.forEach(d => {
            const id = d.assigned_to;
            if(!stats[id]) stats[id] = { amount: 0, count: 0 };
            stats[id].amount += (d.disbursed_amount || 0);
            stats[id].count += 1;
        });
        return Object.entries(stats)
            .map(([id, data]) => ({ 
                id, name: userMap[id] || 'Unknown', amount: data.amount, count: data.count,
                avg: data.count > 0 ? data.amount / data.count : 0
            }))
            .sort((a, b) => b.amount - a.amount);
    }, [filteredData, userMap]);

    // --- NEW: CSV EXPORT FUNCTION ---
    const handleExportCSV = () => {
        if (!filteredData.length) {
            toast({ title: "No Data", description: "Nothing to export based on current filters." });
            return;
        }
        
        const headers = ["Application No", "Date", "Customer Name", "Phone", "Bank", "DSA", "City", "Amount", "Agent"];
        const rows = filteredData.map(item => [
            item.application_number,
            item.disbursed_at ? item.disbursed_at.split('T')[0] : '-',
            `"${item.name}"`, // Quote to handle commas in names
            item.phone,
            item.bank_name,
            item.DSA,
            item.city,
            item.disbursed_amount,
            userMap[item.assigned_to] || item.assigned_to
        ]);

        const csvContent = "data:text/csv;charset=utf-8," 
            + headers.join(",") + "\n" 
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `disbursement_report_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Pagination Logic
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const getRankIcon = (index: number) => {
        if (index === 0) return <Trophy className="h-5 w-5 text-yellow-500 fill-yellow-100" />;
        if (index === 1) return <Medal className="h-5 w-5 text-gray-400 fill-gray-100" />;
        if (index === 2) return <Medal className="h-5 w-5 text-orange-600 fill-orange-100" />;
        return <span className="text-gray-400 font-bold text-sm">#{index + 1}</span>;
    };

    const targetProgress = Math.min((grandTotal / targetAmount) * 100, 100);
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
                    <p className="text-slate-500 text-sm mt-1">Financial tracking, DSA performance, and commission analysis</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleExportCSV} className="gap-2">
                        <Download className="h-4 w-4" /> Export CSV
                    </Button>
                    <Button variant="outline" onClick={handlePrint} className="gap-2">
                        <Printer className="h-4 w-4" /> Print
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
                            <Input placeholder="Search Name, App No, DSA..." className="pl-9" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} />
                        </div>
                        
                        <div className="flex flex-wrap gap-2 items-end">
                             <div className="flex gap-1 mb-1 lg:mb-0 mr-2">
                                <Badge variant="outline" className="cursor-pointer hover:bg-slate-100" onClick={() => setQuickFilter('today')}>Today</Badge>
                                <Badge variant="outline" className="cursor-pointer hover:bg-slate-100" onClick={() => setQuickFilter('yesterday')}>Yesterday</Badge>
                                <Badge variant="outline" className="cursor-pointer hover:bg-slate-100" onClick={() => setQuickFilter('lastMonth')}>Last Month</Badge>
                            </div>

                            {/* BANK FILTER */}
                            <Select value={selectedBank} onValueChange={(v) => { setSelectedBank(v); setCurrentPage(1); }}>
                                <SelectTrigger className="w-[130px] border-slate-300"><SelectValue placeholder="All Banks" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Banks</SelectItem>
                                    {availableBanks.map(bank => <SelectItem key={bank} value={bank}>{bank}</SelectItem>)}
                                </SelectContent>
                            </Select>

                            {/* DSA FILTER (NEW) */}
                            <Select value={selectedDSA} onValueChange={(v) => { setSelectedDSA(v); setCurrentPage(1); }}>
                                <SelectTrigger className="w-[130px] border-slate-300"><SelectValue placeholder="All DSAs" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All DSAs</SelectItem>
                                    {availableDSAs.map(dsa => <SelectItem key={dsa} value={dsa}>{dsa}</SelectItem>)}
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
            <Tabs defaultValue="dashboard" className="w-full">
                <TabsList className="grid w-full max-w-[400px] grid-cols-2 print:hidden">
                    <TabsTrigger value="dashboard">Analytics Board</TabsTrigger>
                    <TabsTrigger value="data">Data List</TabsTrigger>
                </TabsList>

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
                                        <h2 className="text-xl font-bold text-slate-800">{formatCurrency(maxDeal.disbursed_amount)}</h2>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Badge variant="outline" className="text-[10px] px-1">{userMap[maxDeal.assigned_to]?.split(' ')[0]}</Badge>
                                            <span className="text-[10px] text-slate-400 truncate w-16">{maxDeal.bank_name}</span>
                                        </div>
                                    </div>
                                ) : <p className="text-sm text-slate-400 italic">No data</p>}
                            </CardContent>
                        </Card>

                        {/* 3. GOAL */}
                        <Card className="bg-white shadow-sm border-slate-200">
                            <CardContent className="p-4 pt-6">
                                <div className="flex justify-between items-center mb-1">
                                    <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Goal Progress</p>
                                    {!isTargetEditing ? (
                                        <div onClick={() => setIsTargetEditing(true)} className="cursor-pointer text-[10px] bg-slate-100 px-1 rounded">Edit</div>
                                    ) : (
                                        <div className="flex gap-1"><Input type="number" className="h-5 w-16 text-[10px]" value={targetAmount} onChange={e=>setTargetAmount(Number(e.target.value))} /><Button size="sm" className="h-5 text-[10px] px-1" onClick={()=>setIsTargetEditing(false)}>OK</Button></div>
                                    )}
                                </div>
                                <div className="flex justify-between items-end">
                                    <h2 className="text-xl font-bold text-slate-800">{targetProgress.toFixed(0)}%</h2>
                                    <span className="text-xs text-slate-400 mb-1">of {formatCurrency(targetAmount)}</span>
                                </div>
                                <Progress value={targetProgress} className="h-1.5 mt-2 bg-slate-100" indicatorClassName={targetProgress >= 100 ? 'bg-green-500' : 'bg-slate-900'}/>
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
                             {/* TREND CHART */}
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
                                {/* DSA PERFORMANCE CHART (NEW) */}
                                <Card className="shadow-sm border-slate-200">
                                    <CardHeader className="py-4"><CardTitle className="text-sm font-semibold flex gap-2"><BarChart3 className="h-4 w-4 text-pink-500"/> DSA Performance</CardTitle></CardHeader>
                                    <CardContent className="h-[250px]">
                                         <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={dsaChartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                                <XAxis type="number" fontSize={10} hide />
                                                <YAxis dataKey="name" type="category" width={80} fontSize={10} />
                                                <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                                                <Bar dataKey="value" fill="#ec4899" radius={[0, 4, 4, 0]} barSize={20} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </CardContent>
                                </Card>

                                {/* BANK SHARE CHART */}
                                <Card className="shadow-sm border-slate-200">
                                    <CardHeader className="py-4"><CardTitle className="text-sm font-semibold flex gap-2"><PieIcon className="h-4 w-4 text-purple-500"/> Bank Share</CardTitle></CardHeader>
                                    <CardContent className="h-[250px]">
                                         <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2} dataKey="value">
                                                    {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                                                </Pie>
                                                <Legend wrapperStyle={{fontSize: '10px'}} layout="horizontal" verticalAlign="bottom" align="center" />
                                                <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>

                        {/* LEADERBOARD */}
                        <div className="md:col-span-4 space-y-6">
                            <Card className="shadow-sm border-slate-200 h-full">
                                <CardHeader className="py-4 bg-slate-50 border-b">
                                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                        <Trophy className="h-4 w-4 text-yellow-500" /> Leaderboard
                                    </CardTitle>
                                </CardHeader>
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader className="bg-slate-50">
                                            <TableRow className="hover:bg-slate-50">
                                                <TableHead className="w-[40px] text-xs font-bold text-slate-600">#</TableHead>
                                                <TableHead className="text-xs font-bold text-slate-600">Agent</TableHead>
                                                <TableHead className="text-right text-xs font-bold text-green-600">Total</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {telecallerStats.map((stat, idx) => (
                                                <TableRow 
                                                    key={stat.id} 
                                                    className={`hover:bg-slate-50 border-b border-slate-100 ${selectedAgentId === stat.id ? 'bg-green-50' : ''}`}
                                                    onClick={() => setSelectedAgentId(stat.id === selectedAgentId ? null : stat.id)}
                                                >
                                                    <TableCell className="py-3">{getRankIcon(idx)}</TableCell>
                                                    <TableCell className="py-3 font-semibold text-slate-700 text-xs">
                                                        {stat.name}
                                                        <div className="text-[10px] font-normal text-slate-400">{stat.count} files</div>
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

                <TabsContent value="data" className="mt-4">
                    <Card className="shadow-sm">
                        <CardHeader className="flex flex-row justify-between items-center">
                            <CardTitle className="text-base">Transactions ({filteredData.length})</CardTitle>
                            
                            {/* PAGINATION CONTROLS */}
                            <div className="flex items-center gap-2">
                                <Button 
                                    variant="outline" size="icon" className="h-8 w-8" 
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                                    disabled={currentPage === 1}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <span className="text-xs text-slate-500">Page {currentPage} of {totalPages || 1}</span>
                                <Button 
                                    variant="outline" size="icon" className="h-8 w-8" 
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                                    disabled={currentPage === totalPages || totalPages === 0}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader className="bg-slate-50">
                                    <TableRow>
                                        <TableHead>#</TableHead>
                                        <TableHead>App No</TableHead>
                                        <TableHead>Agent</TableHead>
                                        <TableHead>Customer</TableHead>
                                        <TableHead>DSA</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Bank</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                        <TableHead className="text-center">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedData.map((item, index) => (
                                        <TableRow key={item.id} className="hover:bg-slate-50">
                                            <TableCell className="text-xs text-slate-500">{(currentPage - 1) * itemsPerPage + index + 1}</TableCell>
                                            <TableCell className="text-xs font-mono">{item.application_number}</TableCell>
                                            <TableCell><Badge variant="outline" className="font-normal text-xs">{userMap[item.assigned_to]}</Badge></TableCell>
                                            <TableCell><div className="flex flex-col"><span className="text-sm font-medium">{item.name}</span><span className="text-[10px] text-slate-400">{item.city}</span></div></TableCell>
                                            <TableCell className="text-xs font-medium text-slate-700">{item.DSA}</TableCell>
                                            <TableCell className="text-sm text-slate-500">{formatDate(item.disbursed_at)}</TableCell>
                                            <TableCell className="text-sm">{item.bank_name}</TableCell>
                                            <TableCell className="text-right font-bold text-green-700">{formatCurrency(item.disbursed_amount)}</TableCell>
                                            <TableCell className="text-center"><Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600" onClick={() => setDeleteId(item.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                                        </TableRow>
                                    ))}
                                    {paginatedData.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={9} className="h-24 text-center text-slate-500">No transactions found.</TableCell>
                                        </TableRow>
                                    )}
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
