"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, MapPin, Building2, FileSpreadsheet, Loader2 } from "lucide-react"
import { searchMasterData } from "@/app/actions/master-data-actions" // Make sure to save the server action you provided earlier here
import { toast } from "sonner"

export default function GlobalSearchPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [searchType, setSearchType] = useState<'company' | 'pincode'>('company')
  const [results, setResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchTerm.trim()) return

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
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
          <Search className="h-8 w-8 text-blue-600" /> Global Directory Search
        </h1>
        <p className="text-slate-500 mt-1">Instantly search through millions of records from uploaded master files.</p>
      </div>

      {/* Search Bar */}
      <Card className="shadow-sm">
        <CardContent className="p-6">
          <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 flex rounded-md shadow-sm">
              <select 
                value={searchType}
                onChange={(e) => setSearchType(e.target.value as 'company' | 'pincode')}
                className="px-4 py-2 border border-r-0 border-slate-300 bg-slate-50 rounded-l-md text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="company">Company Name</option>
                <option value="pincode">Pincode</option>
              </select>
              <Input 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={searchType === 'company' ? "e.g., Hanva Technologies" : "e.g., 560001"}
                className="rounded-l-none h-12 text-lg focus-visible:ring-1"
                autoFocus
              />
            </div>
            <Button type="submit" disabled={isSearching} className="h-12 px-8 bg-blue-600 hover:bg-blue-700">
              {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5 mr-2" />}
              Search Master Data
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Results List */}
      <div className="space-y-4">
        {isSearching && <div className="text-center text-slate-500 py-10">Searching millions of records instantly...</div>}
        
        {!isSearching && hasSearched && results.length === 0 && (
          <div className="text-center py-16 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <p className="text-slate-500 text-lg">No records found for "{searchTerm}".</p>
          </div>
        )}

        {!isSearching && results.map((record, idx) => (
          <Card key={idx} className="shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader className="bg-slate-50/50 border-b pb-4 pt-4">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg text-slate-800 flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-blue-500" />
                    {record.company_name || "Unknown Company"}
                  </CardTitle>
                  <div className="flex items-center gap-3 mt-2 text-sm text-slate-500">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4 text-rose-500" /> Pincode: {record.pincode || "N/A"}
                    </span>
                    <span className="flex items-center gap-1">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-500" /> Source: {record.source_file_name}
                    </span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 bg-white">
              {/* Dynamically render all the extra columns from the Excel file */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Object.entries(record.additional_data || {}).map(([key, value]) => (
                  <div key={key} className="space-y-1">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{key}</p>
                    <p className="text-sm font-medium text-slate-700 truncate" title={String(value)}>
                      {String(value)}
                    </p>
                  </div>
                ))}
                {Object.keys(record.additional_data || {}).length === 0 && (
                  <p className="text-sm text-slate-400 italic">No additional data columns found in source file.</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
