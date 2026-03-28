"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, MapPin, Building2, FileSpreadsheet, Loader2, UserPlus } from "lucide-react"
import { searchMasterData } from "@/app/actions/master-data-actions"
import { toast } from "sonner"

export default function GlobalSearchPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [searchType, setSearchType] = useState<'company' | 'pincode'>('company')
  const [results, setResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  // 🔴 THE FIX: Debounce function to protect the database
  // This ensures we don't search 2 Lakh rows on every single keystroke
  useEffect(() => {
    // Don't trigger if empty or less than 3 characters (saves unnecessary DB load)
    if (!searchTerm.trim() || searchTerm.trim().length < 3) {
        setResults([]);
        setHasSearched(false);
        return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true)
      setHasSearched(true)
      
      try {
        const res = await searchMasterData(searchTerm, searchType)
        if (res.success) {
          setResults(res.data || [])
        } else {
          toast.error(res.error)
        }
      } catch (error) {
        toast.error("Search failed.")
      } finally {
        setIsSearching(false)
      }
    }, 400) // Waits 400ms after the user stops typing

    return () => clearTimeout(delayDebounceFn)
  }, [searchTerm, searchType])

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
          <Search className="h-8 w-8 text-blue-600" /> Global Directory Search
        </h1>
        <p className="text-slate-500 mt-1">Searching through 200,000+ records in milliseconds.</p>
      </div>

      <Card className="shadow-sm border-blue-100">
        <CardContent className="p-6 bg-blue-50/30">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 flex rounded-md shadow-sm bg-white border border-slate-300 focus-within:ring-2 focus-within:ring-blue-500 overflow-hidden">
              <select 
                value={searchType}
                onChange={(e) => setSearchType(e.target.value as 'company' | 'pincode')}
                className="px-4 py-3 border-r border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700 outline-none cursor-pointer"
              >
                <option value="company">Company Name</option>
                <option value="pincode">Pincode</option>
              </select>
              <Input 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={searchType === 'company' ? "Type at least 3 letters (e.g. Hanva)" : "Enter Pincode (e.g. 560001)"}
                className="border-0 ring-0 focus-visible:ring-0 h-12 text-lg shadow-none"
                autoFocus
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {isSearching && (
            <div className="flex items-center justify-center text-blue-600 py-10 gap-3 font-medium">
                <Loader2 className="w-6 h-6 animate-spin" /> Scanning Master Database...
            </div>
        )}
        
        {!isSearching && hasSearched && results.length === 0 && searchTerm.length >= 3 && (
          <div className="text-center py-16 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <p className="text-slate-500 text-lg">No records found for "{searchTerm}".</p>
          </div>
        )}

        {!isSearching && results.map((record, idx) => (
          <Card key={idx} className="shadow-sm hover:shadow-md transition-shadow duration-200 border-slate-200">
            <CardHeader className="bg-slate-50/50 border-b pb-4 pt-4">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg text-slate-800 flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-blue-500" />
                    {record.company_name || "Unknown Company"}
                  </CardTitle>
                  <div className="flex items-center gap-4 mt-2 text-xs font-medium text-slate-500">
                    <span className="flex items-center gap-1 bg-white px-2 py-1 rounded border border-slate-200 shadow-sm">
                      <MapPin className="w-3 h-3 text-rose-500" /> Pincode: {record.pincode || "N/A"}
                    </span>
                    <span className="flex items-center gap-1 bg-white px-2 py-1 rounded border border-slate-200 shadow-sm">
                      <FileSpreadsheet className="w-3 h-3 text-emerald-500" /> {record.source_file_name}
                    </span>
                  </div>
                </div>
                
                {/* 🔴 Added quick-action button for the agent */}
                <Button variant="outline" className="text-blue-700 border-blue-200 hover:bg-blue-50 h-9 text-xs">
                    <UserPlus className="w-3 h-3 mr-2" /> Save as Lead
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 bg-white">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(record.additional_data || {}).map(([key, value]) => (
                  <div key={key} className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{key}</p>
                    <p className="text-sm font-medium text-slate-700 truncate" title={String(value)}>
                      {String(value)}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
