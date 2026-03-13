"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
    Loader2, CalendarCheck, History, CheckCircle2, XCircle, 
    RefreshCcw, Search, Ban, AlertTriangle 
} from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"

// --- TYPES ---
type DuplicateState = 'checking' | 'clean' | 'duplicate' | 'error'

// --- HOOKS ---
function useDebounce(value: string, delay: number) {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
}

export default function TelecallerLoginsPage() {
    const supabase = createClient()
    const { toast } = useToast()
    
    // UI States
    const [loading, setLoading] = useState(false)
    const [activeTab, setActiveTab] = useState("today")
    const [searchTerm, setSearchTerm] = useState("")
    
    // Pending Pop-up State
    const [pendingLogins, setPendingLogins] = useState<any[]>([])
    const [isPendingModalOpen, setIsPendingModalOpen] = useState(false)
    const hasCheckedPending = useRef(false) 
    
    // Duplicate Logic States
    const [dupState, setDupState] = useState<DuplicateState>('clean')
    const [dupMessage, setDupMessage] = useState<string | null>(null)
    
    // Form Data
    const [formData, setFormData] = useState({
        id: null as string | null, 
        name: "",
        phone: "",
        bank_name: "",
        notes: ""
    })
    
    const [logins, setLogins] = useState<any[]>([])
    
    const debouncedPhone = useDebounce(formData.phone, 500)
    const dailyGoal = 5 
    const todayCount = logins.filter(l => new Date(l.updated_at).toDateString() === new Date().toDateString()).length

    // 1. SPECIFIC LOGINS DUPLICATE CHECK (Via new RPC)
    useEffect(() => {
        const checkPhone = async () => {
            if (debouncedPhone.length < 10) {
                setDupState('clean')
                setDupMessage(null)
                return
            }
            setDupState('checking')

            try {
                // 🔴 THE FIX: Using the new check_login_duplicate function
                const { data, error } = await supabase
                    .rpc('check_login_duplicate', { lookup_phone: debouncedPhone })

                if (error) throw error;

                if (data) {
                    if (formData.id === data.id) {
                        setDupState('clean')
                        setDupMessage(null)
                        return
                    }

                    setDupState('duplicate')
                    const agentName = data.agent_name || 'Another Agent'
                    const dateLogged = new Date(data.updated_at).toLocaleDateString()
                    
                    if (!formData.name && data.name) {
                        setFormData(prev => ({...prev, name: data.name}))
                    }
                    
                    setDupMessage(`Duplicate! Already logged by ${agentName} on ${dateLogged}.`)
                } else {
                    setDupState('clean')
                    setDupMessage(null)
                }

            } catch (err) {
                console.error("Duplicate check failed:", err)
                setDupState('clean') 
            }
        }
        checkPhone()
    }, [debouncedPhone, formData.id, supabase, formData.name])

    // 2. FETCH LIST (MY LOGINS ONLY)
    const fetchLogins = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        let query = supabase
            .from('logins')
            .select('*')
            .eq('assigned_to', user.id) // List shows ONLY my data
            .order('updated_at', { ascending: false })

        const today = new Date()
        if (activeTab === 'today') {
            query = query.gte('updated_at', new Date(today.setHours(0,0,0,0)).toISOString())
        } else {
            query = query.gte('updated_at', new Date(today.getFullYear(), today.getMonth(), 1).toISOString())
        }

        const { data } = await query
        if (data) {
            setLogins(data)
            
            // Check pending items for the modal
            const pending = data.filter(l => l.status === 'Login Done' || l.status === 'Pending')
            setPendingLogins(pending)

            // Only open modal automatically ONCE on first load
            if (pending.length > 0 && !hasCheckedPending.current) {
                setIsPendingModalOpen(true)
                hasCheckedPending.current = true
            }
        }
    }, [supabase, activeTab])

    useEffect(() => { fetchLogins() }, [fetchLogins])

    // 3. STATUS UPDATE HANDLER
    const handleStatusUpdate = async (id: string, newStatus: 'Approved' | 'Rejected') => {
        const { error } = await supabase
            .from('logins')
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq('id', id)

        if (error) {
            toast({ title: "Error", description: "Failed to update status", variant: "destructive" })
        } else {
            toast({ 
                title: newStatus === 'Approved' ? "Approved! ✅" : "Rejected ❌", 
                description: "Status updated successfully.",
                className: newStatus === 'Approved' ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
            })
            fetchLogins() 
        }
    }

    // 4. MODAL SPECIFIC HANDLER (Closes modal on action)
    const handleModalStatusUpdate = async (id: string, newStatus: 'Approved' | 'Rejected') => {
        // 1. Close Modal Immediately
        setIsPendingModalOpen(false)
        
        // 2. Perform Update in Background
        await handleStatusUpdate(id, newStatus)
    }

    // 5. SUBMIT FORM
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (dupState === 'duplicate' || dupState === 'checking') {
            toast({ title: "Duplicate Lead", description: dupMessage || "Number exists.", variant: "destructive" })
            return
        }

        setLoading(true)
        const { data: { user } } = await supabase.auth.getUser()

        try {
            const payload = {
                name: formData.name,
                phone: formData.phone,
                bank_name: formData.bank_name,
                notes: formData.notes,
                status: 'Login Done', 
                assigned_to: user?.id,
                updated_at: new Date().toISOString()
            }

            if (formData.id) {
                const { error } = await supabase.from('logins').update(payload).eq('id', formData.id)
                if (error) throw error
                toast({ title: "Updated", description: "Entry updated.", className: "bg-green-50" })
            } else {
                const { error } = await supabase.from('logins').insert([payload])
                if (error) throw error
                toast({ title: "Success! 🎉", description: "Login submitted.", className: "bg-green-50 border-green-200" })
            }
            
            setFormData({ id: null, name: "", phone: "", bank_name: "", notes: "" })
            setDupState('clean')
            fetchLogins()
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" })
        } finally {
            setLoading(false)
        }
    }

    const filteredLogins = logins.filter(l => 
        l.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        l.phone.includes(searchTerm) ||
        l.bank_name.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const getInputClass = () => {
        if (dupState === 'duplicate') return "border-red-400 bg-red-50 focus-visible:ring-red-400 text-red-900"
        if (dupState === 'clean' && formData.phone.length === 10) return "border-green-400 bg-green-50 focus-visible:ring-green-400"
        return "bg-slate-50 focus:bg-white"
    }

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 bg-slate-50 min-h-screen font-sans">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-end gap-4 bg-white p-6 rounded-2xl border shadow-sm">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">Telecaller Portal</h1>
                    <p className="text-slate-500 mt-2 flex items-center gap-2">
                        <CalendarCheck className="h-4 w-4" /> {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </p>
                </div>

                <div className="flex items-center gap-4 bg-indigo-50 p-3 rounded-xl border border-indigo-100 min-w-[200px]">
                    <div className="relative h-12 w-12 flex items-center justify-center">
                         <svg className="h-full w-full transform -rotate-90">
                            <circle cx="24" cy="24" r="20" stroke="#e0e7ff" strokeWidth="4" fill="transparent" />
                            <circle cx="24" cy="24" r="20" stroke="#4f46e5" strokeWidth="4" fill="transparent" strokeDasharray={125} strokeDashoffset={125 - (125 * Math.min(todayCount, dailyGoal)) / dailyGoal} />
                        </svg>
                        <span className="absolute text-xs font-bold text-indigo-700">{todayCount}</span>
                    </div>
                    <div>
                        <p className="text-xs text-indigo-500 font-medium uppercase tracking-wider">Daily Goal</p>
                        <div className="flex items-end gap-1">
                             <span className="text-xl font-bold text-indigo-900 leading-none">{todayCount}</span>
                             <span className="text-xs text-indigo-400 mb-0.5">/ {dailyGoal}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* FORM SECTION */}
                <div className="lg:col-span-4 space-y-6">
                    <Card className={`shadow-xl border-t-4 transition-colors ${dupState === 'duplicate' ? 'border-red-500' : 'border-indigo-600'} bg-white/80 backdrop-blur-sm sticky top-6`}>
                        <CardHeader className="bg-slate-50/50 border-b pb-4">
                            <CardTitle className="flex items-center justify-between">
                                {formData.id ? "Edit Entry" : "New Login"}
                                {formData.id && (
                                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => {
                                        setFormData({ id: null, name: "", phone: "", bank_name: "", notes: "" })
                                        setDupState('clean')
                                        setDupMessage(null)
                                    }}>Cancel Edit</Button>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div className="space-y-2">
                                    <Label>Mobile Number <span className="text-red-500">*</span></Label>
                                    <div className="relative group">
                                        <Input 
                                            placeholder="9876543210" 
                                            value={formData.phone}
                                            onChange={(e) => setFormData({...formData, phone: e.target.value.replace(/\D/g,'')})}
                                            maxLength={10}
                                            className={`pr-10 transition-all ${getInputClass()}`}
                                        />
                                        <div className="absolute right-3 top-2.5">
                                            {dupState === 'checking' ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : 
                                             dupState === 'duplicate' ? <XCircle className="h-4 w-4 text-red-500"/> :
                                             dupState === 'clean' && formData.phone.length === 10 ? <CheckCircle2 className="h-4 w-4 text-green-600"/> : null}
                                        </div>
                                    </div>
                                    
                                    {dupState === 'duplicate' && (
                                        <div className="rounded-md bg-red-50 p-3 border border-red-200">
                                            <div className="flex gap-2">
                                                <Ban className="h-4 w-4 text-red-600 mt-0.5" />
                                                <div className="text-xs text-red-700 font-medium">
                                                    <p className="font-bold">Duplicate Lead!</p>
                                                    <p>{dupMessage}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label>Customer Name <span className="text-red-500">*</span></Label>
                                    <Input 
                                        placeholder="Full Name" 
                                        value={formData.name}
                                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                                        required
                                        className="bg-slate-50 focus:bg-white"
                                        disabled={dupState === 'duplicate'} 
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Target Bank <span className="text-red-500">*</span></Label>
                                    <Select value={formData.bank_name} onValueChange={(val) => setFormData({...formData, bank_name: val})} required disabled={dupState === 'duplicate'}>
                                        <SelectTrigger className="bg-slate-50 focus:bg-white"><SelectValue placeholder="Select Bank" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="HDFC Bank">HDFC Bank</SelectItem>
                                            <SelectItem value="ICICI Bank">ICICI Bank</SelectItem>
                                            <SelectItem value="Axis Bank">Axis Bank</SelectItem>
                                            <SelectItem value="IDFC First">IDFC First</SelectItem>
                                            <SelectItem value="Incred">Incred</SelectItem>
                                            <SelectItem value="Other">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Notes</Label>
                                    <Textarea 
                                        placeholder="Documents status, specific requirements..." 
                                        value={formData.notes}
                                        onChange={(e) => setFormData({...formData, notes: e.target.value})}
                                        className="bg-slate-50 focus:bg-white min-h-[80px]"
                                        disabled={dupState === 'duplicate'}
                                    />
                                </div>

                                <Button 
                                    type="submit" 
                                    className={`w-full h-12 text-base transition-all ${dupState === 'duplicate' ? 'bg-slate-300 cursor-not-allowed hover:bg-slate-300' : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200'}`} 
                                    disabled={loading || dupState === 'duplicate' || dupState === 'checking'}
                                >
                                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 
                                     dupState === 'duplicate' ? "Cannot Submit Duplicate" :
                                     formData.id ? "Update Entry" : "Submit Login"}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>

                {/* LIST SECTION */}
                <div className="lg:col-span-8 space-y-4">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
                            <TabsList className="bg-slate-200">
                                <TabsTrigger value="today">Today's Logins</TabsTrigger>
                                <TabsTrigger value="month">History (Month)</TabsTrigger>
                            </TabsList>
                            
                            <div className="relative w-full sm:w-[280px]">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                <Input 
                                    placeholder="Search your records..." 
                                    className="pl-9 bg-white border-slate-200 shadow-sm"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        <Card className="shadow-sm border-0 ring-1 ring-slate-200 min-h-[500px]">
                            <Table>
                                <TableHeader className="bg-slate-50/80">
                                    <TableRow>
                                        <TableHead>Customer</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Action</TableHead>
                                        <TableHead className="text-right">Time</TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredLogins.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-64 text-center">
                                                <div className="flex flex-col items-center justify-center text-slate-400">
                                                    <History className="h-10 w-10 mb-2 opacity-20" />
                                                    <p>No records found.</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredLogins.map((login) => (
                                            <TableRow key={login.id} className="hover:bg-indigo-50/30 group transition-colors cursor-default">
                                                <TableCell>
                                                    <div className="font-semibold text-slate-800">{login.name}</div>
                                                    <div className="text-xs text-slate-500 font-mono tracking-tight">{login.phone}</div>
                                                    <div className="text-[10px] text-indigo-600 mt-1">{login.bank_name}</div>
                                                </TableCell>
                                                
                                                <TableCell>
                                                    <Badge variant="outline" className={`
                                                        ${login.status === 'Approved' ? 'bg-green-100 text-green-700 border-green-200' : 
                                                          login.status === 'Rejected' ? 'bg-red-50 text-red-700 border-red-200' : 
                                                          'bg-amber-50 text-amber-700 border-amber-200'}
                                                    `}>
                                                        {login.status === 'Login Done' ? 'Pending' : login.status}
                                                    </Badge>
                                                </TableCell>

                                                <TableCell>
                                                    <div className="flex gap-1">
                                                        <Button 
                                                            size="sm" 
                                                            variant="outline" 
                                                            className="h-7 w-7 p-0 text-green-600 hover:bg-green-100 border-green-200"
                                                            onClick={() => handleStatusUpdate(login.id, 'Approved')}
                                                            title="Mark Approved"
                                                        >
                                                            <CheckCircle2 className="h-4 w-4" />
                                                        </Button>
                                                        <Button 
                                                            size="sm" 
                                                            variant="outline" 
                                                            className="h-7 w-7 p-0 text-red-600 hover:bg-red-50 border-red-200"
                                                            onClick={() => handleStatusUpdate(login.id, 'Rejected')}
                                                            title="Mark Rejected"
                                                        >
                                                            <XCircle className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>

                                                <TableCell className="text-right">
                                                    <div className="text-sm font-medium text-slate-600">
                                                        {new Date(login.updated_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400">
                                                        {new Date(login.updated_at).toLocaleDateString([], {month: 'short', day: 'numeric'})}
                                                    </div>
                                                </TableCell>

                                                <TableCell>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-300 hover:text-indigo-600 group-hover:bg-white" 
                                                        onClick={() => {
                                                            setFormData({
                                                                id: login.id,
                                                                name: login.name,
                                                                phone: login.phone,
                                                                bank_name: login.bank_name,
                                                                notes: login.notes
                                                            })
                                                            window.scrollTo({ top: 0, behavior: 'smooth' })
                                                        }}
                                                    >
                                                        <RefreshCcw className="h-3.5 w-3.5" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </Card>
                    </Tabs>
                </div>
            </div>

            {/* PENDING CASES POP-UP MODAL */}
            <Dialog open={isPendingModalOpen} onOpenChange={setIsPendingModalOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-amber-600">
                            <AlertTriangle className="h-5 w-5" />
                            Pending Follow-ups Required
                        </DialogTitle>
                        <DialogDescription>
                            You have {pendingLogins.length} login(s) that are still pending. Please check their status with the bank and update them.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="border rounded-md mt-4 overflow-hidden">
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow>
                                    <TableHead>Customer</TableHead>
                                    <TableHead>Bank</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pendingLogins.map((p) => (
                                    <TableRow key={p.id}>
                                        <TableCell>
                                            <div className="font-medium text-sm">{p.name}</div>
                                            <div className="text-xs text-slate-500">{p.phone}</div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="text-xs font-normal">
                                                {p.bank_name}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700" onClick={() => handleModalStatusUpdate(p.id, 'Approved')}>
                                                    Approve
                                                </Button>
                                                <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => handleModalStatusUpdate(p.id, 'Rejected')}>
                                                    Reject
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    <DialogFooter className="mt-4">
                        <Button variant="outline" onClick={() => setIsPendingModalOpen(false)}>Close & Remind Later</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
