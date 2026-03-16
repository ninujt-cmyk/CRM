// app/auth/login/page.tsx
"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"
import { useState } from "react"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isResetMode, setIsResetMode] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error

      // Get user role to redirect appropriately
      const { data: userData } = await supabase.from("users").select("role").eq("email", email).single()

      // Redirect based on user role
      const adminRoles = ["admin", "super_admin", "tenant_admin", "team_leader"];

      if (adminRoles.includes(userData?.role)) {
        router.push("/admin")
      } else if (userData?.role === "kyc_team") {
        router.push("/kyc-team")
      } else {
        // Default to telecaller for everyone else
        router.push("/telecaller")
      }
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const redirectUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/update-password`
          : process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || "/auth/update-password"

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      })

      if (error) throw error

      setSuccess("Password reset instructions have been sent to your email.")
      setIsResetMode(false)
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred while sending reset instructions")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10 bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Hanva CRM</h1>
            <p className="text-gray-600">Professional Lead Management System</p>
          </div>
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl">{isResetMode ? "Reset Password" : "Sign In"}</CardTitle>
              <CardDescription>
                {isResetMode
                  ? "Enter your email to receive reset instructions"
                  : "Enter your credentials to access the CRM system"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={isResetMode ? handleResetPassword : handleLogin}>
                <div className="flex flex-col gap-6">
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your.email@company.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

                  {!isResetMode && (
                    <div className="grid gap-2">
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>
                  )}

                  {error && (
                    <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">{error}</div>
                  )}

                  {success && (
                    <div className="p-3 text-sm text-green-600 bg-green-50 border border-green-200 rounded-md">
                      {success}
                    </div>
                  )}

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading
                      ? isResetMode
                        ? "Sending..."
                        : "Signing in..."
                      : isResetMode
                        ? "Send Reset Instructions"
                        : "Sign In"}
                  </Button>

                  {!isResetMode ? (
                    <div className="text-center">
                      <button
                        type="button"
                        onClick={() => setIsResetMode(true)}
                        className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        Forgot your password?
                      </button>
                    </div>
                  ) : (
                    <div className="text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setIsResetMode(false)
                          setError(null)
                          setSuccess(null)
                        }}
                        className="text-sm text-gray-600 hover:text-gray-800 hover:underline"
                      >
                        Back to login
                      </button>
                    </div>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
