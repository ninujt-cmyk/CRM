"use client"

import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Search, PlusCircle, CheckCircle, Plus, Trash2, IndianRupee, Sparkles } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

interface DisbursementModalProps {
    onSuccess: () => void;
}

const DEFAULT_DISBURSEMENT = {
    application_number: "",
    bank_name: "",
    disbursed_date: new Date().toISOString().split('T')[0],
    loan_amount: "",
    disbursed_amount: ""
}

export function DisbursementModal({ onSuccess }: DisbursementModalProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [searchLoading, setSearchLoading] = useState(false)
    const [telecallers, setTelecallers] = useState<{id: string, full_name: string}[]>([])
    const { toast } = useToast()
    const supabase = createClient()

    // UI State
    const [phoneSearch, setPhoneSearch] = useState("")
    const [isLeadFound, setIsLeadFound] = useState(false)
    const [showForm, setShowForm] = useState(false)
    
    // Shared Lead State
    const [sharedData, setSharedData] = useState({
        id: "",
        name: "",
        phone: "",
        location: "",
        dsa_name: "",
        assigned_to: "",
    })

    // Dynamic Disbursements Array
    const [disbursements, setDisbursements] = useState([{ ...DEFAULT_DISBURSEMENT }])

    // Fetch Telecallers
    useEffect(() => {
        const fetchTelecallers = async () => {
            const { data } = await supabase
                .from('users')
                .select('id, full_name')
                .in('role', ['telecaller', 'team_leader'])
                .eq('is_active', true)
            
            if (data) setTelecallers(data)
        }
        if(open) fetchTelecallers()
    }, [open, supabase])

    // 🚀 NEW: Auto-search when 10 digits are entered
    useEffect(() => {
        if (phoneSearch.length === 10 && !showForm && !searchLoading) {
            handleSearch();
        }
    }, [phoneSearch])

    // 🚀 NEW: Live Total Calculation
    const totalDisbursedAmount = useMemo(() => {
        return disbursements.reduce((sum, d) => sum + (Number(d.disbursed_amount) || 0), 0);
    }, [disbursements]);

    const resetForm = () => {
        setPhoneSearch("")
        setShowForm(false)
        setIsLeadFound(false)
        setSharedData({
            id: "", name: "", phone: "", location: "", dsa_name: "", assigned_to: ""
        })
        setDisbursements([{ ...DEFAULT_DISBURSEMENT }])
    }

    const handleSearch = async () => {
        if (!phoneSearch || phoneSearch.length < 10) {
            toast({ title: "Invalid Phone", description: "Please enter a valid 10-digit number", variant: "destructive" })
            return
        }

        setSearchLoading(true)
        setSharedData({ id: "", name: "", phone: phoneSearch, location: "", dsa_name: "", assigned_to: "" })
        setDisbursements([{ ...DEFAULT_DISBURSEMENT }])
        
        const { data } = await supabase
            .from('leads')
            .select('*')
            .eq('phone', phoneSearch)
            .single()

        setShowForm(true)

        if (data) {
            setIsLeadFound(true)
            setSharedData({
                id: data.id,
                name: data.name || "",
                phone: data.phone,
                location: data.city || "",
                dsa_name: data.DSA || "",
                assigned_to: data.assigned_to || ""
            })

            const existingDate = data.disbursed_at ? new Date(data.disbursed_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
            setDisbursements([{
                application_number: data.application_number || "",
                bank_name: data.bank_name || "",
                disbursed_date: existingDate,
                loan_amount: data.loan_amount || "",
                disbursed_amount: data.disbursed_amount || ""
            }])

            toast({ title: "Lead Found", description: "Details auto-populated from database.", className: "bg-emerald-50 border-emerald-200" })
        } else {
            setIsLeadFound(false)
            setSharedData(prev => ({ ...prev, phone: phoneSearch }))
            toast({ title: "New Lead", description: "Number not found. Ready for new entry.", className: "bg-blue-50 border-blue-200" })
        }

        setSearchLoading(false)
    }

    const addDisbursement = () => {
        if (disbursements.length < 6) {
            setDisbursements([...disbursements, { ...DEFAULT_DISBURSEMENT }])
        } else {
            toast({ title: "Limit Reached", description: "Maximum 6 banks allowed per transaction.", variant: "destructive" })
        }
    }

    const removeDisbursement = (indexToRemove: number) => {
        setDisbursements(disbursements.filter((_, index) => index !== indexToRemove))
    }

    const handleDisbursementChange = (index: number, field: string, value: string) => {
        const newArr = [...disbursements]
        newArr[index] = { ...newArr[index], [field]: value }
        setDisbursements(newArr)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const payloads = disbursements.map(d => ({
                name: sharedData.name,
                phone: sharedData.phone,
                city: sharedData.location,
                DSA: sharedData.dsa_name,
                assigned_to: sharedData.assigned_to,
                status: 'DISBURSED', 
                bank_name: d.bank_name,
                application_number: d.application_number,
                disbursed_at: new Date(d.disbursed_date).toISOString(),
                loan_amount: Number(d.loan_amount) || 0,
                disbursed_amount: Number(d.disbursed_amount) || 0,
            }))

            if (isLeadFound && sharedData.id) {
                const { error: updateError } = await supabase.from('leads').update(payloads[0]).eq('id', sharedData.id)
                if (updateError) throw updateError

                if (payloads.length > 1) {
                    const { error: insertError } = await supabase.from('leads').insert(payloads.slice(1))
                    if (insertError) throw insertError
                }
            } else {
                const { error: insertError } = await supabase.from('leads').insert(payloads)
                if (insertError) throw insertError
            }

            toast({ title: "Success", description: `Successfully recorded ${disbursements.length} disbursement(s) totaling ₹${totalDisbursedAmount.toLocaleString('en-IN')}.` })
            onSuccess() 
            setOpen(false) 
            resetForm()

        } catch (error: any) {
            console.error(error)
            toast({ title: "Error", description: error.message || "Failed to save", variant: "destructive" })
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(val) => { setOpen(val); if(!val) resetForm(); }}>
            <DialogTrigger asChild>
                <Button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-lg transition-all">
                    <Sparkles className="h-4 w-4" />
                    Record Disbursement
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[750px] max-h-[90vh] overflow-hidden flex flex-col p-0 bg-slate-50">
                <DialogHeader className="p-6 pb-4 bg-white border-b">
                    <DialogTitle className="text-xl font-bold text-slate-800">New Disbursement Entry</DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Search Section */}
                    <div className="flex gap-3 items-end bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <div className="grid w-full gap-1.5">
                            <Label htmlFor="searchPhone" className="text-slate-500 font-semibold uppercase text-xs tracking-wider">Target Phone Number</Label>
                            <Input 
                                id="searchPhone" 
                                placeholder="Enter 10-digit number to auto-search..." 
                                maxLength={10}
                                className="font-mono text-lg tracking-widest h-12 bg-slate-50"
                                value={phoneSearch}
                                onChange={(e) => setPhoneSearch(e.target.value.replace(/\D/g, ''))} // Only allow numbers
                            />
                        </div>
                        <Button 
                            onClick={handleSearch} 
                            disabled={searchLoading || phoneSearch.length < 10} 
                            className="h-12 px-6 bg-slate-900 text-white hover:bg-slate-800"
                        >
                            {searchLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Verify"}
                        </Button>
                    </div>

                    {/* Main Form */}
                    {showForm && (
                        <form id="disbursement-form" onSubmit={handleSubmit} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                             <div className="flex items-center gap-2">
                                {isLeadFound ? (
                                    <div className="flex items-center gap-2 text-sm bg-emerald-100/50 text-emerald-800 px-3 py-1.5 rounded-full border border-emerald-200 font-medium">
                                        <CheckCircle className="h-4 w-4 text-emerald-600" /> Existing Profile Loaded
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 text-sm bg-blue-100/50 text-blue-800 px-3 py-1.5 rounded-full border border-blue-200 font-medium">
                                        <PlusCircle className="h-4 w-4 text-blue-600" /> Creating New Profile
                                    </div>
                                )}
                            </div>

                            {/* --- SHARED DETAILS SECTION --- */}
                            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-5">
                                <h3 className="text-sm font-bold text-slate-800 border-b pb-2">Applicant Identity</h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div className="space-y-2">
                                        <Label>Full Name *</Label>
                                        <Input required value={sharedData.name} onChange={(e) => setSharedData({...sharedData, name: e.target.value})} className="bg-slate-50 focus:bg-white transition-colors" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Registered Phone</Label>
                                        <Input value={sharedData.phone} disabled className="bg-slate-100 text-slate-500 font-mono" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                    <div className="space-y-2">
                                        <Label>Location (City) *</Label>
                                        <Input required placeholder="E.g. Mumbai" value={sharedData.location} onChange={(e) => setSharedData({...sharedData, location: e.target.value})} className="bg-slate-50 focus:bg-white" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Origin DSA *</Label>
                                        <Input 
                                            required 
                                            placeholder="Enter DSA name" 
                                            value={sharedData.dsa_name} 
                                            onChange={(e) => setSharedData({...sharedData, dsa_name: e.target.value})} 
                                            className="bg-slate-50 focus:bg-white" 
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Assigned Agent *</Label>
                                        <Select value={sharedData.assigned_to} onValueChange={(val) => setSharedData({...sharedData, assigned_to: val})} required>
                                            <SelectTrigger className="bg-slate-50 focus:bg-white"><SelectValue placeholder="Select Officer" /></SelectTrigger>
                                            <SelectContent>{telecallers.map(user => <SelectItem key={user.id} value={user.id}>{user.full_name}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>

                            {/* --- DYNAMIC DISBURSEMENTS SECTION --- */}
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-sm font-bold text-slate-800">Financial Allocations</h3>
                                    <Button type="button" variant="outline" size="sm" onClick={addDisbursement} disabled={disbursements.length >= 6} className="gap-2 h-9 text-xs bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 transition-colors">
                                        <Plus className="h-3.5 w-3.5" /> Add Bank Splitting
                                    </Button>
                                </div>

                                <div className="space-y-4">
                                    {disbursements.map((entry, index) => (
                                        <div key={index} className="relative bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                                            
                                            {/* Top Strip */}
                                            <div className="flex justify-between items-center border-b pb-3">
                                                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Tranche {index + 1}</span>
                                                {disbursements.length > 1 && (
                                                    <Button type="button" variant="ghost" size="icon" onClick={() => removeDisbursement(index)} className="h-6 w-6 text-red-400 hover:text-red-600 hover:bg-red-50 -mr-2">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                                <div className="space-y-2">
                                                    <Label>Application Ref Number *</Label>
                                                    <Input required placeholder="E.g. APP-9981" value={entry.application_number} onChange={(e) => handleDisbursementChange(index, 'application_number', e.target.value)} className="font-mono bg-slate-50 focus:bg-white" />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Banking Partner *</Label>
                                                    <Input 
                                                        required 
                                                        placeholder="Enter Bank name" 
                                                        value={entry.bank_name} 
                                                        onChange={(e) => handleDisbursementChange(index, 'bank_name', e.target.value)} 
                                                        className="bg-slate-50 focus:bg-white" 
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                                <div className="space-y-2">
                                                    <Label>Value Date *</Label>
                                                    <Input type="date" required value={entry.disbursed_date} onChange={(e) => handleDisbursementChange(index, 'disbursed_date', e.target.value)} className="bg-slate-50 focus:bg-white" />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Requested (₹)</Label>
                                                    <Input type="number" placeholder="0" value={entry.loan_amount} onChange={(e) => handleDisbursementChange(index, 'loan_amount', e.target.value)} className="bg-slate-50 focus:bg-white" />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-emerald-700 font-bold flex items-center gap-1"><IndianRupee className="h-3 w-3" /> Disbursed *</Label>
                                                    <Input type="number" required placeholder="0" value={entry.disbursed_amount} onChange={(e) => handleDisbursementChange(index, 'disbursed_amount', e.target.value)} className="border-emerald-200 focus-visible:ring-emerald-500 font-bold bg-emerald-50/30 text-emerald-900 text-lg" />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </form>
                    )}
                </div>

                {/* 🚀 NEW: Sticky Footer with Live Totals */}
                {showForm && (
                    <DialogFooter className="bg-white border-t p-4 px-6 flex flex-row items-center justify-between sm:justify-between shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Approved Volume</span>
                            <span className="text-2xl font-black text-emerald-600 tracking-tight">
                                ₹{totalDisbursedAmount.toLocaleString('en-IN')}
                            </span>
                        </div>
                        
                        <div className="flex gap-3">
                            <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-700">Cancel</Button>
                            <Button type="submit" form="disbursement-form" disabled={loading || totalDisbursedAmount === 0} className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[160px] shadow-lg shadow-emerald-200">
                                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : `Save ₹${(totalDisbursedAmount/100000).toFixed(2)}L`}
                            </Button>
                        </div>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    )
}
