"use client"

import { useState } from "react"
import { Send, Image as ImageIcon, Paperclip, Smile, Bot, MessageCircle, Mail, Phone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { AiReplyGenerator } from "@/components/ai-reply-generator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function InboxChat({ threadId }: { threadId: string }) {
  const [message, setMessage] = useState("")
  const [channel, setChannel] = useState("whatsapp")
  const [isAiOpen, setIsAiOpen] = useState(false)

  // Mock conversation
  const messages = [
    { id: 1, text: "Hi, I saw the 3BHK listing. Is it available?", sender: "user", time: "10:30 AM", type: "whatsapp" },
    { id: 2, text: "Hello! Yes, it is still available. Would you like to schedule a site visit?", sender: "agent", time: "10:35 AM", type: "whatsapp" },
    { id: 3, text: "Yes, I'm available for a site visit tomorrow at 11 AM.", sender: "user", time: "10:42 AM", type: "whatsapp" },
  ]

  const getChannelIcon = (c: string) => {
    switch (c) {
      case "whatsapp": return <MessageCircle className="h-4 w-4 text-green-500" />
      case "email": return <Mail className="h-4 w-4 text-blue-500" />
      case "sms": return <MessageCircle className="h-4 w-4 text-indigo-500" />
    }
  }

  return (
    <div className="flex flex-col h-full relative">
      {/* Header */}
      <div className="h-16 border-b border-slate-200 dark:border-slate-800 flex items-center px-6 shrink-0 bg-white dark:bg-slate-950/50">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
            RS
          </div>
          <div>
            <h3 className="font-bold text-slate-800 dark:text-slate-100">Rohan Sharma</h3>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-xs text-slate-500">Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30 dark:bg-slate-950/10">
        {messages.map((msg) => (
          <div key={msg.id} className={cn("flex flex-col", msg.sender === "agent" ? "items-end" : "items-start")}>
            <div className={cn(
              "max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm relative group",
              msg.sender === "agent" 
                ? "bg-indigo-600 text-white rounded-tr-sm" 
                : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-sm"
            )}>
              <div className="text-[15px] leading-relaxed">{msg.text}</div>
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-400">
              {msg.sender === "agent" && getChannelIcon(msg.type)}
              <span>{msg.time}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex flex-col gap-2">
          
          {/* Controls Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger className="h-8 w-[140px] border-none bg-slate-100 dark:bg-slate-900 font-medium">
                  <div className="flex items-center gap-2">
                    {getChannelIcon(channel)}
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                </SelectContent>
              </Select>
              
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 font-semibold"
                onClick={() => setIsAiOpen(true)}
              >
                <Bot className="h-4 w-4 mr-1.5" /> AI Reply
              </Button>
            </div>
            
            <div className="flex gap-1 text-slate-400">
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-slate-600"><Paperclip className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-slate-600"><ImageIcon className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-slate-600"><Smile className="h-4 w-4" /></Button>
            </div>
          </div>

          {/* Textbox */}
          <div className="relative">
            <Textarea 
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={`Type a ${channel} message...`}
              className="min-h-[80px] pr-12 resize-none bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 focus-visible:ring-1 focus-visible:ring-indigo-500 rounded-xl"
            />
            <Button 
              size="icon" 
              className={cn(
                "absolute bottom-2 right-2 h-8 w-8 rounded-full shadow-sm transition-all",
                message.length > 0 ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
              )}
            >
              <Send className="h-4 w-4 ml-0.5" />
            </Button>
          </div>

        </div>
      </div>

      <AiReplyGenerator 
        isOpen={isAiOpen} 
        onClose={() => setIsAiOpen(false)} 
        onApply={(text) => {
          setMessage(text)
          setIsAiOpen(false)
        }} 
      />
    </div>
  )
}
