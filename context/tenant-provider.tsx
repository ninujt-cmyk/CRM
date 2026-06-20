"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

interface Organization {
  id: string;
  name: string;
  plan: string;
  enabled_statuses: string[];
  workflow_triggers: any;
}

interface TenantContextValue {
  org: Organization | null;
  masterStatuses: any[];
}

const TenantContext = createContext<TenantContextValue>({ org: null, masterStatuses: [] })

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [org, setOrg] = useState<Organization | null>(null)
  const [masterStatuses, setMasterStatuses] = useState<any[]>([])
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
           .select("id, name, plan, enabled_statuses, workflow_triggers")
           .eq('id', profile.tenant_id)
           .limit(1)
           .maybeSingle()

         if (data) setOrg(data)
      }

      // Fetch global master statuses
      const { data: globalStatuses } = await supabase
        .from("global_lead_statuses")
        .select("*")
        .order("created_at", { ascending: true })
      
      if (globalStatuses && globalStatuses.length > 0) {
        setMasterStatuses(globalStatuses)
      }
    }
    
    fetchTenant()
  }, [supabase])

  return (
    <TenantContext.Provider value={{ org, masterStatuses }}>
      {children}
    </TenantContext.Provider>
  )
}

export const useTenant = () => useContext(TenantContext).org
export const useMasterStatuses = () => useContext(TenantContext).masterStatuses
