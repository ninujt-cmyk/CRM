"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

interface Organization {
  id: string;
  name: string;
  plan: string;
}

const TenantContext = createContext<Organization | null>(null)

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [org, setOrg] = useState<Organization | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const fetchTenant = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return;

      // Because of RLS, fetching from 'organizations' will ONLY return the single org this user belongs to!
      const { data } = await supabase
        .from("organizations")
        .select("id, name, plan")
        .single()

      if (data) setOrg(data)
    }
    
    fetchTenant()
  }, [supabase])

  return (
    <TenantContext.Provider value={org}>
      {children}
    </TenantContext.Provider>
  )
}

export const useTenant = () => useContext(TenantContext)
