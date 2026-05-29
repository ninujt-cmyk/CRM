"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export function Watermark() {
  const [userInfo, setUserInfo] = useState<string>("")
  const [dateTime, setDateTime] = useState<string>("")
  const supabase = createClient()

  // 1. Fetch User Name
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // Fetch profile for full name, or fallback to email
        const { data: profile } = await supabase
          .from('users')
          .select('full_name, email')
          .eq('id', user.id)
          .single()
        
        const identifier = profile?.full_name || user.email || "Unknown User"
        setUserInfo(identifier)
      }
    }
    getUser()
  }, [supabase])

  // 2. Live Clock Logic
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date()
      setDateTime(now.toLocaleString('en-IN', { 
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  if (!userInfo) return null

  // 3. Create a repeating pattern of the text
  // We repeat the text block multiple times to cover the screen
  const watermarkText = `${userInfo} • ${dateTime}`
  
  return (
    <div 
      className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden flex flex-wrap content-center justify-center gap-20 opacity-10 select-none"
      aria-hidden="true"
    >
      {/* Generate 20 copies of the watermark text for full coverage */}
      {Array.from({ length: 20 }).map((_, i) => (
        <div 
          key={i} 
          className="transform -rotate-45 text-gray-500 text-sm font-bold whitespace-nowrap"
          style={{ minWidth: "200px", textAlign: "center" }}
        >
          {watermarkText}
        </div>
      ))}
    </div>
  )
}
