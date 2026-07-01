"use client"

import { useState, useEffect, useCallback, useTransition } from "react"
import { useRouter } from "next/navigation"
import { globalSearch, SearchResult } from "@/app/actions/search"
import { Command } from "cmdk"
import { Search, Building, User, LayoutDashboard, Calendar, Users, X, Loader2, Bug } from "lucide-react"

export function CommandMenu() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [isPending, startTransition] = useTransition()
  
  // Quick Actions (always available)
  const quickActions = [
    { id: 'debug', title: '🐞 Open Performance Debugger & Profiler', icon: Bug, action: () => { window.dispatchEvent(new CustomEvent('hanva-open-debugger')); setOpen(false); } },
    { id: 'dashboard', title: 'Dashboard', icon: LayoutDashboard, href: '/admin' },
    { id: 'leads', title: 'Lead Management', icon: User, href: '/admin/leads' },
    { id: 'properties', title: 'Property Inventory', icon: Building, href: '/admin/properties' },
    { id: 'roster', title: 'Agent Roster', icon: Users, href: '/admin/roster' },
    { id: 'site-visits', title: 'Site Visits', icon: Calendar, href: '/admin/site-visits' },
  ]

  // Toggle overlay on Cmd+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  // Debounce search API calls
  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setResults([])
      return
    }

    const delayDebounceFn = setTimeout(() => {
      startTransition(async () => {
        const data = await globalSearch(query)
        setResults(data)
      })
    }, 300)

    return () => clearTimeout(delayDebounceFn)
  }, [query])

  const handleSelect = (href: string) => {
    setOpen(false)
    setQuery("")
    router.push(href)
  }

  if (!open) return null

  const leads = results.filter(r => r.type === 'lead')
  const properties = results.filter(r => r.type === 'property')

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-start justify-center pt-[15vh]">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-950 rounded-xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[70vh]">
        
        {/* Header / Input */}
        <div className="flex items-center px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <Search className="h-5 w-5 text-slate-400 mr-3 shrink-0" />
          <input
            autoFocus
            className="flex-1 bg-transparent border-none outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-lg"
            placeholder="Search leads, properties, or commands..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {isPending ? (
             <Loader2 className="h-4 w-4 text-slate-400 animate-spin ml-2 shrink-0" />
          ) : (
            <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-slate-100 dark:bg-slate-800 px-1.5 font-mono text-[10px] font-medium text-slate-500 dark:text-slate-400 ml-2">
              ESC
            </kbd>
          )}
          <button onClick={() => setOpen(false)} className="ml-2 p-1 text-slate-400 hover:text-slate-600 sm:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Results Area */}
        <div className="flex-1 overflow-y-auto p-2">
          
          {query.length > 0 && results.length === 0 && !isPending && (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400">
              No results found for "{query}"
            </div>
          )}

          {/* Leads Section */}
          {leads.length > 0 && (
            <div className="mb-4">
              <div className="px-3 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Leads
              </div>
              {leads.map(lead => (
                <button
                  key={lead.id}
                  onClick={() => handleSelect(lead.href)}
                  className="w-full text-left flex items-center px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group"
                >
                  <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mr-3 shrink-0">
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                      {lead.title}
                    </div>
                    {lead.subtitle && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {lead.subtitle}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Properties Section */}
          {properties.length > 0 && (
            <div className="mb-4">
              <div className="px-3 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Properties
              </div>
              {properties.map(prop => (
                <button
                  key={prop.id}
                  onClick={() => handleSelect(prop.href)}
                  className="w-full text-left flex items-center px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group"
                >
                  <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mr-3 shrink-0">
                    <Building className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                      {prop.title}
                    </div>
                    {prop.subtitle && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {prop.subtitle}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Quick Actions (Fallback when no query or combined at bottom) */}
          {(!query || query.trim().length === 0) && (
            <div>
               <div className="px-3 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Navigation
              </div>
              {quickActions.map(action => (
                <button
                  key={action.id}
                  onClick={() => action.action ? action.action() : (action.href && handleSelect(action.href))}
                  className="w-full text-left flex items-center px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <action.icon className="h-4 w-4 text-slate-400 mr-3 shrink-0" />
                  <span className="text-sm text-slate-700 dark:text-slate-300">{action.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        
      </div>
      
      {/* Invisible backdrop click catcher */}
      <div className="fixed inset-0 z-[-1]" onClick={() => setOpen(false)} />
    </div>
  )
}
