"use client"

import { useState, useMemo } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ArrowUpDown, Search, SlidersHorizontal, Layers, LayoutGrid } from "lucide-react"
import { DrillDownSheet } from "@/components/admin/drill-down-sheet"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

// --- Helper for Heatmap ---
const getCellColor = (value: number, max: number) => {
  if (value === 0) return "";
  const intensity = Math.min((value / max) * 100, 100); 
  return `rgba(16, 185, 129, ${intensity * 0.005 + 0.05})`; 
};

// --- FUNNEL CONFIGURATION ---
const FUNNEL_GROUPS = {
  "Untouched": ["new"],
  "In Progress": ["contacted", "Interested", "Documents_Sent", "Login", "follow_up", "self_employed"],
  "Won": ["Disbursed"],
  "Lost": ["nr", "Not_Interested", "not_eligible"]
};

// Colors for Funnel Columns
const FUNNEL_COLORS = {
  "Untouched": "text-slate-500",
  "In Progress": "text-blue-600 bg-blue-50/30",
  "Won": "text-green-700 bg-green-50/50",
  "Lost": "text-red-400"
};

interface TelecallerTableProps {
  data: any[];
  grandTotals: any;
  statuses: string[];
}

export function TelecallerTable({ data, grandTotals, statuses }: TelecallerTableProps) {
  // State
  const [viewMode, setViewMode] = useState<"detailed" | "funnel">("funnel"); // Default to clean Funnel view
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({ key: 'totalLeads', direction: 'desc' });
  const [searchTerm, setSearchTerm] = useState("");
  const [visibleStatuses, setVisibleStatuses] = useState<Set<string>>(new Set(statuses));

  // 1. Data Processing
  const processedData = useMemo(() => {
    // Basic Filter
    const filtered = data.filter(agent => 
      agent.telecallerName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Calculate Funnel Groups if needed
    return filtered.map(agent => {
      const funnelStats: Record<string, number> = { "Untouched": 0, "In Progress": 0, "Won": 0, "Lost": 0 };
      
      Object.entries(FUNNEL_GROUPS).forEach(([groupName, groupStatuses]) => {
        funnelStats[groupName] = groupStatuses.reduce((acc, status) => acc + (agent.statusCounts[status] || 0), 0);
      });

      return { ...agent, funnelStats };
    });
  }, [data, searchTerm]);

  // 2. Sort Logic
  const sortedData = useMemo(() => {
    if (!sortConfig) return processedData;

    return [...processedData].sort((a, b) => {
      let aValue, bValue;

      if (sortConfig.key === 'name') {
        aValue = a.telecallerName; bValue = b.telecallerName;
      } else if (sortConfig.key === 'totalLeads') {
        aValue = a.totalLeads; bValue = b.totalLeads;
      } else if (sortConfig.key === 'conversion') {
        aValue = a.conversionRate; bValue = b.conversionRate;
      } else if (viewMode === 'funnel') {
        // Sort by Funnel Group
        aValue = a.funnelStats[sortConfig.key] || 0;
        bValue = b.funnelStats[sortConfig.key] || 0;
      } else {
        // Sort by Specific Status
        aValue = a.statusCounts[sortConfig.key] || 0;
        bValue = b.statusCounts[sortConfig.key] || 0;
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [processedData, sortConfig, viewMode]);

  const handleSort = (key: string) => {
    setSortConfig(current => ({
      key,
      direction: current?.key === key && current.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const toggleColumn = (status: string) => {
    const next = new Set(visibleStatuses);
    if (next.has(status)) next.delete(status);
    else next.add(status);
    setVisibleStatuses(next);
  };

  // Dynamic max value for heatmap
  const maxCellValue = useMemo(() => {
    if (viewMode === 'funnel') {
      return Math.max(...processedData.map(t => Math.max(...Object.values(t.funnelStats as Record<string, number>))));
    }
    return Math.max(...processedData.map(t => Math.max(...Object.values(t.statusCounts as Record<string, number>))));
  }, [processedData, viewMode]);

  return (
    <div className="space-y-4">
      {/* TOOLBAR */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-3 rounded-md border border-gray-100 shadow-sm">
        
        {/* Search & View Toggle */}
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <Input 
              placeholder="Search agent..." 
              className="pl-9 h-9 bg-gray-50 border-gray-200 focus:bg-white transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <Tabs value={viewMode} onValueChange={(v:any) => setViewMode(v)} className="w-full sm:w-auto">
            <TabsList className="h-9 w-full sm:w-auto grid grid-cols-2">
              <TabsTrigger value="funnel" className="text-xs gap-2"><Layers className="h-3 w-3"/> Funnel View</TabsTrigger>
              <TabsTrigger value="detailed" className="text-xs gap-2"><LayoutGrid className="h-3 w-3"/> Detailed</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        
        {/* Column Filters (Only for Detailed Mode) */}
        {viewMode === 'detailed' && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-2 ml-auto">
                <SlidersHorizontal className="h-4 w-4" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 max-h-[300px] overflow-y-auto">
              {statuses.map((status) => (
                <DropdownMenuCheckboxItem 
                  key={status} 
                  checked={visibleStatuses.has(status)}
                  onCheckedChange={() => toggleColumn(status)}
                  className="capitalize"
                >
                  {status.replace(/_/g, " ")}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* TABLE */}
      <div className="rounded-md border overflow-x-auto bg-white dark:bg-slate-900 shadow-sm max-w-full">
        <Table className={cn("transition-all duration-300", viewMode === 'detailed' ? "min-w-[1200px]" : "min-w-full")}>
          <TableHeader>
            <TableRow className="bg-gray-50 dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-900 text-xs uppercase tracking-wider">
              <TableHead className="w-[180px] pl-4 sticky left-0 bg-gray-50 dark:bg-slate-900 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] border-r border-slate-100 dark:border-slate-800">
                <Button variant="ghost" onClick={() => handleSort('name')} className="h-8 -ml-4 font-bold text-gray-700 dark:text-slate-200 hover:bg-transparent">
                  Telecaller <ArrowUpDown className="ml-2 h-3 w-3 opacity-50" />
                </Button>
              </TableHead>
              <TableHead className="text-right">
                <Button variant="ghost" onClick={() => handleSort('totalLeads')} className="h-8 font-bold text-gray-900 dark:text-slate-100 hover:bg-transparent">
                  Total <ArrowUpDown className="ml-2 h-3 w-3 opacity-50" />
                </Button>
              </TableHead>
              <TableHead className="text-right">
                <Button variant="ghost" onClick={() => handleSort('conversion')} className="h-8 font-bold text-blue-700 dark:text-blue-400 hover:bg-transparent">
                  Conv. % <ArrowUpDown className="ml-2 h-3 w-3 opacity-50" />
                </Button>
              </TableHead>

              {/* DYNAMIC HEADERS BASED ON VIEW MODE */}
              {viewMode === 'funnel' ? (
                Object.keys(FUNNEL_GROUPS).map((group) => (
                  <TableHead key={group} className="text-right">
                    <Button variant="ghost" onClick={() => handleSort(group)} className={`h-8 font-bold ${FUNNEL_COLORS[group as keyof typeof FUNNEL_COLORS].split(' ')[0]} hover:bg-transparent`}>
                      {group} <ArrowUpDown className="ml-2 h-3 w-3 opacity-50" />
                    </Button>
                  </TableHead>
                ))
              ) : (
                statuses.map((status) => {
                  if (!visibleStatuses.has(status)) return null;
                  return (
                    <TableHead key={status} className="text-right">
                      <Button variant="ghost" onClick={() => handleSort(status)} className="h-8 font-bold text-gray-600 dark:text-slate-400 capitalize hover:bg-transparent">
                        {status.replace(/_/g, " ")} <ArrowUpDown className="ml-2 h-3 w-3 opacity-50" />
                      </Button>
                    </TableHead>
                  );
                })
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.map((telecaller) => (
              <TableRow key={telecaller.telecallerId} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                <TableCell className="font-medium text-gray-900 dark:text-slate-100 sticky left-0 bg-white dark:bg-slate-950 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] border-r border-slate-100 dark:border-slate-800 pl-4">
                  {telecaller.telecallerName}
                </TableCell>
                <TableCell className="text-right font-bold text-gray-900 dark:text-slate-100 bg-gray-50/50 dark:bg-slate-900/30">
                  {telecaller.totalLeads}
                </TableCell>
                <TableCell className="text-right font-bold text-blue-600 dark:text-blue-400 bg-blue-50/20 dark:bg-blue-950/10">
                  {telecaller.conversionRate.toFixed(1)}%
                </TableCell>

                {/* DYNAMIC BODY CELLS */}
                {viewMode === 'funnel' ? (
                  Object.keys(FUNNEL_GROUPS).map((group) => {
                    const count = telecaller.funnelStats[group];
                    return (
                      <TableCell key={group} className={`text-right font-medium p-2 ${FUNNEL_COLORS[group as keyof typeof FUNNEL_COLORS]}`}>
                        {count > 0 ? count : "-"}
                      </TableCell>
                    )
                  })
                ) : (
                  statuses.map((status) => {
                    if (!visibleStatuses.has(status)) return null;
                    const count = telecaller.statusCounts[status] || 0;
                    return (
                      <TableCell key={status} className="text-right text-gray-700 dark:text-slate-300 p-2" style={{ backgroundColor: getCellColor(count, maxCellValue) }}>
                        <DrillDownSheet agentId={telecaller.telecallerId} agentName={telecaller.telecallerName} status={status} count={count} />
                      </TableCell>
                    );
                  })
                )}
              </TableRow>
            ))}
            {sortedData.length === 0 && (
                <TableRow>
                    <TableCell colSpan={viewMode === 'funnel' ? 7 : statuses.length + 3} className="h-32 text-center text-gray-500">
                        No agents found matching &quot;{searchTerm}&quot;
                    </TableCell>
                </TableRow>
            )}
          </TableBody>
          
          {/* FOOTER */}
          <TableFooter className="bg-slate-900 dark:bg-slate-950 text-white hover:bg-slate-900 dark:hover:bg-slate-950 font-bold">
            <TableRow>
              <TableCell className="pl-4 sticky left-0 bg-slate-900 dark:bg-slate-950 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] border-r border-slate-800">Grand Total</TableCell>
              <TableCell className="text-right">{grandTotals['total'].toLocaleString()}</TableCell>
              <TableCell className="text-right text-blue-300">
                {grandTotals['total'] > 0 ? ((grandTotals['Disbursed'] / grandTotals['total']) * 100).toFixed(1) + "%" : "0%"}
              </TableCell>
              
              {viewMode === 'funnel' ? (
                 Object.entries(FUNNEL_GROUPS).map(([group, groupStatuses]) => {
                   const sum = groupStatuses.reduce((acc, s) => acc + (grandTotals[s] || 0), 0);
                   return <TableCell key={group} className="text-right">{sum.toLocaleString()}</TableCell>
                 })
              ) : (
                statuses.map(status => {
                  if (!visibleStatuses.has(status)) return null;
                  return <TableCell key={status} className="text-right">{grandTotals[status].toLocaleString()}</TableCell>
                })
              )}
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  );
}
