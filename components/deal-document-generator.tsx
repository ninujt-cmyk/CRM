"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { FileText, Download, Mail, Copy, Check } from "lucide-react"

interface DealDocumentGeneratorProps {
  isOpen: boolean
  onClose: () => void
  deal: any
}

export function DealDocumentGenerator({ isOpen, onClose, deal }: DealDocumentGeneratorProps) {
  const [copied, setCopied] = useState(false)
  const [docType, setDocType] = useState<"offer" | "receipt" | "site_visit">("offer")

  if (!isOpen || !deal) return null

  const getTemplate = () => {
    const today = new Date().toLocaleDateString()
    const amount = Number(deal.amount || 0).toLocaleString()

    if (docType === "offer") {
      return `OFFER LETTER

Date: ${today}

To: ${deal.lead?.name || "Client"}
Email: ${deal.lead?.email || "N/A"}
Phone: ${deal.lead?.phone || "N/A"}

Property Details:
${deal.property?.title || "TBD"}
Location: ${deal.property?.location || "TBD"}

Financial Details:
Agreed Price: ₹${amount}
Expected Commission: ₹${Number(deal.expected_commission || 0).toLocaleString()}

Terms & Conditions:
1. This offer is valid for 7 days from the date of issue.
2. Subject to final contract signing.

Best Regards,
The Real Estate Team`
    } else if (docType === "receipt") {
      return `PAYMENT RECEIPT

Date: ${today}

Received from: ${deal.lead?.name || "Client"}
Amount: ₹${amount}
Towards: Booking amount for ${deal.property?.title || "Property"}

Authorized Signatory`
    } else {
      return `SITE VISIT CONFIRMATION

Date: ${today}

Client: ${deal.lead?.name || "Client"}
Property: ${deal.property?.title || "TBD"}

Notes: 
Please bring government ID for entry.
`
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(getTemplate())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="p-6 border-b pb-4 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-indigo-500" />
            Generate Document
          </DialogTitle>
          <DialogDescription>
            Creating document for deal: <strong>{deal.title}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-64 border-r p-4 space-y-2 bg-slate-50 dark:bg-slate-900/50">
            <h4 className="text-xs font-bold uppercase text-slate-500 mb-4 tracking-wider">Document Type</h4>
            <Button 
              variant={docType === "offer" ? "default" : "ghost"} 
              className={`w-full justify-start ${docType === "offer" ? "bg-indigo-600 hover:bg-indigo-700" : ""}`}
              onClick={() => setDocType("offer")}
            >
              Offer Letter
            </Button>
            <Button 
              variant={docType === "receipt" ? "default" : "ghost"} 
              className={`w-full justify-start ${docType === "receipt" ? "bg-indigo-600 hover:bg-indigo-700" : ""}`}
              onClick={() => setDocType("receipt")}
            >
              Booking Receipt
            </Button>
            <Button 
              variant={docType === "site_visit" ? "default" : "ghost"} 
              className={`w-full justify-start ${docType === "site_visit" ? "bg-indigo-600 hover:bg-indigo-700" : ""}`}
              onClick={() => setDocType("site_visit")}
            >
              Site Visit Form
            </Button>
          </div>

          {/* Preview */}
          <div className="flex-1 flex flex-col p-6 bg-slate-100 dark:bg-slate-950 overflow-hidden">
            <div className="flex justify-between items-center mb-4 shrink-0">
              <h3 className="font-semibold text-slate-700 dark:text-slate-300">Document Preview</h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                  {copied ? "Copied" : "Copy Text"}
                </Button>
                <Button variant="outline" size="sm">
                  <Mail className="h-4 w-4 mr-2" />
                  Email to Client
                </Button>
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  <Download className="h-4 w-4 mr-2" />
                  Export PDF
                </Button>
              </div>
            </div>

            <div className="flex-1 bg-white dark:bg-slate-900 border shadow-sm rounded-lg p-8 overflow-y-auto font-mono text-sm whitespace-pre-wrap text-slate-800 dark:text-slate-200">
              {getTemplate()}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
