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
    if (requiredRole === "telecaller") {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 max-w-lg mx-auto space-y-6 animate-pulse">
          {/* Status Bar Header Skeleton */}
          <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-3xs">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-slate-200 dark:bg-slate-800 rounded-full" />
              <div className="space-y-1.5">
                <div className="h-3.5 w-28 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="h-2.5 w-16 bg-slate-200 dark:bg-slate-800 rounded" />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="h-8 w-20 bg-slate-200 dark:bg-slate-800 rounded-full" />
              <div className="h-8 w-8 bg-slate-200 dark:bg-slate-800 rounded-lg" />
            </div>
          </div>
          
          {/* Main Greeting Banner Skeleton */}
          <div className="h-44 w-full bg-slate-200 dark:bg-slate-800 rounded-3xl" />
          
          {/* 2x2 Grid stats */}
          <div className="grid grid-cols-2 gap-3.5">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 w-full bg-slate-200 dark:bg-slate-800 rounded-2xl" />
            ))}
          </div>

          {/* Large Performance/Task Skeleton */}
          <div className="h-[280px] w-full bg-slate-200 dark:bg-slate-800 rounded-2xl" />
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 w-full space-y-6 animate-pulse">
        {/* Top Header Row Skeleton */}
        <div className="h-14 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-slate-200 dark:bg-slate-800 rounded-full" />
            <div className="h-4 w-28 bg-slate-200 dark:bg-slate-800 rounded-md" />
          </div>
          <div className="h-7 w-20 bg-slate-200 dark:bg-slate-800 rounded-full" />
        </div>

        {/* Content Workspace Grid Skeleton */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2 space-y-4">
            <div className="h-40 w-full bg-slate-200 dark:bg-slate-800 rounded-2xl" />
            <div className="grid grid-cols-2 gap-4">
              <div className="h-28 w-full bg-slate-200 dark:bg-slate-800 rounded-2xl" />
              <div className="h-28 w-full bg-slate-200 dark:bg-slate-800 rounded-2xl" />
            </div>
            <div className="h-56 w-full bg-slate-200 dark:bg-slate-800 rounded-2xl" />
          </div>
          <div className="h-96 w-full bg-slate-200 dark:bg-slate-800 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (!isAuthorized) {
    return null
  }

  return <>{children}</>
}
