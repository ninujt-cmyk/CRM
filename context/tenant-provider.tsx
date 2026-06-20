"use client"

import { createContext, useContext } from "react"

interface Organization {
  id: string;
  name: string;
  plan: string;
  enabled_statuses: string[];
  enabled_modules: string[];
  workflow_triggers: any;
}

interface TenantContextValue {
  org: Organization | null;
  masterStatuses: any[];
}

const TenantContext = createContext<TenantContextValue>({ org: null, masterStatuses: [] })

export function TenantProvider({ 
    children, 
    initialOrg = null, 
    initialMasterStatuses = [] 
}: { 
    children: React.ReactNode,
    initialOrg?: Organization | null,
    initialMasterStatuses?: any[]
}) {
  return (
    <TenantContext.Provider value={{ org: initialOrg, masterStatuses: initialMasterStatuses }}>
      {children}
    </TenantContext.Provider>
  )
}

export const useTenant = () => useContext(TenantContext).org
export const useMasterStatuses = () => useContext(TenantContext).masterStatuses
