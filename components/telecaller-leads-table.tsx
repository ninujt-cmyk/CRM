"use client"

import { useState, useTransition } from "react"
import { createClient } from "@/lib/supabase/client"
import { 
  Building, ChevronDown, ChevronUp, ArrowUpRight, 
  Copy, PhoneMissed, MessageSquare, Loader2
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

// Import the Server Action for C2C
import { initiateC2CCall } from "@/app/actions/c2c-dialer" 

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
  tags?: string[]
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
  const [isDialingC2C, setIsDialingC2C] = useState<string | null>(null) // Tracks which lead is currently connecting

  // --- 1. HANDLE SORTING ---
  const handleSort = (field: string) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (sortBy === field) {
        params.set('sort_order', sortOrder === 'asc' ? 'desc' : 'asc')
      } else {
        params.set('sort_by', field)
        params.set('sort_order', 'desc')
      }
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
  
  // Standard Call (tel: link)
  const handleStandardCallInitiated = (lead: Lead) => {
    setSelectedLead(lead)
    setIsStatusDialogOpen(true)
    setIsCallInitiated(true)
  }

  // C2C Cloud Call
  const handleC2CCallInitiated = async (leadId: string, customerPhone: string) => {
      const lead = leads.find(l => l.id === leadId);
      if (!lead) return;

      setIsDialingC2C(leadId); // Show loading spinner on row
      
      try {
          toast.info("Initiating cloud call...", { description: "Please wait for your phone to ring." });
          
          const result = await initiateC2CCall(leadId, customerPhone);
          
          if (result.success) {
              toast.success(result.message);
              // Open the status popup immediately since the call is connecting!
              setSelectedLead(lead);
              setIsCallInitiated(true);
              setIsStatusDialogOpen(true);
          } else {
              toast.error(result.error || "Failed to initiate call");
          }
      } catch (error: any) {
          toast.error("Call failed", { description: error.message });
      } finally {
          setIsDialingC2C(null);
      }
  }

  const handleCallLogged = (callLogId: string) => {
    setIsCallInitiated(false)
    router.refresh()
  }

  const handleNextLead = () => {
    if (!selectedLead) return;
    
    // If the status update was not part of an active call flow,
    // just close the dialog and do not auto-advance to the next lead.
    if (!isCallInitiated) {
        setIsStatusDialogOpen(false);
        setSelectedLead(null);
        return;
    }
    
    const currentIndex = leads.findIndex(l => l.id === selectedLead.id);
    let nextIndex = -1;

    if (currentIndex !== -1 && currentIndex < leads.length - 1) {
        nextIndex = currentIndex + 1;
    } else if (currentIndex === -1 && leads.length > 0) {
        nextIndex = 0;
    }

    if (nextIndex !== -1 && leads[nextIndex]) {
        const nextLead = leads[nextIndex];
        
        setTimeout(() => {
            setSelectedLead(nextLead);
            setIsCallInitiated(true); 
            setIsStatusDialogOpen(true);
        }, 50); 
    } else {
        setIsStatusDialogOpen(false);
        setSelectedLead(null);
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

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '-'
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
  }

  const handleStatusUpdate = async (newStatus: string, note?: string, callbackDate?: string) => {
    const isAutoNext = typeof window !== 'undefined' && localStorage.getItem("crm_auto_next") !== "false";
    
    if (isCallInitiated && isAutoNext) {
        // Do not close the dialog immediately, handleNextLead will transition it smoothly.
    } else {
        setIsStatusDialogOpen(false)
        setSelectedLead(null)
    }
    router.refresh()
  }

  const totalPages = Math.ceil(totalCount / pageSize)

  if (leads.length === 0) {
    return <div className="p-12 text-center text-slate-500 border border-dashed rounded-lg">No leads found.</div>
  }

  return (
    <div className="space-y-4">
      <div className={cn("rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden relative transition-opacity duration-200", isPending ? "opacity-50 pointer-events-none" : "opacity-100")}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-950 sticky top-0 z-10 shadow-sm">
              <TableRow>
                <TableHead className="w-[300px]">Contact Options</TableHead>
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
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
               {leads.map((lead) => {
                const isHighPriority = lead.priority === 'high';
                const isDialing = isDialingC2C === lead.id;
                const isHot = Array.isArray(lead.tags) && lead.tags.some(t => t.includes("Hot Prospect"));
                const isDNC = Array.isArray(lead.tags) && lead.tags.some(t => t.includes("Do Not Call"));
                
                return (
                  <TableRow key={lead.id} className={cn(
                    "group transition-all duration-200 hover:bg-slate-50/80 dark:hover:bg-slate-800/40", 
                    isHighPriority ? "border-l-4 border-l-red-500" : "",
                    isHot ? "bg-orange-50/10 hover:bg-orange-50/20 border-l-4 border-l-orange-500 font-medium" : "",
                    isDNC ? "opacity-60 bg-red-50/5 hover:bg-red-50/10 border-l-4 border-l-red-400" : ""
                  )}>
                    <TableCell>
                        <div className="flex items-center gap-1.5">
                            {isDialing ? (
                                <div className="flex items-center gap-2 text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-md border border-indigo-100 text-sm font-medium w-[200px]">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Connecting...
                                </div>
                            ) : (
                                <QuickActions 
                                    phone={lead.phone || ""} 
                                    email={lead.email || ""} 
                                    leadId={lead.id} 
                                    onCallInitiated={() => handleStandardCallInitiated(lead)} 
                                    onC2CCallInitiated={handleC2CCallInitiated}
                                />
                            )}

                            {!isDialing && (
                              <>
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
                              </>
                            )}
                        </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <Link href={`/telecaller/leads/${lead.id}`} className="font-semibold text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-2">
                            {lead.name}
                            <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
                        </Link>
                        {lead.company && (
                            <span className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 truncate max-w-[150px]">
                                <Building className="h-3 w-3" /> {lead.company}
                            </span>
                        )}
                        {Array.isArray(lead.tags) && lead.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5 max-w-[200px]">
                                {lead.tags.map((tag) => {
                                  let tagStyle = "bg-slate-100 text-slate-800 border-slate-200";
                                  if (tag.includes("Hot Prospect")) tagStyle = "bg-orange-50 text-orange-700 border-orange-200 font-semibold shadow-sm";
                                  if (tag.includes("Do Not Call")) tagStyle = "bg-red-50 text-red-700 border-red-200 font-semibold shadow-sm";
                                  if (tag.includes("Cold Lead")) tagStyle = "bg-blue-50 text-blue-700 border-blue-200 shadow-sm";
                                  if (tag.includes("Callback Scheduled")) tagStyle = "bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold shadow-sm";
                                  
                                  return (
                                    <Badge key={tag} variant="outline" className={cn("text-[10px] px-1.5 py-0 h-5 font-normal tracking-wide", tagStyle)}>
                                        {tag}
                                    </Badge>
                                  );
                                })}
                            </div>
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
          key={selectedLead.id} 
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
