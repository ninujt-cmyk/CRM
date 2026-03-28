"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import * as XLSX from "xlsx"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { UploadCloud, CheckCircle2, Database, Trash2, FileSpreadsheet, Loader2, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { getUploadedFilesSummary, deleteMasterFile } from "@/app/actions/master-data-actions"

export default function MasterDataUploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stats, setStats] = useState({ total: 0, uploaded: 0 })
  
  // File Management State
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([])
  const [isLoadingFiles, setIsLoadingFiles] = useState(true)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  
  const supabase = createClient()

  // Load the list of uploaded files on mount
  const fetchFiles = async () => {
      setIsLoadingFiles(true)
      const res = await getUploadedFilesSummary()
      if (res.success) {
          setUploadedFiles(res.files || [])
      } else {
          toast.error("Failed to load file history.")
      }
      setIsLoadingFiles(false)
  }

  useEffect(() => { fetchFiles() }, [])

  // 🔴 HANDLE FILE DELETION
  const handleDelete = async (fileName: string) => {
      if (!confirm(`Are you absolutely sure you want to delete ALL records from "${fileName}"? This cannot be undone.`)) return;
      
      setIsDeleting(fileName)
      const res = await deleteMasterFile(fileName)
      
      if (res.success) {
          toast.success(res.message)
          fetchFiles() // Refresh the table
      } else {
          toast.error(res.error)
      }
      setIsDeleting(null)
  }

  // 🔴 HANDLE EXCEL UPLOAD (Chunked)
  const handleFileUpload = async () => {
    if (!file) return toast.error("Please select an Excel file first.")
    
    // Prevent duplicate file names so deletion doesn't accidentally delete multiple files
    if (uploadedFiles.some(f => f.file_name === file.name)) {
        return toast.error("A file with this exact name already exists. Please rename your file before uploading.")
    }

    setIsUploading(true)
    setProgress(0)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user?.id).single()
      if (!profile?.tenant_id) throw new Error("Tenant ID not found")

      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data, { type: "array" })
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
      
      const rows: any[] = XLSX.utils.sheet_to_json(firstSheet)
      setStats({ total: rows.length, uploaded: 0 })

      if (rows.length === 0) throw new Error("The Excel file is empty.")

      const formattedData = rows.map(row => {
        const companyName = row["Company Name"] || row["company_name"] || row["Company"] || row["Name"] || null;
        const pincode = row["Pincode"] || row["pincode"] || row["Pin"] || row["Zip"] || null;

        const { ["Company Name"]: _c1, company_name: _c2, Company: _c3, Name: _c4, 
                Pincode: _p1, pincode: _p2, Pin: _p3, Zip: _p4, 
                ...additionalData } = row;

        return {
          tenant_id: profile.tenant_id,
          source_file_name: file.name,
          company_name: companyName ? String(companyName).trim() : null,
          pincode: pincode ? String(pincode).trim() : null,
          additional_data: additionalData
        }
      })

      const CHUNK_SIZE = 1000
      let totalUploaded = 0

      for (let i = 0; i < formattedData.length; i += CHUNK_SIZE) {
        const chunk = formattedData.slice(i, i + CHUNK_SIZE)
        
        const { error } = await supabase.from('tenant_master_data').insert(chunk)
        if (error) throw new Error(`Error inserting chunk: ${error.message}`)

        totalUploaded += chunk.length
        setStats(prev => ({ ...prev, uploaded: totalUploaded }))
        setProgress(Math.round((totalUploaded / formattedData.length) * 100))
      }

      toast.success(`Successfully uploaded ${totalUploaded} records!`)
      setFile(null)
      fetchFiles() // Refresh the table so the new file appears instantly!
      
    } catch (error: any) {
      console.error("Upload Error:", error)
      toast.error(error.message || "Failed to process the Excel file.")
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
          <Database className="h-8 w-8 text-indigo-600" /> Master Data Management
        </h1>
        <p className="text-slate-500 mt-1">Upload new directories or purge old files from your global search index.</p>
      </div>

      {/* 🔴 UPLOAD CARD */}
      <Card className="shadow-sm border-indigo-100">
        <CardHeader className="bg-indigo-50/50 border-b">
          <CardTitle className="text-lg text-indigo-900">Import New Excel Directory</CardTitle>
          <CardDescription>File should ideally contain "Company Name" and "Pincode" columns.</CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="space-y-4">
            <Input 
              type="file" 
              accept=".xlsx, .xls, .csv" 
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              disabled={isUploading}
              className="cursor-pointer h-12 bg-white"
            />
            
            {isUploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-slate-600 font-medium">
                  <span>Uploading to Database... {stats.uploaded.toLocaleString()} / {stats.total.toLocaleString()} rows</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-2 bg-indigo-100" />
              </div>
            )}

            <Button 
              onClick={handleFileUpload} 
              disabled={!file || isUploading} 
              className="w-full bg-indigo-600 hover:bg-indigo-700 h-12 text-lg"
            >
              {isUploading ? (
                <><UploadCloud className="w-5 h-5 mr-2 animate-bounce"/> Processing...</>
              ) : (
                <><UploadCloud className="w-5 h-5 mr-2"/> Upload & Index Data</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 🔴 FILE MANAGEMENT TABLE */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="bg-slate-50 border-b pb-4 pt-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-slate-600" /> Active Master Files
          </CardTitle>
          <CardDescription>These files are currently indexed and searchable by your agents.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-100/50">
              <TableRow>
                <TableHead>File Name</TableHead>
                <TableHead className="text-center">Total Records</TableHead>
                <TableHead>Upload Date</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingFiles && (
                  <TableRow><TableCell colSpan={4} className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-500"/></TableCell></TableRow>
              )}
              
              {!isLoadingFiles && uploadedFiles.map((f, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium text-slate-700">{f.file_name}</TableCell>
                  <TableCell className="text-center font-mono font-semibold text-slate-600">
                      {f.row_count.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">
                      {new Date(f.upload_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleDelete(f.file_name)}
                        disabled={isDeleting === f.file_name}
                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all"
                    >
                        {isDeleting === f.file_name ? <Loader2 className="w-4 h-4 animate-spin"/> : <Trash2 className="w-4 h-4 mr-2"/>}
                        {isDeleting === f.file_name ? "Purging..." : "Purge Data"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}

              {!isLoadingFiles && uploadedFiles.length === 0 && (
                  <TableRow>
                      <TableCell colSpan={4} className="text-center py-10 text-slate-400 flex flex-col items-center justify-center gap-2">
                          <AlertCircle className="w-8 h-8 opacity-20" />
                          No master data files uploaded yet.
                      </TableCell>
                  </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

    </div>
  )
}
