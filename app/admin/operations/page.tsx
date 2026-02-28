"use client"

import { useEffect, useState } from "react"
import { Activity, X, Server, AlertTriangle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

// --- 1. THE API TRACKER WIDGET ---
export function ApiMonitorWidget() {
  const [logs, setLogs] = useState<{ time: string, url: string, type: string }[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (typeof window === "undefined") return;

    const originalFetch = window.fetch;

    window.fetch = async (...args) => {
      const url = typeof args[0] === 'string' ? args[0] : args[0] instanceof Request ? args[0].url : '';
      
      // Only track Supabase requests
      if (url.includes('supabase.co')) {
        setCount(c => c + 1);
        
        let type = "DB";
        if (url.includes('/auth/v1')) type = "AUTH";
        if (url.includes('/realtime/v1')) type = "REALTIME";

        const shortUrl = url.split('supabase.co')[1].split('?')[0]; 

        setLogs(prev => {
          const newLogs = [{ time: new Date().toLocaleTimeString(), url: shortUrl, type }, ...prev];
          return newLogs.slice(0, 50); // Keep only last 50 to prevent memory leaks
        });
      }
      
      return originalFetch(...args);
    };

    return () => {
      window.fetch = originalFetch; // Restore on unmount
    };
  }, []);

  if (count === 0) return null;

  return (
    <div className="fixed bottom-6 left-6 z-[9999]">
      {!isOpen ? (
        <button 
          onClick={() => setIsOpen(true)}
          className="bg-red-600 hover:bg-red-700 text-white p-4 rounded-full shadow-2xl flex items-center gap-2 font-bold animate-pulse transition-all"
        >
          <Activity className="h-5 w-5" />
          {count} API Calls
        </button>
      ) : (
        <div className="bg-slate-900 text-green-400 w-[450px] h-[500px] rounded-xl shadow-2xl flex flex-col overflow-hidden border border-slate-700">
          <div className="bg-slate-800 p-3 flex justify-between items-center text-white border-b border-slate-700">
            <h3 className="font-bold flex items-center gap-2"><Activity className="h-4 w-4 text-green-400"/> Live Supabase Traffic</h3>
            <button onClick={() => setIsOpen(false)} className="hover:text-red-400 p-1"><X className="h-5 w-5"/></button>
          </div>
          <div className="p-3 bg-slate-950 text-sm text-slate-400 border-b border-slate-800 flex justify-between items-center">
            <span>Total Session Calls:</span>
            <span className="text-white font-black text-lg bg-slate-800 px-3 py-1 rounded-md">{count}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1 font-mono text-xs">
            {logs.map((log, i) => (
              <div key={i} className="flex gap-3 border-b border-slate-800/50 pb-1.5 pt-1 hover:bg-slate-800/30 px-2 rounded">
                <span className="text-slate-500 shrink-0">{log.time}</span>
                <span className={`shrink-0 font-bold ${log.type === 'AUTH' ? 'text-purple-400' : log.type === 'REALTIME' ? 'text-blue-400' : 'text-green-400'}`}>
                  [{log.type}]
                </span>
                <span className="text-slate-300 break-all">{log.url}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}


// --- 2. THE MAIN OPERATIONS PAGE ---
export default function AdminOperationsPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
          <Server className="h-8 w-8 text-indigo-600" />
          System Operations
        </h1>
        <p className="text-slate-500 mt-1">Monitor live API requests, database health, and system diagnostics.</p>
      </div>

      {/* Instructions Card */}
      <Card className="border-indigo-100 shadow-sm bg-white">
        <CardHeader className="bg-indigo-50/50 border-b border-indigo-100 pb-4">
          <CardTitle className="flex items-center gap-2 text-indigo-800 text-lg">
            <Activity className="h-5 w-5" /> Live API Diagnostics Active
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          
          <div className="flex gap-4 p-4 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg">
            <AlertTriangle className="h-6 w-6 shrink-0 text-amber-600" />
            <div>
              <h3 className="font-bold mb-1">How to find the API Loop Bug:</h3>
              <ul className="list-decimal list-inside space-y-2 text-sm text-amber-900/80">
                <li>Wait a few seconds on this page. If the red tracker starts appearing and the number flies up into the thousands, the bug is in your **Layout** or **Navbar** (because it's happening globally).</li>
                <li>If it stays quiet here, click the red floating button in the bottom left to open the log window.</li>
                <li>Leave the log window open and click around your CRM (Go to Wallboard, Leads, Dashboard, etc).</li>
                <li>The moment you hit a page where the numbers start rolling like crazy, **stop!** That page has the infinite loop. Look at the URL in the black log window to see exactly which table is being spammed.</li>
              </ul>
            </div>
          </div>

        </CardContent>
      </Card>

      {/* Mount the floating widget */}
      <ApiMonitorWidget />
      
    </div>
  )
}
