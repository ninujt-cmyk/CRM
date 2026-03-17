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

      // 1. Securely get the user's specific tenant_id
      const { data: profile } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (profile?.tenant_id) {
         // 2. Fetch only THAT specific organization (Prevents 406 Error for Super Admins)
         const { data } = await supabase
           .from("organizations")
           .select("id, name, plan")
           .eq('id', profile.tenant_id)
           .limit(1)
           .maybeSingle()

         if (data) setOrg(data)
      }
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
