// config/sidebar-nav.ts
import { 
  LayoutDashboard, 
  ClipboardList,     // Replaced FileSpreadsheet for "All Leads" (List of records)
  FileUp,            // Replaced UserPlus for "Upload Leads" (Indicates file uploading)
  Target,            // Replaced FileSpreadsheet for "Available Leads" (Actionable targets)
  Headset,           // Replaced Users for "Telecallers" (More specific to your team's role)
  CalendarCheck,     // Replaced Calendar for "Attendance" (Shows tracked attendance)
  CalendarOff,       // Replaced FileText for "Leave Management" (Visually indicates time off)
  MessageCircle,     // Better matches the classic WhatsApp bubble shape
  BarChart3, 
  IndianRupee, 
  Activity,          // Replaced Logs for "Activities" (More dynamic)
  UserCheck,         // Replaced KeyRound for "Logins" (Verifying user presence)
  Presentation,      // Replaced KeyRound for "Wallboard" (Represents a large display/board)
  Workflow,          // Replaced KeyRound for "Operations" (Interconnected processes)
  PhoneOutgoing,     // Replaced KeyRound for "Dialer" (Directly indicates outbound calling)
  Settings 
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
      { name: "All Leads", href: "/admin/leads", icon: ClipboardList },
      { name: "Upload Leads", href: "/admin/upload", icon: FileUp },
      { name: "Available Leads", href: "/admin/calls", icon: Target },
    ]
  },
  {
    label: "Team",
    items: [
      { name: "Telecallers", href: "/admin/users", icon: Headset },
      { name: "Attendance", href: "/admin/attendance", icon: CalendarCheck },
      { name: "Leave Management", href: "/admin/leave-management", icon: CalendarOff },
      { name: "WhatsApp", href: "/admin/whatsapp", icon: MessageCircle },
    ]
  },
  {
    label: "Analytics",
    items: [
      { name: "Reports", href: "/admin/reports", icon: BarChart3 },
      { name: "Disbursed Data", href: "/admin/disbursement-report", icon: IndianRupee },
      { name: "Activities", href: "/admin/audit-logs", icon: Activity },
      { name: "Logins", href: "/admin/logins", icon: UserCheck },
      { name: "Wallboard", href: "/admin/wallboard", icon: Presentation },
      { name: "Operations", href: "/admin/operations", icon: Workflow },
      { name: "Dialer", href: "/admin/dialer-assignment", icon: PhoneOutgoing },
    ]
  },
  {
    label: "System",
    items: [
      { name: "Settings", href: "/admin/settings", icon: Settings },
    ]
  }
]
