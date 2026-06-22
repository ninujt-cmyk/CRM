"use client"

import { useState } from "react"
import { Bot, Sparkles, Loader2, Check, X, RefreshCw } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

export function AiReplyGenerator({ isOpen, onClose, onApply }: { isOpen: boolean, onClose: () => void, onApply: (text: string) => void }) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [draft, setDraft] = useState("")

  const handleGenerate = () => {
    setIsGenerating(true)
    // Mocking an AI generation delay
    setTimeout(() => {
      setDraft("Hello Rohan, yes the 3BHK property is still available. A site visit tomorrow at 11 AM works perfectly. Our executive will meet you at the location. Let me know if you need directions!")
      setIsGenerating(false)
    }, 1500)
  }

  // Auto-generate on open if empty
  if (isOpen && !draft && !isGenerating) {
    handleGenerate()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden bg-white dark:bg-slate-950 border-indigo-100 dark:border-indigo-900 shadow-2xl">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
        
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800">
          <DialogTitle className="flex items-center gap-2 text-indigo-900 dark:text-indigo-100">
            <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg">
              <Bot className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            AI Copilot Reply
          </DialogTitle>
        </DialogHeader>

        <div className="p-6">
          {isGenerating ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <div className="relative">
                <div className="absolute inset-0 bg-indigo-400 blur-xl opacity-20 animate-pulse rounded-full" />
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500 relative z-10" />
              </div>
              <p className="text-sm font-medium text-slate-500 animate-pulse">Analyzing context & drafting reply...</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative group">
                <Textarea 
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="min-h-[120px] bg-indigo-50/50 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-800/50 focus-visible:ring-indigo-500 text-slate-700 dark:text-slate-300 rounded-xl leading-relaxed resize-none p-4"
                />
                <Sparkles className="absolute top-3 right-3 h-4 w-4 text-indigo-400 opacity-50" />
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleGenerate}
                  className="text-slate-500 hover:text-indigo-600"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Re-generate
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={onClose}>Cancel</Button>
                  <Button 
                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                    onClick={() => onApply(draft)}
                  >
                    <Check className="h-4 w-4 mr-1.5" /> Apply
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
