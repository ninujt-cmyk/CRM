"use client"

import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { 
  Phone, Mail, Calendar, MessageSquare, ArrowLeft, Clock, Send, 
  Loader2, UserCheck, Save, AlertTriangle, Briefcase, Banknote, MapPin, User
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useEffect, useCallback, useRef } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"

// --- CUSTOM COMPONENTS ---
import { TimelineView } from "@/components/timeline-view"
import { LeadNotes } from "@/components/lead-notes"
import { LeadCallHistory } from "@/components/lead-call-history"
import { FollowUpsList } from "@/components/follow-ups-list"
// ✅ IMPORT THE NEW WHATSAPP COMPONENT HERE
import { WhatsAppChat } from "@/components/WhatsAppChat" 

// --- CONSTANTS ---
const STATUSES = {
    NEW: "New Lead",
    CONTACTED: "Contacted",
    FOLLOW_UP: "Follow Up",
    NOT_INTERESTED: "Not Interested",
    LOGIN_DONE: "Login Done",
    TRANSFERRED_TO_KYC: "Transferred to KYC",
} as const;

const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'urgent'];
const STATUS_OPTIONS = Object.values(STATUSES);

// --- TYPES ---
interface UserProfile {
    id: string;
    email: string;
    full_name: string | null; 
}

interface Lead {
  id: string
  name: string
  email: string | null
  phone: string
  company: string | null
  designation: string | null 
  source: string | null
  status: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  created_at: string
  updated_at: string
  assigned_to: string | null
  kyc_member_id: string | null
  loan_amount: number | null;
  loan_type: string | null; 
}

// --- HELPER: Status Badge ---
const getStatusBadge = (status: string) => {
    switch (status) {
        case STATUSES.NEW: return <Badge className="bg-blue-500 hover:bg-blue-600">New</Badge>;
        case STATUSES.CONTACTED: return <Badge className="bg-green-500 hover:bg-green-600">Contacted</Badge>;
        case STATUSES.FOLLOW_UP: return <Badge className="bg-yellow-500 text-black hover:bg-yellow-600">Follow Up</Badge>;
        case STATUSES.NOT_INTERESTED: return <Badge className="bg-red-500 hover:bg-red-600">Not Interested</Badge>;
        case STATUSES.LOGIN_DONE: return <Badge className="bg-purple-500 hover:bg-purple-600">Login Done</Badge>;
        case STATUSES.TRANSFERRED_TO_KYC: return <Badge className="bg-indigo-600 hover:bg-indigo-700">Transferred to KYC</Badge>;
        default: return <Badge variant="secondary">Other</Badge>;
    }
};

// --- HELPER: Read-Only Detail Item ---
const DetailItem = ({ label, value, icon }: { label: string, value: React.ReactNode, icon?: React.ReactNode }) => (
    <div className="flex flex-col space-y-1 p-2 bg-slate-50 rounded-lg border border-slate-100">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
        <div className="flex items-center gap-2">
            {icon && <span className="text-slate-400">{icon}</span>}
            <span className="text-sm font-medium text-slate-800 break-words">{value || "N/A"}</span>
        </div>
    </div>
);

// --- COMPONENT: Transfer Module ---
interface LeadTransferModuleProps {
    lead: Lead;
    onTransferSuccess: (kycUserId: string) => void;
}

const LeadTransferModule = ({ lead, onTransferSuccess }: LeadTransferModuleProps) => {
    const supabase = createClient();
    const { toast } = useToast();
    const [kycUsers, setKycUsers] = useState<UserProfile[]>([]);
    const [selectedKycUserId, setSelectedKycUserId] = useState<string>('');
    const [isFetchingUsers, setIsFetchingUsers] = useState(false); 
    const [isTransferring, setIsTransferring] = useState(false);
    const [transferError, setTransferError] = useState<string | null>(null);
    const fetchedRef = useRef(false); 

    useEffect(() => {
        if (fetchedRef.current) return;
        fetchedRef.current = true;

        const fetchKycUsers = async () => {
            setIsFetchingUsers(true);
            const { data, error } = await supabase
                .from('users') 
                .select('id, email, full_name')
                .eq('role', 'kyc_team') 
                .limit(100);

            if (error) {
                console.error('Error fetching KYC users:', error);
                setTransferError("Could not load KYC team list.");
            } else if (data) {
                setKycUsers(data as UserProfile[]);
                if (data.length > 0) setSelectedKycUserId(data[0].id);
            }
            setIsFetchingUsers(false);
        };
        fetchKycUsers();
    }, [supabase]);

    const handleTransfer = async () => {
        if (!selectedKycUserId) return;
        setIsTransferring(true);
        setTransferError(null);

        const { error } = await supabase
            .from('leads')
            .update({
                status: STATUSES.TRANSFERRED_TO_KYC,
                kyc_member_id: selectedKycUserId,
                updated_at: new Date().toISOString()
            })
            .eq('id', lead.id);
        
        setIsTransferring(false);

        if (error) {
            setTransferError(error.message);
            toast({ title: "Transfer Failed", description: error.message, variant: "destructive" });
        } else {
            onTransferSuccess(selectedKycUserId);
            toast({ title: "Transfer Successful", description: "Lead sent to KYC team.", className: "bg-indigo-500 text-white" });
        }
    };

    const isAlreadyTransferred = lead.status === STATUSES.TRANSFERRED_TO_KYC;
    const isButtonDisabled = isTransferring || isFetchingUsers || !selectedKycUserId || isAlreadyTransferred || kycUsers.length === 0;

    const currentKycAssignee = lead.kyc_member_id 
        ? kycUsers.find(u => u.id === lead.kyc_member_id)?.full_name || "Assigned Member"
        : null;

    return (
        <Card className="shadow-lg border-2 border-indigo-200">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl text-indigo-700">
                    <Send className="h-5 w-5" /> Transfer to KYC
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {isAlreadyTransferred && (
                    <div className="bg-indigo-50 border-l-4 border-indigo-500 text-indigo-700 p-3 rounded-md text-sm">
                        <p className="font-semibold">Status: Transferred</p>
                        {currentKycAssignee && <p className="mt-1 text-xs">Assignee: <strong>{currentKycAssignee}</strong></p>}
                    </div>
                )}
                
                {!isAlreadyTransferred && (
                    <div className="space-y-2">
                        <Label htmlFor="kyc-select">Assign to KYC Member</Label>
                        <Select value={selectedKycUserId} onValueChange={setSelectedKycUserId} disabled={isButtonDisabled}>
                            <SelectTrigger id="kyc-select" className="w-full bg-white">
                                <SelectValue placeholder={isFetchingUsers ? "Loading..." : "Select member"} />
                            </SelectTrigger>
                            <SelectContent>
                                {kycUsers.map(user => (
                                    <SelectItem key={user.id} value={user.id}>{user.full_name || user.email}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                {transferError && <div className="text-sm p-3 bg-red-100 text-red-700 rounded-lg">{transferError}</div>}

                <Button onClick={handleTransfer} disabled={isButtonDisabled} className="w-full bg-indigo-600 hover:bg-indigo-700">
                    {isTransferring ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                    {isAlreadyTransferred ? "Transferred" : "Transfer Lead"}
                </Button>
            </CardContent>
        </Card>
    );
};

// --- MAIN PAGE COMPONENT ---
export default function LeadDetailPage({ params }: { params: { id: string } }) {
    const router = useRouter()
    const leadId = params.id
    const supabase = createClient()
    const { toast } = useToast();
    
    const [lead, setLead] = useState<Lead | null>(null)
    const [editableLeadData, setEditableLeadData] = useState<Partial<Lead>>({})
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [isSavingDetails, setIsSavingDetails] = useState(false);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    
    const fetchLeadData = useCallback(async () => {
        const { data, error } = await supabase
            .from('leads')
            .select('*') 
            .eq('id', leadId)
            .single()

        if (error) {
            console.error('Lead fetch error:', error)
            setError(error.message)
        } else {
            setLead(data as Lead)
            setEditableLeadData(data as Lead)
        }
        setLoading(false)
    }, [leadId, supabase])

    useEffect(() => {
        fetchLeadData();
    }, [fetchLeadData]);

    useEffect(() => {
        const channel = supabase.channel(`lead-watch-${leadId}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'leads', filter: `id=eq.${leadId}` },
                (payload) => {
                    const newLead = payload.new as Lead
                    setLead(newLead);
                    if (!isSavingDetails) {
                        setEditableLeadData(newLead);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [leadId, supabase, isSavingDetails]);

    const handleInputChange = (field: keyof Lead, value: any) => {
        setEditableLeadData(prev => ({ ...prev, [field]: value }))
    };

    const handleUpdateDetails = async () => {
        if (!editableLeadData.id) return;
        setIsSavingDetails(true);

        const { error } = await supabase
            .from('leads')
            .update({
                ...editableLeadData,
                updated_at: new Date().toISOString()
            })
            .eq('id', leadId);

        setIsSavingDetails(false);

        if (error) {
            toast({ title: "Update Failed", description: error.message, variant: "destructive" });
        } else {
            toast({ title: "Saved", description: "Lead details updated successfully." });
        }
    };

    const handleStatusUpdate = async (newStatus: string) => {
        if (!lead || newStatus === lead.status) return;
        setIsUpdatingStatus(true);
        
        const { error } = await supabase
            .from('leads')
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq('id', lead.id);

        setIsUpdatingStatus(false);

        if (error) {
            toast({ title: "Status Update Failed", description: error.message, variant: "destructive" });
        }
    };

    if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>;
    if (error || !lead) return <div className="p-8 text-center text-red-600">Error: {error || "Lead not found"}</div>;

    const isTransferred = lead.status === STATUSES.TRANSFERRED_TO_KYC;

    return (
        <div className="space-y-6 pb-8">
            {/* HEADER AREA */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Button onClick={() => router.back()} variant="outline" size="icon" className="h-9 w-9">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                            {lead.name}
                            {getStatusBadge(lead.status)}
                        </h1>
                        <p className="text-sm text-gray-500">Last Active: {new Date(lead.updated_at).toLocaleString()}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* --- LEFT COLUMN (2/3) --- */}
                <div className="lg:col-span-2 space-y-6">
                    
                    {/* EDITABLE DETAILS CARD */}
                    <Card className="shadow-sm border-purple-100">
                        <CardHeader className="flex flex-row items-center justify-between py-4 bg-slate-50/50 border-b">
                            <CardTitle className="flex items-center gap-2 text-base text-purple-800">
                                <UserCheck className="h-4 w-4" /> Lead Information
                            </CardTitle>
                            <Button 
                                onClick={handleUpdateDetails} 
                                disabled={isSavingDetails || isTransferred} 
                                size="sm"
                                className="bg-purple-600 hover:bg-purple-700"
                            >
                                {isSavingDetails ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Save className="h-3 w-3 mr-2" />}
                                Save Changes
                            </Button>
                        </CardHeader>
                        <CardContent className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                                <div className="space-y-1">
                                    <Label className="text-xs text-slate-500">Full Name</Label>
                                    <Input value={editableLeadData.name || ''} onChange={(e) => handleInputChange('name', e.target.value)} disabled={isTransferred} />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-slate-500">Phone Number</Label>
                                    <Input value={editableLeadData.phone || ''} onChange={(e) => handleInputChange('phone', e.target.value)} disabled={isTransferred} />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-slate-500">Email Address</Label>
                                    <Input value={editableLeadData.email || ''} onChange={(e) => handleInputChange('email', e.target.value)} disabled={isTransferred} />
                                </div>
                                
                                <div className="space-y-1">
                                    <Label className="text-xs text-slate-500">Company Name</Label>
                                    <Input value={editableLeadData.company || ''} onChange={(e) => handleInputChange('company', e.target.value)} disabled={isTransferred} />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-slate-500">Designation</Label>
                                    <Input value={editableLeadData.designation || ''} onChange={(e) => handleInputChange('designation', e.target.value)} disabled={isTransferred} />
                                </div>

                                <div className="space-y-1">
                                    <Label className="text-xs text-slate-500">Loan Amount</Label>
                                    <Input type="number" value={editableLeadData.loan_amount || ''} onChange={(e) => handleInputChange('loan_amount', e.target.value)} disabled={isTransferred} />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-slate-500">Loan Type</Label>
                                    <Input value={editableLeadData.loan_type || ''} onChange={(e) => handleInputChange('loan_type', e.target.value)} disabled={isTransferred} placeholder="e.g. Personal, Home" />
                                </div>

                                <div className="space-y-1">
                                    <Label className="text-xs text-slate-500">Priority</Label>
                                    <Select value={editableLeadData.priority} onValueChange={(val) => handleInputChange('priority', val)} disabled={isTransferred}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {PRIORITY_OPTIONS.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="mt-6 pt-4 border-t grid grid-cols-2 md:grid-cols-3 gap-4">
                                <DetailItem label="Lead Source" value={lead.source} icon={<MapPin className="h-3 w-3" />} />
                                <DetailItem label="Assigned Telecaller" value={lead.assigned_to ? "You" : "Unassigned"} icon={<User className="h-3 w-3" />} />
                                <DetailItem label="KYC Member ID" value={lead.kyc_member_id || "None"} icon={<UserCheck className="h-3 w-3" />} />
                            </div>
                        </CardContent>
                    </Card>

                    {/* TABS SECTION */}
                    <Tabs defaultValue="timeline" className="w-full">
                        <TabsList className="grid w-full grid-cols-4 bg-slate-100 p-1 rounded-lg">
                            <TabsTrigger value="timeline">Timeline</TabsTrigger>
                            <TabsTrigger value="notes">Notes</TabsTrigger>
                            <TabsTrigger value="calls">Calls</TabsTrigger>
                            <TabsTrigger value="followups">Follow-ups</TabsTrigger>
                        </TabsList>
                        <div className="mt-4">
                            <TabsContent value="timeline"><Card><CardContent className="pt-6"><TimelineView data={[]} /></CardContent></Card></TabsContent>
                            <TabsContent value="notes"><Card><CardContent className="pt-6"><LeadNotes leadId={leadId} userId="" /></CardContent></Card></TabsContent>
                            <TabsContent value="calls"><Card><CardContent className="pt-6"><LeadCallHistory leadId={leadId} userId="" /></CardContent></Card></TabsContent>
                            <TabsContent value="followups"><Card><CardContent className="pt-6"><FollowUpsList leadId={leadId} /></CardContent></Card></TabsContent>
                        </div>
                    </Tabs>
                </div>

                {/* --- RIGHT COLUMN (1/3) --- */}
                <div className="lg:col-span-1 space-y-6">
                    
                    {/* ✅ INJECTED WHATSAPP PANEL HERE ✅ */}
                    <div className="mb-6">
                       <WhatsAppChat leadId={lead.id} phone={lead.phone} />
                    </div>
                    {/* ==================================== */}

                    {/* STATUS CARD */}
                    <Card className="shadow-lg border-2 border-purple-200">
                        <CardHeader className="py-4 border-b bg-purple-50/50">
                            <CardTitle className="text-lg text-purple-800 flex items-center gap-2">
                                <Clock className="h-5 w-5" /> Update Status
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <Label>Select New Status</Label>
                                <Select value={lead.status} onValueChange={handleStatusUpdate} disabled={isUpdatingStatus}>
                                    <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button 
                                onClick={() => handleStatusUpdate(lead.status)} 
                                disabled={isUpdatingStatus || isTransferred} 
                                className="w-full bg-purple-600 hover:bg-purple-700"
                            >
                                {isUpdatingStatus ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Confirm Status Change"}
                            </Button>
                        </CardContent>
                    </Card>

                    {/* TRANSFER MODULE (Conditionally Rendered) */}
                    {(lead.status === STATUSES.LOGIN_DONE || lead.status === STATUSES.TRANSFERRED_TO_KYC) ? (
                        <LeadTransferModule lead={lead} onTransferSuccess={(id) => handleInputChange('kyc_member_id', id)} />
                    ) : (
                        <Card className="bg-slate-50 border-slate-200 text-slate-500">
                            <CardContent className="p-4 text-sm text-center">
                                <Send className="h-8 w-8 mx-auto mb-2 opacity-20" />
                                Transfer to KYC is available only when status is <strong>Login Done</strong>.
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    )
}
