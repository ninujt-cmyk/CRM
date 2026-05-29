"use client"

import type React from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

interface AuthGuardProps {
  children: React.ReactNode
  requiredRole?: "admin" | "telecaller"
}

export function AuthGuard({ children, requiredRole }: AuthGuardProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // 1. Get the Auth User
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          router.push("/auth/login")
          return
        }

        // 2. Fetch the REAL role from the public.users table
        // (We do this because user_metadata might be stale if you edited the DB directly)
        const { data: userData, error } = await supabase
          .from("users")
          .select("role")
          .eq("id", user.id)
          .single()

        const userRole = userData?.role || "telecaller"

        // 3. Define Access Rights
        // These are the roles allowed to access the "Admin" dashboard
        const adminAccessRoles = ["admin", "super_admin", "tenant_admin", "team_leader"]

        if (requiredRole) {
          // SCENARIO: Accessing Admin Pages
          if (requiredRole === "admin") {
            // Check if the user has ANY of the admin-level roles
            const hasAdminAccess = adminAccessRoles.includes(userRole)
            
            if (!hasAdminAccess) {
              console.log(`User role '${userRole}' not allowed in Admin area. Redirecting to telecaller.`)
              router.push("/telecaller")
              return
            }
          } 
          // SCENARIO: Accessing Telecaller Pages (Strict check usually not needed, but good for safety)
          else if (requiredRole === "telecaller") {
             // Usually admins can see everything, but if you want to restrict:
             // if (adminAccessRoles.includes(userRole)) { router.push("/admin"); return; }
          }
        }

        // If we passed the checks, authorized!
        setIsAuthorized(true)

      } catch (error) {
        console.error("Auth check failed:", error)
        router.push("/auth/login")
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [router, requiredRole, supabase])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!isAuthorized) {
    return null
  }

  return <>{children}</>
}
