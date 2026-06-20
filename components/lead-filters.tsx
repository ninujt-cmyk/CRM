"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, X, Calendar, Loader2 } from "lucide-react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useState, useEffect, useTransition, useRef } from "react"
import { Label } from "@/components/ui/label"
import { useTenant } from "@/context/tenant-provider"
import { MASTER_STATUSES } from "@/lib/lead-statuses"

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

  const org = useTenant()
  const enabledStatusValues = org?.enabled_statuses || MASTER_STATUSES.map(s => s.value)
  const availableStatuses = MASTER_STATUSES.filter(s => enabledStatusValues.includes(s.value))

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
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3"> 
        
        {/* Search Input Pill */}
        <div className="relative col-span-1 sm:col-span-2 lg:col-span-1">
          {isPending ? (
            <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-3.5 w-3.5" />
          )}
          <Input 
            placeholder="Search phone number..." 
            value={inputValue} 
            onChange={(e) => setInputValue(e.target.value)} 
            className="pl-9 h-9 rounded-full bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-700 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus-visible:ring-blue-500 transition-colors" 
          />
        </div>

        {/* Status Filter Pill */}
        <Select value={currentStatus} onValueChange={(val) => updateUrlParams({ status: val })}>
          <SelectTrigger className="h-9 rounded-full bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900/60 text-xs text-slate-750 dark:text-slate-200 transition-colors cursor-pointer">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all" className="rounded-lg text-xs">All Statuses</SelectItem>
            {availableStatuses.map(s => (
               <SelectItem key={s.value} value={s.value} className="rounded-lg text-xs">
                 {s.label}
               </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Priority Filter Pill */}
        <Select value={currentPriority} onValueChange={(val) => updateUrlParams({ priority: val })}>
          <SelectTrigger className="h-9 rounded-full bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900/60 text-xs text-slate-750 dark:text-slate-200 transition-colors cursor-pointer">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all" className="rounded-lg text-xs">All Priorities</SelectItem>
            <SelectItem value="high" className="rounded-lg text-xs">High</SelectItem>
            <SelectItem value="medium" className="rounded-lg text-xs">Medium</SelectItem>
            <SelectItem value="low" className="rounded-lg text-xs">Low</SelectItem>
          </SelectContent>
        </Select>

        {/* Telecaller Filter Pill */}
        <Select value={currentAssignedTo} onValueChange={(val) => updateUrlParams({ assigned_to: val })}>
          <SelectTrigger className="h-9 rounded-full bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900/60 text-xs text-slate-750 dark:text-slate-200 transition-colors cursor-pointer">
            <SelectValue placeholder="Telecaller" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all" className="rounded-lg text-xs">All Telecallers</SelectItem>
            <SelectItem value="unassigned" className="rounded-lg text-xs">Unassigned</SelectItem>
            {telecallers.map((t) => (
              <SelectItem key={t.id} value={t.id} className="rounded-lg text-xs">
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${telecallerStatus[t.id] ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-400'}`} />
                  {t.full_name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Source Filter Pill */}
        <Select value={currentSource} onValueChange={(val) => updateUrlParams({ source: val })}>
          <SelectTrigger className="h-9 rounded-full bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900/60 text-xs text-slate-750 dark:text-slate-200 transition-colors cursor-pointer">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all" className="rounded-lg text-xs">All Sources</SelectItem>
            <SelectItem value="website" className="rounded-lg text-xs">Website</SelectItem>
            <SelectItem value="referral" className="rounded-lg text-xs">Referral</SelectItem>
            <SelectItem value="campaign" className="rounded-lg text-xs">Campaign</SelectItem>
            <SelectItem value="cold_call" className="rounded-lg text-xs">Cold Call</SelectItem>
          </SelectContent>
        </Select>

        {/* Date Filter Pill */}
        <div className="relative">
          <Select value={currentDateRange} onValueChange={handleDateRangeChange}>
            <SelectTrigger className={cn("h-9 rounded-full bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900/60 text-xs text-slate-755 dark:text-slate-200 transition-colors cursor-pointer", currentDateRange !== "all" ? "border-blue-500 bg-blue-50/50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900" : "")}>
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                <SelectValue placeholder="Created Date" />
              </div>
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all" className="rounded-lg text-xs">All Time</SelectItem>
              <SelectItem value="today" className="rounded-lg text-xs">Today</SelectItem>
              <SelectItem value="yesterday" className="rounded-lg text-xs">Yesterday</SelectItem>
              <SelectItem value="this_month" className="rounded-lg text-xs">This Month</SelectItem>
              <SelectItem value="custom" className="rounded-lg text-xs">Custom Range</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Expanded Custom Date Picker Drawer */}
      {currentDateRange === "custom" && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900/30 border border-slate-150 dark:border-slate-800/80 rounded-2xl w-full sm:w-fit mt-2 animate-in slide-in-from-top-2 duration-350">
          <div className="flex items-center gap-2">
            <Label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">From:</Label>
            <Input type="date" value={customStart} onChange={(e) => handleCustomDateChange('from', e.target.value)} className="h-8 rounded-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100"/>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">To:</Label>
            <Input type="date" value={customEnd} onChange={(e) => handleCustomDateChange('to', e.target.value)} className="h-8 rounded-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100"/>
          </div>
        </div>
      )}

      {/* Clear Filters Button */}
      {Array.from(searchParams.keys()).length > 0 && (
        <div className="flex justify-end pt-1">
          <Button variant="ghost" onClick={clearFilters} className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 h-7 text-xs rounded-full px-3 hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition-colors">
            <X className="h-3.5 w-3.5 mr-1" /> Clear Filters
          </Button>
        </div>
      )}
    </div>
  )
}

