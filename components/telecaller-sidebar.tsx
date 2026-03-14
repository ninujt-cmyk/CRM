"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { LogoutButton } from "@/components/logout-button"
import {
  LayoutDashboard,
  Phone,
  Users,
  Calendar,
  FileText,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  KeyRound,
  MessageCircle,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const navigation = [
  { name: "Dashboard", href: "/telecaller", icon: LayoutDashboard },
  { name: "My Leads", href: "/telecaller/leads", icon: Users },
  { name: "Today's Tasks", href: "/telecaller/tasks", icon: CheckSquare },
  { name: "Call History", href: "/telecaller/calls", icon: Phone },
  { name: "Follow-ups", href: "/telecaller/follow-ups", icon: Calendar },
  { name: "Notes", href: "/telecaller/notes", icon: FileText },
  { name: "Attendance", href: "/telecaller/attendance", icon: FileText },
  { name: "Leave", href: "/telecaller/leave", icon: Calendar },
  { name: "Team Chat", href: "/telecaller/chat", icon: MessageCircle },
  { name: "Logins", href: "/telecaller/logins", icon: KeyRound },
]

type TelecallerSidebarProps = {}

export function TelecallerSidebar({}: TelecallerSidebarProps) {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Check if we're on a mobile device
  useEffect(() => {
    const checkIsMobile = () => {
      if (typeof window === "undefined") return

      setIsMobile(window.innerWidth < 768)
      if (window.innerWidth < 768) {
        setIsCollapsed(true)
      }
    }

    checkIsMobile()

    if (typeof window !== "undefined") {
      window.addEventListener("resize", checkIsMobile)

      return () => {
        window.removeEventListener("resize", checkIsMobile)
      }
    }
  }, [])

  const toggleSidebar = () => {
    if (isMobile) {
      setIsMobileMenuOpen(!isMobileMenuOpen)
    } else {
      setIsCollapsed(!isCollapsed)
    }
  }

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false)
  }

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="outline"
        size="icon"
        className={cn("fixed top-4 left-4 z-50 md:hidden", isMobileMenuOpen && "hidden")}
        onClick={toggleSidebar}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Overlay for mobile */}
      {isMobile && isMobileMenuOpen && <div className="fixed inset-0 bg-black/50 z-40" onClick={closeMobileMenu} />}

      {/* Sidebar */}
      <div
        className={cn(
          "bg-white shadow-lg flex flex-col fixed md:relative z-40 h-full transition-all duration-300",
          isCollapsed ? "w-16" : "w-64",
          isMobile && !isMobileMenuOpen && "-translate-x-full",
          isMobile && isMobileMenuOpen && "translate-x-0",
        )}
      >
        <div className={cn("p-4 border-b flex items-center", isCollapsed ? "justify-center" : "justify-between")}>
          {!isCollapsed && (
            <div>
              <h1 className="text-xl font-bold text-gray-900">Bankscart CRM</h1>
              <p className="text-sm text-gray-600 mt-1">Telecaller Panel</p>
            </div>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleSidebar}>
            {isMobile ? (
              <X className="h-4 w-4" />
            ) : isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Added overflow-y-auto here to make only the links scrollable */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link key={item.name} href={item.href} onClick={isMobile ? closeMobileMenu : undefined}>
                <Button
                  variant={isActive ? "default" : "ghost"}
                  className={cn(
                    "w-full justify-start gap-3 transition-all",
                    isActive && "bg-blue-600 text-white hover:bg-blue-700",
                    isCollapsed && "justify-center px-2",
                  )}
                >
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  {!isCollapsed && item.name}
                </Button>
              </Link>
            )
          })}
        </nav>

        <div className={`p-4 border-t ${isCollapsed ? 'flex justify-center' : ''}`}>
          <LogoutButton />
        </div>
      </div>
    </>
  )
}
