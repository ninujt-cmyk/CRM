"use client"

import { useEffect, useState, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Search, Send, User, Clock, Check, CheckCheck, 
  Loader2, MessageSquare, Bot, ExternalLink, ShieldAlert
} from "lucide-react"
import { sendWhatsAppText } from "@/app/actions/whatsapp"
import Link from "next/link"

// --- TYPES ---
interface ChatLead {
  id: string
  name: string
  phone: string
  status: string
  last_message_at: string
  unread_count: number
  assigned_to: string | null
  telecaller_name?: string
  created_at: string // ✅ Added to support your new sorting logic
}

interface ChatMessage {
  id: string
  direction: 'inbound' | 'outbound'
  message_type: string
  content: string
  status: string
  created_at: string
}

export default function AdminWhatsAppPanel() {
  const supabase = createClient()
  
  // State
  const [leads, setLeads] = useState<ChatLead[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedLead, setSelectedLead] = useState<ChatLead | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState("")
  
  // Loading States
  const [loadingLeads, setLoadingLeads] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 1. FETCH ALL LEADS WITH CHAT HISTORY
  useEffect(() => {
    const fetchLeadsAndUsers = async () => {
      // ✅ Fetch the latest 150 leads, prioritizing those with active chats
      const { data: leadsData } = await supabase
        .from('leads')
        .select('id, name, phone, status, last_message_at, unread_count, assigned_to, created_at')
        // We removed the strict filter so you can see all leads and initiate chats!
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(150) // Adjust this number if you want to load more leads in the sidebar

      // Fetch all users to map the telecaller names
      const { data: usersData } = await supabase
        .from('users')
        .select('id, full_name')

      if (leadsData && usersData) {
        const mappedLeads = leadsData.map(lead => {
          const owner = usersData.find(u => u.id === lead.assigned_to)
          return { ...lead, telecaller_name: owner?.full_name || "Unassigned" }
        })
        setLeads(mappedLeads as ChatLead[])
      }
      setLoadingLeads(false)
    }

    fetchLeadsAndUsers()

    // Realtime listener for new inbound messages across the whole company
    const leadChannel = supabase.channel('admin_leads_update')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads' }, () => {
        fetchLeadsAndUsers() // Refresh list to bump new messages to top
      }).subscribe()

    return () => { supabase.removeChannel(leadChannel) }
  }, [supabase])

  // 2. FETCH MESSAGES FOR SELECTED LEAD
  useEffect(() => {
    if (!selectedLead) return

    const fetchMessages = async () => {
      setLoadingMessages(true)
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('lead_id', selectedLead.id)
        .order('created_at', { ascending: true })
      
      if (data) setMessages(data)
      setLoadingMessages(false)
      scrollToBottom()

      // Reset unread count when admin views the chat
      if (selectedLead.unread_count > 0) {
          await supabase.from('leads').update({ unread_count: 0 }).eq('id', selectedLead.id)
          setLeads(prev => prev.map(l => l.id === selectedLead.id ? { ...l, unread_count: 0 } : l))
      }
    }

    fetchMessages()

    const msgChannel = supabase.channel(`admin_chat_${selectedLead.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `lead_id=eq.${selectedLead.id}` }, 
      (payload) => {
          setMessages(prev => [...prev, payload.new as ChatMessage])
          scrollToBottom()
      }).subscribe()

    return () => { supabase.removeChannel(msgChannel) }
  }, [selectedLead, supabase])

  const scrollToBottom = () => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100)
  }

  // 3. ADMIN SEND MESSAGE
  const handleSend = async () => {
    if (!inputText.trim() || sending || !selectedLead) return
    setSending(true)
    const textToSend = inputText
    setInputText("")
    
    // Using the same server action to send via Fonada
    const res = await sendWhatsAppText(selectedLead.id, selectedLead.phone, textToSend)
    if (!res.success) {
        alert("Failed to send message: " + res.error)
        setInputText(textToSend)
    }
    setSending(false)
  }

  // Filter leads by Search
  const filteredLeads = leads.filter(l => 
    l.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    l.phone.includes(searchQuery) ||
    (l.telecaller_name && l.telecaller_name.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  return (
    <div className="flex h-[calc(100vh-6rem)] bg-white border rounded-xl shadow-lg overflow-hidden">
      
      {/* --- LEFT SIDEBAR: LEAD INBOX --- */}
      <div className="w-1/3 border-r bg-slate-50 flex flex-col">
        {/* Sidebar Header */}
        <div className="p-4 bg-[#005c4b] text-white flex items-center justify-between">
          <h2 className="font-bold flex items-center gap-2">
            <MessageSquare className="h-5 w-5" /> All Chats
          </h2>
          <Badge variant="outline" className="bg-white/20 text-white border-none">{leads.length} Active</Badge>
        </div>

        {/* Search Bar */}
        <div className="p-3 border-b bg-white">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search name, phone, or owner..." 
              className="pl-9 bg-slate-100 border-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Lead List */}
        <div className="flex-1 overflow-y-auto">
          {loadingLeads ? (
            <div className="flex justify-center p-10"><Loader2 className="animate-spin text-[#005c4b]" /></div>
          ) : filteredLeads.length === 0 ? (
            <div className="text-center p-10 text-slate-500 text-sm">No chats found.</div>
          ) : (
            filteredLeads.map(lead => (
              <div 
                key={lead.id} 
                onClick={() => setSelectedLead(lead)}
                className={`p-3 border-b cursor-pointer hover:bg-slate-100 transition-colors ${selectedLead?.id === lead.id ? 'bg-slate-200' : ''}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-semibold text-slate-800 truncate pr-2">{lead.name}</h3>
                  <span className="text-xs text-slate-500 whitespace-nowrap">
                    {lead.last_message_at 
                      ? new Date(lead.last_message_at).toLocaleDateString([], { month: 'short', day: 'numeric' })
                      : new Date(lead.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })
                    }
                  </span>
                </div>
                
                <div className="flex justify-between items-center mt-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] bg-white border-slate-200 text-slate-600">
                      <User className="h-3 w-3 mr-1" /> {lead.telecaller_name}
                    </Badge>
                    <Badge className={`text-[10px] ${lead.status === 'New' ? 'bg-blue-500' : 'bg-slate-500'}`}>
                      {lead.status}
                    </Badge>
                  </div>
                  {lead.unread_count > 0 && (
                    <div className="bg-[#25D366] text-white text-[10px] font-bold h-5 w-5 flex items-center justify-center rounded-full shadow-sm">
                      {lead.unread_count}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* --- RIGHT SIDEBAR: CHAT WINDOW --- */}
      <div className="w-2/3 flex flex-col bg-[#efeae2]">
        {selectedLead ? (
          <>
            {/* Chat Header */}
            <div className="bg-white px-6 py-3 border-b flex items-center justify-between shadow-sm z-10">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 bg-slate-200 rounded-full flex items-center justify-center text-slate-600 font-bold">
                  {selectedLead.name.charAt(0)}
                </div>
                <div>
                  <h2 className="font-bold text-slate-800 text-lg">{selectedLead.name}</h2>
                  <p className="text-sm text-slate-500">+{selectedLead.phone} • Owner: <span className="font-semibold text-slate-700">{selectedLead.telecaller_name}</span></p>
                </div>
              </div>
              <Link href={`/admin/leads/${selectedLead.id}`}>
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <ExternalLink className="h-4 w-4" /> View CRM Profile
                </Button>
              </Link>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {loadingMessages ? (
                 <div className="flex justify-center items-center h-full"><Loader2 className="animate-spin text-[#005c4b]" /></div>
              ) : (
                messages.map((msg) => {
                  const isOutbound = msg.direction === 'outbound'
                  const isTemplate = msg.message_type === 'template'

                  return (
                    <div key={msg.id} className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] rounded-lg p-3 shadow-sm relative group
                        ${isOutbound ? 'bg-[#d9fdd3] text-slate-900 rounded-tr-none' : 'bg-white text-slate-900 rounded-tl-none'}`}
                      >
                        {/* Template Identifier */}
                        {isTemplate && (
                           <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 mb-1 border-b pb-1 border-slate-200/50 uppercase tracking-wider">
                             <Bot className="h-3 w-3" /> Automated Template
                           </div>
                        )}

                        <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{msg.content}</p>
                        
                        <div className="flex items-center justify-end gap-1 mt-2">
                          <span className="text-[10px] text-slate-500 font-medium">
                            {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </span>
                          {isOutbound && (
                            <span className="text-[#53bdeb]">
                              {msg.status === 'read' ? <CheckCheck size={14}/> : <Check size={14} className="text-slate-400"/>}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Admin Chat Input */}
            <div className="bg-[#f0f2f5] p-4 flex items-center gap-3">
              <div className="bg-slate-200 p-2 rounded text-slate-500" title="Admin Mode Active">
                 <ShieldAlert className="h-5 w-5" />
              </div>
              <Input 
                className="flex-1 bg-white border-none shadow-sm h-12 focus-visible:ring-1 focus-visible:ring-[#005c4b] text-base"
                placeholder="Type a message to the customer..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                disabled={sending}
              />
              <Button 
                onClick={handleSend} 
                disabled={!inputText.trim() || sending}
                className="bg-[#005c4b] hover:bg-[#064e40] h-12 w-12 rounded-full shrink-0 flex items-center justify-center p-0"
              >
                {sending ? <Loader2 className="animate-spin h-5 w-5" /> : <Send className="h-5 w-5 ml-1" />}
              </Button>
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-[#f8f9fa]">
            <div className="h-24 w-24 bg-slate-200 rounded-full flex items-center justify-center mb-6">
               <MessageSquare className="h-10 w-10 text-slate-400" />
            </div>
            <h2 className="text-2xl font-light text-slate-600 mb-2">WhatsApp Inbox</h2>
            <p>Select a chat from the left menu to view history.</p>
          </div>
        )}
      </div>

    </div>
  )
}
