"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Search, MessageCircle, Mail, Phone, Filter } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

// Mock data
const THREADS = [
  { id: "t_1", name: "Rohan Sharma", preview: "Yes, I'm available for a site visit...", time: "10:42 AM", unread: 2, channel: "whatsapp" },
  { id: "t_2", name: "Sneha Patel", preview: "Can you send the brochure again?", time: "Yesterday", unread: 0, channel: "email" },
  { id: "t_3", name: "Amit Kumar", preview: "Call summary: Interested in 3BHK", time: "Mon", unread: 0, channel: "call" },
  { id: "t_4", name: "Priya Singh", preview: "Ok, I will check and get back.", time: "Last week", unread: 0, channel: "whatsapp" }
]

export function InboxSidebar({ activeThreadId }: { activeThreadId: string | null }) {
  const router = useRouter()
  const [search, setSearch] = useState("")

  const ChannelIcon = ({ channel }: { channel: string }) => {
    switch (channel) {
      case "whatsapp": return <MessageCircle className="h-3 w-3 text-green-500" />
      case "email": return <Mail className="h-3 w-3 text-blue-500" />
      case "call": return <Phone className="h-3 w-3 text-orange-500" />
      default: return <MessageCircle className="h-3 w-3" />
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Inbox</h2>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Filter className="h-4 w-4 text-slate-500" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Search messages..." 
            className="pl-9 h-9 bg-white dark:bg-slate-900"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Thread List */}
      <div className="flex-1 overflow-y-auto">
        {THREADS.map(thread => (
          <div 
            key={thread.id}
            onClick={() => router.push(`/admin/inbox?thread=${thread.id}`)}
            className={cn(
              "p-4 border-b border-slate-100 dark:border-slate-800/50 cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors",
              activeThreadId === thread.id && "bg-indigo-50/50 dark:bg-indigo-900/10"
            )}
          >
            <div className="flex justify-between items-start mb-1">
              <span className={cn(
                "font-semibold truncate",
                thread.unread > 0 ? "text-slate-900 dark:text-slate-100" : "text-slate-700 dark:text-slate-300"
              )}>
                {thread.name}
              </span>
              <span className="text-xs text-slate-400 shrink-0 ml-2">{thread.time}</span>
            </div>
            <div className="flex items-center gap-2">
              <ChannelIcon channel={thread.channel} />
              <p className={cn(
                "text-sm truncate flex-1",
                thread.unread > 0 ? "text-slate-800 dark:text-slate-200 font-medium" : "text-slate-500"
              )}>
                {thread.preview}
              </p>
              {thread.unread > 0 && (
                <Badge className="bg-indigo-500 hover:bg-indigo-600 rounded-full h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                  {thread.unread}
                </Badge>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
