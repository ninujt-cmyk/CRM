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
  Settings,
  CloudUpload,
  Webhook
} from "lucide-react"

export const sidebarGroups = [
  {
    label: "Overview",
    items: [
      { name: "Dashboard", href: "/admin", icon: LayoutDashboard, exact: true, module: "core" },
    ]
  },
  {
    label: "Lead Management",
    items: [
      { name: "All Leads", href: "/admin/leads", icon: ClipboardList, module: "leads" },
      { name: "Upload Leads", href: "/admin/upload", icon: FileUp, module: "leads" },
      { name: "Available Leads", href: "/admin/calls", icon: Target, module: "dialer" },
    ]
  },
  {
    label: "Team",
    items: [
      { name: "Team", href: "/admin/users", icon: Headset, module: "team" },
      { name: "Attendance", href: "/admin/attendance", icon: CalendarCheck, module: "attendance" },
      { name: "Leave Management", href: "/admin/leave-management", icon: CalendarOff, module: "attendance" },
      { name: "WhatsApp", href: "/admin/whatsapp", icon: MessageCircle, module: "whatsapp" },
    ]
  },
  {
    label: "Analytics",
    items: [
      { name: "Reports", href: "/admin/reports", icon: BarChart3, module: "analytics" },
      { name: "Disbursed Data", href: "/admin/disbursement-report", icon: IndianRupee, module: "analytics" },
      { name: "Activities", href: "/admin/audit-logs", icon: Activity, module: "logs" },
      { name: "Logins", href: "/admin/logins", icon: UserCheck, module: "logs" },
      { name: "Wallboard", href: "/admin/wallboard", icon: Presentation, module: "wallboard" },
      { name: "IVR Campaigns", href: "/admin/ivr-campaigns", icon: Workflow, module: "ivr" },
      { name: "IVR Configs", href: "/admin/ivr-configs", icon: Settings, module: "ivr" },
      { name: "Files", href: "/admin/master-data", icon: CloudUpload, module: "files" },
    ]
  },
  {
    label: "System",
    items: [
      { name: "Settings", href: "/admin/settings", icon: Settings, module: "core" },
      { name: "Integrations", href: "/admin/integrations", icon: Webhook, module: "integrations" },
    ]
  }
]
