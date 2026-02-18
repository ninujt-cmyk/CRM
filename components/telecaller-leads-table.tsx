"use client"

import { useState, useTransition } from "react"
import { createClient } from "@/lib/supabase/client"
import { 
  Building, Clock, ChevronDown, ChevronUp, AlertCircle, ArrowUpRight, 
  CheckSquare, X, Loader2, Copy, PhoneMissed, MessageSquare 
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { LeadStatusDialog } from "@/components/lead-status-dialog" 
import { QuickActions } from "@/components/quick-actions" 
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import { useRouter, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"

interface Lead {
  id: string
  name: string
  email: string
  phone: string
  company: string
  status: string
  priority: string
  created_at: string
  last_contacted: string | null
  loan_amount: number | null
  loan_type: string | null
  source: string | null
  city: string | null
}

interface TelecallerLeadsTableProps {
  leads: Lead[]
  totalCount: number
  currentPage: number
  pageSize: number
  sortBy: string
  sortOrder: string
}

export function TelecallerLeadsTable({ 
  leads = [], 
  totalCount = 0, 
  currentPage = 1, 
  pageSize = 20,
  sortBy,
  sortOrder
}: TelecallerLeadsTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [isPending, startTransition] = useTransition()

  // State
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false)
  const [isCallInitiated, setIsCallInitiated] = useState(false)
    
  // Bulk Actions State
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  // --- 1. HANDLE SORTING ---
  const handleSort = (field: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (sortBy === field) {
      params.set('sort_order', sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      params.set('sort_by', field)
      params.set('sort_order', 'desc')
    }
    startTransition(() => {
      router.push(`?${params.toString()}`)
    })
  }

  const SortIcon = ({ field }: { field: string }) => {
    if (sortBy !== field) return <ChevronDown className="ml-1 h-3 w-3 opacity-20" />
    return sortOrder === 'asc' 
      ? <ChevronUp className="ml-1 h-3 w-3 text-blue-600" /> 
      : <ChevronDown className="ml-1 h-3 w-3 text-blue-600" />
  }

  // --- 2. ACTIONS ---
  const handleCallInitiated = (lead: Lead) => {
    setSelectedLead(lead)
    setIsStatusDialogOpen(true)
    setIsCallInitiated(true)
  }

  const handleCallLogged = (callLogId: string) => {
    setIsCallInitiated(false)
    router.refresh()
  }

  // AUTOMATION: ROBUST NEXT LEAD LOGIC
  const handleNextLead = () => {
    if (!selectedLead) return;
    
    // Find where we are in the list
    const currentIndex = leads.findIndex(l => l.id === selectedLead.id);
    
    let nextIndex = -1;

    if (currentIndex !== -1 && currentIndex < leads.length - 1) {
        // Normal case: Move to the next person
        nextIndex = currentIndex + 1;
    } else if (currentIndex === -1 && leads.length > 0) {
        // Edge Case: The current lead disappeared (e.g. status changed from "New" to "Interested" and filter is "New")
        // In this case, the list shifted up, so the *next* person is now at the *top* (or same index).
        // Let's default to the first one to be safe and keep the flow moving.
        nextIndex = 0;
    }

    if (nextIndex !== -1 && leads[nextIndex]) {
        const nextLead = leads[nextIndex];
        
        // 1. Close briefly to force reset (optional, but Key prop handles this better)
        // setIsStatusDialogOpen(false);
        
        // 2. Load Next
        setTimeout(() => {
            setSelectedLead(nextLead);
            setIsCallInitiated(true); // Ensure Dialer stays ON
            setIsStatusDialogOpen(true);
        }, 50); // Tiny delay to allow React to process
    } else {
        setIsStatusDialogOpen(false);
        toast.success("List completed! No more leads to call.");
    }
  }

  const handleQuickNR = async (e: React.MouseEvent, lead: Lead) => {
    e.stopPropagation();
    toast.message("Marking No Response...", { description: "Scheduling callback for tomorrow." });

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(11, 0, 0, 0);

    try {
        await Promise.all([
             supabase.from("leads").update({ 
                 status: 'nr', 
                 last_contacted: new Date().toISOString() 
             }).eq('id', lead.id),
             supabase.from("follow_ups").insert({
                 lead_id: lead.id,
                 scheduled_at: tomorrow.toISOString(),
                 status: "pending",
                 title: `Retry: ${lead.name}`,
                 notes: "Auto-scheduled: No Response"
             })
        ]);
        
        router.refresh();
        toast.success("Marked NR");
    } catch (error) {
        toast.error("Failed to update");
    }
  }

  const getWhatsAppLink = (phone: string, name: string) => {
    if (!phone) return "#"
    const cleanedPhone = phone.replace(/\D/g, '')
    const message = `Hi ${name || "there"}, this is from ICICI Bank regarding your loan inquiry.`
    return `https://wa.me/${cleanedPhone}?text=${encodeURIComponent(message)}`
  }

  const copyToClipboard = (text: string) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    toast.success("Copied to clipboard")
  }

  const isStale = (lastContacted: string | null, status: string) => {
    if(!lastContacted) return true;
    if(['Disbursed', 'Not_Interested', 'not_eligible'].includes(status)) return false;
    const diff = new Date().getTime() - new Date(lastContacted).getTime();
    return diff > (48 * 60 * 60 * 1000); 
  }

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '-'
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
  }

  const handleStatusUpdate = async (newStatus: string, note?: string, callbackDate?: string) => {
    setIsStatusDialogOpen(false)
    router.refresh()
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === leads.length) setSelectedIds([])
    else setSelectedIds(leads.map(l => l.id))
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const handleBulkStatus = async (status: string) => {
    if (selectedIds.length === 0) return
    setIsProcessing(true)
    try {
      await supabase.from('leads').update({ status, last_contacted: new Date().toISOString() }).in('id', selectedIds)
      toast.success(`Updated ${selectedIds.length} leads`)
      setSelectedIds([])
      router.refresh()
    } catch (e) { console.error(e) }
    finally { setIsProcessing(false) }
  }

  const totalPages = Math.ceil(totalCount / pageSize)

  if (leads.length === 0) {
    return <div className="p-12 text-center text-slate-500 border border-dashed rounded-lg">No leads found.</div>
  }

  return (
    <div className="space-y-4">
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between bg-blue-50 p-2 px-4 rounded-md border border-blue-200 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-blue-600"/>
            <span className="text-sm font-medium text-blue-800">{selectedIds.length} Selected</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-8 bg-white" onClick={() => handleBulkStatus('nr')} disabled={isProcessing}>
              {isProcessing ? <Loader2 className="h-3 w-3 animate-spin"/> : "Mark NR"}
            </Button>
            <Button size="sm" variant="outline" className="h-8 bg-white" onClick={() => handleBulkStatus('Not_Interested')} disabled={isProcessing}>
              {isProcessing ? <Loader2 className="h-3 w-3 animate-spin"/> : "Mark NI"}
            </Button>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setSelectedIds([])}><X className="h-4 w-4"/></Button>
          </div>
        </div>
      )}

      <div className={cn("rounded-md border bg-white shadow-sm overflow-hidden relative transition-opacity duration-200", isPending ? "opacity-50 pointer-events-none" : "opacity-100")}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
              <TableRow>
                <TableHead className="w-10">
                  <input type="checkbox" checked={selectedIds.length === leads.length && leads.length > 0} onChange={toggleSelectAll} className="rounded border-gray-300"/>
                </TableHead>
                <TableHead className="w-[120px]">Contact</TableHead>
                <TableHead className="w-[200px] md:w-[250px] cursor-pointer hover:bg-slate-100" onClick={() => handleSort('name')}>
                    <div className="flex items-center">Name <SortIcon field="name"/></div>
                </TableHead>
                <TableHead className="hidden md:table-cell">Status</TableHead>
                <TableHead className="cursor-pointer hover:bg-slate-100" onClick={() => handleSort('loan_amount')}>
                    <div className="flex items-center">Amount <SortIcon field="loan_amount"/></div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-slate-100 hidden md:table-cell" onClick={() => handleSort('priority')}>
                    <div className="flex items-center">Priority <SortIcon field="priority"/></div>
                </TableHead>
                {/* Last Contact Column Header Removed Here */}
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => {
                const isSelected = selectedIds.includes(lead.id);
                const isHighPriority = lead.priority === 'high';
                
                return (
                  <TableRow key={lead.id} className={cn("group transition-colors", isSelected ? "bg-blue-50/50" : "hover:bg-slate-50", isHighPriority ? "border-l-4 border-l-red-500" : "")}>
                    <TableCell>
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(lead.id)} className="rounded border-gray-300"/>
                    </TableCell>
                    <TableCell>
                        <div className="flex items-center gap-1">
                            <QuickActions 
                                phone={lead.phone || ""} 
                                email={lead.email || ""} 
                                leadId={lead.id} 
                                onCallInitiated={() => handleCallInitiated(lead)} 
                            />
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button onClick={() => copyToClipboard(lead.phone || '')} className="p-1.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors">
                                            <Copy className="h-3.5 w-3.5" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent>Copy Number</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <a href={getWhatsAppLink(lead.phone || '', lead.name)} target="_blank" className="p-1.5 rounded-full bg-green-50 text-green-600 hover:bg-green-100 transition-colors border border-green-200">
                                            <MessageSquare className="h-3.5 w-3.5" />
                                        </a>
                                    </TooltipTrigger>
                                    <TooltipContent>WhatsApp</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <Link href={`/telecaller/leads/${lead.id}`} className="font-semibold text-slate-900 hover:text-blue-600 flex items-center gap-2">
                            {lead.name}
                            <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
                        </Link>
                        {lead.company && (
                            <span className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 truncate max-w-[150px]">
                                <Building className="h-3 w-3" /> {lead.company}
                            </span>
                        )}
                        <div className="md:hidden mt-1">
                           <Badge variant="outline" className="text-[10px] px-1 py-0 h-5">{lead.status?.replace(/_/g, " ")}</Badge>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                        <Badge variant="outline" className={cn(
                           "capitalize font-medium border-0 px-2.5 py-0.5 rounded-md", 
                           lead.status === 'new' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                           lead.status === 'Interested' ? 'bg-green-50 text-green-700 border-green-100' :
                           lead.status === 'Disbursed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                           'bg-slate-100 text-slate-700 border-slate-200'
                        )}>
                         {lead.status?.replace(/_/g, " ")}
                        </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-slate-600">
                        {formatCurrency(lead.loan_amount)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                        {lead.priority === 'high' && <Badge variant="destructive" className="text-[10px] px-1.5">HIGH</Badge>}
                        {lead.priority === 'medium' && <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-800 hover:bg-amber-100 border-0 px-1.5">MED</Badge>}
                        {lead.priority === 'low' && <Badge variant="outline" className="text-[10px] text-slate-500 border-slate-300 px-1.5">LOW</Badge>}
                    </TableCell>
                    {/* Last Contact Column Cell Removed Here */}
                    <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-8 w-8 p-0 text-slate-400 hover:text-orange-600 hover:bg-orange-50"
                                            onClick={(e) => handleQuickNR(e, lead)}
                                        >
                                            <PhoneMissed className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>One-Click NR</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                            <Button variant="ghost" size="sm" className="h-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => { setSelectedLead(lead); setIsStatusDialogOpen(true); }}>
                                Update
                            </Button>
                        </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="py-4 border-t flex justify-end">
        {totalPages > 1 && (
            <Pagination>
            <PaginationContent>
                <PaginationItem>
                <PaginationPrevious href={`?page=${Math.max(1, currentPage - 1)}`} className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}/>
                </PaginationItem>
                <PaginationItem><div className="px-4 text-sm text-slate-500">Page {currentPage} of {totalPages}</div></PaginationItem>
                <PaginationItem>
                <PaginationNext href={`?page=${Math.min(totalPages, currentPage + 1)}`} className={currentPage >= totalPages ? 'pointer-events-none opacity-50' : ''}/>
                </PaginationItem>
            </PaginationContent>
            </Pagination>
        )}
      </div>

      {selectedLead && (
        <LeadStatusDialog
          key={selectedLead.id} /* FIX: Forces fresh instance for every lead */
          leadId={selectedLead.id}
          currentStatus={selectedLead.status}
          open={isStatusDialogOpen}
          onOpenChange={(open) => {
            setIsStatusDialogOpen(open)
            if (!open) { setIsCallInitiated(false); setSelectedLead(null); }
          }}
          onStatusUpdate={handleStatusUpdate}
          isCallInitiated={isCallInitiated}
          onCallLogged={handleCallLogged}
          leadPhoneNumber={selectedLead.phone}
          telecallerName="Agent"
          onNextLead={handleNextLead}
        />
      )}
    </div>
  )
}
