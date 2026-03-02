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
  Loader2, FileCheck, Download, Search, Trophy, 
  ArrowRightLeft, Edit, Plus, X, Trash2, 
  TrendingUp, Clock, CheckCircle2, XCircle, ChevronLeft, ChevronRight,
  Building2, Wallet, BarChart3, CalendarDays, UserCheck
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
    const [attendanceData, setAttendanceData] = useState<Record<string, number>>({}) // ✅ ADDED ATTENDANCE STATE
    
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
            let loginsQuery = supabase
                .from('logins') 
                .select(`
                    id, name, phone, bank_name, created_at, updated_at, notes, status, bank_attempts,
                    assigned_to,
                    users:assigned_to ( full_name, email )
                `)
                .order('created_at', { ascending: false })

            let startRange = startOfMonth(new Date()).toISOString()
            let endRange = endOfMonth(new Date()).toISOString()

            if (dateFilter === 'today' || dateFilter === 'this_month') {
                startRange = startOfMonth(new Date()).toISOString()
                loginsQuery = loginsQuery.gte('created_at', startRange)
            } else if (dateFilter === 'last_month') {
                const lastMonth = subMonths(new Date(), 1)
                startRange = startOfMonth(lastMonth).toISOString()
                endRange = endOfMonth(lastMonth).toISOString()
                loginsQuery = loginsQuery.gte('created_at', startRange).lte('created_at', endRange)
            }

            const transfersQuery = supabase
                .from('leads')
                .select(`id, name, updated_at, users:assigned_to ( full_name )`)
                .eq('status', 'Transferred to KYC')
                .gte('updated_at', new Date(new Date().setHours(0,0,0,0)).toISOString()) 
                .order('updated_at', { ascending: false })

            // ✅ NEW: Fetch Attendance Data for the Selected Month Range
            const attendanceQuery = supabase
                .from('user_sessions')
                .select('user_id')
                .gte('check_in', startRange)
                .lte('check_in', endRange)

            const [loginsRes, transfersRes, attendanceRes] = await Promise.all([loginsQuery, transfersQuery, attendanceQuery])
            
            if (loginsRes.data) setLogins(loginsRes.data)
            if (transfersRes.data) setTransfers(transfersRes.data)
            
            // ✅ Group attendance by user ID
            if (attendanceRes.data) {
                const attendanceCounts: Record<string, number> = {}
                attendanceRes.data.forEach((session: any) => {
                    if (session.user_id) {
                        attendanceCounts[session.user_id] = (attendanceCounts[session.user_id] || 0) + 1
                    }
                })
                setAttendanceData(attendanceCounts)
            }

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
        <div className="p-4 md:p-8 space-y-6 bg-slate-50/50 min-h-screen pb-20 font-sans">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl border shadow-sm">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <div className="p-2 bg-indigo-600 rounded-lg text-white shadow-lg shadow-indigo-200">
                            <FileCheck className="h-5 w-5" />
                        </div>
                        Login Management
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Track files, view reports, and manage daily logins.</p>
                </div>
            </div>

            <Tabs defaultValue="manage" className="w-full">
                <TabsList className="grid w-full max-w-[500px] grid-cols-3 mb-6">
                    <TabsTrigger value="manage">Manage Logins</TabsTrigger>
                    <TabsTrigger value="daily_reports">Daily Reports</TabsTrigger>
                    <TabsTrigger value="monthly_reports">Monthly Reports</TabsTrigger>
                </TabsList>

                {/* --- TAB 1: MANAGE LIST --- */}
                <TabsContent value="manage" className="space-y-6">
                    
                    {/* Controls */}
                    <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-lg border">
                        <div className="flex gap-2">
                            <Button variant={dateFilter === 'today' ? 'default' : 'outline'} size="sm" onClick={() => setDateFilter('today')}>Today</Button>
                            <Button variant={dateFilter === 'this_month' ? 'default' : 'outline'} size="sm" onClick={() => setDateFilter('this_month')}>This Month</Button>
                            <Button variant={dateFilter === 'last_month' ? 'default' : 'outline'} size="sm" onClick={() => setDateFilter('last_month')}>Last Month</Button>
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                                <Input placeholder="Search..." className="pl-9" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                            </div>
                            <Button variant="outline" onClick={handleExport}><Download className="w-4 h-4" /></Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        <div className="lg:col-span-9 space-y-4">
                            <Card className="shadow-lg border-0 ring-1 ring-slate-200">
                                <Table>
                                    <TableHeader className="bg-slate-50">
                                        <TableRow>
                                            <TableHead>Customer Details</TableHead>
                                            <TableHead className="hidden md:table-cell">Bank Status</TableHead>
                                            <TableHead className="hidden md:table-cell">Agent</TableHead>
                                            <TableHead>Created Date</TableHead>
                                            <TableHead className="w-[80px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loading ? (
                                            <TableRow><TableCell colSpan={5} className="h-48 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600" /></TableCell></TableRow>
                                        ) : paginatedLogins.length === 0 ? (
                                            <TableRow><TableCell colSpan={5} className="h-48 text-center"><EmptyState icon={Search} title="No Records Found" description="Try adjusting your filters." /></TableCell></TableRow>
                                        ) : (
                                            paginatedLogins.map((item) => (
                                                <TableRow key={item.id} className="group hover:bg-slate-50/80 transition-colors">
                                                    <TableCell>
                                                        <div>
                                                            <span className="font-semibold text-slate-900 block">{item.name}</span>
                                                            <span className="text-xs text-slate-500 font-mono">{item.phone}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="hidden md:table-cell">
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {Array.isArray(item.bank_attempts) && item.bank_attempts.length > 0 ? (
                                                                item.bank_attempts.map((att: BankAttempt, idx: number) => (
                                                                    <Badge key={idx} variant="outline" className={`gap-1.5 py-1 px-2 ${getStatusColor(att.status)}`}>
                                                                        {getStatusIcon(att.status)}
                                                                        <span className="font-medium">{att.bank}</span>
                                                                    </Badge>
                                                                ))
                                                            ) : (
                                                                <Badge variant="outline" className="bg-slate-100 text-slate-500">{item.bank_name || 'No Bank'}</Badge>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="hidden md:table-cell">
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-6 w-6 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700">
                                                                {(item.users?.full_name || 'U')[0]}
                                                            </div>
                                                            <span className="text-sm text-slate-600">{item.users?.full_name?.split(' ')[0] || 'Unknown'}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="text-sm text-slate-600">{format(new Date(item.created_at), "MMM dd")}</div>
                                                        <div className="text-[10px] text-slate-400">{format(new Date(item.created_at), "hh:mm a")}</div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50" onClick={() => setEditingLogin(item)}>
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                                
                                {/* Pagination */}
                                <div className="p-4 border-t bg-slate-50/50 flex items-center justify-between">
                                    <span className="text-xs text-slate-500">
                                        Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredLogins.length)} of {filteredLogins.length}
                                    </span>
                                    <div className="flex gap-1">
                                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4"/></Button>
                                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage === totalPages}><ChevronRight className="h-4 w-4"/></Button>
                                    </div>
                                </div>
                            </Card>
                        </div>

                        {/* Sidebar (3 cols) */}
                        <div className="lg:col-span-3 space-y-6">
                            <Card className="shadow-md border-0 ring-1 ring-slate-200">
                                <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 pb-3 border-b border-indigo-100">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <ArrowRightLeft className="h-4 w-4 text-indigo-600" />
                                            <CardTitle className="text-sm text-indigo-900">Live Handover</CardTitle>
                                        </div>
                                        <span className="text-xs font-bold bg-white text-indigo-600 px-2 py-0.5 rounded-full shadow-sm">{transfers.length}</span>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="max-h-[400px] overflow-y-auto">
                                        {transfers.length === 0 ? (
                                            <div className="p-4 text-center text-xs text-slate-400">No handovers yet.</div>
                                        ) : (
                                            transfers.map((t) => (
                                                <div key={t.id} className="p-3 border-b last:border-0 hover:bg-indigo-50/30 transition-colors">
                                                    <div className="flex justify-between items-start">
                                                        <span className="text-xs font-semibold text-slate-700">{t.users?.full_name || 'Unknown'}</span>
                                                        <span className="text-[10px] text-slate-400">{format(new Date(t.updated_at), "hh:mm a")}</span>
                                                    </div>
                                                    <div className="text-xs text-slate-500 mt-1 truncate">{t.name}</div>
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

            {/* EDIT SHEET */}
            <EditLoginSheet 
                login={editingLogin} 
                open={!!editingLogin} 
                onClose={() => setEditingLogin(null)}
                onSave={handleSave} 
                onDelete={(id) => setDeleteConfirmation(id)}
            />

            {/* DELETE CONFIRMATION */}
            <Dialog open={!!deleteConfirmation} onOpenChange={() => setDeleteConfirmation(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Record?</DialogTitle>
                        <DialogDescription>This action cannot be undone. This will permanently remove this login from the server.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteConfirmation(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDelete}>Delete Permanently</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

// --- DAILY REPORT VIEW COMPONENT ---
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
                    const isTargetNBFC = TARGET_NBFCS.some(tn => bankName.includes(tn));

                    if (isTargetBank) stats[name].todayBank += 1;
                    else if (isTargetNBFC) stats[name].todayNbfc += 1;
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

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-indigo-600 text-white shadow-md border-0">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-indigo-100">Today's Total</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold">{todayTotal}</div>
                    </CardContent>
                </Card>
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">MTD Total</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold text-slate-800">{mtdTotal}</div>
                        <p className="text-xs text-slate-400 mt-1">Since {format(startOfCurrentMonth, 'MMM 01')}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Detailed Leaderboard */}
            <Card className="shadow-lg border-0 ring-1 ring-slate-200">
                <CardHeader className="bg-slate-50 border-b pb-4">
                    <div className="flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-amber-500" />
                        <CardTitle className="text-base text-slate-800">Telecaller Daily Leaderboard</CardTitle>
                    </div>
                    <CardDescription>Breakdown of today's logins by Banks and NBFCs, plus Month-to-Date totals.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50/50">
                                <TableHead className="w-[50px] text-center">Rank</TableHead>
                                <TableHead>Telecaller Name</TableHead>
                                <TableHead className="text-center w-[120px] bg-indigo-50 text-indigo-900 border-x border-indigo-100 font-bold">Today's Total</TableHead>
                                <TableHead className="text-center w-[120px]">
                                    <div className="flex items-center justify-center gap-1 text-blue-600"><Building2 className="h-3 w-3"/> Banks</div>
                                </TableHead>
                                <TableHead className="text-center w-[120px]">
                                    <div className="flex items-center justify-center gap-1 text-orange-600"><Wallet className="h-3 w-3"/> NBFCs</div>
                                </TableHead>
                                <TableHead className="text-center w-[120px] bg-slate-100 font-bold text-slate-700">MTD Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {detailedStats.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="text-center py-12 text-slate-400">No data found for today.</TableCell></TableRow>
                            ) : (
                                detailedStats.map((stat, index) => (
                                    <TableRow key={stat.name} className="hover:bg-slate-50 transition-colors">
                                        <TableCell className="text-center font-medium text-slate-500">#{index + 1}</TableCell>
                                        <TableCell className="font-semibold text-slate-700">{stat.name}</TableCell>
                                        <TableCell className="text-center bg-indigo-50/30 font-bold text-indigo-700 text-lg border-x border-indigo-50">
                                            {stat.today > 0 ? stat.today : <span className="text-slate-300 text-sm font-normal">-</span>}
                                        </TableCell>
                                        <TableCell className="text-center font-medium text-blue-600">
                                            {stat.todayBank > 0 ? stat.todayBank : <span className="text-slate-300 font-normal">-</span>}
                                        </TableCell>
                                        <TableCell className="text-center font-medium text-orange-600">
                                            {stat.todayNbfc > 0 ? stat.todayNbfc : <span className="text-slate-300 font-normal">-</span>}
                                        </TableCell>
                                        <TableCell className="text-center bg-slate-50 font-bold text-slate-800">{stat.mtd}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}

// --- MONTHLY REPORT VIEW COMPONENT ---
function MonthlyReportsView({ logins, attendanceData }: { logins: any[], attendanceData: Record<string, number> }) {
    const [monthOffset, setMonthOffset] = useState(0); 

    const targetDate = subMonths(new Date(), monthOffset);
    const startOfTargetMonth = startOfMonth(targetDate);
    const endOfTargetMonth = endOfMonth(targetDate);

    const detailedStats = useMemo(() => {
        const stats: Record<string, { id: string, name: string, total: number, bank: number, nbfc: number, daysWorked: number }> = {};

        logins.forEach(l => {
            const createdAt = new Date(l.created_at);
            
            if (isWithinInterval(createdAt, { start: startOfTargetMonth, end: endOfTargetMonth })) {
                const userId = l.assigned_to;
                const name = l.users?.full_name || 'Unknown';
                
                if (!stats[name]) {
                    stats[name] = { 
                        id: userId, 
                        name, 
                        total: 0, 
                        bank: 0, 
                        nbfc: 0, 
                        daysWorked: attendanceData[userId] || 0 // ✅ Inject Attendance Data
                    };
                }

                stats[name].total += 1;

                let bankName = l.bank_name || '';
                if (!bankName && Array.isArray(l.bank_attempts) && l.bank_attempts.length > 0) {
                    bankName = l.bank_attempts[0].bank;
                }
                bankName = bankName.toLowerCase().trim();

                const isTargetBank = TARGET_BANKS.some(tb => bankName.includes(tb));
                const isTargetNBFC = TARGET_NBFCS.some(tn => bankName.includes(tn));

                if (isTargetBank) stats[name].bank += 1;
                else if (isTargetNBFC) stats[name].nbfc += 1;
                else stats[name].nbfc += 1; 
            }
        });

        return Object.values(stats).sort((a, b) => b.total - a.total);
    }, [logins, startOfTargetMonth, endOfTargetMonth, attendanceData]);

    const grandTotal = detailedStats.reduce((acc, curr) => acc + curr.total, 0);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Month Selector & Summary */}
            <div className="flex flex-col sm:flex-row justify-between gap-4 items-center bg-white p-4 rounded-xl border shadow-sm">
                <div className="flex gap-2">
                    <Button 
                        variant={monthOffset === 0 ? "default" : "outline"} 
                        onClick={() => setMonthOffset(0)}
                    >
                        This Month ({format(new Date(), "MMM yyyy")})
                    </Button>
                    <Button 
                        variant={monthOffset === 1 ? "default" : "outline"} 
                        onClick={() => setMonthOffset(1)}
                    >
                        Last Month ({format(subMonths(new Date(), 1), "MMM yyyy")})
                    </Button>
                </div>
                <div className="flex items-center gap-4 border-l pl-4">
                    <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Total Logins</p>
                        <p className="text-2xl font-black text-indigo-600">{grandTotal}</p>
                    </div>
                </div>
            </div>

            {/* Monthly Leaderboard */}
            <Card className="shadow-lg border-0 ring-1 ring-slate-200">
                <CardHeader className="bg-slate-50 border-b pb-4">
                    <div className="flex items-center gap-2">
                        <CalendarDays className="h-5 w-5 text-indigo-500" />
                        <CardTitle className="text-base text-slate-800">Monthly Telecaller Performance</CardTitle>
                    </div>
                    <CardDescription>Breakdown of logins by Banks and NBFCs for the selected month.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50/50">
                                <TableHead className="w-[50px] text-center">Rank</TableHead>
                                <TableHead>Telecaller Name</TableHead>
                                {/* ✅ ADDED DAYS WORKED COLUMN HERE */}
                                <TableHead className="text-center w-[120px]">
                                    <div className="flex items-center justify-center gap-1 text-slate-500"><UserCheck className="h-3 w-3"/> Working Days</div>
                                </TableHead>
                                <TableHead className="text-center w-[150px] bg-indigo-50 text-indigo-900 border-x border-indigo-100 font-bold">Monthly Total</TableHead>
                                <TableHead className="text-center w-[150px]">
                                    <div className="flex items-center justify-center gap-1 text-blue-600"><Building2 className="h-3 w-3"/> Banks</div>
                                </TableHead>
                                <TableHead className="text-center w-[150px]">
                                    <div className="flex items-center justify-center gap-1 text-orange-600"><Wallet className="h-3 w-3"/> NBFCs</div>
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {detailedStats.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="text-center py-12 text-slate-400">No data found for this month.</TableCell></TableRow>
                            ) : (
                                detailedStats.map((stat, index) => (
                                    <TableRow key={stat.name} className="hover:bg-slate-50 transition-colors">
                                        <TableCell className="text-center font-medium text-slate-500">#{index + 1}</TableCell>
                                        <TableCell className="font-semibold text-slate-700">{stat.name}</TableCell>
                                        
                                        {/* ✅ POPULATED DAYS WORKED DATA */}
                                        <TableCell className="text-center font-medium text-slate-600">
                                            {stat.daysWorked > 0 ? (
                                                <Badge variant="outline" className="bg-slate-100">{stat.daysWorked} Days</Badge>
                                            ) : (
                                                <span className="text-slate-300 font-normal">-</span>
                                            )}
                                        </TableCell>

                                        <TableCell className="text-center bg-indigo-50/30 font-bold text-indigo-700 text-lg border-x border-indigo-50">
                                            {stat.total > 0 ? stat.total : <span className="text-slate-300 text-sm font-normal">-</span>}
                                        </TableCell>
                                        <TableCell className="text-center font-medium text-blue-600">
                                            {stat.bank > 0 ? stat.bank : <span className="text-slate-300 font-normal">-</span>}
                                        </TableCell>
                                        <TableCell className="text-center font-medium text-orange-600">
                                            {stat.nbfc > 0 ? stat.nbfc : <span className="text-slate-300 font-normal">-</span>}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
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
            <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
                <SheetHeader className="mb-6">
                    <SheetTitle>Manage Application</SheetTitle>
                    <SheetDescription>
                        Customer: <span className="font-semibold text-indigo-600">{login?.name}</span> • {login?.phone}
                    </SheetDescription>
                </SheetHeader>
                
                <div className="space-y-6">
                    <div className="flex justify-between items-center border-b pb-2">
                        <Label className="text-base font-semibold">Bank Applications</Label>
                        <Button size="sm" onClick={handleAdd} className="h-8 gap-1"><Plus className="h-3 w-3"/> Add Bank</Button>
                    </div>
                    
                    {attempts.length === 0 && (
                        <div className="text-center py-8 border-2 border-dashed rounded-xl bg-slate-50">
                            <p className="text-sm text-slate-500">No applications recorded.</p>
                        </div>
                    )}

                    <div className="space-y-4">
                        {attempts.map((att, idx) => (
                            <div key={idx} className="bg-white p-4 rounded-xl border shadow-sm relative group hover:border-indigo-300 transition-colors">
                                <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6 text-slate-300 hover:text-red-500 hover:bg-red-50" onClick={() => handleRemove(idx)}><X className="h-3 w-3"/></Button>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs text-slate-500 uppercase tracking-wider">Bank Name</Label>
                                        <Input value={att.bank} onChange={e => handleChange(idx, 'bank', e.target.value)} placeholder="e.g. HDFC" className="h-9"/>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs text-slate-500 uppercase tracking-wider">Status</Label>
                                        <Select value={att.status} onValueChange={v => handleChange(idx, 'status', v)}>
                                            <SelectTrigger className="h-9"><SelectValue/></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Pending">Pending</SelectItem>
                                                <SelectItem value="Approved">Approved</SelectItem>
                                                <SelectItem value="Disbursed">Disbursed</SelectItem>
                                                <SelectItem value="Rejected">Rejected</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                {att.status === 'Rejected' && (
                                    <div className="mt-3 pt-3 border-t border-dashed">
                                        <Input placeholder="Rejection Reason (Optional)" value={att.reason || ''} onChange={e => handleChange(idx, 'reason', e.target.value)} className="h-8 text-xs bg-red-50 border-red-100 placeholder:text-red-300 text-red-700"/>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <SheetFooter className="mt-8 flex-col sm:flex-row gap-3 border-t pt-4">
                    <Button variant="destructive" className="w-full sm:w-auto text-red-600 bg-red-50 hover:bg-red-100 border-red-200 mr-auto" onClick={() => onDelete(login.id)}>
                        <Trash2 className="h-4 w-4 mr-2" /> Delete
                    </Button>
                    <div className="flex gap-3 w-full sm:w-auto">
                        <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">Cancel</Button>
                        <Button onClick={save} disabled={loading} className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700">
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
        case 'Approved': case 'Disbursed': return <CheckCircle2 className="h-3 w-3 text-emerald-600" />
        case 'Rejected': return <XCircle className="h-3 w-3 text-red-600" />
        default: return <Clock className="h-3 w-3 text-amber-600" />
    }
}

function getStatusColor(status: string) {
    switch(status) {
        case 'Approved': return "bg-emerald-100 text-emerald-800 border-emerald-200"
        case 'Disbursed': return "bg-green-100 text-green-800 border-green-200 ring-1 ring-green-300"
        case 'Rejected': return "bg-red-50 text-red-800 border-red-200"
        default: return "bg-amber-50 text-amber-800 border-amber-200"
    }
}
