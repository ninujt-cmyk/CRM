"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription 
} from "@/components/ui/card"
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table"
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from "@/components/ui/dialog"
import { 
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter 
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { 
  Loader2, FileCheck, Download, Search, Trophy, Medal,
  ArrowRightLeft, Edit, Plus, X, Trash2, 
  Clock, CheckCircle2, XCircle, ChevronLeft, ChevronRight,
  Building2, Wallet, CalendarDays, Fingerprint
} from "lucide-react"
import { toast } from "sonner"
import { format, startOfMonth, endOfMonth, subMonths, isSameDay, isWithinInterval } from "date-fns" 
import { EmptyState } from "@/components/empty-state" 

// --- TYPES ---
type BankAttempt = {
  bank: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Disbursed';
  reason?: string;
  date: string;
}

// --- CONFIGURATION ---
const TARGET_BANKS = ["icici", "hdfc", "axis", "kotak"];
const TARGET_NBFCS = ["incred", "finnable", "idfc", "paysense", "kreditbee", "bajaj", "tata"];

export default function AdminLoginsPage() {
    const supabase = createClient()
    const [loading, setLoading] = useState(true)
    const [logins, setLogins] = useState<any[]>([])
    const [transfers, setTransfers] = useState<any[]>([])
    const [attendanceData, setAttendanceData] = useState<any[]>([])
    
    // Filters & Pagination
    const [dateFilter, setDateFilter] = useState("today") 
    const [searchQuery, setSearchQuery] = useState("")
    const [selectedBank, setSelectedBank] = useState("all")
    const [statusFilter, setStatusFilter] = useState("all")
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 10

    // Edit/Delete State
    const [editingLogin, setEditingLogin] = useState<any>(null)
    const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(null)

    // 1. DATA FETCHING
    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            // Determine global start/end dates based on filter to fetch ALL relevant data
            let startDate = startOfMonth(new Date());
            let endDate = endOfMonth(new Date());

            if (dateFilter === 'last_month') {
                const lastMonth = subMonths(new Date(), 1);
                startDate = startOfMonth(lastMonth);
                endDate = endOfMonth(lastMonth);
            }

            // Fetch Logins
            let loginsQuery = supabase
                .from('logins') 
                .select(`
                    id, name, phone, bank_name, created_at, updated_at, notes, status, bank_attempts,
                    assigned_to,
                    users:assigned_to ( full_name, email )
                `)
                .gte('created_at', startDate.toISOString())
                .lte('created_at', endDate.toISOString())
                .order('created_at', { ascending: false })

            // Fetch Transfers (Live today only)
            const transfersQuery = supabase
                .from('leads')
                .select(`id, name, updated_at, users:assigned_to ( full_name )`)
                .eq('status', 'Transferred to KYC')
                .gte('updated_at', new Date(new Date().setHours(0,0,0,0)).toISOString()) 
                .order('updated_at', { ascending: false })

            // Fetch Attendance Data for the target period
            const attendanceQuery = supabase
                .from('attendance')
                .select('user_id, date, users:user_id ( full_name )')
                .gte('date', startDate.toISOString().split('T')[0])
                .lte('date', endDate.toISOString().split('T')[0])
                .not('check_in', 'is', null) // Must have checked in

            const [loginsRes, transfersRes, attendanceRes] = await Promise.all([loginsQuery, transfersQuery, attendanceQuery])
            
            if (loginsRes.data) setLogins(loginsRes.data)
            if (transfersRes.data) setTransfers(transfersRes.data)
            if (attendanceRes.data) setAttendanceData(attendanceRes.data)

        } catch (e) {
            console.error(e)
            toast.error("Failed to load data")
        } finally {
            setLoading(false)
        }
    }, [dateFilter, supabase])

    useEffect(() => { fetchData() }, [fetchData])

    // 2. COMPUTED STATS & FILTERING (For Manage Tab)
    const filteredLogins = useMemo(() => {
        return logins.filter(l => {
            if (dateFilter === 'today') {
                if (!isSameDay(new Date(l.created_at), new Date())) return false;
            }

            const matchesSearch = 
                (l.name && l.name.toLowerCase().includes(searchQuery.toLowerCase())) || 
                (l.phone && l.phone.includes(searchQuery)) ||
                (l.users?.full_name && l.users.full_name.toLowerCase().includes(searchQuery.toLowerCase()));
            
            const matchesBank = selectedBank === 'all' || 
                (Array.isArray(l.bank_attempts) ? l.bank_attempts.some((a:any) => a.bank === selectedBank) : l.bank_name === selectedBank);
            
            const matchesStatus = statusFilter === 'all' || 
                (Array.isArray(l.bank_attempts) ? l.bank_attempts.some((a:any) => a.status === statusFilter) : l.status === statusFilter);

            return matchesSearch && matchesBank && matchesStatus;
        })
    }, [logins, searchQuery, selectedBank, statusFilter, dateFilter])

    const paginatedLogins = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage
        return filteredLogins.slice(start, start + itemsPerPage)
    }, [filteredLogins, currentPage])

    const totalPages = Math.ceil(filteredLogins.length / itemsPerPage)

    const handleSave = (updatedLogin: any) => {
        setLogins(logins.map(l => l.id === updatedLogin.id ? updatedLogin : l))
        setEditingLogin(null)
    }

    const handleDelete = async () => {
        if(!deleteConfirmation) return
        const { error } = await supabase.from('logins').delete().eq('id', deleteConfirmation)
        if(error) {
            toast.error("Failed to delete record")
        } else {
            setLogins(logins.filter(l => l.id !== deleteConfirmation))
            toast.success("Record deleted")
        }
        setDeleteConfirmation(null)
    }

    const handleExport = () => {
        if (filteredLogins.length === 0) return toast.error("No data to export");
        const csvRows = [
            ["Agent Name", "Customer Name", "Phone", "Status", "Bank Details", "Created At"],
            ...filteredLogins.map(l => [
                l.users?.full_name || 'Unknown',
                l.name,
                l.phone,
                l.status,
                Array.isArray(l.bank_attempts) ? l.bank_attempts.map((a:any) => `${a.bank}(${a.status})`).join('; ') : l.bank_name,
                format(new Date(l.created_at), "yyyy-MM-dd HH:mm:ss")
            ])
        ]
        const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Logins_${format(new Date(), 'yyyyMMdd')}.csv`);
        document.body.appendChild(link);
        link.click();
    }

    return (
        <div className="p-4 md:p-8 space-y-6 bg-slate-50/60 dark:bg-slate-950/60 min-h-screen pb-20 font-sans">
            {/* Header section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-600 rounded-xl text-white shadow-md shadow-indigo-500/10">
                        <FileCheck className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                            Login Management
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">Track customer files, monitor bank status attempts, and analyze daily leaderboards.</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/40 p-2 px-4 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Live Hands-on System</span>
                </div>
            </div>

            <Tabs defaultValue="manage" className="w-full">
                <TabsList className="bg-slate-100/80 dark:bg-slate-900/60 p-1 rounded-xl border border-slate-200/50 dark:border-slate-800/50 max-w-[480px] mb-6">
                    <TabsTrigger value="manage" className="rounded-lg text-xs font-semibold py-2 px-4 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:shadow-xs">Manage Logins</TabsTrigger>
                    <TabsTrigger value="daily_reports" className="rounded-lg text-xs font-semibold py-2 px-4 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:shadow-xs">Daily Reports</TabsTrigger>
                    <TabsTrigger value="monthly_reports" className="rounded-lg text-xs font-semibold py-2 px-4 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:shadow-xs">Monthly Reports</TabsTrigger>
                </TabsList>

                {/* --- TAB 1: MANAGE LIST --- */}
                <TabsContent value="manage" className="space-y-6">
                    <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-xs">
                        <div className="flex flex-wrap gap-2">
                            <Button variant={dateFilter === 'today' ? 'default' : 'outline'} size="sm" onClick={() => setDateFilter('today')} className="rounded-lg text-xs font-semibold">Today</Button>
                            <Button variant={dateFilter === 'this_month' ? 'default' : 'outline'} size="sm" onClick={() => setDateFilter('this_month')} className="rounded-lg text-xs font-semibold">This Month</Button>
                            <Button variant={dateFilter === 'last_month' ? 'default' : 'outline'} size="sm" onClick={() => setDateFilter('last_month')} className="rounded-lg text-xs font-semibold">Last Month</Button>
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
                                <Input placeholder="Search Customer, Phone, Agent..." className="pl-9 h-9 text-xs rounded-lg border-slate-200 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-950/50 focus-visible:ring-indigo-500 dark:text-white" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                            </div>
                            <Button variant="outline" size="sm" onClick={handleExport} className="h-9 w-9 p-0 rounded-lg border-slate-200 dark:border-slate-850 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-850"><Download className="w-4 h-4" /></Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        <div className="lg:col-span-9 space-y-4">
                            <Card className="shadow-xs border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl overflow-hidden">
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader className="bg-slate-50/70 dark:bg-slate-800/40">
                                            <TableRow className="border-b border-slate-100 dark:border-slate-850">
                                                <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs">Customer Details</TableHead>
                                                <TableHead className="hidden md:table-cell font-semibold text-slate-700 dark:text-slate-300 text-xs">Bank Attempts & Status</TableHead>
                                                <TableHead className="hidden md:table-cell font-semibold text-slate-700 dark:text-slate-300 text-xs">Assigned Telecaller</TableHead>
                                                <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs">Created Date</TableHead>
                                                <TableHead className="w-[60px]"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {loading ? (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="h-48 text-center">
                                                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600 dark:text-indigo-400" />
                                                    </TableCell>
                                                </TableRow>
                                            ) : paginatedLogins.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="h-48 text-center">
                                                        <EmptyState icon={Search} title="No Records Found" description="Try adjusting your filter parameters." />
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                paginatedLogins.map((item) => (
                                                    <TableRow key={item.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors border-b border-slate-100 dark:border-slate-850">
                                                        <TableCell className="py-3.5">
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-slate-900 dark:text-slate-100 block text-sm">{item.name}</span>
                                                                <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">{item.phone}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="hidden md:table-cell py-3.5">
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {Array.isArray(item.bank_attempts) && item.bank_attempts.length > 0 ? (
                                                                    item.bank_attempts.map((att: BankAttempt, idx: number) => (
                                                                        <Badge key={idx} variant="outline" className={`gap-1 py-0.5 px-2 text-[10px] rounded-full border shadow-2xs font-semibold ${getStatusColor(att.status)}`}>
                                                                            {getStatusIcon(att.status)}
                                                                            <span className="font-semibold tracking-tight">{att.bank}</span>
                                                                        </Badge>
                                                                    ))
                                                                ) : (
                                                                    <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 text-[10px] rounded-full">{item.bank_name || 'No Bank'}</Badge>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="hidden md:table-cell py-3.5">
                                                            <div className="flex items-center gap-2">
                                                                <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-indigo-500 via-indigo-600 to-violet-600 flex items-center justify-center text-xs font-bold text-white shadow-xs ring-1 ring-white dark:ring-slate-800">
                                                                    {(item.users?.full_name || 'U')[0].toUpperCase()}
                                                                </div>
                                                                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{item.users?.full_name?.split(' ')[0] || 'Unknown'}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="py-3.5">
                                                            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">{format(new Date(item.created_at), "MMM dd, yyyy")}</div>
                                                            <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">{format(new Date(item.created_at), "hh:mm a")}</div>
                                                        </TableCell>
                                                        <TableCell className="py-3.5 text-right">
                                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-lg" onClick={() => setEditingLogin(item)}>
                                                                <Edit className="h-4 w-4" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                                
                                <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex items-center justify-between">
                                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                        Showing {filteredLogins.length === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredLogins.length)} of {filteredLogins.length}
                                    </span>
                                    <div className="flex gap-1">
                                        <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg border-slate-200 dark:border-slate-800" onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4"/></Button>
                                        <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg border-slate-200 dark:border-slate-800" onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage === totalPages || totalPages === 0}><ChevronRight className="h-4 w-4"/></Button>
                                    </div>
                                </div>
                            </Card>
                        </div>

                        {/* Sidebar */}
                        <div className="lg:col-span-3 space-y-6">
                            <Card className="shadow-xs border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl overflow-hidden">
                                <CardHeader className="bg-gradient-to-r from-indigo-50/40 to-purple-50/20 dark:from-slate-800/40 dark:to-slate-800/20 pb-3.5 border-b border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="relative">
                                                <span className="h-2 w-2 rounded-full bg-emerald-500 absolute -top-0.5 -right-0.5 animate-ping" />
                                                <span className="h-2 w-2 rounded-full bg-emerald-500 absolute -top-0.5 -right-0.5" />
                                                <ArrowRightLeft className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                                            </div>
                                            <CardTitle className="text-sm font-bold text-slate-850 dark:text-slate-100">Live Handover</CardTitle>
                                        </div>
                                        <Badge className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40 text-[10px] font-bold py-0.5 px-2 rounded-full">{transfers.length}</Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/50">
                                        {transfers.length === 0 ? (
                                            <div className="p-6 text-center text-xs text-slate-450 dark:text-slate-500 italic">No handovers recorded today.</div>
                                        ) : (
                                            transfers.map((t) => (
                                                <div key={t.id} className="p-3.5 hover:bg-slate-50/60 dark:hover:bg-slate-800/25 transition-all">
                                                    <div className="flex justify-between items-center gap-2">
                                                        <span className="text-xs font-semibold text-slate-750 dark:text-slate-300">{t.users?.full_name || 'Unknown'}</span>
                                                        <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">{format(new Date(t.updated_at), "hh:mm a")}</span>
                                                    </div>
                                                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate font-medium">{t.name}</div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                {/* --- TAB 2: DAILY REPORTS --- */}
                <TabsContent value="daily_reports">
                    <DailyReportsView logins={logins} />
                </TabsContent>

                {/* --- TAB 3: MONTHLY REPORTS --- */}
                <TabsContent value="monthly_reports">
                    <MonthlyReportsView logins={logins} attendanceData={attendanceData} />
                </TabsContent>
            </Tabs>

            <EditLoginSheet 
                login={editingLogin} 
                open={!!editingLogin} 
                onClose={() => setEditingLogin(null)}
                onSave={handleSave} 
                onDelete={(id) => setDeleteConfirmation(id)}
            />

            <Dialog open={!!deleteConfirmation} onOpenChange={() => setDeleteConfirmation(null)}>
                <DialogContent className="rounded-2xl dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white">Delete Record?</DialogTitle>
                        <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1">This action cannot be undone. This will permanently remove this customer login details from the server database.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-4 gap-2 sm:gap-0">
                        <Button variant="outline" size="sm" onClick={() => setDeleteConfirmation(null)} className="rounded-lg text-xs">Cancel</Button>
                        <Button variant="destructive" size="sm" onClick={handleDelete} className="rounded-lg text-xs bg-red-650 hover:bg-red-700">Delete Permanently</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

function DailyReportsView({ logins }: { logins: any[] }) {
    const today = new Date();
    const startOfCurrentMonth = startOfMonth(today);

    const detailedStats = useMemo(() => {
        const stats: Record<string, { name: string, mtd: number, today: number, todayBank: number, todayNbfc: number }> = {};

        logins.forEach(l => {
            const createdAt = new Date(l.created_at);
            
            if (createdAt >= startOfCurrentMonth) {
                const name = l.users?.full_name || 'Unknown';
                if (!stats[name]) stats[name] = { name, mtd: 0, today: 0, todayBank: 0, todayNbfc: 0 };

                stats[name].mtd += 1;

                if (isSameDay(createdAt, today)) {
                    stats[name].today += 1;

                    let bankName = l.bank_name || '';
                    if (!bankName && Array.isArray(l.bank_attempts) && l.bank_attempts.length > 0) {
                        bankName = l.bank_attempts[0].bank;
                    }
                    bankName = bankName.toLowerCase().trim();

                    const isTargetBank = TARGET_BANKS.some(tb => bankName.includes(tb));

                    if (isTargetBank) stats[name].todayBank += 1;
                    else stats[name].todayNbfc += 1; 
                }
            }
        });

        return Object.values(stats).sort((a, b) => {
            if (b.today !== a.today) return b.today - a.today;
            return b.mtd - a.mtd;
        });
    }, [logins]);

    const mtdTotal = detailedStats.reduce((acc, curr) => acc + curr.mtd, 0);
    const todayTotal = detailedStats.reduce((acc, curr) => acc + curr.today, 0);

    const getLeaderboardRankBadge = (rank: number) => {
        if (rank === 0) {
            return (
                <div className="flex justify-center items-center">
                    <span className="flex items-center gap-1 text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full border border-amber-200/50 dark:border-amber-900/40 shadow-3xs">
                        <Trophy className="h-3 w-3 text-amber-500 fill-amber-500" />
                        Gold
                    </span>
                </div>
            )
        }
        if (rank === 1) {
            return (
                <div className="flex justify-center items-center">
                    <span className="flex items-center gap-1 text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-750 shadow-3xs">
                        <Medal className="h-3 w-3 text-slate-450 fill-slate-355" />
                        Silver
                    </span>
                </div>
            )
        }
        if (rank === 2) {
            return (
                <div className="flex justify-center items-center">
                    <span className="flex items-center gap-1 text-[10px] font-bold bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 px-2 py-0.5 rounded-full border border-orange-200/40 dark:border-orange-900/30 shadow-3xs">
                        <Medal className="h-3 w-3 text-orange-600 fill-orange-500" />
                        Bronze
                    </span>
                </div>
            )
        }
        return <span className="text-slate-400 dark:text-slate-500 font-bold text-xs font-mono">#{rank + 1}</span>
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-800 text-white shadow-md border-0 rounded-2xl overflow-hidden relative">
                    <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-4 translate-y-4">
                        <FileCheck className="h-32 w-32" />
                    </div>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-indigo-200">Today's Logins</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-extrabold tracking-tight">{todayTotal}</div>
                        <p className="text-[10px] text-indigo-250 mt-1 font-medium">Real-time logins submitted today</p>
                    </CardContent>
                </Card>
                <Card className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xs rounded-2xl overflow-hidden relative">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">MTD Total Logins</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-extrabold tracking-tight text-slate-800 dark:text-white">{mtdTotal}</div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 font-medium">Since {format(startOfCurrentMonth, 'MMM 01, yyyy')}</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="shadow-xs border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl overflow-hidden">
                <CardHeader className="bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 pb-4">
                    <div className="flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-amber-500" />
                        <CardTitle className="text-base font-bold text-slate-800 dark:text-slate-100">Telecaller Daily Leaderboard</CardTitle>
                    </div>
                    <CardDescription className="text-xs text-slate-400 dark:text-slate-500">Breakdown of today's logins by Banks and NBFCs.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-slate-50/40 dark:bg-slate-800/20">
                                <TableRow className="border-b border-slate-150 dark:border-slate-850">
                                    <TableHead className="w-[80px] text-center text-xs font-semibold text-slate-650 dark:text-slate-400">Rank</TableHead>
                                    <TableHead className="text-xs font-semibold text-slate-650 dark:text-slate-400">Telecaller Name</TableHead>
                                    <TableHead className="text-center w-[130px] bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-950 dark:text-indigo-300 border-x border-slate-150 dark:border-slate-850 font-bold text-xs">Today's Total</TableHead>
                                    <TableHead className="text-center w-[130px] text-xs font-semibold text-slate-650 dark:text-slate-400">
                                        <div className="flex items-center justify-center gap-1 text-blue-600 dark:text-blue-400 font-semibold"><Building2 className="h-3.5 w-3.5"/> Banks</div>
                                    </TableHead>
                                    <TableHead className="text-center w-[130px] text-xs font-semibold text-slate-650 dark:text-slate-400">
                                        <div className="flex items-center justify-center gap-1 text-orange-600 dark:text-orange-400 font-semibold"><Wallet className="h-3.5 w-3.5"/> NBFCs</div>
                                    </TableHead>
                                    <TableHead className="text-center w-[130px] bg-slate-100/50 dark:bg-slate-800/40 font-bold text-slate-700 dark:text-slate-300 text-xs">MTD Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {detailedStats.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-12 text-slate-400 dark:text-slate-500 text-xs italic font-medium">No data found for today.</TableCell>
                                    </TableRow>
                                ) : (
                                    detailedStats.map((stat, index) => (
                                        <TableRow key={stat.name} className="hover:bg-slate-50 dark:hover:bg-slate-800/25 transition-colors border-b border-slate-100 dark:border-slate-850">
                                            <TableCell className="py-3 text-center">{getLeaderboardRankBadge(index)}</TableCell>
                                            <TableCell className="py-3 font-bold text-slate-800 dark:text-slate-200 text-xs">{stat.name}</TableCell>
                                            <TableCell className="py-3 text-center bg-indigo-50/20 dark:bg-indigo-950/10 font-extrabold text-indigo-700 dark:text-indigo-400 text-sm border-x border-indigo-50 dark:border-indigo-950/20">
                                                {stat.today > 0 ? stat.today : <span className="text-slate-350 dark:text-slate-600 font-normal">-</span>}
                                            </TableCell>
                                            <TableCell className="py-3 text-center font-bold text-blue-600 dark:text-blue-400 text-xs">
                                                {stat.todayBank > 0 ? stat.todayBank : <span className="text-slate-350 dark:text-slate-600 font-normal">-</span>}
                                            </TableCell>
                                            <TableCell className="py-3 text-center font-bold text-orange-600 dark:text-orange-400 text-xs">
                                                {stat.todayNbfc > 0 ? stat.todayNbfc : <span className="text-slate-350 dark:text-slate-600 font-normal">-</span>}
                                            </TableCell>
                                            <TableCell className="py-3 text-center bg-slate-50/40 dark:bg-slate-800/10 font-extrabold text-slate-800 dark:text-slate-200 text-xs">{stat.mtd}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

// --- MONTHLY REPORT VIEW COMPONENT (UPDATED WITH ATTENDANCE) ---
function MonthlyReportsView({ logins, attendanceData }: { logins: any[], attendanceData: any[] }) {
    const [monthOffset, setMonthOffset] = useState(0); 

    const targetDate = subMonths(new Date(), monthOffset);
    const startOfTargetMonth = startOfMonth(targetDate);
    const endOfTargetMonth = endOfMonth(targetDate);

    const detailedStats = useMemo(() => {
        const stats: Record<string, { name: string, total: number, bank: number, nbfc: number, workingDays: number }> = {};

        // 1. Calculate working days first (to ensure agents with 0 logins still appear)
        attendanceData.forEach(record => {
            const date = new Date(record.date);
            if (isWithinInterval(date, { start: startOfTargetMonth, end: endOfTargetMonth })) {
                const name = record.users?.full_name || 'Unknown';
                if (!stats[name]) stats[name] = { name, total: 0, bank: 0, nbfc: 0, workingDays: 0 };
                
                stats[name].workingDays += 1;
            }
        });

        // 2. Add Login Stats
        logins.forEach(l => {
            const createdAt = new Date(l.created_at);
            
            if (isWithinInterval(createdAt, { start: startOfTargetMonth, end: endOfTargetMonth })) {
                const name = l.users?.full_name || 'Unknown';
                if (!stats[name]) stats[name] = { name, total: 0, bank: 0, nbfc: 0, workingDays: 0 };

                stats[name].total += 1;

                let bankName = l.bank_name || '';
                if (!bankName && Array.isArray(l.bank_attempts) && l.bank_attempts.length > 0) {
                    bankName = l.bank_attempts[0].bank;
                }
                bankName = bankName.toLowerCase().trim();

                const isTargetBank = TARGET_BANKS.some(tb => bankName.includes(tb));

                if (isTargetBank) stats[name].bank += 1;
                else stats[name].nbfc += 1; 
            }
        });

        // Sort by Total Login count descending
        return Object.values(stats).sort((a, b) => b.total - a.total);
    }, [logins, attendanceData, startOfTargetMonth, endOfTargetMonth]);

    const grandTotal = detailedStats.reduce((acc, curr) => acc + curr.total, 0);

    const getLeaderboardRankBadge = (rank: number) => {
        if (rank === 0) {
            return (
                <div className="flex justify-center items-center">
                    <span className="flex items-center gap-1 text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full border border-amber-200/50 dark:border-amber-900/40 shadow-3xs">
                        <Trophy className="h-3 w-3 text-amber-500 fill-amber-500" />
                        Gold
                    </span>
                </div>
            )
        }
        if (rank === 1) {
            return (
                <div className="flex justify-center items-center">
                    <span className="flex items-center gap-1 text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-750 shadow-3xs">
                        <Medal className="h-3 w-3 text-slate-455 fill-slate-355" />
                        Silver
                    </span>
                </div>
            )
        }
        if (rank === 2) {
            return (
                <div className="flex justify-center items-center">
                    <span className="flex items-center gap-1 text-[10px] font-bold bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 px-2 py-0.5 rounded-full border border-orange-200/40 dark:border-orange-900/30 shadow-3xs">
                        <Medal className="h-3 w-3 text-orange-600 fill-orange-500" />
                        Bronze
                    </span>
                </div>
            )
        }
        return <span className="text-slate-400 dark:text-slate-500 font-bold text-xs font-mono">#{rank + 1}</span>
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Month Selector & Summary */}
            <div className="flex flex-col sm:flex-row justify-between gap-4 items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-xs">
                <div className="flex gap-2">
                    <Button 
                        variant={monthOffset === 0 ? "default" : "outline"} 
                        onClick={() => setMonthOffset(0)}
                        className="rounded-lg text-xs font-semibold"
                    >
                        This Month ({format(new Date(), "MMM yyyy")})
                    </Button>
                    <Button 
                        variant={monthOffset === 1 ? "default" : "outline"} 
                        onClick={() => setMonthOffset(1)}
                        className="rounded-lg text-xs font-semibold"
                    >
                        Last Month ({format(subMonths(new Date(), 1), "MMM yyyy")})
                    </Button>
                </div>
                <div className="flex items-center gap-4 border-l border-slate-150 dark:border-slate-800 pl-4">
                    <div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-bold">Total Monthly Logins</p>
                        <p className="text-3xl font-black text-indigo-600 dark:text-indigo-400">{grandTotal}</p>
                    </div>
                </div>
            </div>

            {/* Monthly Leaderboard */}
            <Card className="shadow-xs border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl overflow-hidden">
                <CardHeader className="bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 pb-4">
                    <div className="flex items-center gap-2">
                        <CalendarDays className="h-5 w-5 text-indigo-500" />
                        <CardTitle className="text-base font-bold text-slate-800 dark:text-slate-100">Monthly Telecaller Performance</CardTitle>
                    </div>
                    <CardDescription className="text-xs text-slate-400 dark:text-slate-500">Breakdown of attendance and logins for the selected month.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-slate-50/40 dark:bg-slate-800/20">
                                <TableRow className="border-b border-slate-150 dark:border-slate-850">
                                    <TableHead className="w-[80px] text-center text-xs font-semibold text-slate-650 dark:text-slate-400">Rank</TableHead>
                                    <TableHead className="text-xs font-semibold text-slate-650 dark:text-slate-400">Telecaller Name</TableHead>
                                    <TableHead className="text-center w-[140px] bg-slate-100/50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 font-bold border-x border-slate-200/55 dark:border-slate-800 text-xs">
                                        <div className="flex items-center justify-center gap-1 font-semibold text-slate-600 dark:text-slate-400"><Fingerprint className="h-3.5 w-3.5"/> Working Days</div>
                                    </TableHead>
                                    <TableHead className="text-center w-[140px] bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-950 dark:text-indigo-300 border-r border-slate-150 dark:border-slate-850 font-bold text-xs">Monthly Total</TableHead>
                                    <TableHead className="text-center w-[145px] text-xs font-semibold text-slate-655 dark:text-slate-400">
                                        <div className="flex items-center justify-center gap-1 text-blue-600 dark:text-blue-400 font-semibold"><Building2 className="h-3.5 w-3.5"/> Banks</div>
                                    </TableHead>
                                    <TableHead className="text-center w-[145px] text-xs font-semibold text-slate-655 dark:text-slate-400">
                                        <div className="flex items-center justify-center gap-1 text-orange-600 dark:text-orange-400 font-semibold"><Wallet className="h-3.5 w-3.5"/> NBFCs</div>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {detailedStats.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-12 text-slate-400 dark:text-slate-500 text-xs italic font-medium">No data found for this month.</TableCell>
                                    </TableRow>
                                ) : (
                                    detailedStats.map((stat, index) => (
                                        <TableRow key={stat.name} className="hover:bg-slate-50 dark:hover:bg-slate-800/25 transition-colors border-b border-slate-100 dark:border-slate-850">
                                            <TableCell className="py-3.5 text-center">{getLeaderboardRankBadge(index)}</TableCell>
                                            <TableCell className="py-3.5 font-bold text-slate-800 dark:text-slate-200 text-xs">{stat.name}</TableCell>
                                            
                                            <TableCell className="py-3.5 text-center bg-slate-50/30 dark:bg-slate-800/10 font-bold text-slate-600 dark:text-slate-450 border-x border-slate-100 dark:border-slate-850 text-xs">
                                                {stat.workingDays} <span className="text-[10px] font-normal text-slate-400 dark:text-slate-550 font-mono">days</span>
                                            </TableCell>

                                            <TableCell className="py-3.5 text-center bg-indigo-50/20 dark:bg-indigo-950/10 font-extrabold text-indigo-700 dark:text-indigo-400 text-sm border-r border-indigo-50 dark:border-indigo-950/20">
                                                {stat.total > 0 ? stat.total : <span className="text-slate-350 dark:text-slate-600 font-normal">-</span>}
                                            </TableCell>
                                            <TableCell className="py-3.5 text-center font-bold text-blue-600 dark:text-blue-400 text-xs">
                                                {stat.bank > 0 ? stat.bank : <span className="text-slate-350 dark:text-slate-600 font-normal">-</span>}
                                            </TableCell>
                                            <TableCell className="py-3.5 text-center font-bold text-orange-600 dark:text-orange-400 text-xs">
                                                {stat.nbfc > 0 ? stat.nbfc : <span className="text-slate-350 dark:text-slate-600 font-normal">-</span>}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

function EditLoginSheet({ login, open, onClose, onSave, onDelete }: { login: any, open: boolean, onClose: () => void, onSave: (l: any) => void, onDelete: (id: string) => void }) {
    const supabase = createClient()
    const [attempts, setAttempts] = useState<BankAttempt[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (login) {
            const existing = Array.isArray(login.bank_attempts) ? login.bank_attempts : []
            if (existing.length === 0 && login.bank_name) {
                existing.push({ 
                    bank: login.bank_name, 
                    status: login.status === 'Logged In' ? 'Pending' : login.status, 
                    date: login.updated_at 
                })
            }
            setAttempts(existing)
        }
    }, [login])

    const handleAdd = () => setAttempts([...attempts, { bank: '', status: 'Pending', date: new Date().toISOString() }])
    
    const handleChange = (idx: number, field: keyof BankAttempt, val: string) => {
        const next = [...attempts]
        next[idx] = { ...next[idx], [field]: val }
        setAttempts(next)
    }
    
    const handleRemove = (idx: number) => setAttempts(attempts.filter((_, i) => i !== idx))

    const save = async () => {
        setLoading(true)
        const hasSuccess = attempts.some(a => ['Approved', 'Disbursed'].includes(a.status))
        const overallStatus = hasSuccess ? 'Approved' : 'Pending' 
        const updated = { ...login, bank_attempts: attempts, status: overallStatus, bank_name: attempts[attempts.length-1]?.bank || login.bank_name }

        const { error } = await supabase.from('logins').update({ 
            bank_attempts: attempts,
            status: overallStatus,
            bank_name: updated.bank_name
        }).eq('id', login.id)

        if (error) {
            toast.error("Failed to save")
        } else {
            toast.success("Saved successfully")
            onSave(updated)
            onClose()
        }
        setLoading(false)
    }

    return (
        <Sheet open={open} onOpenChange={onClose}>
            <SheetContent className="w-[400px] sm:w-[520px] overflow-y-auto border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl">
                <SheetHeader className="mb-6 border-b border-slate-100 dark:border-slate-850 pb-4">
                    <SheetTitle className="text-lg font-black tracking-tight text-slate-800 dark:text-white">Manage Application</SheetTitle>
                    <SheetDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 flex items-center flex-wrap gap-1 font-medium">
                        Customer: <span className="font-bold text-indigo-600 dark:text-indigo-400">{login?.name}</span> • <span className="font-mono text-[11px]">{login?.phone}</span>
                    </SheetDescription>
                </SheetHeader>
                
                <div className="space-y-6">
                    <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                        <Label className="text-xs uppercase tracking-wider font-bold text-slate-450 dark:text-slate-500">Bank Applications</Label>
                        <Button size="sm" onClick={handleAdd} className="h-8 gap-1 rounded-lg text-xs font-semibold bg-indigo-650 hover:bg-indigo-700 text-white"><Plus className="h-3.5 w-3.5"/> Add Bank</Button>
                    </div>
                    
                    {attempts.length === 0 && (
                        <div className="text-center py-10 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-950/20">
                            <p className="text-xs text-slate-450 dark:text-slate-500 font-medium">No active attempts recorded.</p>
                        </div>
                    )}

                    <div className="space-y-4">
                        {attempts.map((att, idx) => (
                            <div key={idx} className="bg-slate-50/30 dark:bg-slate-950/25 p-4 rounded-xl border border-slate-200/60 dark:border-slate-800/80 shadow-2xs relative group hover:border-indigo-400/50 transition-colors">
                                <Button variant="ghost" size="icon" className="absolute top-2.5 right-2.5 h-6 w-6 text-slate-350 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md" onClick={() => handleRemove(idx)}><X className="h-3.5 w-3.5"/></Button>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] text-slate-400 dark:text-slate-550 uppercase tracking-widest font-bold">Bank Name</Label>
                                        <Input value={att.bank} onChange={e => handleChange(idx, 'bank', e.target.value)} placeholder="e.g. HDFC" className="h-9 text-xs rounded-lg border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus-visible:ring-indigo-500 dark:text-white"/>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] text-slate-400 dark:text-slate-550 uppercase tracking-widest font-bold">Status</Label>
                                        <Select value={att.status} onValueChange={v => handleChange(idx, 'status', v)}>
                                            <SelectTrigger className="h-9 text-xs rounded-lg border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 dark:text-white"><SelectValue/></SelectTrigger>
                                            <SelectContent className="dark:bg-slate-900 border-slate-200 dark:border-slate-850">
                                                <SelectItem value="Pending" className="text-xs">Pending</SelectItem>
                                                <SelectItem value="Approved" className="text-xs">Approved</SelectItem>
                                                <SelectItem value="Disbursed" className="text-xs">Disbursed</SelectItem>
                                                <SelectItem value="Rejected" className="text-xs">Rejected</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                {att.status === 'Rejected' && (
                                    <div className="mt-3 pt-3 border-t border-slate-200/50 dark:border-slate-800/40 border-dashed">
                                        <Input placeholder="Add Rejection Reason (Optional)" value={att.reason || ''} onChange={e => handleChange(idx, 'reason', e.target.value)} className="h-8.5 text-xs bg-red-50/50 dark:bg-red-950/20 border-red-100/60 dark:border-red-900/35 placeholder:text-red-400/70 text-red-700 dark:text-red-300 focus-visible:ring-red-500 rounded-lg"/>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <SheetFooter className="mt-8 flex-col sm:flex-row gap-3 border-t border-slate-100 dark:border-slate-850 pt-4">
                    <Button variant="destructive" className="w-full sm:w-auto text-red-650 bg-red-50 hover:bg-red-100/70 dark:bg-red-950/20 dark:hover:bg-red-900/35 border-red-200/50 dark:border-red-900/30 rounded-lg text-xs font-semibold mr-auto" onClick={() => onDelete(login.id)}>
                        <Trash2 className="h-4 w-4 mr-2" /> Delete File
                    </Button>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Button variant="outline" onClick={onClose} className="w-full sm:w-auto rounded-lg text-xs font-semibold border-slate-200 dark:border-slate-800">Cancel</Button>
                        <Button onClick={save} disabled={loading} className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs">
                            {loading ? <Loader2 className="h-4 w-4 animate-spin"/> : "Save Changes"}
                        </Button>
                    </div>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    )
}

function getStatusIcon(status: string) {
    switch(status) {
        case 'Approved': case 'Disbursed': return <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
        case 'Rejected': return <XCircle className="h-3 w-3 text-red-600 dark:text-red-400" />
        default: return <Clock className="h-3 w-3 text-amber-600 dark:text-amber-400" />
    }
}

function getStatusColor(status: string) {
    switch(status) {
        case 'Approved': return "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200/70 dark:border-emerald-900/30"
        case 'Disbursed': return "bg-emerald-100/70 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-450 border-emerald-300 dark:border-emerald-800/40 ring-1 ring-emerald-450/10 dark:ring-emerald-800/20"
        case 'Rejected': return "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200/60 dark:border-red-900/35"
        default: return "bg-amber-50/80 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-200/60 dark:border-amber-900/30"
    }
}
