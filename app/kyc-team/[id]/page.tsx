"use client";

import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Phone, User, Briefcase, IndianRupee, CreditCard, MapPin, MessageSquare, ArrowLeft, Clock, Save, Loader2, Edit2, XCircle } from "lucide-react";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";

// --- 1. CONSTANTS AND UTILITIES ---

const STATUSES = {
    LOGIN_DONE: "Login Done",
    UNDERWRITING: "Underwriting",
    REJECTED: "Rejected",
    APPROVED: "Approved",
    DISBURSED: "DISBURSED",
} as const;

const STATUS_OPTIONS = Object.values(STATUSES);

const PRIORITY_OPTIONS = [
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" },
    { value: "urgent", label: "Urgent" }
];

const OCCUPATION_OPTIONS = [
    { value: "private", label: "Private" },
    { value: "government", label: "Government" },
    { value: "public", label: "Public" },
    { value: "business", label: "Business" },
    { value: "self_employed", label: "Self Employed" }
];

const GENDER_OPTIONS = [
    { value: "male", label: "Male" },
    { value: "female", label: "Female" },
    { value: "other", label: "Other" }
];

const MARITAL_STATUS_OPTIONS = [
    { value: "married", label: "Married" },
    { value: "unmarried", label: "Unmarried" }
];

const RESIDENCE_TYPE_OPTIONS = [
    { value: "self_owned", label: "Self Owned" },
    { value: "rented", label: "Rented" },
    { value: "company_provided", label: "Company Provided" },
    { value: "parental", label: "Parental" }
];

// --- ADDED BANK OPTIONS ---
const BANK_OPTIONS = [
    { value: "ICICI Bank", label: "ICICI Bank" },
    { value: "HDFC Bank", label: "HDFC Bank" },
    { value: "Incred", label: "Incred" },
    { value: "IDFC First", label: "IDFC First" },
    { value: "Axis Bank", label: "Axis Bank" },
    { value: "FINNABLE", label: "FINNABLE" },
    { value: "Other", label: "Other" }
];

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  company: string | null;
  designation: string | null;
  source: string | null;
  status: string;
  priority: string;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  loan_amount: number | null;
  loan_type: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  zip_code: string | null;
  pan_number: string | null;
  residence_address: string | null;
  permanent_address: string | null;
  office_address: string | null;
  application_number: string | null;
  nth_salary: number | null;
  office_email: string | null;
  personal_email: string | null;
  disbursed_amount: number | null;
  disbursed_at: string | null;
  roi: number | null;
  tenure: number | null;
  gender: string | null;
  marital_status: string | null;
  residence_type: string | null;
  experience: number | null;
  occupation: string | null;
  alternative_mobile: string | null;
  bank_name: string | null;
  account_number: string | null;
  telecaller_name: string | null;
  salary_bank_name: string | null; // <--- NEW FIELD ADDED HERE
}

const formatCurrency = (value: number | null) => {
    if (value === null || isNaN(Number(value))) return "N/A";
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(Number(value));
};

const getStatusBadge = (status: string) => {
    switch (status) {
        case STATUSES.LOGIN_DONE: return <Badge className="bg-blue-500 text-white hover:bg-blue-600">Login Done</Badge>;
        case STATUSES.UNDERWRITING: return <Badge className="bg-amber-500 text-white hover:bg-amber-600">Underwriting</Badge>;
        case STATUSES.REJECTED: return <Badge className="bg-red-600 text-white hover:bg-red-700">Rejected</Badge>;
        case STATUSES.APPROVED: return <Badge className="bg-green-600 text-white hover:bg-green-700">Approved</Badge>;
        case STATUSES.DISBURSED: return <Badge className="bg-purple-600 text-white hover:bg-purple-700">DISBURSED</Badge>;
        default: return <Badge variant="secondary">{status || "New"}</Badge>;
    }
};

// --- 2. EDITABLE FIELD COMPONENT ---

interface EditableFieldProps {
  label: string;
  value: string | number | null;
  onSave: (value: string | number | null) => void;
  type?: 'text' | 'number' | 'email' | 'tel' | 'textarea' | 'date';
  placeholder?: string;
  options?: { value: string; label: string }[];
  className?: string;
  formatter?: (val: any) => string;
}

const EditableField = ({ 
  label, 
  value, 
  onSave, 
  type = 'text', 
  placeholder = '',
  options,
  className = '',
  formatter
}: EditableFieldProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
      if (type === 'date' && value) {
          setEditValue(new Date(value as string).toISOString().split('T')[0]);
      } else {
          setEditValue(value || '');
      }
  }, [value, type]);

  const handleSave = async () => {
    setIsSaving(true);
    let valToSave = editValue;
    
    if (type === 'number' && editValue !== '') {
        valToSave = Number(editValue);
    }
    
    await onSave(valToSave === '' ? null : valToSave);
    setIsSaving(false);
    setIsEditing(false);
  };

  const handleCancel = () => {
    if (type === 'date' && value) {
        setEditValue(new Date(value as string).toISOString().split('T')[0]);
    } else {
        setEditValue(value || '');
    }
    setIsEditing(false);
  };

  let displayValue = value || 'N/A';
  if (formatter && value !== null && value !== '') {
      displayValue = formatter(value);
  } else if (type === 'date' && value) {
      displayValue = new Date(value as string).toLocaleDateString('en-IN', {
          day: 'numeric', month: 'short', year: 'numeric'
      });
  }

  return (
    <div className={`flex flex-col space-y-2 p-3 bg-gray-50 rounded-lg ${className}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-gray-500">{label}</p>
        {!isEditing && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(true)}
            className="h-6 w-6 p-0 hover:bg-gray-200"
          >
            <Edit2 className="h-3 w-3" />
          </Button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-2">
          {options ? (
            <Select value={editValue as string} onValueChange={setEditValue}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={`Select ${label}`} />
              </SelectTrigger>
              <SelectContent>
                {options.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : type === 'textarea' ? (
            <Textarea
              value={editValue as string}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder={placeholder}
              rows={3}
            />
          ) : (
            <Input
              type={type}
              value={editValue as string}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder={placeholder}
              className="w-full"
            />
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={isSaving} className="flex-1 bg-purple-600 hover:bg-purple-700">
              {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
            </Button>
            <Button size="sm" variant="outline" onClick={handleCancel} disabled={isSaving}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-800 break-words font-medium">{displayValue}</p>
      )}
    </div>
  );
};

// --- 3. INLINE STATUS UPDATER ---

interface LeadStatusUpdaterProps {
    leadId: string;
    currentStatus: string;
    onStatusUpdate: (newStatus: string) => void;
}

const LeadStatusUpdater = ({ leadId, currentStatus, onStatusUpdate }: LeadStatusUpdaterProps) => {
    const [newStatus, setNewStatus] = useState(currentStatus);
    const [isUpdating, setIsUpdating] = useState(false);
    const supabase = createClient();
    const { toast } = useToast();

    useEffect(() => { setNewStatus(currentStatus); }, [currentStatus]);

    const handleUpdate = useCallback(async () => {
        if (newStatus === currentStatus) return;
        setIsUpdating(true);
        
        const updates: any = { status: newStatus, updated_at: new Date().toISOString() };
        if (newStatus === STATUSES.DISBURSED) {
            updates.disbursed_at = new Date().toISOString();
        }

        const { error } = await supabase.from('leads').update(updates).eq('id', leadId);
        setIsUpdating(false);

        if (error) {
            toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
            setNewStatus(currentStatus); 
        } else {
            toast({ title: "Success", description: "Status updated successfully", className: "bg-green-500 text-white" });
            onStatusUpdate(newStatus); 
        }
    }, [newStatus, currentStatus, leadId, supabase, onStatusUpdate, toast]);

    const isSaveDisabled = isUpdating || newStatus === currentStatus;

    return (
        <Card className="shadow-lg border-2 border-purple-200">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl text-purple-700">
                    <Clock className="h-5 w-5" /> Update Loan Status
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                    <Label className="min-w-[80px]">Current:</Label>
                    <div className="flex-grow">{getStatusBadge(currentStatus)}</div>
                </div>
                <div className="flex items-center gap-4">
                    <Label className="min-w-[80px]">Set New:</Label>
                    <Select value={newStatus} onValueChange={setNewStatus} disabled={isUpdating}>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select a new status" />
                        </SelectTrigger>
                        <SelectContent>
                            {STATUS_OPTIONS.map(status => (
                                <SelectItem key={status} value={status}>{status}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <Button onClick={handleUpdate} disabled={isSaveDisabled} className="w-full bg-purple-600 hover:bg-purple-700">
                    {isUpdating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    {isUpdating ? "Updating..." : "Save Status Change"}
                </Button>
            </CardContent>
        </Card>
    );
};

// --- 4. MAIN PAGE ---

export default function KycLeadProfilePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const leadId = params.id;
  const [lead, setLead] = useState<Lead | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();
  const { toast } = useToast();

  const fetchLead = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (error) {
      setError(`Lead not found: ${error.message}`);
      setLead(null);
    } else {
      setLead(data as Lead);
    }
    setIsLoading(false);
  }, [leadId, supabase]);

  const updateField = async (field: keyof Lead, value: any) => {
    if (!lead) return;
    
    const updates: any = { [field]: value, updated_at: new Date().toISOString() };

    if (field === 'disbursed_at' && value) {
        updates.status = STATUSES.DISBURSED;
    }

    const { error } = await supabase.from('leads').update(updates).eq('id', leadId);

    if (error) {
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
    } else {
      setLead(prev => {
          if (!prev) return null;
          const updated = { ...prev, [field]: value };
          if (field === 'disbursed_at' && value) updated.status = STATUSES.DISBURSED;
          return updated;
      });
      toast({ title: "Success", description: "Field updated successfully" });
    }
  };

  useEffect(() => {
    fetchLead();
    const channel = supabase.channel(`lead_${leadId}_changes`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads', filter: `id=eq.${leadId}` }, 
      (payload: any) => setLead(prev => ({ ...(prev as Lead), ...(payload.new as Lead) })))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [leadId, fetchLead, supabase]); 

  const handleStatusUpdate = (newStatus: string) => {
      setLead(prev => (prev ? { ...prev, status: newStatus } : null));
  };

  if (isLoading) return <LoadingSkeleton variant="details" />;
  if (error || !lead) return <div className="p-8 text-center text-red-600">{error}</div>;

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Button onClick={() => router.back()} variant="outline" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">{lead.name}</h1>
          {getStatusBadge(lead.status)}
        </div>
        <div className="text-sm text-gray-500">Last Updated: {new Date(lead.updated_at).toLocaleString()}</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Details */}
        <div className="lg:col-span-2 space-y-6">
            
            <Card>
                <CardHeader><CardTitle className="flex items-center gap-2 text-purple-700"><User className="h-5 w-5" /> Personal Information</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <EditableField label="Name" value={lead.name} onSave={(v) => updateField('name', v)} />
                    <EditableField label="Phone" value={lead.phone} onSave={(v) => updateField('phone', v)} type="tel" />
                    <EditableField label="Email" value={lead.email} onSave={(v) => updateField('email', v)} type="email" />
                    <EditableField label="Alt Mobile" value={lead.alternative_mobile} onSave={(v) => updateField('alternative_mobile', v)} type="tel" />
                    <EditableField label="Personal Email" value={lead.personal_email} onSave={(v) => updateField('personal_email', v)} type="email" />
                    <EditableField label="Gender" value={lead.gender} onSave={(v) => updateField('gender', v)} options={GENDER_OPTIONS} />
                    <EditableField label="Marital Status" value={lead.marital_status} onSave={(v) => updateField('marital_status', v)} options={MARITAL_STATUS_OPTIONS} />
                    <EditableField label="PAN Number" value={lead.pan_number} onSave={(v) => updateField('pan_number', v)} />
                    <EditableField label="Application No" value={lead.application_number} onSave={(v) => updateField('application_number', v)} />
                    <EditableField label="Telecaller Name" value={lead.telecaller_name} onSave={(v) => updateField('telecaller_name', v)} />
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle className="flex items-center gap-2 text-purple-700"><Briefcase className="h-5 w-5" /> Professional Information</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <EditableField label="Company" value={lead.company} onSave={(v) => updateField('company', v)} />
                    <EditableField label="Designation" value={lead.designation} onSave={(v) => updateField('designation', v)} />
                    <EditableField label="Office Email" value={lead.office_email} onSave={(v) => updateField('office_email', v)} type="email" />
                    <EditableField label="Occupation" value={lead.occupation} onSave={(v) => updateField('occupation', v)} options={OCCUPATION_OPTIONS} />
                    <EditableField label="Experience (Yrs)" value={lead.experience} onSave={(v) => updateField('experience', v)} type="number" />
                    <EditableField label="Nth Salary" value={lead.nth_salary} onSave={(v) => updateField('nth_salary', v)} type="number" formatter={formatCurrency} />
                    
                    {/* NEW FIELD ADDED HERE */}
                    <EditableField 
                        label="Salary Bank Account" 
                        value={lead.salary_bank_name} 
                        onSave={(v) => updateField('salary_bank_name', v)} 
                        options={BANK_OPTIONS} 
                    />
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle className="flex items-center gap-2 text-purple-700"><IndianRupee className="h-5 w-5" /> Loan & Financial Details</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <EditableField label="Loan Amount" value={lead.loan_amount} onSave={(v) => updateField('loan_amount', v)} type="number" formatter={formatCurrency} className="font-semibold" />
                    <EditableField label="Disbursed Amount" value={lead.disbursed_amount} onSave={(v) => updateField('disbursed_amount', v)} type="number" formatter={formatCurrency} className="font-bold text-green-700 bg-green-50 border border-green-200" />
                    <EditableField 
                        label="Disbursed Date" 
                        value={lead.disbursed_at} 
                        onSave={(v) => updateField('disbursed_at', v)} 
                        type="date"
                        className="bg-green-50 border border-green-200"
                    />
                    <EditableField label="Loan Type" value={lead.loan_type} onSave={(v) => updateField('loan_type', v)} />
                    <EditableField label="ROI (%)" value={lead.roi} onSave={(v) => updateField('roi', v)} type="number" />
                    <EditableField label="Tenure (Months)" value={lead.tenure} onSave={(v) => updateField('tenure', v)} type="number" />
                    <EditableField label="Priority" value={lead.priority} onSave={(v) => updateField('priority', v)} options={PRIORITY_OPTIONS} />
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle className="flex items-center gap-2 text-purple-700"><CreditCard className="h-5 w-5" /> Bank Account</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <EditableField label="Bank Name" value={lead.bank_name} onSave={(v) => updateField('bank_name', v)} options={BANK_OPTIONS} />
                    <EditableField label="Account Number" value={lead.account_number} onSave={(v) => updateField('account_number', v)} />
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle className="flex items-center gap-2 text-purple-700"><MapPin className="h-5 w-5" /> Address</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <EditableField label="Residence Address" value={lead.residence_address} onSave={(v) => updateField('residence_address', v)} type="textarea" />
                    <EditableField label="Permanent Address" value={lead.permanent_address} onSave={(v) => updateField('permanent_address', v)} type="textarea" />
                    <EditableField label="Office Address" value={lead.office_address} onSave={(v) => updateField('office_address', v)} type="textarea" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <EditableField label="Residence Type" value={lead.residence_type} onSave={(v) => updateField('residence_type', v)} options={RESIDENCE_TYPE_OPTIONS} />
                        <EditableField label="City" value={lead.city} onSave={(v) => updateField('city', v)} />
                        <EditableField label="State" value={lead.state} onSave={(v) => updateField('state', v)} />
                        <EditableField label="Country" value={lead.country} onSave={(v) => updateField('country', v)} />
                        <EditableField label="ZIP Code" value={lead.zip_code} onSave={(v) => updateField('zip_code', v)} />
                    </div>
                </CardContent>
            </Card>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-1 space-y-6">
            <LeadStatusUpdater leadId={lead.id} currentStatus={lead.status} onStatusUpdate={handleStatusUpdate} />
            <Tabs defaultValue="timeline" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="timeline">Timeline</TabsTrigger>
                    <TabsTrigger value="notes">Notes</TabsTrigger>
                </TabsList>
                <TabsContent value="timeline">
                    <Card>
                        <CardHeader><CardTitle>Activity Timeline</CardTitle></CardHeader>
                        <CardContent>
                            <div className="text-sm text-gray-500 space-y-2">
                                <div className="p-2 border-l-4 border-purple-400">
                                    <p className="font-semibold">Last Updated</p>
                                    <p className="text-xs">{new Date(lead.updated_at).toLocaleString()}</p>
                                </div>
                                <div className="p-2 border-l-4 border-gray-300">
                                    <p className="font-semibold">Created</p>
                                    <p className="text-xs">{new Date(lead.created_at).toLocaleString()}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="notes">
                    <Card>
                        <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5" /> Notes</CardTitle></CardHeader>
                        <CardContent>
                            <p className="text-sm text-gray-500 mb-2">Internal notes for this lead.</p>
                            <Textarea placeholder="Add a note..." rows={3} />
                            <Button size="sm" className="mt-2 w-full bg-purple-600 hover:bg-purple-700">Save Note</Button>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
      </div>
    </div>
  );
}
