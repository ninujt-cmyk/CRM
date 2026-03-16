"use client"

import type React from "react"
import { useState, useEffect, Suspense } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"

// We separate the logic into a sub-component to wrap it in Suspense
// This is a Next.js requirement when using useSearchParams
function UpdatePasswordForm() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [urlError, setUrlError] = useState<string | null>(null)
  
  const router = useRouter()
  const searchParams = useSearchParams()

  // Check for errors passed in the URL (e.g. expired link) immediately on load
  useEffect(() => {
    const errorDescription = searchParams.get("error_description")
    const errorString = searchParams.get("error")
    
    if (errorDescription || errorString) {
      // Clean up the error message for display (replace '+' with spaces if needed)
      const cleanError = errorDescription?.replace(/\+/g, " ") || "Invalid or expired link"
      setUrlError(cleanError)
    }
  }, [searchParams])

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      setIsLoading(false)
      return
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters")
      setIsLoading(false)
      return
    }

    const supabase = createClient()

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      })

      if (error) throw error

      setSuccess(true)
      // Optional: Redirect after a delay
      setTimeout(() => {
        router.push("/auth/login")
      }, 3000)

    } catch (error: any) {
      setError(error.message || "An error occurred while updating password")
    } finally {
      setIsLoading(false)
    }
  }

  // RENDER: If the link was expired/invalid (URL params check)
  if (urlError) {
    return (
      <Card className="shadow-lg border-red-200">
        <CardHeader>
          <CardTitle className="text-2xl text-red-600">Link Expired</CardTitle>
          <CardDescription>
            The password reset link is invalid or has expired.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
            {urlError}
          </div>
          <Button asChild className="w-full" variant="outline">
            <Link href="/auth/forgot-password">Request New Link</Link>
          </Button>
          <div className="text-center text-sm">
             <Link href="/auth/login" className="text-gray-600 hover:underline">
               Back to Login
             </Link>
          </div>
        </CardContent>
      </Card>
    )
  }

  // RENDER: Success State
  if (success) {
    return (
      <Card className="shadow-lg border-green-200">
        <CardHeader>
          <CardTitle className="text-2xl text-green-600">Password Updated</CardTitle>
          <CardDescription>
            Your password has been changed successfully.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md">
            Redirecting you to login...
          </div>
          <Button asChild className="w-full">
            <Link href="/auth/login">Go to Login</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  // RENDER: Standard Form
  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl">Reset Password</CardTitle>
        <CardDescription>Enter your new password below.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleUpdatePassword}>
          <div className="flex flex-col gap-4">
            <div className="grid gap-2">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="******"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="******"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                {error}
              </div>
            )}
            
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Updating..." : "Update Password"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

export default function UpdatePasswordPage() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10 bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full max-w-md">
        <div className="flex flex-col gap-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Hanva CRM</h1>
            <p className="text-gray-600">Secure Password Update</p>
          </div>
          
          <Suspense fallback={<div>Loading...</div>}>
            <UpdatePasswordForm />
          </Suspense>

        </div>
      </div>
    </div>
  )
}
