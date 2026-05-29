"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Loader2, ShieldAlert } from "lucide-react"

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: string[]; // e.g., ['super_admin', 'admin', 'manager']
}

export function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const checkRole = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push("/auth/login")

      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

      const userRole = (profile?.role || 'agent').toLowerCase()

      if (allowedRoles.includes(userRole)) {
        setIsAuthorized(true)
      } else {
        setIsAuthorized(false)
      }
    }
    checkRole()
  }, [supabase, router, allowedRoles])

  if (isAuthorized === null) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>
  }

  if (isAuthorized === false) {
    return (
      <div className="flex flex-col h-[80vh] items-center justify-center text-center px-4">
        <ShieldAlert className="h-16 w-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
        <p className="text-slate-500 max-w-md mb-6">
          Your current role does not have permission to view this page. If you believe this is an error, please contact your workspace administrator.
        </p>
        <button onClick={() => router.back()} className="text-indigo-600 hover:underline font-semibold">
          Go Back
        </button>
      </div>
    )
  }

  return <>{children}</>
}
