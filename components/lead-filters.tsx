"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, X, Calendar, Loader2 } from "lucide-react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useState, useEffect, useTransition, useRef } from "react"
import { Label } from "@/components/ui/label"

interface LeadFiltersProps {
  telecallers: Array<{ id: string; full_name: string }>
  telecallerStatus: Record<string, boolean>
}

export function LeadFilters({ telecallers, telecallerStatus }: LeadFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [inputValue, setInputValue] = useState(searchParams.get("search") || "")
  const lastPushedValue = useRef(searchParams.get("search") || "")
  
  const [customStart, setCustomStart] = useState(searchParams.get("from") || "")
  const [customEnd, setCustomEnd] = useState(searchParams.get("to") || "")

  // 1. Sync from URL to input (ONLY if updated by the other search bar)
  useEffect(() => {
    const currentUrlSearch = searchParams.get("search") || "";
    if (currentUrlSearch !== lastPushedValue.current) {
      setInputValue(currentUrlSearch);
      lastPushedValue.current = currentUrlSearch;
    }
  }, [searchParams]);

  // 2. Debounce local state to URL
  useEffect(() => {
    // If what we have matches the last thing we pushed, don't loop.
    if (inputValue === lastPushedValue.current) return;

    const timer = setTimeout(() => {
      lastPushedValue.current = inputValue;
      
      // Grab latest URL state directly from window so filters aren't lost
      const params = new URLSearchParams(window.location.search);
      if (inputValue) params.set("search", inputValue);
      else params.delete("search");
      
      params.set("page", "1");

      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [inputValue, pathname, router]);

  // --- DROPDOWN HANDLERS ---
  const updateUrlParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(window.location.search) 
    Object.entries(updates).forEach(([key, value]) => {
      if (value && value !== "all") params.set(key, value)
      else params.delete(key)
    })
    params.set("page", "1") 
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }

  const handleDateRangeChange = (val: string) => {
    if (val !== "custom") {
        updateUrlParams({ date_range: val, from: null, to: null })
        setCustomStart("")
        setCustomEnd("")
    } else {
        updateUrlParams({ date_range: val })
    }
  }

  const handleCustomDateChange = (type: 'from' | 'to', val: string) => {
    if (type === 'from') setCustomStart(val)
    if (type === 'to') setCustomEnd(val)
    updateUrlParams({ [type]: val })
  }

  const clearFilters = () => {
    setInputValue("")
    setCustomStart("")
    setCustomEnd("")
    startTransition(() => {
      router.push(pathname, { scroll: false })
    })
  }

  const currentStatus = searchParams.get("status") || "all"
  const currentPriority = searchParams.get("priority") || "all"
  const currentAssignedTo = searchParams.get("assigned_to") || "all"
  const currentSource = searchParams.get("source") || "all"
  const currentDateRange = searchParams.get("date_range") || "all"

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4"> 
        
        <div className="relative col-span-2 lg:col-span-1">
          {isPending ? (
            <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500 h-4 w-4 animate-spin" />
          ) : (
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
          )}
          <Input 
            placeholder="Search phone number..." 
            value={inputValue} 
            onChange={(e) => setInputValue(e.target.value)} 
            className="pl-9" 
          />
        </div>

        <Select value={currentStatus} onValueChange={(val) => updateUrlParams({ status: val })}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {['new','contacted','Interested','Documents_Sent','Login','Disbursed','Not_Interested','follow_up','not_eligible','self_employed','nr','recycle_pool'].map(s => (
               <SelectItem key={s} value={s}>
                 {s.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
               </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={currentPriority} onValueChange={(val) => updateUrlParams({ priority: val })}>
          <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>

        <Select value={currentAssignedTo} onValueChange={(val) => updateUrlParams({ assigned_to: val })}>
          <SelectTrigger><SelectValue placeholder="Telecaller" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Telecallers</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {telecallers.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${telecallerStatus[t.id] ? 'bg-green-500' : 'bg-red-500'}`} />
                  {t.full_name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={currentSource} onValueChange={(val) => updateUrlParams({ source: val })}>
          <SelectTrigger><SelectValue placeholder="Source" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="website">Website</SelectItem>
            <SelectItem value="referral">Referral</SelectItem>
            <SelectItem value="campaign">Campaign</SelectItem>
            <SelectItem value="cold_call">Cold Call</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative">
          <Select value={currentDateRange} onValueChange={handleDateRangeChange}>
            <SelectTrigger className={currentDateRange !== "all" ? "border-blue-500 bg-blue-50 text-blue-700" : ""}>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <SelectValue placeholder="Created Date" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {currentDateRange === "custom" && (
        <div className="flex items-center gap-2 p-3 bg-slate-50 border rounded-md w-fit">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">From:</Label>
            <Input type="date" value={customStart} onChange={(e) => handleCustomDateChange('from', e.target.value)} className="h-8 w-auto bg-white"/>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">To:</Label>
            <Input type="date" value={customEnd} onChange={(e) => handleCustomDateChange('to', e.target.value)} className="h-8 w-auto bg-white"/>
          </div>
        </div>
      )}

      {Array.from(searchParams.keys()).length > 0 && (
        <div className="flex justify-end">
          <Button variant="ghost" onClick={clearFilters} className="text-slate-500 hover:text-slate-900 h-8 text-xs">
            <X className="h-4 w-4 mr-1" /> Clear All Filters
          </Button>
        </div>
      )}
    </div>
  )
}
