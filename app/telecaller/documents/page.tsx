"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FileText, Download, Loader2, FolderOpen } from "lucide-react"

export default function TelecallerDocumentsPage() {
  const [documents, setDocuments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      
      // Because of Row Level Security (RLS), this simple query automatically 
      // filters out documents from other companies!
      const { data: docs } = await supabase
        .from('tenant_documents')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (docs) setDocuments(docs)
      setLoading(false)
    }
    fetchData()
  }, [supabase])

  const getFileUrl = (filePath: string) => {
    const { data } = supabase.storage.from('tenant_documents').getPublicUrl(filePath)
    return data.publicUrl
  }

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      
      <div>
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
          <FolderOpen className="h-8 w-8 text-blue-600" /> Company Resources
        </h1>
        <p className="text-slate-500 mt-2 text-sm">
          Access training materials, policy documents, and calling scripts provided by your manager.
        </p>
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardHeader className="bg-slate-50 border-b">
          <CardTitle className="text-lg">Available Documents</CardTitle>
          <CardDescription>Click to view or download a file.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-100">
              <TableRow>
                <TableHead>Document Name</TableHead>
                <TableHead className="text-center">Size</TableHead>
                <TableHead className="text-center">Date Added</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                {documents.map(doc => (
                    <TableRow key={doc.id} className="hover:bg-slate-50/50 transition-colors">
                        <TableCell>
                            <div className="flex items-center gap-4">
                                <div className="p-2.5 bg-red-100 text-red-600 rounded-xl shadow-sm border border-red-200">
                                    <FileText className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-800">{doc.title}</p>
                                    <p className="text-xs text-slate-400 truncate max-w-[250px]">{doc.file_name}</p>
                                </div>
                            </div>
                        </TableCell>
                        <TableCell className="text-center font-mono text-sm text-slate-500">
                            {doc.file_size_kb} KB
                        </TableCell>
                        <TableCell className="text-center text-sm text-slate-500">
                            {new Date(doc.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                        </TableCell>
                        <TableCell className="text-right">
                            <Button variant="outline" size="sm" className="text-blue-700 border-blue-200 hover:bg-blue-50" asChild>
                                <a href={getFileUrl(doc.file_path)} target="_blank" rel="noopener noreferrer">
                                    <Download className="w-4 h-4 mr-2"/> View File
                                </a>
                            </Button>
                        </TableCell>
                    </TableRow>
                ))}
                
                {documents.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={4} className="text-center py-20">
                            <FolderOpen className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                            <p className="text-base font-medium text-slate-700">No resources available</p>
                            <p className="text-sm text-slate-500 mt-1">Your manager hasn't uploaded any documents yet.</p>
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
