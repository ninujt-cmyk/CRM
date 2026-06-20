"use client"

import { useState, useRef, useEffect } from "react"
import { useChat } from "@ai-sdk/react"
import { X, Sparkles, Send } from "lucide-react"

export function AIGuideAssistant() {
  const [isOpen, setIsOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: "/api/assistant",
  })

  // Auto-scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages])

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 p-4 rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all z-50 flex items-center justify-center hover:scale-105 active:scale-95 ${isOpen ? 'opacity-0 pointer-events-none scale-0' : 'opacity-100 scale-100'}`}
        aria-label="Open AI Guide"
      >
        <Sparkles className="w-6 h-6" />
      </button>

      {/* Chat Window */}
      <div 
        className={`fixed bottom-6 right-6 w-[350px] sm:w-[380px] h-[550px] max-h-[85vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col z-50 transition-all duration-300 origin-bottom-right ${isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-10 pointer-events-none'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-indigo-600 rounded-t-2xl text-white shadow-sm z-10">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-200" />
            <h3 className="font-semibold tracking-tight">AI Guide</h3>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-950/50">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 dark:text-slate-400 space-y-4">
              <div className="w-14 h-14 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center shadow-sm border border-indigo-200 dark:border-indigo-800">
                <Sparkles className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="space-y-1 px-4">
                <p className="font-medium text-slate-700 dark:text-slate-200">Hi! I'm your AI Guide.</p>
                <p className="text-sm">Ask me how to navigate the platform or where to find specific features.</p>
              </div>
            </div>
          )}
          
          {messages.map(m => (
            <div 
              key={m.id} 
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`max-w-[85%] p-3.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                  m.role === 'user' 
                    ? 'bg-indigo-600 text-white rounded-br-sm' 
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-bl-sm border border-slate-100 dark:border-slate-700'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-4 rounded-2xl rounded-bl-sm text-sm flex gap-1.5 items-center shadow-sm">
                 <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></span>
                 <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                 <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form 
          onSubmit={handleSubmit}
          className="p-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-b-2xl shadow-[0_-4px_10px_rgba(0,0,0,0.02)]"
        >
          <div className="relative flex items-center">
            <input
              value={input}
              onChange={handleInputChange}
              placeholder="Ask a question..."
              className="w-full pl-4 pr-12 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:focus:ring-indigo-500 text-sm transition-all text-slate-900 dark:text-slate-100"
            />
            <button 
              type="submit"
              disabled={!(input || "").trim() || isLoading}
              className="absolute right-1.5 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-colors shadow-sm"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
