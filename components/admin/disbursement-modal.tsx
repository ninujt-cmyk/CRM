"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Search, PlusCircle, CheckCircle } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

interface DisbursementModalProps {
    onSuccess: () => void; // Function to refresh parent data
}

// DSA Options
const DSA_OPTIONS = ["RKPL", "Star Power", "Profincare", "DRRT", "URBAN"]

export function DisbursementModal({ onSuccess }: DisbursementModalProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [searchLoading, setSearchLoading] = useState(false)
    const [telecallers, setTelecallers] = useState<{id: string, full_name: string}[]>([])
    const { toast } = useToast()
    const supabase = createClient()

    // Form State
    const [phoneSearch, setPhoneSearch] = useState("")
    const [isLeadFound, setIsLeadFound] = useState(false)
    const [showForm, setShowForm] = useState(false)
    
    const [formData, setFormData] = useState({
        id: "", // Lead ID if found
        name: "",
        phone: "",
        loan_amount: "",
        disbursed_amount: "",
        bank_name: "",
        assigned_to: "", // Telecaller ID
        application_number: "",
        disbursed_date: new Date().toISOString().split('T')[0], // Default to today
        location: "", // Maps to 'city'
        dsa_name: ""  // Maps to 'DSA' column
    })

    // Fetch Telecallers for the dropdown
    useEffect(() => {
        const fetchTelecallers = async () => {
            const { data } = await supabase
                .from('users')
                .select('id, full_name')
                .in('role', ['telecaller', 'team_leader']) // Added team_leader just in case
                .eq('is_active', true)
            
            if (data) setTelecallers(data)
        }
        if(open) fetchTelecallers()
    }, [open, supabase])

    const resetForm = () => {
        setPhoneSearch("")
        setShowForm(false)
        setIsLeadFound(false)
        setFormData({
            id: "",
            name: "",
            phone: "",
            loan_amount: "",
            disbursed_amount: "",
            bank_name: "",
            assigned_to: "",
            application_number: "",
            disbursed_date: new Date().toISOString().split('T')[0],
            location: "",
            dsa_name: ""
        })
    }

    const handleSearch = async () => {
        if (!phoneSearch || phoneSearch.length < 10) {
            toast({ title: "Invalid Phone", description: "Please enter a valid phone number", variant: "destructive" })
            return
        }

        setSearchLoading(true)
        // Reset form data but keep phone search
        setFormData(prev => ({ ...prev, id: "", name: "", loan_amount: "", disbursed_amount: "", bank_name: "", assigned_to: "", application_number: "", location: "", dsa_name: "" }))
        
        // Search for existing lead
        const { data, error } = await supabase
            .from('leads')
            .select('*')
            .eq('phone', phoneSearch)
            .single()

        setShowForm(true) // Show form regardless of result

        if (data) {
            setIsLeadFound(true)
            
            // Format existing date if available, else today
            const existingDate = data.disbursed_at ? new Date(data.disbursed_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

            setFormData({
                id: data.id,
                name: data.name || "",
                phone: data.phone,
                loan_amount: data.loan_amount || "",
                disbursed_amount: data.disbursed_amount || "", 
                bank_name: data.bank_name || "",
                assigned_to: data.assigned_to || "",
                application_number: data.application_number || "",
                disbursed_date: existingDate,
                location: data.city || "",
                dsa_name: data.DSA || "" // Load existing DSA if available
            })
            toast({ title: "Lead Found", description: "Details fetched from database.", className: "bg-green-50" })
        } else {
            setIsLeadFound(false)
            // Pre-fill phone, leave rest blank for creation
            setFormData(prev => ({ ...prev, phone: phoneSearch, id: "" }))
            toast({ title: "New Lead", description: "Number not found. Please enter details.", className: "bg-blue-50" })
        }

        setSearchLoading(false)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const payload = {
                name: formData.name,
                phone: formData.phone,
                loan_amount: Number(formData.loan_amount) || 0,
                disbursed_amount: Number(formData.disbursed_amount) || 0,
                bank_name: formData.bank_name,
                assigned_to: formData.assigned_to,
                status: 'DISBURSED', 
                disbursed_at: new Date(formData.disbursed_date).toISOString(),
                application_number: formData.application_number,
                city: formData.location, // Saving location to 'city' column
                DSA: formData.dsa_name // Saving DSA name to 'DSA' column
            }

            let error;

            if (isLeadFound && formData.id) {
                // Update existing
                const result = await supabase.from('leads').update(payload).eq('id', formData.id)
                error = result.error
            } else {
                // Insert new
                const result = await supabase.from('leads').insert([payload])
                error = result.error
            }

            if (error) throw error

            toast({ title: "Success", description: "Disbursement recorded successfully." })
            onSuccess() // Refresh parent
            setOpen(false) // Close modal
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
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
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
                        <form onSubmit={handleSubmit} className="space-y-4 border-t pt-4">
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

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Customer Name *</Label>
                                    <Input 
                                        id="name" 
                                        required 
                                        value={formData.name}
                                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="phone">Phone</Label>
                                    <Input 
                                        id="phone" 
                                        value={formData.phone}
                                        disabled // Locked to search result
                                        className="bg-slate-50"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="app_no">Application Number *</Label>
                                    <Input 
                                        id="app_no" 
                                        required
                                        placeholder="APP-12345"
                                        value={formData.application_number}
                                        onChange={(e) => setFormData({...formData, application_number: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="location">Location (City) *</Label>
                                    <Input 
                                        id="location" 
                                        required
                                        placeholder="City"
                                        value={formData.location}
                                        onChange={(e) => setFormData({...formData, location: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="bank">Bank Selection *</Label>
                                    <Select 
                                        value={formData.bank_name} 
                                        onValueChange={(val) => setFormData({...formData, bank_name: val})}
                                        required
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Bank" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ICICI Bank">ICICI Bank</SelectItem>
                                            <SelectItem value="HDFC Bank">HDFC Bank</SelectItem>
                                            <SelectItem value="IDFC Bank">IDFC Bank</SelectItem>
                                            <SelectItem value="Axis Bank">Axis Bank</SelectItem>
                                            <SelectItem value="Finnable">Finnable</SelectItem>
                                            <SelectItem value="Incred">Incred</SelectItem>
                                            <SelectItem value="L&T">L&T</SelectItem>
                                            <SelectItem value="Other">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="date">Disbursement Date *</Label>
                                    <Input 
                                        id="date" 
                                        type="date"
                                        required
                                        value={formData.disbursed_date}
                                        onChange={(e) => setFormData({...formData, disbursed_date: e.target.value})}
                                    />
                                </div>
                            </div>

                            {/* DSA SELECTION FIELD */}
                            <div className="space-y-2">
                                <Label htmlFor="dsa">DSA Name *</Label>
                                <Select 
                                    value={formData.dsa_name} 
                                    onValueChange={(val) => setFormData({...formData, dsa_name: val})}
                                    required
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select DSA" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {DSA_OPTIONS.map((dsa) => (
                                            <SelectItem key={dsa} value={dsa}>{dsa}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="loan_amount">Requested Amount</Label>
                                    <Input 
                                        id="loan_amount" 
                                        type="number"
                                        value={formData.loan_amount}
                                        onChange={(e) => setFormData({...formData, loan_amount: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="disbursed_amount" className="text-green-700 font-bold">Disbursed Amount *</Label>
                                    <Input 
                                        id="disbursed_amount" 
                                        type="number"
                                        required
                                        className="border-green-200 focus-visible:ring-green-500 font-semibold"
                                        value={formData.disbursed_amount}
                                        onChange={(e) => setFormData({...formData, disbursed_amount: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="assign">Assigned Telecaller *</Label>
                                <Select 
                                    value={formData.assigned_to} 
                                    onValueChange={(val) => setFormData({...formData, assigned_to: val})}
                                    required
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Telecaller" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {telecallers.map(user => (
                                            <SelectItem key={user.id} value={user.id}>{user.full_name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                                <Button type="submit" disabled={loading} className="bg-green-600 hover:bg-green-700 text-white">
                                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Disbursement"}
                                </Button>
                            </div>
                        </form>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
