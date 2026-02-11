"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  DropdownMenu, 
  DropdownMenuCheckboxItem, 
  DropdownMenuContent, 
  DropdownMenuLabel, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { Search, X, ChevronDown } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"

interface ReportsFiltersProps {
  telecallers: Array<{ id: string; full_name: string }>
  defaultStartDate: string
  defaultEndDate: string
}

export function ReportsFilters({ telecallers, defaultStartDate, defaultEndDate }: ReportsFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [startDate, setStartDate] = useState(defaultStartDate)
  const [endDate, setEndDate] = useState(defaultEndDate)
  
  // Initialize selected telecallers from URL params (comma separated)
  const [selectedTelecallers, setSelectedTelecallers] = useState<string[]>(() => {
    const param = searchParams.get("telecaller")
    if (!param || param === "all") return []
    return param.split(",")
  })

  const [telecallerStatus, setTelecallerStatus] = useState<Record<string, boolean>>({})

  // Fetch telecaller status
  useEffect(() => {
    const fetchTelecallerStatus = async () => {
      try {
        const today = new Date().toISOString().split('T')[0]
        const { data: attendanceRecords } = await supabase
          .from("attendance")
          .select("user_id, check_in")
          .eq("date", today)
        
        if (attendanceRecords) {
          // Create a map of telecaller ID to checked-in status
          const statusMap: Record<string, boolean> = {}
          attendanceRecords.forEach(record => {
            statusMap[record.user_id] = !!record.check_in
          })
          setTelecallerStatus(statusMap)
        }
      } catch (err) {
        console.error("Error fetching telecaller status:", err)
      }
    }

    fetchTelecallerStatus()
  }, [supabase])

  const applyFilters = () => {
    const params = new URLSearchParams()
    if (startDate) params.set("start_date", startDate)
    if (endDate) params.set("end_date", endDate)
    
    // Join selected IDs with commas, or don't set param if empty (implies 'all')
    if (selectedTelecallers.length > 0) {
      params.set("telecaller", selectedTelecallers.join(","))
    }

    router.push(`/admin/reports?${params.toString()}`)
  }

  const clearFilters = () => {
    const today = new Date().toISOString().split("T")[0]
    const thirtyDaysAgo = new Date().toISOString().split("T")[0]

    setStartDate(today)
    setEndDate(today)
    setSelectedTelecallers([]) // Clear selection
    router.push("/admin/reports")
  }

  const setQuickRange = (days: number) => {
    const today = new Date().toISOString().split("T")[0]
    const pastDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0]

    setStartDate(pastDate)
    setEndDate(today)
  }

  const toggleTelecaller = (id: string) => {
    setSelectedTelecallers(prev => 
      prev.includes(id) 
        ? prev.filter(prevId => prevId !== id)
        : [...prev, id]
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <Label htmlFor="start-date">Start Date</Label>
          <Input id="start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>

        <div>
          <Label htmlFor="end-date">End Date</Label>
          <Input id="end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>

        <div>
          <Label>Telecallers</Label>
          <DropdownMenu>
            {/* Removed asChild and added w-full to the Trigger wrapper. */}
            <DropdownMenuTrigger className="w-full">
              {/* Added pointer-events-none to the inner Button so the surrounding 
                  Trigger element can handle the click. */}
              <Button variant="outline" className="w-full justify-between font-normal pointer-events-none">
                {selectedTelecallers.length === 0 ? (
                  <span className="text-muted-foreground">All Telecallers</span>
                ) : selectedTelecallers.length === 1 ? (
                  <span className="truncate">
                    {telecallers.find(t => t.id === selectedTelecallers[0])?.full_name}
                  </span>
                ) : (
                  <span>{selectedTelecallers.length} Selected</span>
                )}
                <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[250px]" align="start">
              <DropdownMenuLabel>Filter by Telecaller</DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              {/* Option to clear selection (Show All) */}
              <DropdownMenuItem
                onClick={() => setSelectedTelecallers([])}
                className="cursor-pointer font-medium text-primary hover:bg-muted"
                disabled={selectedTelecallers.length === 0}
              >
                Clear Selection (Show All)
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              
              <div className="max-h-[300px] overflow-y-auto">
                {telecallers.map((tc) => (
                  <DropdownMenuCheckboxItem
                    key={tc.id}
                    checked={selectedTelecallers.includes(tc.id)}
                    onCheckedChange={() => toggleTelecaller(tc.id)}
                  >
                    <div className="flex items-center gap-2">
                      {/* Status indicator for telecaller */}
                      <div 
                        className={`w-2 h-2 rounded-full ${telecallerStatus[tc.id] ? 'bg-green-500' : 'bg-red-500'}`} 
                        title={telecallerStatus[tc.id] ? 'Checked in' : 'Not checked in'} 
                      />
                      {tc.full_name}
                    </div>
                  </DropdownMenuCheckboxItem>
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-end gap-2">
          <Button onClick={applyFilters} className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Apply
          </Button>
          <Button variant="outline" onClick={clearFilters} className="flex items-center gap-2 bg-transparent">
            <X className="h-4 w-4" />
            Clear
          </Button>
        </div>
      </div>

      {/* Quick Date Ranges */}
      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => setQuickRange(7)} className="bg-transparent">
          Last 7 days
        </Button>
        <Button variant="outline" size="sm" onClick={() => setQuickRange(30)} className="bg-transparent">
          Last 30 days
        </Button>
        <Button variant="outline" size="sm" onClick={() => setQuickRange(90)} className="bg-transparent">
          Last 90 days
        </Button>
        <Button variant="outline" size="sm" onClick={() => setQuickRange(365)} className="bg-transparent">
          Last year
        </Button>
      </div>
    </div>
  )
}
