"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

// UI Components
import { Button } from "@/components/ui/button"
import { LogoutButton } from "@/components/logout-button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

// Modernized & Unique Lucide Icons for Telecallers
import {
  LayoutDashboard,
  Headset,         // My Leads (Action-oriented)
  ListTodo,        // Today's Tasks
  History,         // Call History
  CalendarClock,   // Follow-ups (Time-sensitive)
  StickyNote,      // Notes
  UserCheck,       // Attendance
  CalendarOff,     // Leave
  MessageCircle,   // Team Chat
  Fingerprint,     // Logins (Identity/Security)
  ChevronsLeft,
  AlignLeft
} from "lucide-react"

const navigation = [
  { name: "Dashboard", href: "/telecaller", icon: LayoutDashboard },
  { name: "My Leads", href: "/telecaller/leads", icon: Headset },
  { name: "Today's Tasks", href: "/telecaller/tasks", icon: ListTodo },
  { name: "Call History", href: "/telecaller/calls", icon: History },
  { name: "Follow-ups", href: "/telecaller/follow-ups", icon: CalendarClock },
  { name: "Notes", href: "/telecaller/notes", icon: StickyNote },
  { name: "Attendance", href: "/telecaller/attendance", icon: UserCheck },
  { name: "Leave", href: "/telecaller/leave", icon: CalendarOff },
  { name: "Team Chat", href: "/telecaller/chat", icon: MessageCircle },
  { name: "Logins", href: "/telecaller/logins", icon: Fingerprint },
]

// --- SUB-COMPONENT: Nav Item with 3D Effects ---
function SidebarItem({ item, isCollapsed, isActive }: { item: any, isCollapsed: boolean, isActive: boolean }) {
  const Icon = item.icon

  // 1. COLLAPSED VIEW (Icon Only) - 3D Bubble Pop
  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link href={item.href} className="flex justify-center mb-3">
            <div
              className={cn(
                "h-11 w-11 flex items-center justify-center rounded-2xl transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                "hover:scale-115 hover:-translate-y-1 hover:rotate-3 hover:shadow-[0_10px_20px_-5px_rgba(59,130,246,0.4)]",
                "active:scale-95 active:translate-y-0", 
                isActive 
                  ? "bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/40" 
                  : "bg-white text-slate-500 hover:text-blue-600 border border-slate-100"
              )}
            >
              <Icon strokeWidth={isActive ? 2.5 : 2} className="h-5 w-5" />
              <span className="sr-only">{item.name}</span>
            </div>
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right" className="bg-slate-900 text-white border-0 font-bold ml-2 shadow-2xl animate-in zoom-in-50 duration-300">
          {item.name}
        </TooltipContent>
      </Tooltip>
    )
  }

  // 2. EXPANDED VIEW (Full Row) - 3D Card Lift
  return (
    <Link href={item.href} className="block mb-2 px-2 perspective-[1000px] group/item">
      <div
        className={cn(
          "relative flex items-center w-full p-3 rounded-xl transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
          "border cursor-pointer overflow-hidden",
          "hover:-translate-y-1.5 hover:scale-[1.02] hover:shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1),0_8px_10px_-6px_rgba(0,0,0,0.1)] hover:border-blue-200/50",
          "active:scale-[0.98] active:translate-y-0 active:shadow-none",
          isActive 
            ? "bg-gradient-to-r from-blue-50 via-indigo-50 to-white text-blue-700 border-blue-100 shadow-sm" 
            : "bg-transparent text-slate-600 border-transparent hover:bg-white"
        )}
      >
        {isActive && (
          <div className="absolute left-0 h-full w-1 bg-blue-600 rounded-r-full shadow-[0_0_15px_2px_rgba(37,99,235,0.6)]" />
        )}

        <Icon 
          strokeWidth={isActive ? 2.5 : 2}
          className={cn(
            "h-5 w-5 mr-3 transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
            "group-hover/item:scale-125 group-hover/item:rotate-6",
            isActive ? "text-blue-600" : "text-slate-400 group-hover/item:text-blue-500"
          )} 
        />
        
        <span className={cn(
          "font-semibold tracking-tight transition-colors",
          isActive ? "text-blue-900" : "group-hover/item:text-slate-900"
        )}>
          {item.name}
        </span>

        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent -translate-x-full group-hover/item:animate-[shimmer_1.5s_infinite] pointer-events-none" />
      </div>
    </Link>
  )
}

// --- MAIN TELECALLER SIDEBAR ---
export function TelecallerSidebar() {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    const saved = localStorage.getItem("telecaller-sidebar-collapsed")
    if (saved) setIsCollapsed(JSON.parse(saved))
    
    // Auto-collapse on smaller screens
    const checkIsMobile = () => {
      if (window.innerWidth < 1024) setIsCollapsed(true)
    }
    checkIsMobile()
    window.addEventListener("resize", checkIsMobile)
    return () => window.removeEventListener("resize", checkIsMobile)
  }, [])

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed)
    localStorage.setItem("telecaller-sidebar-collapsed", JSON.stringify(!isCollapsed))
  }

  if (!isMounted) return <div className="hidden md:flex w-[70px] h-screen bg-white border-r" />

  return (
    <>
      {/* 1. MOBILE SIDEBAR */}
      <div className="md:hidden p-4 fixed top-0 left-0 z-50">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="shadow-lg active:scale-95 transition-transform bg-white/80 backdrop-blur-md">
              <AlignLeft strokeWidth={2.5} className="h-5 w-5 text-slate-700" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0 border-r-0">
            <SidebarContent isCollapsed={false} pathname={pathname} />
          </SheetContent>
        </Sheet>
      </div>

      {/* 2. DESKTOP SIDEBAR */}
      <div 
        className={cn(
          "hidden md:flex flex-col h-screen bg-slate-50/50 border-r border-slate-200/60 transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] relative sticky top-0",
          isCollapsed ? "w-[90px]" : "w-72"
        )}
      >
        <Button
          variant="outline"
          size="icon"
          onClick={toggleSidebar}
          className="absolute -right-4 top-8 h-9 w-9 rounded-full bg-white shadow-[0_4px_12px_rgba(0,0,0,0.1)] border-slate-100 z-30 hidden md:flex text-slate-400 hover:text-blue-600 hover:scale-110 hover:-rotate-180 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
        >
          <ChevronsLeft strokeWidth={2.5} className={cn("h-4 w-4 transition-transform duration-300", isCollapsed && "rotate-180")} />
        </Button>

        <SidebarContent isCollapsed={isCollapsed} pathname={pathname} />
      </div>
    </>
  )
}

// --- INTERNAL CONTENT RENDERER ---
function SidebarContent({ isCollapsed, pathname }: { isCollapsed: boolean, pathname: string }) {
  return (
    <div className="flex flex-col h-full bg-white/60 backdrop-blur-2xl">
      
      {/* Branding */}
      <div className={cn("h-24 flex items-center border-b border-slate-100/50 px-6 transition-all duration-500", isCollapsed ? "justify-center" : "justify-start gap-4")}>
        <div className="relative group cursor-default">
            {/* Logo Container - Made Circular and White */}
            <div className="h-12 w-12 bg-white border border-slate-100/50 rounded-full flex items-center justify-center shadow-[0_10px_20px_-5px_rgba(79,70,229,0.4)] flex-shrink-0 transition-all duration-500 group-hover:scale-110 group-hover:rotate-6 group-hover:shadow-blue-600/50 overflow-hidden">
              <Image 
                src="/icons/icon-32x32.jpg" 
                alt="Logo"
                width={32}
                height={32}
                className="object-contain rounded-full"
              />
            </div>
            <div className="absolute -inset-2 bg-blue-500/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
        </div>
        
        {!isCollapsed && (
          <div className="flex flex-col overflow-hidden animate-in fade-in slide-in-from-left-4 duration-500">
            <span className="font-extrabold text-slate-800 text-xl tracking-tight">Hanva</span>
            <span className="text-[10px] text-blue-600 font-bold uppercase tracking-[0.2em]">Telecaller Panel</span>
          </div>
        )}
      </div>

      {/* Navigation - min-h-0 allows proper scrolling */}
      <ScrollArea className="flex-1 py-6 min-h-0">
        <div className="px-4 space-y-1.5">
          <TooltipProvider delayDuration={0}>
            {navigation.map((item, index) => (
              <div key={item.href} className="animate-in fade-in slide-in-from-bottom-2 duration-500" style={{ animationDelay: `${index * 50}ms` }}>
                <SidebarItem 
                  item={item} 
                  isCollapsed={isCollapsed} 
                  isActive={pathname === item.href || pathname.startsWith(item.href + '/')} 
                />
              </div>
            ))}
          </TooltipProvider>
        </div>
      </ScrollArea>

      {/* User & Logout */}
      <div className="p-4 border-t border-slate-100/50 mt-auto">
        {!isCollapsed && (
          <div className="group flex items-center gap-3 px-3 mb-4 p-3 rounded-2xl bg-gradient-to-r from-slate-50 to-white border border-slate-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-default">
            <div className="relative">
              <Avatar className="h-10 w-10 border-2 border-white shadow-md group-hover:scale-105 transition-transform duration-300">
                <AvatarImage src="/placeholder-user.jpg" />
                <AvatarFallback className="bg-blue-600 text-white font-bold">TA</AvatarFallback>
              </Avatar>
              <span className="absolute bottom-0 right-0 h-3 w-3 bg-green-500 border-2 border-white rounded-full"></span>
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-bold text-slate-800 truncate">Agent Profile</span>
              <span className="text-[10px] text-slate-500 truncate font-medium">Online & Ready</span>
            </div>
          </div>
        )}
        
        <LogoutButton 
          variant="outline"
          size={isCollapsed ? "icon" : "default"}
          className={cn(
            "w-full transition-all duration-300 ease-out border-slate-200 shadow-sm",
            "hover:shadow-red-100 hover:border-red-200 hover:bg-red-50 hover:text-red-600 hover:-translate-y-0.5",
            isCollapsed ? "rounded-2xl h-11 w-11 mx-auto flex" : "rounded-xl h-11 justify-center gap-2 font-semibold"
          )}
          showText={!isCollapsed}
        />
      </div>
    </div>
  )
}
