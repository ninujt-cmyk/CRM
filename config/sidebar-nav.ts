// config/sidebar-nav.ts
import { 
  LayoutDashboard, Users, UserPlus, FileSpreadsheet, BarChart3, 
  Settings, MessageCircle, Calendar, FileText, IndianRupee, 
  Logs, KeyRound 
} from "lucide-react"

export const sidebarGroups = [
  {
    label: "Overview",
    items: [
      { name: "Dashboard", href: "/admin", icon: LayoutDashboard, exact: true },
    ]
  },
  {
    label: "Lead Management",
    items: [
      { name: "All Leads", href: "/admin/leads", icon: FileSpreadsheet },
      { name: "Upload Leads", href: "/admin/upload", icon: UserPlus },
      { name: "Available Leads", href: "/admin/calls", icon: FileSpreadsheet },
    ]
  },
  {
    label: "Team",
    items: [
      { name: "Telecallers", href: "/admin/users", icon: Users },
      { name: "Attendance", href: "/admin/attendance", icon: Calendar },
      { name: "Leave Management", href: "/admin/leave-management", icon: FileText },
      { name: "Team Chat", href: "/admin/chat", icon: MessageCircle },
    ]
  },
  {
    label: "Analytics",
    items: [
      { name: "Reports", href: "/admin/reports", icon: BarChart3 },
      { name: "Disbursed Data", href: "/admin/disbursement-report", icon: IndianRupee },
      { name: "Activities", href: "/admin/audit-logs", icon: Logs },
      { name: "Logins", href: "/admin/logins", icon: KeyRound },
    ]
  },
  {
    label: "System",
    items: [
      { name: "Settings", href: "/admin/settings", icon: Settings },
    ]
  }
]
