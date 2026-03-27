"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FileText, Download, Trash2, UploadCloud, Loader2, File, FolderOpen } from "lucide-react"
import { toast } from "sonner"

export default function TenantDocumentsPage() {
  const [documents, setDocuments] = useState<any[]>([])
  const [userRole, setUserRole] = useState<string>("agent")
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  
  const [isUploading, setIsUploading] = useState(false)
  const [title, setTitle] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  const fetchData = async () => {
    setLoading(true)
    
    // 1. Get User Details & Role
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
        setUserId(user.id)
        const { data: profile } = await supabase.from('users').select('role, tenant_id').eq('id', user.id).single()
        if (profile) {
            setUserRole(profile.role)
            setTenantId(profile.tenant_id)
        }
    }

    // 2. Fetch Documents (RLS automatically filters for their tenant!)
    const { data: docs } = await supabase.from('tenant_documents').select('*').order('created_at', { ascending: false })
    if (docs) setDocuments(docs)
    
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const handleUpload = async () => {
    if (!file || !title || !tenantId || !userId) return toast.error("Please provide a title and select a PDF file.")
    if (file.type !== "application/pdf") return toast.error("Only PDF files are allowed.")
    if (file.size > 10 * 1024 * 1024) return toast.error("File size must be less than 10MB.")

    setIsUploading(true)
    try {
        // 1. Create a secure, unique file path: tenant_id/timestamp_filename.pdf
        const fileExt = file.name.split('.').pop()
        const safeFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '')
        const filePath = `${tenantId}/${Date.now()}_${safeFileName}`

        // 2. Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
            .from('tenant_documents')
            .upload(filePath, file)

        if (uploadError) throw uploadError

        // 3. Save to Database
        const { error: dbError } = await supabase.from('tenant_documents').insert({
            tenant_id: tenantId,
            title: title,
            file_name: file.name,
            file_path: filePath,
            file_size_kb: Math.round(file.size / 1024),
            uploaded_by: userId
        })

        if (dbError) throw dbError

        toast.success("Document uploaded successfully!")
        setTitle("")
        setFile(null)
        // Reset file input visually
        const fileInput = document.getElementById('file-upload') as HTMLInputElement
        if (fileInput) fileInput.value = ""
        
        fetchData() // Refresh list

    } catch (error: any) {
        console.error("Upload Error:", error)
        toast.error(error.message || "Failed to upload document.")
    } finally {
        setIsUploading(false)
    }
  }

  const handleDelete = async (id: string, filePath: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return

    try {
        // 1. Delete from Storage
        await supabase.storage.from('tenant_documents').remove([filePath])
        
        // 2. Delete from Database
        const { error } = await supabase.from('tenant_documents').delete().eq('id', id)
        if (error) throw error

        toast.success("Document deleted.")
        setDocuments(documents.filter(d => d.id !== id))
    } catch (error: any) {
        toast.error("Failed to delete document.")
    }
  }

  const getFileUrl = (filePath: string) => {
    const { data } = supabase.storage.from('tenant_documents').getPublicUrl(filePath)
    return data.publicUrl
  }

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>

  const isAdmin = ['admin', 'manager', 'super_admin'].includes(userRole)

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      
      <div>
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
          <FolderOpen className="h-8 w-8 text-blue-600" /> Company Resources
        </h1>
        <p className="text-slate-500 mt-1">Access training materials, policy documents, and scripts.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* UPLOAD PANEL (ONLY VISIBLE TO ADMINS & MANAGERS) */}
        {isAdmin && (
            <div className="md:col-span-1">
            <Card className="shadow-sm border-blue-100 bg-blue-50/30">
                <CardHeader className="border-b bg-white rounded-t-xl">
                <CardTitle className="text-lg text-blue-900">Upload Document</CardTitle>
                <CardDescription>Upload PDFs for your team to access.</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-5">
                
                <div className="space-y-2">
                    <Label>Document Title</Label>
                    <Input placeholder="e.g. Sales Script V2" value={title} onChange={e=>setTitle(e.target.value)} className="bg-white" />
                </div>

                <div className="space-y-2">
                    <Label className="flex items-center gap-2"><File className="w-4 h-4 text-slate-400"/> PDF File</Label>
                    <Input id="file-upload" type="file" accept="application/pdf" onChange={e => setFile(e.target.files?.[0] || null)} className="cursor-pointer bg-white" />
                    <p className="text-[10px] text-slate-500">Max size 10MB. PDF only.</p>
                </div>

                <Button onClick={handleUpload} disabled={isUploading || !file || !title} className="w-full bg-blue-600 hover:bg-blue-700">
                    {isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <UploadCloud className="w-4 h-4 mr-2"/>}
                    {isUploading ? "Uploading..." : "Upload Resource"}
                </Button>
                </CardContent>
            </Card>
            </div>
        )}

        {/* DOCUMENTS LIST */}
        <div className={isAdmin ? "md:col-span-2" : "md:col-span-3"}>
          <Card className="shadow-sm h-full">
            <CardHeader className="bg-slate-50 border-b">
              <CardTitle className="text-lg">Available Documents</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead className="text-center">Size</TableHead>
                    <TableHead className="text-center">Date Added</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                   {documents.map(doc => (
                       <TableRow key={doc.id}>
                           <TableCell>
                               <div className="flex items-center gap-3">
                                   <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                                       <FileText className="w-4 h-4" />
                                   </div>
                                   <div>
                                       <p className="font-medium text-slate-800">{doc.title}</p>
                                       <p className="text-[10px] text-slate-400 truncate max-w-[200px]">{doc.file_name}</p>
                                   </div>
                               </div>
                           </TableCell>
                           <TableCell className="text-center text-xs text-slate-500">{doc.file_size_kb} KB</TableCell>
                           <TableCell className="text-center text-xs text-slate-500">
                               {new Date(doc.created_at).toLocaleDateString()}
                           </TableCell>
                           <TableCell className="text-right space-x-2">
                               <Button variant="outline" size="sm" className="text-blue-600 border-blue-200 hover:bg-blue-50" asChild>
                                   <a href={getFileUrl(doc.file_path)} target="_blank" rel="noopener noreferrer">
                                       <Download className="w-4 h-4 mr-1"/> View
                                   </a>
                               </Button>
                               
                               {/* DELETE BUTTON (ONLY ADMINS) */}
                               {isAdmin && (
                                   <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-50 hover:text-red-700" onClick={() => handleDelete(doc.id, doc.file_path)}>
                                       <Trash2 className="w-4 h-4"/>
                                   </Button>
                               )}
                           </TableCell>
                       </TableRow>
                   ))}
                   {documents.length === 0 && (
                       <TableRow>
                           <TableCell colSpan={4} className="text-center py-12 text-slate-400">
                               <FolderOpen className="w-8 h-8 mx-auto mb-3 opacity-20" />
                               No resources have been uploaded yet.
                           </TableCell>
                       </TableRow>
                   )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  )
}
