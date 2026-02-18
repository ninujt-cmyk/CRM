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
      // Fetch leads that have a last_message_at timestamp
      const { data: leadsData } = await supabase
        .from('leads')
        .select('id, name, phone, status, last_message_at, unread_count, assigned_to')
        .not('last_message_at', 'is', null)
        .order('last_message_at', { ascending: false })

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
              value={
