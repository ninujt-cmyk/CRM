"use client"

import { useEffect, useState, useRef } from "react"
import { Bell, CheckCheck, Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { RealtimeChannel } from "@supabase/supabase-js"
import { formatDistanceToNow } from "date-fns"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

// --- TYPES ---
interface NotificationItem {
  id: string
  user_id: string
  title: string
  message: string
  read: boolean
  link?: string // URL to redirect to (e.g., /admin/leads/123)
  created_at: string
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const supabase = createClient()
  const router = useRouter()
  const channelRef = useRef<RealtimeChannel | null>(null)
  
  // Audio ref for notification sound
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    // Initialize audio (ensure you have a sound file in public/sounds/)
    // You can use a free sound like: https://freesound.org/people/ProjectsU012/sounds/341695/
    audioRef.current = new Audio('/sounds/notification.mp3')
    
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission()
      }
    }
  }, [])

  useEffect(() => {
    const setupNotifications = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Fetch Unread Notifications
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .eq("read", false)
        .order("created_at", { ascending: false })
        .limit(20)

      if (data) {
        setNotifications(data)
        setUnreadCount(data.length)
      }

      if (channelRef.current) return

      // Use a unique channel name per mount to prevent race conditions in React Strict Mode
      const channelName = `realtime:notifications:${user.id}-${Math.random()}`
      
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload: any) => {
            const newNotif = payload.new as NotificationItem
            
            // 1. Play Sound
            audioRef.current?.play().catch(() => {}) // Catch error if user hasn't interacted yet

            // 2. Update UI
            setNotifications((prev) => [newNotif, ...prev])
            setUnreadCount((prev) => prev + 1)

            // 3. Show Toast
            toast.info(newNotif.title, {
              description: newNotif.message,
              action: newNotif.link ? {
                label: "View",
                onClick: () => router.push(newNotif.link!)
              } : undefined,
            })
            
            // 4. System Notification
            if (Notification.permission === "granted") {
               new Notification(newNotif.title, {
                 body: newNotif.message,
                 icon: '/icons/icon-192x192.jpg'
               })
            }
          }
        )
        .subscribe()

      channelRef.current = channel
    }

    setupNotifications()

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [supabase, router])

  const markAsRead = async (id: string, link?: string) => {
    // Optimistic Update
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    setUnreadCount((prev) => Math.max(0, prev - 1))

    // DB Update
    await supabase.from("notifications").update({ read: true }).eq("id", id)

    // Navigation logic
    if (link) router.push(link)
  }

  const markAllRead = async () => {
    // Optimistic
    setNotifications([])
    setUnreadCount(0)
    
    const { data: { user } } = await supabase.auth.getUser()
    if(user) {
        await supabase.from("notifications").update({ read: true }).eq("user_id", user.id)
    }
    toast.success("All notifications cleared")
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5 text-slate-600" />
          {unreadCount > 0 && (
            <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-red-600 ring-2 ring-white animate-pulse" />
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-80 p-0 shadow-xl border-slate-200">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b">
            <DropdownMenuLabel className="p-0 text-sm font-semibold text-slate-900">
                Notifications 
                {unreadCount > 0 && <span className="ml-2 text-xs font-normal text-slate-500">({unreadCount} new)</span>}
            </DropdownMenuLabel>
            {notifications.length > 0 && (
                <button 
                    onClick={markAllRead}
                    className="text-[10px] uppercase font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                    <CheckCheck className="h-3 w-3" /> Mark all read
                </button>
            )}
        </div>

        <div className="max-h-[350px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200">
            {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center text-slate-500">
                    <Bell className="h-8 w-8 mb-2 opacity-20" />
                    <p className="text-sm">No new notifications</p>
                </div>
            ) : (
                notifications.map((notif) => (
                    <DropdownMenuItem 
                        key={notif.id} 
                        className="p-3 border-b last:border-0 cursor-pointer focus:bg-blue-50/50"
                        onClick={() => markAsRead(notif.id, notif.link)}
                    >
                        <div className="flex flex-col gap-1 w-full">
                            <div className="flex justify-between items-start w-full">
                                <span className={cn("text-sm font-medium", !notif.read ? "text-blue-700" : "text-slate-700")}>
                                    {notif.title}
                                </span>
                                <span className="text-[10px] text-slate-400 whitespace-nowrap ml-2">
                                    {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                                </span>
                            </div>
                            <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                                {notif.message}
                            </p>
                        </div>
                    </DropdownMenuItem>
                ))
            )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
