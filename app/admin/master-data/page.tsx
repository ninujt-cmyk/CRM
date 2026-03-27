"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import ExcelJS from "exceljs" // Replaced XLSX with ExcelJS
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { UploadCloud, CheckCircle2, AlertCircle, Database } from "lucide-react"
import { toast } from "sonner"

export default function MasterDataUploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stats, setStats] = useState({ total: 0, uploaded: 0 })
  const supabase = createClient()

  const handleFileUpload = async () => {
    if (!file) return toast.error("Please select an Excel file first.")
    
    setIsUploading(true)
    setProgress(0)

    try {
      // 1. Get Tenant ID
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user?.id).single()
      if (!profile?.tenant_id) throw new Error("Tenant ID not found")

      // 2. Read File in the Browser
      let rows: any[] = []

      // --- CSV FALLBACK PARSER ---
      if (file.name.toLowerCase().endsWith('.csv')) {
        const text = await file.text();
        // Split text by lines, handle basic CSV
        const lines = text.split('\n').filter(line => line.trim() !== '');
        if (lines.length > 0) {
          const headers = lines[0].split(',').map(h => h.trim());
          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            const rowObject: any = {};
            headers.forEach((h, idx) => {
              rowObject[h] = values[idx] ? values[idx].trim() : '';
            });
            rows.push(rowObject);
          }
        }
      } 
      // --- EXCELJS PARSER (.xlsx) ---
      else {
        const data = await file.arrayBuffer()
        const workbook = new ExcelJS.Workbook()
        await workbook.xlsx.load(data)
        
        const worksheet = workbook.worksheets[0] // Get first sheet
        if (!worksheet) throw new Error("The Excel file is empty or invalid.")

        let headers: string[] = []
        worksheet.eachRow((row, rowNumber) => {
          // ExcelJS uses 1-based indexing for arrays returned in row.values
          const rowValues = row.values as any[];
          
          if (rowNumber === 1) {
            headers = rowValues; // Save headers
          } else {
            const rowObject: any = {};
            rowValues.forEach((val, index) => {
              if (index > 0 && headers[index]) {
                // Handle complex cells (formulas, hyperlinks)
                let finalVal = val;
                if (val && typeof val === 'object') {
                  if ('result' in val) finalVal = val.result; // Formula result
                  else if ('text' in val) finalVal = val.text; // Hyperlink text
                }
                rowObject[headers[index]] = finalVal;
              }
            });
            rows.push(rowObject);
          }
        });
      }

      setStats({ total: rows.length, uploaded: 0 })

      if (rows.length === 0) throw new Error("No data found in the file.")

      // 3. Format Data for the Database
      const formattedData = rows.map(row => {
        // Try to intelligently find company name and pincode columns (adjust these keys based on your usual Excel headers)
        const companyName = row["Company Name"] || row["company_name"] || row["Company"] || row["Name"] || null;
        const pincode = row["Pincode"] || row["pincode"] || row["Pin"] || row["Zip"] || null;

        // Remove them from the 'additional' JSON so we don't duplicate data
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

      // 4. THE MAGIC: Chunked Uploads (1,000 rows at a time)
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
      
    } catch (error: any) {
      console.error("Upload Error:", error)
      toast.error(error.message || "Failed to process the file.")
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
          <Database className="h-8 w-8 text-indigo-600" /> Master Data Import
        </h1>
        <p className="text-slate-500 mt-1">Upload massive Excel directories securely into your high-speed database.</p>
      </div>

      <Card className="shadow-sm border-indigo-100">
        <CardHeader className="bg-indigo-50/50 border-b">
          <CardTitle className="text-lg text-indigo-900">Upload Excel File (.xlsx, .csv)</CardTitle>
          <CardDescription>File should ideally contain "Company Name" and "Pincode" columns for best search results.</CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="space-y-4">
            <Input 
              type="file" 
              accept=".xlsx, .xls, .csv" 
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              disabled={isUploading}
              className="cursor-pointer h-12"
            />
            
            {isUploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-slate-600 font-medium">
                  <span>Uploading... {stats.uploaded.toLocaleString()} / {stats.total.toLocaleString()} rows</span>
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

          {!isUploading && stats.uploaded > 0 && (
            <div className="p-4 bg-emerald-50 text-emerald-800 rounded-lg flex items-center gap-3 border border-emerald-200">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              <div>
                <p className="font-semibold">Upload Complete</p>
                <p className="text-sm text-emerald-600">{stats.uploaded.toLocaleString()} records are now instantly searchable by your agents.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
