"use client"

import { useEffect, useState } from "react"
import { Activity, X } from "lucide-react"

export function ApiMonitorWidget() {
  const [logs, setLogs] = useState<{ time: string, url: string, type: string }[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [count, setCount] = useState(0)

  useEffect(() => {
    // Only run in development/testing, do not use in production!
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

        const shortUrl = url.split('supabase.co')[1].split('?')[0]; // Clean up the URL

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

  // Only render if there are actual requests being tracked
  if (count === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 z-[9999]">
      {!isOpen ? (
        <button 
          onClick={() => setIsOpen(true)}
          className="bg-red-600 text-white p-3 rounded-full shadow-2xl flex items-center gap-2 font-bold animate-pulse"
        >
          <Activity className="h-5 w-5" />
          {count} API Calls
        </button>
      ) : (
        <div className="bg-slate-900 text-green-400 w-[400px] h-[400px] rounded-lg shadow-2xl flex flex-col overflow-hidden border border-slate-700">
          <div className="bg-slate-800 p-3 flex justify-between items-center text-white">
            <h3 className="font-bold flex items-center gap-2"><Activity className="h-4 w-4 text-green-400"/> Supabase API Tracker</h3>
            <button onClick={() => setIsOpen(false)} className="hover:text-red-400"><X className="h-5 w-5"/></button>
          </div>
          <div className="p-2 bg-slate-950 text-xs text-slate-400 border-b border-slate-800">
            Total Session Calls: <span className="text-white font-bold">{count}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1 font-mono text-[10px]">
            {logs.map((log, i) => (
              <div key={i} className="flex gap-2 border-b border-slate-800 pb-1">
                <span className="text-slate-500">{log.time}</span>
                <span className={log.type === 'AUTH' ? 'text-purple-400' : log.type === 'REALTIME' ? 'text-blue-400' : 'text-green-400'}>[{log.type}]</span>
                <span className="text-slate-300 truncate" title={log.url}>{log.url}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
