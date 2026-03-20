"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Search, PlusCircle, CheckCircle, Plus, Trash2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

interface DisbursementModalProps {
    onSuccess: () => void; // Function to refresh parent data
}

// Options
const DSA_OPTIONS = ["RKPL", "Star Power", "Profincare", "DRRT", "URBAN"]
const BANK_OPTIONS = ["ICICI Bank", "HDFC Bank", "IDFC Bank", "Axis Bank", "Finnable", "Incred", "L&T", "Other"]

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
    
    // 1. Shared Lead State (Applies to all disbursements for this phone number)
    const [sharedData, setSharedData] = useState({
        id: "", // Lead ID if found
        name: "",
        phone: "",
        location: "", // Maps to 'city'
        dsa_name: "", // Maps to 'DSA' column
        assigned_to: "", // Telecaller ID
    })

    // 2. Dynamic Disbursements Array (Up to 6)
    const [disbursements, setDisbursements] = useState([{ ...DEFAULT_DISBURSEMENT }])

    // Fetch Telecallers for the dropdown
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

    const resetForm = () => {
        setPhoneSearch("")
        setShowForm(false)
        setIsLeadFound(false)
        setSharedData({
            id: "",
            name: "",
            phone: "",
            location: "",
            dsa_name: "",
            assigned_to: ""
        })
        setDisbursements([{ ...DEFAULT_DISBURSEMENT }])
    }

    const handleSearch = async () => {
        if (!phoneSearch || phoneSearch.length < 10) {
            toast({ title: "Invalid Phone", description: "Please enter a valid phone number", variant: "destructive" })
            return
        }

        setSearchLoading(true)
        resetForm()
        setPhoneSearch(phoneSearch) // Restore search term after reset
        
        // Search for existing lead
        const { data, error } = await supabase
            .from('leads')
            .select('*')
            .eq('phone', phoneSearch)
            .single()

        setShowForm(true)

        if (data) {
            setIsLeadFound(true)
            
            // Populate Shared Data
            setSharedData({
                id: data.id,
                name: data.name || "",
                phone: data.phone,
                location: data.city || "",
                dsa_name: data.DSA || "",
                assigned_to: data.assigned_to || ""
            })

            // Populate First Disbursement Entry
            const existingDate = data.disbursed_at ? new Date(data.disbursed_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
            setDisbursements([{
                application_number: data.application_number || "",
                bank_name: data.bank_name || "",
                disbursed_date: existingDate,
                loan_amount: data.loan_amount || "",
                disbursed_amount: data.disbursed_amount || ""
            }])

            toast({ title: "Lead Found", description: "Details fetched from database.", className: "bg-green-50" })
        } else {
            setIsLeadFound(false)
            setSharedData(prev => ({ ...prev, phone: phoneSearch }))
            toast({ title: "New Lead", description: "Number not found. Please enter details.", className: "bg-blue-50" })
        }

        setSearchLoading(false)
    }

    // --- Dynamic Array Handlers ---
    const addDisbursement = () => {
        if (disbursements.length < 6) {
            setDisbursements([...disbursements, { ...DEFAULT_DISBURSEMENT }])
        } else {
            toast({ title: "Limit Reached", description: "You can only add up to 6 banks at a time.", variant: "destructive" })
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

    // --- Submit Handler ---
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            // Generate payloads for all disbursement blocks
            const payloads = disbursements.map(d => ({
                name: sharedData.name,
                phone: sharedData.phone,
                city: sharedData.location,
                DSA: sharedData.dsa_name,
                assigned_to: sharedData.assigned_to,
                status: 'DISBURSED', 
                
                // Block-specific data
                bank_name: d.bank_name,
                application_number: d.application_number,
                disbursed_at: new Date(d.disbursed_date).toISOString(),
                loan_amount: Number(d.loan_amount) || 0,
                disbursed_amount: Number(d.disbursed_amount) || 0,
            }))

            if (isLeadFound && sharedData.id) {
                // 1. Update the originally found lead row with the FIRST disbursement data
                const { error: updateError } = await supabase
                    .from('leads')
                    .update(payloads[0])
                    .eq('id', sharedData.id)
                
                if (updateError) throw updateError

                // 2. Insert any ADDITIONAL disbursements as new rows
                if (payloads.length > 1) {
                    const newPayloads = payloads.slice(1)
                    const { error: insertError } = await supabase
                        .from('leads')
                        .insert(newPayloads)
                    
                    if (insertError) throw insertError
                }
            } else {
                // Brand new lead - insert all blocks as new rows
                const { error: insertError } = await supabase
                    .from('leads')
                    .insert(payloads)
                
                if (insertError) throw insertError
            }

            toast({ title: "Success", description: `Successfully recorded ${disbursements.length} disbursement(s).` })
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
                <Button className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white">
                    <PlusCircle className="h-4 w-4" />
                    Create Disbursement
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Record Disbursement</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Search Section */}
                    <div className="flex gap-2 items-end">
                        <div className="grid w-full gap-1.5">
                            <Label htmlFor="searchPhone">Search Phone Number</Label>
                            <Input 
                                id="searchPhone" 
                                placeholder="9876543210" 
                                value={phoneSearch}
                                onChange={(e) => setPhoneSearch(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault(); 
                                        handleSearch();
                                    }
                                }}
                            />
                        </div>
                        <Button onClick={handleSearch} disabled={searchLoading} variant="secondary">
                            {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        </Button>
                    </div>

                    {/* Main Form */}
                    {showForm && (
                        <form onSubmit={handleSubmit} className="space-y-6 border-t pt-4">
                             <div className="flex items-center gap-2 mb-2">
                                {isLeadFound ? (
                                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded flex items-center gap-1">
                                        <CheckCircle className="h-3 w-3" /> Existing Lead Found
                                    </span>
                                ) : (
                                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                        Creating New Lead
                                    </span>
                                )}
                            </div>

                            {/* --- SHARED DETAILS SECTION --- */}
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-4">
                                <h3 className="text-sm font-bold text-slate-800 mb-2">Customer & Assignment Details</h3>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Customer Name *</Label>
                                        <Input 
                                            required 
                                            value={sharedData.name}
                                            onChange={(e) => setSharedData({...sharedData, name: e.target.value})}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Phone</Label>
                                        <Input 
                                            value={sharedData.phone}
                                            disabled // Locked to search result
                                            className="bg-slate-100 text-slate-500"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label>Location (City) *</Label>
                                        <Input 
                                            required
                                            placeholder="City"
                                            value={sharedData.location}
                                            onChange={(e) => setSharedData({...sharedData, location: e.target.value})}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>DSA Name *</Label>
                                        <Select 
                                            value={sharedData.dsa_name} 
                                            onValueChange={(val) => setSharedData({...sharedData, dsa_name: val})}
                                            required
                                        >
                                            <SelectTrigger><SelectValue placeholder="Select DSA" /></SelectTrigger>
                                            <SelectContent>
                                                {DSA_OPTIONS.map((dsa) => (
                                                    <SelectItem key={dsa} value={dsa}>{dsa}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Assigned Telecaller *</Label>
                                        <Select 
                                            value={sharedData.assigned_to} 
                                            onValueChange={(val) => setSharedData({...sharedData, assigned_to: val})}
                                            required
                                        >
                                            <SelectTrigger><SelectValue placeholder="Select Agent" /></SelectTrigger>
                                            <SelectContent>
                                                {telecallers.map(user => (
                                                    <SelectItem key={user.id} value={user.id}>{user.full_name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>

                            {/* --- DYNAMIC DISBURSEMENTS SECTION --- */}
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-sm font-bold text-slate-800">Bank Disbursements</h3>
                                    <Button 
                                        type="button" 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={addDisbursement}
                                        disabled={disbursements.length >= 6}
                                        className="gap-1 h-8 text-xs bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                                    >
                                        <Plus className="h-3 w-3" /> Add Another Bank
                                    </Button>
                                </div>

                                {disbursements.map((entry, index) => (
                                    <div key={index} className="relative bg-white p-4 rounded-lg border border-slate-200 shadow-sm space-y-4">
                                        
                                        {/* Remove Button for extra blocks */}
                                        {disbursements.length > 1 && (
                                            <Button 
                                                type="button" 
                                                variant="ghost" 
                                                size="icon" 
                                                className="absolute top-2 right-2 h-6 w-6 text-red-400 hover:text-red-600 hover:bg-red-50"
                                                onClick={() => removeDisbursement(index)}
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        )}

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Application Number *</Label>
                                                <Input 
                                                    required
                                                    placeholder="APP-12345"
                                                    value={entry.application_number}
                                                    onChange={(e) => handleDisbursementChange(index, 'application_number', e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-2 pr-6"> {/* Padding right to avoid delete button overlap */}
                                                <Label>Bank Selection *</Label>
                                                <Select 
                                                    value={entry.bank_name} 
                                                    onValueChange={(val) => handleDisbursementChange(index, 'bank_name', val)}
                                                    required
                                                >
                                                    <SelectTrigger><SelectValue placeholder="Select Bank" /></SelectTrigger>
                                                    <SelectContent>
                                                        {BANK_OPTIONS.map(bank => (
                                                            <SelectItem key={bank} value={bank}>{bank}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="space-y-2">
                                                <Label>Date *</Label>
                                                <Input 
                                                    type="date"
                                                    required
                                                    value={entry.disbursed_date}
                                                    onChange={(e) => handleDisbursementChange(index, 'disbursed_date', e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Requested (₹)</Label>
                                                <Input 
                                                    type="number"
                                                    placeholder="0"
                                                    value={entry.loan_amount}
                                                    onChange={(e) => handleDisbursementChange(index, 'loan_amount', e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-green-700 font-bold">Disbursed (₹) *</Label>
                                                <Input 
                                                    type="number"
                                                    required
                                                    placeholder="0"
                                                    className="border-green-200 focus-visible:ring-green-500 font-semibold bg-green-50/30"
                                                    value={entry.disbursed_amount}
                                                    onChange={(e) => handleDisbursementChange(index, 'disbursed_amount', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="flex justify-between items-center pt-4 border-t">
                                <span className="text-xs text-slate-500 font-medium bg-slate-100 px-2 py-1 rounded">
                                    Total Rows: {disbursements.length} / 6
                                </span>
                                <div className="flex gap-2">
                                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                                    <Button type="submit" disabled={loading} className="bg-green-600 hover:bg-green-700 text-white min-w-[140px]">
                                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save All"}
                                    </Button>
                                </div>
                            </div>
                        </form>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
