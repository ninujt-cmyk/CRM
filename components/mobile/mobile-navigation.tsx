"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Menu, Home, Users, Phone, FileText, Settings, LogOut, Plus, Search } from "lucide-react"
import { cn } from "@/lib/utils"

interface MobileNavigationProps {
  userRole?: string
  pendingCount?: number
}

export function MobileNavigation({ userRole = "telecaller", pendingCount = 0 }: MobileNavigationProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  const navigationItems = [
    {
      title: "Dashboard",
      href: userRole === "admin" ? "/admin" : "/telecaller",
      icon: Home,
    },
    {
      title: "Leads",
      href: userRole === "admin" ? "/admin/leads" : "/telecaller/leads",
      icon: Users,
      badge: pendingCount > 0 ? pendingCount : undefined,
    },
    {
      title: "Call Logs",
      href: userRole === "admin" ? "/admin/call-logs" : "/telecaller/call-logs",
      icon: Phone,
    },
    {
      title: "Notes",
      href: userRole === "admin" ? "/admin/notes" : "/telecaller/notes",
      icon: FileText,
    },
    ...(userRole === "admin"
      ? [
          {
            title: "Users",
            href: "/admin/users",
            icon: Settings,
          },
        ]
      : []),
  ]

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-background border-b border-border">
        <div className="flex items-center justify-between p-4">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="p-2">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 p-0">
              <div className="flex flex-col h-full">
                {/* Header */}
                <div className="p-6 border-b border-border">
                  <h2 className="text-lg font-semibold">Hanva CRM</h2>
                  <p className="text-sm text-muted-foreground capitalize">{userRole}</p>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-2">
                  {navigationItems.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + "/")

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors",
                          "hover:bg-accent hover:text-accent-foreground",
                          isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground",
                        )}
                      >
                        <item.icon className="h-5 w-5" />
                        <span className="flex-1">{item.title}</span>
                        {item.badge && (
                          <Badge variant="secondary" className="h-5 px-2 text-xs">
                            {item.badge}
                          </Badge>
                        )}
                      </Link>
                    )
                  })}
                </nav>

                {/* Footer */}
                <div className="p-4 border-t border-border">
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-muted-foreground"
                    onClick={() => setOpen(false)}
                  >
                    <LogOut className="h-4 w-4 mr-3" />
                    Sign Out
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          <h1 className="text-lg font-semibold">Hanva CRM</h1>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="p-2">
              <Search className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border">
        <div className="grid grid-cols-5 gap-1 p-2">
          {navigationItems.slice(0, 4).map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/")

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 p-2 rounded-lg text-xs font-medium transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground",
                )}
              >
                <div className="relative">
                  <item.icon className="h-5 w-5" />
                  {item.badge && (
                    <Badge
                      variant="destructive"
                      className="absolute -top-2 -right-2 h-4 w-4 p-0 text-xs flex items-center justify-center"
                    >
                      {item.badge > 99 ? "99+" : item.badge}
                    </Badge>
                  )}
                </div>
                <span className="truncate">{item.title}</span>
              </Link>
            )
          })}

          {/* Add Button */}
          <Link
            href={`${userRole === "admin" ? "/admin" : "/telecaller"}/leads/new`}
            className="flex flex-col items-center gap-1 p-2 rounded-lg text-xs font-medium transition-colors text-primary hover:bg-accent"
          >
            <Plus className="h-5 w-5" />
            <span>Add</span>
          </Link>
        </div>
      </div>
      {/* Spacer for fixed navigation */}
      <div className="lg:hidden h-16" /> {/* Top spacer */}
      <div className="lg:hidden h-20" /> {/* Bottom spacer */}
    </>
  )
}
