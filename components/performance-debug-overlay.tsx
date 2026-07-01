"use client"

import React, { useState, useEffect, useRef } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import {
  Bug,
  Zap,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Copy,
  Trash2,
  Search,
  Activity,
  Eye,
  X,
  Play,
  Server,
  Layers,
  ArrowRight,
  Loader2,
  Info
} from "lucide-react"

export interface NetworkLogItem {
  id: string
  type: "fetch" | "xhr"
  url: string
  method: string
  startTime: number
  duration?: number
  statusCode?: number
  status: "loading" | "success" | "slow" | "error"
  errorMsg?: string
  timestamp: string
}

export interface PageLogItem {
  id: string
  path: string
  duration: number
  timestamp: string
  status: "success" | "slow"
}

export function PerformanceDebugOverlay() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // State
  const [isOpen, setIsOpen] = useState(false)
  const [badgeVisible, setBadgeVisible] = useState(true)
  const [activeTab, setActiveTab] = useState<"overview" | "network" | "pages" | "tools">("overview")
  
  const [networkLogs, setNetworkLogs] = useState<NetworkLogItem[]>([])
  const [pageLogs, setPageLogs] = useState<PageLogItem[]>([])
  const [activeRequests, setActiveRequests] = useState(0)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState<"all" | "slow" | "error" | "loading">("all")

  // Stable Refs for interceptor callbacks
  const addNetworkLogRef = useRef<((item: NetworkLogItem) => void) | null>(null)
  const updateNetworkLogRef = useRef<((id: string, updates: Partial<NetworkLogItem>) => void) | null>(null)

  useEffect(() => {
    addNetworkLogRef.current = (item: NetworkLogItem) => {
      setNetworkLogs((prev) => [item, ...prev.slice(0, 149)])
      if (item.status === "loading") {
        setActiveRequests((count) => count + 1)
      }
    }
    updateNetworkLogRef.current = (id: string, updates: Partial<NetworkLogItem>) => {
      setNetworkLogs((prev) =>
        prev.map((log) => (log.id === id ? { ...log, ...updates } : log))
      )
      if (updates.status && updates.status !== "loading") {
        setActiveRequests((count) => Math.max(0, count - 1))
      }
    }
  })

  // Load badge preference & listen for custom events
  useEffect(() => {
    if (typeof window === "undefined") return

    const savedBadge = localStorage.getItem("hanva_debug_badge_visible")
    if (savedBadge !== null) {
      setBadgeVisible(savedBadge === "true")
    }

    const handleOpenEvent = () => {
      setIsOpen(true)
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === "D" || e.key === "d")) {
        e.preventDefault()
        setIsOpen((prev) => !prev)
      }
    }

    window.addEventListener("hanva-open-debugger", handleOpenEvent)
    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("hanva-open-debugger", handleOpenEvent)
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [])

  // 1. Network Intercepting (fetch & XHR)
  useEffect(() => {
    if (typeof window === "undefined") return

    const origFetch = window.fetch
    const origXhrOpen = XMLHttpRequest.prototype.open
    const origXhrSend = XMLHttpRequest.prototype.send

    const resolveUrl = (input: any, init?: any): string => {
      let str = ""
      if (typeof input === "string") {
        str = input
      } else if (input && typeof input === "object") {
        str = input.url || input.href || (typeof input.toString === "function" && input.toString() !== "[object Object]" ? input.toString() : "")
      } else {
        str = String(input || "")
      }

      // Check if it's a Next.js Server Action
      const headers = init?.headers || (input && typeof input === "object" ? input.headers : null)
      let nextActionId = ""
      if (headers) {
        if (typeof headers.get === "function") {
          nextActionId = headers.get("next-action") || headers.get("Next-Action") || ""
        } else if (typeof headers === "object") {
          nextActionId = headers["next-action"] || headers["Next-Action"] || ""
        }
      }

      if (nextActionId) {
        const path = str && str.trim() !== "" ? str : (typeof window !== "undefined" ? window.location.pathname : "/")
        return `${path} [Next.js Server Action: ${nextActionId.substring(0, 10)}...]`
      }

      if (!str || str.trim() === "") {
        return typeof window !== "undefined" ? window.location.pathname : "/ (Current Route)"
      }

      return str
    }

    // Patch fetch
    window.fetch = async function (...args) {
      const url = resolveUrl(args[0], args[1])
      const method =
        (typeof args[0] === "object" && (args[0] as Request)?.method) ||
        (args[1]?.method || "GET").toUpperCase()

      // Ignore noise (Vercel analytics, HMR, hot reloads)
      const isIgnored =
        url.includes("vercel/analytics") ||
        url.includes("/_next/static") ||
        url.includes("webpack-hmr")

      const id = Math.random().toString(36).substring(2, 9)
      const startTime = performance.now()

      if (!isIgnored) {
        addNetworkLogRef.current?.({
          id,
          type: "fetch",
          url,
          method,
          startTime,
          status: "loading",
          timestamp: new Date().toLocaleTimeString(),
        })
      }

      try {
        const response = await origFetch.apply(this, args)
        const endTime = performance.now()
        const duration = Math.round(endTime - startTime)

        if (!isIgnored) {
          const isSlow = duration > 500
          updateNetworkLogRef.current?.(id, {
            duration,
            statusCode: response.status,
            status: response.ok ? (isSlow ? "slow" : "success") : "error",
          })
        }
        return response
      } catch (error) {
        const endTime = performance.now()
        const duration = Math.round(endTime - startTime)
        if (!isIgnored) {
          updateNetworkLogRef.current?.(id, {
            duration,
            statusCode: 0,
            status: "error",
            errorMsg: error instanceof Error ? error.message : "Network/Connection Failure",
          })
        }
        throw error
      }
    }

    // Patch XHR
    XMLHttpRequest.prototype.open = function (
      method: string,
      url: string | URL,
      ...rest: any[]
    ) {
      ;(this as any)._debugId = Math.random().toString(36).substring(2, 9)
      ;(this as any)._debugMethod = method.toUpperCase()
      ;(this as any)._debugUrl = resolveUrl(url)
      return origXhrOpen.apply(this, [method, url, ...rest] as any)
    }

    XMLHttpRequest.prototype.send = function (...args: any[]) {
      const id = (this as any)._debugId
      const url = (this as any)._debugUrl || ""
      const method = (this as any)._debugMethod || "GET"

      const isIgnored =
        url.includes("vercel/analytics") ||
        url.includes("/_next/static") ||
        url.includes("webpack-hmr")

      if (id && !isIgnored) {
        const startTime = performance.now()
        addNetworkLogRef.current?.({
          id,
          type: "xhr",
          url,
          method,
          startTime,
          status: "loading",
          timestamp: new Date().toLocaleTimeString(),
        })

        this.addEventListener("loadend", () => {
          const endTime = performance.now()
          const duration = Math.round(endTime - startTime)
          const statusCode = this.status
          const isSlow = duration > 500
          updateNetworkLogRef.current?.(id, {
            duration,
            statusCode,
            status:
              statusCode >= 200 && statusCode < 400
                ? isSlow
                  ? "slow"
                  : "success"
                : "error",
          })
        })
      }
      return origXhrSend.call(this, args[0])
    }

    return () => {
      window.fetch = origFetch
      XMLHttpRequest.prototype.open = origXhrOpen
      XMLHttpRequest.prototype.send = origXhrSend
    }
  }, [])

  // 2. Route Navigation Tracking
  useEffect(() => {
    if (typeof window === "undefined") return
    const startTime = performance.now()
    const currentPath = `${pathname}${searchParams ? `?${searchParams.toString()}` : ""}`

    const timer = setTimeout(() => {
      const duration = Math.round(performance.now() - startTime)
      const newPageLog: PageLogItem = {
        id: Math.random().toString(36).substring(2, 9),
        path: currentPath,
        duration,
        timestamp: new Date().toLocaleTimeString(),
        status: duration > 500 ? "slow" : "success",
      }
      setPageLogs((prev) => [newPageLog, ...prev.slice(0, 49)])
    }, 100)

    return () => clearTimeout(timer)
  }, [pathname, searchParams])

  // Helper: Copy Diagnostic Report
  const generateAndCopyReport = () => {
    const slowPages = pageLogs.filter((p) => p.duration > 500 || p.status === "slow")
    const slowNetwork = networkLogs.filter(
      (n) => n.status === "slow" || (n.duration && n.duration > 500)
    )
    const errorNetwork = networkLogs.filter((n) => n.status === "error")
    const validDurations = networkLogs.filter((n) => typeof n.duration === "number")
    const avgDuration =
      validDurations.length > 0
        ? Math.round(
            validDurations.reduce((acc, curr) => acc + (curr.duration || 0), 0) /
              validDurations.length
          )
        : 0

    const report = `# 🐞 HANVA CRM - PERFORMANCE & DIAGNOSTIC REPORT
**Generated At:** ${new Date().toLocaleString()}
**Current Page:** \`${pathname}${searchParams ? `?${searchParams.toString()}` : ""}\`
**Browser / OS:** ${typeof navigator !== "undefined" ? navigator.userAgent : "N/A"}
**Total Operations Tracked:** ${networkLogs.length} | **Slow Operations:** ${slowNetwork.length} | **Errors:** ${errorNetwork.length} | **Avg Response:** ${avgDuration}ms

## 🚨 Slowest Pages & Route Transitions (>500ms)
${
  slowPages.length > 0
    ? slowPages
        .map((p) => `- \`${p.path}\`: **${p.duration}ms** (Time: ${p.timestamp})`)
        .join("\n")
    : "*No slow page loads identified. All routes rendered within optimal thresholds (<500ms).*"
}

## ⚠️ Slowest Option Loading & API Queries (>500ms)
${
  slowNetwork.length > 0
    ? slowNetwork
        .slice(0, 10)
        .map(
          (n, i) =>
            `${i + 1}. \`[${n.method}] ${n.url}\` - **${n.duration}ms** (Status: ${n.statusCode || "N/A"}, Time: ${n.timestamp})`
        )
        .join("\n")
    : "*No slow API or option loading requests detected.*"
}

## ❌ Errors & Failed Requests
${
  errorNetwork.length > 0
    ? errorNetwork
        .map(
          (e) =>
            `- \`[${e.method}] ${e.url}\` - Status: **${e.statusCode || "Failed"}** (${e.errorMsg || "Error"}, Time: ${e.timestamp})`
        )
        .join("\n")
    : "*No failed requests or errors encountered.*"
}

## 🌐 Recent Tracked Operations (Top 10)
${
  networkLogs.length > 0
    ? networkLogs
        .slice(0, 10)
        .map(
          (n) =>
            `- \`[${n.method}] ${n.url}\` - **${n.duration ? `${n.duration}ms` : "Loading..."}:** Status ${n.statusCode || n.status} (${n.timestamp})`
        )
        .join("\n")
    : "*No network queries recorded yet.*"
}

---
*Note for AI / Developer: Please analyze the slowest endpoints and page render times listed above to optimize database indexes, caching, or React rendering bottlenecks.*`

    navigator.clipboard.writeText(report)
    toast.success("📋 Diagnostic Report Copied!", {
      description: "Paste this report directly in chat to share with your developer.",
      duration: 5000,
    })
  }

  // Simulation helpers for testing
  const simulateSlowQuery = async () => {
    toast.info("🧪 Testing 1200ms slow option load...")
    const id = Math.random().toString(36).substring(2, 9)
    const startTime = performance.now()
    setNetworkLogs((prev) => [
      {
        id,
        type: "fetch",
        url: "/api/test/slow-option-load?limit=100&delay=1200",
        method: "GET",
        startTime,
        status: "loading",
        timestamp: new Date().toLocaleTimeString(),
      },
      ...prev,
    ])
    setActiveRequests((c) => c + 1)

    setTimeout(() => {
      const duration = Math.round(performance.now() - startTime)
      updateNetworkLogRef.current?.(id, {
        duration,
        statusCode: 200,
        status: "slow",
      })
      toast.warning(`⚠️ Simulated option load completed in ${duration}ms (Slow threshold exceeded)`)
    }, 1200)
  }

  const simulateErrorQuery = () => {
    toast.info("🧪 Testing API Error response...")
    const id = Math.random().toString(36).substring(2, 9)
    setNetworkLogs((prev) => [
      {
        id,
        type: "fetch",
        url: "/api/telecaller/leads-sync-failed",
        method: "POST",
        startTime: performance.now() - 450,
        duration: 450,
        statusCode: 500,
        status: "error",
        errorMsg: "Internal Server Error: Database transaction deadlock",
        timestamp: new Date().toLocaleTimeString(),
      },
      ...prev,
    ])
    toast.error("❌ Simulated error logged in Performance Monitor")
  }

  // Filter logs
  const filteredLogs = networkLogs.filter((log) => {
    const matchesQuery =
      searchQuery === "" ||
      log.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.method.toLowerCase().includes(searchQuery.toLowerCase())
    if (!matchesQuery) return false

    if (filterStatus === "slow") return log.status === "slow" || (log.duration && log.duration > 500)
    if (filterStatus === "error") return log.status === "error"
    if (filterStatus === "loading") return log.status === "loading"
    return true
  })

  const slowLogsCount = networkLogs.filter((n) => n.status === "slow" || (n.duration && n.duration > 500)).length
  const errorLogsCount = networkLogs.filter((n) => n.status === "error").length

  return (
    <>
      {/* Floating Trigger Badge */}
      {badgeVisible && (
        <div className="fixed bottom-4 left-4 z-50 flex items-center">
          <div
            onClick={() => setIsOpen(true)}
            className={`flex items-center gap-2.5 bg-slate-900/95 dark:bg-slate-950/95 text-white backdrop-blur-md px-3.5 py-2 rounded-full shadow-2xl border transition-all duration-200 cursor-pointer group select-none hover:scale-105 ${
              errorLogsCount > 0
                ? "border-red-500/80 bg-red-950/90"
                : slowLogsCount > 0
                ? "border-amber-500/80 bg-amber-950/90"
                : "border-slate-700 hover:border-indigo-500"
            }`}
          >
            <div className="relative flex items-center justify-center">
              <Bug className="h-4 w-4 text-indigo-400 group-hover:rotate-12 transition-transform" />
              {activeRequests > 0 && (
                <span className="absolute -top-1 -right-1 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                </span>
              )}
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold tracking-wide">Debug Mode</span>
                {activeRequests > 0 ? (
                  <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.2 rounded text-[10px] font-mono flex items-center gap-1">
                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    {activeRequests} loading
                  </span>
                ) : (
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-mono border ${
                      errorLogsCount > 0
                        ? "bg-red-500/20 text-red-300 border-red-500/30"
                        : slowLogsCount > 0
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                        : "bg-slate-800 text-slate-300 border-slate-700"
                    }`}
                  >
                    {errorLogsCount > 0
                      ? `${errorLogsCount} errors`
                      : slowLogsCount > 0
                      ? `${slowLogsCount} slow`
                      : `${networkLogs.length} queries`}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation()
              setBadgeVisible(false)
              localStorage.setItem("hanva_debug_badge_visible", "false")
              toast.info("Floating debug badge hidden.", {
                description: "Press Cmd+K / Ctrl+K and search 'Debug' to open anytime!",
                duration: 4000,
              })
            }}
            title="Hide Badge"
            className="ml-1 p-1 bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white rounded-full border border-slate-700 shadow transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Main Interactive Debugger Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="w-full max-w-5xl bg-white dark:bg-slate-950 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="flex flex-wrap items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600/30 border border-indigo-500/40 rounded-xl">
                  <Bug className="h-6 w-6 text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
                    Hanva CRM Performance &amp; Diagnostic Engine
                    <span className="text-xs font-normal bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                      v2.0 Live Profiler
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Identify slow page renders, option loading delays, and API network bottlenecks in real-time.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-2 sm:mt-0">
                <button
                  onClick={generateAndCopyReport}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3.5 py-2 rounded-lg shadow transition-all hover:scale-105 active:scale-95"
                  title="Copy Report to Share with AI / Support"
                >
                  <Copy className="h-4 w-4" />
                  <span>Copy Report for AI / Support</span>
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Quick Stats Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-xs">
              <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Tracked Operations</p>
                  <p className="text-base font-bold text-slate-900 dark:text-white">
                    {networkLogs.length} <span className="text-[10px] font-normal text-slate-400">queries</span>
                  </p>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Slow Loading (&gt;500ms)</p>
                  <p className="text-base font-bold text-amber-600 dark:text-amber-400">
                    {slowLogsCount} <span className="text-[10px] font-normal text-slate-400">items</span>
                  </p>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-3">
                <div className="p-2 bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Failed / Errors</p>
                  <p className="text-base font-bold text-red-600 dark:text-red-400">
                    {errorLogsCount} <span className="text-[10px] font-normal text-slate-400">errors</span>
                  </p>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Active / Loading</p>
                  <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    {activeRequests}
                    {activeRequests > 0 && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  </p>
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1 px-6 pt-3 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
              <button
                onClick={() => setActiveTab("overview")}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
                  activeTab === "overview"
                    ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
                    : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span>🚨 Diagnostic Summary &amp; Slowest</span>
              </button>

              <button
                onClick={() => setActiveTab("network")}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
                  activeTab === "network"
                    ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
                    : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                <Server className="h-4 w-4" />
                <span>🌐 API &amp; Option Calls ({networkLogs.length})</span>
              </button>

              <button
                onClick={() => setActiveTab("pages")}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
                  activeTab === "pages"
                    ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
                    : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                <Layers className="h-4 w-4" />
                <span>📄 Page Transitions ({pageLogs.length})</span>
              </button>

              <button
                onClick={() => setActiveTab("tools")}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
                  activeTab === "tools"
                    ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
                    : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                <Play className="h-4 w-4 text-emerald-500" />
                <span>🧪 Test &amp; Settings</span>
              </button>
            </div>

            {/* Tab Body */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-900/40">
              
              {/* TAB 1: OVERVIEW & SLOWEST */}
              {activeTab === "overview" && (
                <div className="space-y-6">
                  <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <Info className="h-5 w-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                      <div>
                        <h3 className="text-sm font-bold text-indigo-950 dark:text-indigo-200">
                          Ready to Share with Support or AI?
                        </h3>
                        <p className="text-xs text-indigo-800 dark:text-indigo-300 mt-1">
                          Clicking the button below copies all page transition times, slow option loads, and API latency logs directly to your clipboard. Paste it into chat so we can fix the exact issue!
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={generateAndCopyReport}
                      className="shrink-0 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-md transition-all hover:scale-105"
                    >
                      <Copy className="h-4 w-4" />
                      <span>Copy Full Report to Clipboard</span>
                    </button>
                  </div>

                  {/* Slowest Pages Section */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                      <Clock className="h-4 w-4 text-amber-500" />
                      Slowest Page Transitions (&gt;500ms threshold)
                    </h3>
                    <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                      {pageLogs.filter((p) => p.duration > 500).length === 0 ? (
                        <div className="p-6 text-center text-slate-500 dark:text-slate-400 text-xs flex flex-col items-center gap-2">
                          <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                          <span>✨ All page transitions in this session loaded quickly (&lt;500ms).</span>
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                          {pageLogs
                            .filter((p) => p.duration > 500)
                            .map((p) => (
                              <div
                                key={p.id}
                                className="p-3.5 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
                              >
                                <div className="flex items-center gap-2.5 overflow-hidden">
                                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                                  <span className="font-mono font-medium text-slate-800 dark:text-slate-200 truncate">
                                    {p.path}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  <span className="text-slate-400 text-[10px]">{p.timestamp}</span>
                                  <span className="px-2 py-0.5 rounded-full font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                                    {p.duration} ms
                                  </span>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Slowest API Calls Section */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                      <Server className="h-4 w-4 text-amber-500" />
                      Slowest Option Loading &amp; API Requests (&gt;500ms)
                    </h3>
                    <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                      {networkLogs.filter((n) => n.status === "slow" || (n.duration && n.duration > 500)).length === 0 ? (
                        <div className="p-6 text-center text-slate-500 dark:text-slate-400 text-xs flex flex-col items-center gap-2">
                          <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                          <span>✨ All options and API queries responded within normal speed limits (&lt;500ms).</span>
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                          {networkLogs
                            .filter((n) => n.status === "slow" || (n.duration && n.duration > 500))
                            .map((n) => (
                              <div
                                key={n.id}
                                className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
                              >
                                <div className="flex items-center gap-2.5 overflow-hidden">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                                      n.method === "GET"
                                        ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                                        : "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300"
                                    }`}
                                  >
                                    {n.method}
                                  </span>
                                  <span className="font-mono text-slate-800 dark:text-slate-200 truncate">
                                    {n.url}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                                  <span className="text-slate-400 text-[10px]">{n.timestamp}</span>
                                  <span className="px-2 py-0.5 rounded font-mono text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                    Status: {n.statusCode || "N/A"}
                                  </span>
                                  <span className="px-2.5 py-0.5 rounded-full font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                                    {n.duration} ms ⚠️
                                  </span>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: NETWORK & OPTIONS */}
              {activeTab === "network" && (
                <div className="space-y-4">
                  {/* Controls */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="relative w-full sm:w-72">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Filter URL or method..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg bg-slate-100 dark:bg-slate-900 border border-transparent focus:border-indigo-500 outline-none text-slate-800 dark:text-slate-100"
                      />
                    </div>

                    <div className="flex items-center gap-1 w-full sm:w-auto overflow-x-auto">
                      {(["all", "slow", "error", "loading"] as const).map((status) => (
                        <button
                          key={status}
                          onClick={() => setFilterStatus(status)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors whitespace-nowrap ${
                            filterStatus === status
                              ? "bg-indigo-600 text-white"
                              : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
                          }`}
                        >
                          {status === "all" ? `All (${networkLogs.length})` : status}
                        </button>
                      ))}
                      <button
                        onClick={() => {
                          setNetworkLogs([])
                          setActiveRequests(0)
                          toast.success("Network logs cleared.")
                        }}
                        className="ml-2 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                        title="Clear Logs"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Logs Table */}
                  <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                    {filteredLogs.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-xs">
                        No network logs match your filter criteria.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 font-semibold text-slate-600 dark:text-slate-400">
                              <th className="p-3 w-20">Status</th>
                              <th className="p-3 w-16">Method</th>
                              <th className="p-3">URL / Endpoint</th>
                              <th className="p-3 w-24 text-right">Duration</th>
                              <th className="p-3 w-24 text-right">Time</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                            {filteredLogs.map((log) => (
                              <tr
                                key={log.id}
                                className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors font-mono"
                              >
                                <td className="p-3">
                                  {log.status === "loading" && (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded">
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                      Wait
                                    </span>
                                  )}
                                  {log.status === "success" && (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
                                      <CheckCircle2 className="h-3 w-3" />
                                      {log.statusCode || 200}
                                    </span>
                                  )}
                                  {log.status === "slow" && (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-700">
                                      <Clock className="h-3 w-3" />
                                      {log.statusCode || 200}
                                    </span>
                                  )}
                                  {log.status === "error" && (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded border border-red-300 dark:border-red-700" title={log.errorMsg}>
                                      <XCircle className="h-3 w-3" />
                                      {log.statusCode || "Err"}
                                    </span>
                                  )}
                                </td>
                                <td className="p-3 font-bold text-slate-700 dark:text-slate-300">
                                  {log.method}
                                </td>
                                <td className="p-3 max-w-md truncate text-slate-900 dark:text-slate-100" title={log.url}>
                                  {log.url}
                                  {log.errorMsg && (
                                    <div className="text-[10px] text-red-500 mt-0.5 font-sans">
                                      {log.errorMsg}
                                    </div>
                                  )}
                                </td>
                                <td className="p-3 text-right font-bold">
                                  {log.duration ? (
                                    <span
                                      className={
                                        log.duration > 1500
                                          ? "text-red-600 dark:text-red-400"
                                          : log.duration > 500
                                          ? "text-amber-600 dark:text-amber-400"
                                          : "text-emerald-600 dark:text-emerald-400"
                                      }
                                    >
                                      {log.duration} ms
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 italic">...</span>
                                  )}
                                </td>
                                <td className="p-3 text-right text-slate-400 text-[11px]">
                                  {log.timestamp}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: PAGES */}
              {activeTab === "pages" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Session Route Navigation Log ({pageLogs.length} transitions recorded)
                    </span>
                    <button
                      onClick={() => {
                        setPageLogs([])
                        toast.success("Page navigation history cleared.")
                      }}
                      className="text-xs text-red-600 hover:underline flex items-center gap-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Clear History
                    </button>
                  </div>

                  <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                    {pageLogs.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-xs">
                        No route transitions recorded yet. Navigate between pages to log render speeds!
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {pageLogs.map((p) => (
                          <div
                            key={p.id}
                            className="p-3.5 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
                          >
                            <div className="flex items-center gap-2.5 overflow-hidden">
                              <span
                                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                  p.duration > 500 ? "bg-amber-500" : "bg-emerald-500"
                                }`}
                              />
                              <span className="font-mono font-medium text-slate-900 dark:text-slate-100 truncate">
                                {p.path}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-slate-400 text-[11px]">{p.timestamp}</span>
                              <span
                                className={`px-2.5 py-0.5 rounded-full font-bold border ${
                                  p.duration > 500
                                    ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700"
                                    : "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700"
                                }`}
                              >
                                {p.duration} ms
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: TOOLS & SETTINGS */}
              {activeTab === "tools" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white dark:bg-slate-950 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Play className="h-4 w-4 text-indigo-500" />
                      Test Diagnostic Profiler
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Simulate slow option loads or server errors to verify how they appear in the diagnostic monitor and copyable reports.
                    </p>

                    <div className="flex flex-col gap-2 pt-2">
                      <button
                        onClick={simulateSlowQuery}
                        className="w-full flex items-center justify-between px-4 py-2.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-950/50 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800 rounded-xl text-xs font-semibold transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-amber-600" />
                          Simulate Slow Option Load (1200ms)
                        </span>
                        <ArrowRight className="h-4 w-4" />
                      </button>

                      <button
                        onClick={simulateErrorQuery}
                        className="w-full flex items-center justify-between px-4 py-2.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-950/50 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800 rounded-xl text-xs font-semibold transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                          Simulate API 500 Error
                        </span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-950 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Eye className="h-4 w-4 text-indigo-500" />
                      Debugger Display Settings
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Manage the visibility of the floating bottom-left badge or reset all diagnostic session counters.
                    </p>

                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                        <div className="text-xs">
                          <p className="font-semibold text-slate-800 dark:text-slate-200">
                            Floating Bottom Badge
                          </p>
                          <p className="text-slate-400 text-[11px]">
                            Show quick speed status badge on bottom-left of screen
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            const next = !badgeVisible
                            setBadgeVisible(next)
                            localStorage.setItem("hanva_debug_badge_visible", String(next))
                            toast.success(next ? "Badge enabled!" : "Badge hidden!")
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                            badgeVisible
                              ? "bg-indigo-600 text-white"
                              : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          {badgeVisible ? "Visible" : "Hidden"}
                        </button>
                      </div>

                      <button
                        onClick={() => {
                          setNetworkLogs([])
                          setPageLogs([])
                          setActiveRequests(0)
                          toast.success("All diagnostic logs and metrics reset.")
                        }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>Clear All Tracked Logs &amp; Metrics</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="text-slate-400 flex items-center gap-2">
                <span>💡 Tip: Press <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono text-[10px] text-slate-600 dark:text-slate-300">Cmd/Ctrl + Shift + D</kbd> to toggle this profiler anytime.</span>
              </div>
              <button
                onClick={generateAndCopyReport}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2 rounded-lg shadow transition-colors"
              >
                <Copy className="h-4 w-4" />
                <span>Copy Diagnostic Report</span>
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  )
}
