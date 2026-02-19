"use client"

import { useEffect, useState, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Search, Send, User, Check, CheckCheck, 
  Loader2, MessageSquare, Bot, ExternalLink, ShieldAlert, Filter
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
  created_at: string
}

interface ChatMessage {
  id: string
  direction: 'inbound' | 'outbound'
  message_type: string
  content: string
  status: string // 'sent', 'delivered', 'read'
  created_at: string
  fonada_message_id?: string
}

export default function AdminWhatsAppPanel() {
  const supabase = createClient()
  
  // State
  const [leads, setLeads] = useState<ChatLead[]>([])
  const [filteredLeads, setFilteredLeads] = useState<ChatLead[]>([]) // Derived state
  const [searchQuery, setSearchQuery] = useState("")
  const [showUnreadOnly, setShowUnreadOnly] = useState(false) // 👈 NEW FILTER STATE
  const [selectedLead, setSelectedLead] = useState<ChatLead | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState("")
  
  // Loading States
  const [loadingLeads, setLoadingLeads] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 1. FETCH ALL LEADS
  const fetchLeadsAndUsers = async () => {
    const { data: leadsData } = await supabase
      .from('leads')
      .select('id, name, phone, status, last_message_at, unread_count, assigned_to, created_at')
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(150)

    const { data: usersData } = await supabase.from('users').select('id, full_name')

    if (leadsData && usersData) {
      const mappedLeads = leadsData.map(lead => {
        const owner = usersData.find(u => u.id === lead.assigned_to)
        return { ...lead, telecaller_name: owner?.full_name || "Unassigned" }
      })
      setLeads(mappedLeads as ChatLead[])
    }
    setLoadingLeads(false)
  }

  useEffect(() => {
    fetchLeadsAndUsers()
    
    // Realtime Listener for New Leads/Updates
    const leadChannel = supabase.channel('admin_leads_update')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads' }, () => {
        fetchLeadsAndUsers() 
      }).subscribe()

    return () => { supabase.removeChannel(leadChannel) }
  }, [])

  // 2. FILTER LOGIC (Search + Unread Toggle)
  useEffect(() => {
    let result = leads;

    // Apply Search
    if (searchQuery) {
        const lowerQ = searchQuery.toLowerCase();
        result = result.filter(l => 
            l.name.toLowerCase().includes(lowerQ) || 
            l.phone.includes(lowerQ) ||
            (l.telecaller_name && l.telecaller_name.toLowerCase().includes(lowerQ))
        );
    }

    // Apply Unread Filter 👈 NEW LOGIC
    if (showUnreadOnly) {
        result = result.filter(l => l.unread_count > 0);
    }

    setFilteredLeads(result);
  }, [leads, searchQuery, showUnreadOnly]);

  // 3. FETCH MESSAGES & HANDLE REALTIME DLRs
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
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100)

      // Clear Unread Count
      if (selectedLead.unread_count > 0) {
          await supabase.from('leads').update({ unread_count: 0 }).eq('id', selectedLead.id)
          setLeads(prev => prev.map(l => l.id === selectedLead.id ? { ...l, unread_count: 0 } : l))
      }
    }

    fetchMessages()

    // Realtime: New Messages AND DLR Status Updates 👈 NEW
    const msgChannel = supabase.channel(`admin_chat_${selectedLead.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `lead_id=eq.${selectedLead.id}` }, 
      (payload) => {
          setMessages(prev => [...prev, payload.new as ChatMessage])
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter: `lead_id=eq.${selectedLead.id}` },
      (payload) => {
          // Update status of existing message (e.g. sent -> read)
          setMessages(prev => prev.map(msg => msg.id === payload.new.id ? payload.new as ChatMessage : msg))
      })
      .subscribe()

    return () => { supabase.removeChannel(msgChannel) }
  }, [selectedLead])

  // 4. SEND MESSAGE
  const handleSend = async () => {
    if (!inputText.trim() || sending || !selectedLead) return
    setSending(true)
    const textToSend = inputText
    setInputText("")
    
    const res = await sendWhatsAppText(selectedLead.id, selectedLead.phone, textToSend)
    if (!res.success) {
        alert("Failed: " + res.error)
        setInputText(textToSend)
    }
    setSending(false)
  }

  return (
    <div className="flex h-[calc(100vh-6rem)] bg-white border rounded-xl shadow-lg overflow-hidden">
      
      {/* --- LEFT SIDEBAR --- */}
      <div className="w-1/3 border-r bg-slate-50 flex flex-col">
        {/* Header */}
        <div className="p-4 bg-[#005c4b] text-white flex items-center justify-between">
          <h2 className="font-bold flex items-center gap-2"><MessageSquare className="h-5 w-5" /> All Chats</h2>
          <Badge variant="outline" className="bg-white/20 text-white border-none">{leads.length}</Badge>
        </div>

        {/* Search & Filter */}
        <div className="p-3 border-b bg-white space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search..." 
              className="pl-9 bg-slate-100 border-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {/* 👈 NEW TOGGLE FILTER */}
          <button 
             onClick={() => setShowUnreadOnly(!showUnreadOnly)}
             className={`text-xs px-3 py-1.5 rounded-full border transition-all flex items-center gap-2 ${
               showUnreadOnly ? 'bg-green-100 border-green-500 text-green-700 font-bold' : 'bg-slate-50 border-slate-200 text-slate-600'
             }`}
           >
             <Filter className="h-3 w-3" /> {showUnreadOnly ? "Filter: Unread Only" : "Show All Chats"}
           </button>
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
                  <span className="text-xs text-slate-500">
                    {lead.last_message_at 
                      ? new Date(lead.last_message_at).toLocaleDateString([], { month: 'short', day: 'numeric' })
                      : new Date(lead.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })
                    }
                  </span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] bg-white text-slate-600"><User className="h-3 w-3 mr-1" /> {lead.telecaller_name}</Badge>
                    <Badge className={`text-[10px] ${lead.status === 'New' ? 'bg-blue-500' : 'bg-slate-500'}`}>{lead.status}</Badge>
                  </div>
                  {lead.unread_count > 0 && (
                    <div className="bg-[#25D366] text-white text-[10px] font-bold h-5 w-5 flex items-center justify-center rounded-full shadow-sm">{lead.unread_count}</div>
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
            {/* 👈 NEW RICH CONTEXT HEADER */}
            <div className="bg-white px-6 py-3 border-b flex items-center justify-between shadow-sm z-10">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 bg-[#005c4b] text-white rounded-full flex items-center justify-center font-bold text-lg">
                  {selectedLead.name.charAt(0)}
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                    {selectedLead.name}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        selectedLead.status === 'New' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                    }`}>{selectedLead.status}</span>
                  </h2>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span>+{selectedLead.phone}</span>
                    <span className="h-3 w-[1px] bg-slate-300"></span>
                    <span>Owner: <strong>{selectedLead.telecaller_name}</strong></span>
                  </div>
                </div>
              </div>
              <Link href={`/admin/leads/${selectedLead.id}`}>
                <Button variant="outline" size="sm" className="border-green-600 text-green-700 hover:bg-green-50 gap-2">
                  <ExternalLink className="h-4 w-4" /> CRM Profile
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
                        {isTemplate && (
                           <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 mb-1 border-b pb-1 border-slate-200/50 uppercase tracking-wider">
                             <Bot className="h-3 w-3" /> Automated Template
                           </div>
                        )}

                        {/* 👈 NEW BOLD TEXT RENDERING */}
                        <p className="whitespace-pre-wrap text-[15px] leading-relaxed">
                          {msg.content.split(/(\*[^*]+\*)/g).map((part, index) =>
                            part.startsWith('*') && part.endsWith('*') ? (
                              <strong key={index} className="font-bold text-black">{part.slice(1, -1)}</strong>
                            ) : ( part )
                          )}
                        </p>
                        
                        <div className="flex items-center justify-end gap-1 mt-2">
                          <span className="text-[10px] text-slate-500 font-medium">
                            {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </span>
                          
                          {/* 👈 NEW BLUE TICKS LOGIC */}
                          {isOutbound && (
                            <span className="flex items-center">
                              {msg.status === 'read' ? (
                                <CheckCheck size={16} className="text-blue-500" /> // Blue Ticks
                              ) : msg.status === 'delivered' ? (
                                <CheckCheck size={16} className="text-gray-400" /> // Gray Double Ticks
                              ) : (
                                <Check size={16} className="text-gray-400" /> // Gray Single Tick
                              )}
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

            {/* Input Area */}
            <div className="bg-[#f0f2f5] p-4 flex items-center gap-3">
              <div className="bg-slate-200 p-2 rounded text-slate-500" title="Admin Mode">
                 <ShieldAlert className="h-5 w-5" />
              </div>
              <Input 
                className="flex-1 bg-white border-none shadow-sm h-12 text-base"
                placeholder="Type a message..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                disabled={sending}
              />
              <Button onClick={handleSend} disabled={!inputText.trim() || sending} className="bg-[#005c4b] hover:bg-[#064e40] h-12 w-12 rounded-full p-0">
                {sending ? <Loader2 className="animate-spin h-5 w-5" /> : <Send className="h-5 w-5 ml-1" />}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-[#f8f9fa]">
            <div className="h-24 w-24 bg-slate-200 rounded-full flex items-center justify-center mb-6">
               <MessageSquare className="h-10 w-10 text-slate-400" />
            </div>
            <h2 className="text-2xl font-light text-slate-600 mb-2">WhatsApp Inbox</h2>
            <p>Select a chat to view history and status.</p>
          </div>
        )}
      </div>
    </div>
  )
}
