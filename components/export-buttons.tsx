"use client"

import { Button } from "@/components/ui/button"
import { FileSpreadsheet, Users, Phone } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useState } from "react"

interface ExportButtonsProps {
  startDate: string
  endDate: string
  telecallerId?: string
}

export function ExportButtons({ startDate, endDate, telecallerId }: ExportButtonsProps) {
  const [isExporting, setIsExporting] = useState<string | null>(null)
  const supabase = createClient()

  const exportToCSV = (data: any[], filename: string, headers: string[]) => {
    const csvContent = [
      headers.join(","),
      ...data.map((row) => headers.map((header) => `"${row[header] || ""}"`).join(",")),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${filename}_${startDate}_to_${endDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportLeads = async () => {
    setIsExporting("leads")
    try {
      let query = supabase
        .from("leads")
        .select(`
          name,
          email,
          phone,
          company,
          designation,
          source,
          status,
          priority,
          created_at,
          last_contacted,
          next_follow_up,
          assigned_user:users!leads_assigned_to_fkey(full_name)
        `)
        .gte("created_at", startDate)
        .lte("created_at", `${endDate}T23:59:59`)

      if (telecallerId) {
        query = query.eq("assigned_to", telecallerId)
      }

      const { data } = await query

      if (data) {
        const exportData = data.map((lead: any) => ({
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          company: lead.company,
          designation: lead.designation,
          source: lead.source,
          status: lead.status,
          priority: lead.priority,
          assigned_to: lead.assigned_user?.full_name || "Unassigned",
          created_at: new Date(lead.created_at).toLocaleDateString(),
          last_contacted: lead.last_contacted ? new Date(lead.last_contacted).toLocaleDateString() : "",
          next_follow_up: lead.next_follow_up ? new Date(lead.next_follow_up).toLocaleDateString() : "",
        }))

        exportToCSV(exportData, "leads_report", [
          "name",
          "email",
          "phone",
          "company",
          "designation",
          "source",
          "status",
          "priority",
          "assigned_to",
          "created_at",
          "last_contacted",
          "next_follow_up",
        ])
      }
    } catch (error) {
      console.error("Error exporting leads:", error)
      alert("Failed to export leads")
    } finally {
      setIsExporting(null)
    }
  }

  const exportCalls = async () => {
    setIsExporting("calls")
    try {
      let query = supabase
        .from("call_logs")
        .select(`
          call_type,
          call_status,
          duration_seconds,
          notes,
          created_at,
          users!call_logs_user_id_fkey(full_name),
          leads!call_logs_lead_id_fkey(name, phone)
        `)
        .gte("created_at", startDate)
        .lte("created_at", `${endDate}T23:59:59`)

      if (telecallerId) {
        query = query.eq("user_id", telecallerId)
      }

      const { data } = await query

      if (data) {
        const exportData = data.map((call: any) => ({
          telecaller: call.users?.full_name || "",
          lead_name: call.leads?.name || "",
          lead_phone: call.leads?.phone || "",
          call_type: call.call_type,
          call_status: call.call_status,
          duration_minutes: Math.round((call.duration_seconds || 0) / 60),
          notes: call.notes || "",
          call_date: new Date(call.created_at).toLocaleDateString(),
          call_time: new Date(call.created_at).toLocaleTimeString(),
        }))

        exportToCSV(exportData, "calls_report", [
          "telecaller",
          "lead_name",
          "lead_phone",
          "call_type",
          "call_status",
          "duration_minutes",
          "notes",
          "call_date",
          "call_time",
        ])
      }
    } catch (error) {
      console.error("Error exporting calls:", error)
      alert("Failed to export calls")
    } finally {
      setIsExporting(null)
    }
  }

  const exportPerformance = async () => {
    setIsExporting("performance")
    try {
      let userFilter = telecallerId ? [telecallerId] : undefined

      if (!telecallerId) {
        const { data: telecallers } = await supabase
          .from("users")
          .select("id")
          .eq("role", "telecaller")
          .eq("is_active", true)
        userFilter = telecallers?.map((t: any) => t.id) || []
      }

      const performanceData = []

      for (const userId of userFilter || []) {
        const [{ data: user }, { count: totalLeads }, { count: totalCalls }, { count: connectedCalls }] =
          await Promise.all([
            supabase.from("users").select("full_name").eq("id", userId).single(),
            supabase
              .from("leads")
              .select("*", { count: "exact", head: true })
              .eq("assigned_to", userId)
              .gte("created_at", startDate)
              .lte("created_at", `${endDate}T23:59:59`),
            supabase
              .from("call_logs")
              .select("*", { count: "exact", head: true })
              .eq("user_id", userId)
              .gte("created_at", startDate)
              .lte("created_at", `${endDate}T23:59:59`),
            supabase
              .from("call_logs")
              .select("*", { count: "exact", head: true })
              .eq("user_id", userId)
              .eq("call_status", "connected")
              .gte("created_at", startDate)
              .lte("created_at", `${endDate}T23:59:59`),
          ])

        performanceData.push({
          telecaller: user?.full_name || "",
          total_leads: totalLeads || 0,
          total_calls: totalCalls || 0,
          connected_calls: connectedCalls || 0,
          connect_rate: totalCalls ? (((connectedCalls || 0) / totalCalls) * 100).toFixed(1) + "%" : "0%",
        })
      }

      exportToCSV(performanceData, "performance_report", [
        "telecaller",
        "total_leads",
        "total_calls",
        "connected_calls",
        "connect_rate",
      ])
    } catch (error) {
      console.error("Error exporting performance:", error)
      alert("Failed to export performance data")
    } finally {
      setIsExporting(null)
    }
  }

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        onClick={exportLeads}
        disabled={isExporting === "leads"}
        className="flex items-center gap-2 bg-transparent"
      >
        <FileSpreadsheet className="h-4 w-4" />
        {isExporting === "leads" ? "Exporting..." : "Export Leads"}
      </Button>
      <Button
        variant="outline"
        onClick={exportCalls}
        disabled={isExporting === "calls"}
        className="flex items-center gap-2 bg-transparent"
      >
        <Phone className="h-4 w-4" />
        {isExporting === "calls" ? "Exporting..." : "Export Calls"}
      </Button>
      <Button
        variant="outline"
        onClick={exportPerformance}
        disabled={isExporting === "performance"}
        className="flex items-center gap-2 bg-transparent"
      >
        <Users className="h-4 w-4" />
        {isExporting === "performance" ? "Exporting..." : "Export Performance"}
      </Button>
    </div>
  )
}
