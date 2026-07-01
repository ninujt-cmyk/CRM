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
  Webhook,
  Home,
  MapPin,
  Handshake,
  Zap,
  Trophy,
  ChevronsLeft
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
      { name: "Unicorn AI Calling", href: "/unicorn-calling", icon: PhoneOutgoing, module: "dialer" },
    ]
  },
  {
    label: "Real Estate",
    items: [
      { name: "Properties", href: "/admin/properties", icon: Home, module: "real_estate" },
      { name: "Site Visits", href: "/admin/site-visits", icon: MapPin, module: "real_estate" },
      { name: "Deals Pipeline", href: "/admin/deals", icon: Handshake, module: "real_estate" },
    ]
  },
  {
    label: "Team",
    items: [
      { name: "Team", href: "/admin/users", icon: Headset, module: "team" },
      { name: "Leaderboard", href: "/admin/leaderboard", icon: Trophy,
  ChevronsLeft, module: "real_estate" },
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
      { name: "Automations", href: "/admin/automations", icon: Zap, module: "core" },
      { name: "Settings", href: "/admin/settings", icon: Settings, module: "core" },
      { name: "External Portals", href: "/admin/integrations/portals", icon: Webhook, module: "real_estate" },
    ]
  }
]

import { 
  Bot, 
  Library, 
  Mic2, 
  History, 
  PlaySquare, 
  Zap, 
  BarChart, 
  CreditCard 
} from "lucide-react"

export const unicornSidebarGroups = [
  {
    label: "Main",
    items: [
      { name: "Analytics", href: "/unicorn-calling/dashboard", icon: BarChart, module: "core", exact: true },
    ]
  },
  {
    label: "AI Calling",
    items: [
      { name: "Agent Scripts", href: "/unicorn-calling/scripts", icon: Bot, module: "core" },
      { name: "Knowledge Base", href: "/unicorn-calling/knowledge-base", icon: Library, module: "core" },
      { name: "Voice Library", href: "/unicorn-calling/voices", icon: Mic2, module: "core" },
    ]
  },
  {
    label: "Campaigns",
    items: [
      { name: "Auto Campaigns", href: "/unicorn-calling/campaigns", icon: PlaySquare, module: "core" },
      { name: "Call Logs", href: "/unicorn-calling/logs", icon: History, module: "core" },
      { name: "Automations", href: "/unicorn-calling/automations", icon: Zap, module: "core" },
    ]
  },
  {
    label: "Settings",
    items: [
      { name: "Integrations", href: "/unicorn-calling/settings", icon: Settings, module: "core" },
      { name: "Billing", href: "/unicorn-calling/billing", icon: CreditCard, module: "core" },
      { name: "Back to CRM", href: "/admin", icon: ChevronsLeft, module: "core" },
    ]
  }
]
