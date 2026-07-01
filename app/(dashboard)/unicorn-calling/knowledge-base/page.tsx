"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Search, Book, FileText, Trash2, UploadCloud, RefreshCw, Library } from "lucide-react"
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { toast } from "sonner"

export default function KnowledgeBasePage() {
  const [books, setBooks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [search, setSearch] = useState("")

  useEffect(() => {
    const fetchBooks = async () => {
      try {
        const res = await fetch("/api/proxy/unicorn?endpoint=/api/knowledge-books")
        const data = await res.json()
        if (data.knowledgeBooks) {
          setBooks(data.knowledgeBooks)
        }
      } catch (error) {
        console.error("Error fetching knowledge books:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchBooks()
  }, [])

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsUploading(true)
    // Simulate upload delay
    setTimeout(() => {
      setIsUploading(false)
      toast.success("Document uploaded successfully")
      setBooks([
        { id: Math.random().toString(), name: "Company Policy 2024.pdf", size: "2.4 MB", status: "indexed", date: new Date().toISOString() },
        ...books
      ])
    }, 1500)
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Library className="h-6 w-6 text-blue-600" />
            Knowledge Base
          </h1>
          <p className="text-slate-500 mt-1">Upload documents to give your AI agents custom knowledge.</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4" />
              Upload Document
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Knowledge Base Document</DialogTitle>
              <DialogDescription>
                Upload a PDF, Word document, or text file. The AI will read and index this document to answer customer questions.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpload} className="space-y-4 pt-4">
              <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer">
                <UploadCloud className="h-10 w-10 text-slate-400 mx-auto mb-4" />
                <p className="text-sm font-medium">Click to upload or drag and drop</p>
                <p className="text-xs text-slate-500 mt-1">PDF, DOCX, TXT up to 10MB</p>
                <Input type="file" className="hidden" id="file-upload" />
              </div>
              <Button type="submit" className="w-full" disabled={isUploading}>
                {isUploading ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Indexing Document...</> : "Upload & Index"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/50">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search documents..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white dark:bg-slate-900"
            />
          </div>
        </div>
        
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-slate-300" />
            Loading knowledge books...
          </div>
        ) : books.length === 0 ? (
          <div className="p-12 text-center">
            <div className="h-16 w-16 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Book className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">No Knowledge Books Yet</h3>
            <p className="text-slate-500 max-w-md mx-auto">
              Upload your company policies, FAQs, or product manuals so your AI agent can accurately answer customer questions.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {books.filter(b => (b.name || "").toLowerCase().includes(search.toLowerCase())).map((book, i) => (
              <div key={book.id || i} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-medium text-slate-900 dark:text-white">{book.name || "Untitled Document"}</h4>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                      <span>{book.size || "Unknown size"}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                        {book.status || "Indexed"}
                      </span>
                      {book.date && (
                        <>
                          <span>•</span>
                          <span>Uploaded {new Date(book.date).toLocaleDateString()}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
