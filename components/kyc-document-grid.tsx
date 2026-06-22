"use client"

import { useState } from "react"
import { FileText, FileImage, ShieldAlert, ShieldCheck, Clock, Download, ExternalLink, MoreVertical } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

// Mock Data
const MOCK_DOCS = [
  { id: 1, leadName: "Rohan Sharma", type: "Aadhar Card", fileType: "pdf", status: "verified", date: "2026-06-20", size: "2.4 MB" },
  { id: 2, leadName: "Rohan Sharma", type: "PAN Card", fileType: "image", status: "pending", date: "2026-06-21", size: "1.1 MB" },
  { id: 3, leadName: "Sneha Patel", type: "Booking Cheque", fileType: "image", status: "verified", date: "2026-06-19", size: "3.5 MB" },
  { id: 4, leadName: "Amit Kumar", type: "Builder Agreement", fileType: "pdf", status: "rejected", date: "2026-06-18", size: "12.4 MB" },
  { id: 5, leadName: "Priya Singh", type: "Aadhar Card", fileType: "pdf", status: "verified", date: "2026-06-15", size: "1.8 MB" },
  { id: 6, leadName: "Priya Singh", type: "Bank Statement", fileType: "pdf", status: "pending", date: "2026-06-15", size: "5.2 MB" },
]

export function KycDocumentGrid() {
  const [docs, setDocs] = useState(MOCK_DOCS)

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "verified":
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-0 flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Verified</Badge>
      case "pending":
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-0 flex items-center gap-1"><Clock className="h-3 w-3" /> Pending Review</Badge>
      case "rejected":
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-200 border-0 flex items-center gap-1"><ShieldAlert className="h-3 w-3" /> Rejected</Badge>
    }
  }

  const getFileIcon = (fileType: string) => {
    if (fileType === "pdf") return <FileText className="h-10 w-10 text-red-500" />
    return <FileImage className="h-10 w-10 text-blue-500" />
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
      {docs.map((doc) => (
        <Card key={doc.id} className="overflow-hidden border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 group hover:shadow-md transition-all duration-300">
          
          {/* Document Preview Area (Mocked with gray box and icon) */}
          <div className="h-40 bg-slate-100 dark:bg-slate-800/50 flex flex-col items-center justify-center relative">
            {getFileIcon(doc.fileType)}
            <div className="absolute top-3 right-3">
                {getStatusBadge(doc.status)}
            </div>
            
            {/* Hover Actions */}
            <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-sm">
                <Button size="icon" variant="secondary" className="h-9 w-9 rounded-full bg-white text-slate-900 hover:bg-slate-200"><ExternalLink className="h-4 w-4" /></Button>
                <Button size="icon" variant="secondary" className="h-9 w-9 rounded-full bg-white text-slate-900 hover:bg-slate-200"><Download className="h-4 w-4" /></Button>
            </div>
          </div>

          {/* Details Area */}
          <CardContent className="p-4">
            <div className="flex justify-between items-start mb-2">
                <div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-100">{doc.type}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{doc.leadName}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 text-slate-400"><MoreVertical className="h-4 w-4" /></Button>
            </div>
            
            <div className="flex justify-between items-center text-xs text-slate-400 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <span>{doc.date}</span>
                <span>{doc.size}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
