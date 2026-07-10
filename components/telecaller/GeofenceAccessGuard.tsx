"use client"

import React, { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { MapPinOff, RefreshCw, ShieldAlert, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"

function calculateDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3 // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180
  const phi2 = (lat2 * Math.PI) / 180
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export function GeofenceAccessGuard({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"checking" | "allowed" | "blocked">("checking")
  const [reason, setReason] = useState<string>("")
  const [distanceInfo, setDistanceInfo] = useState<{ distanceMeters: number; officeName?: string } | null>(null)
  const [isRetrying, setIsRetrying] = useState(false)
  const supabase = createClient()

  const verifyAccess = async () => {
    setIsRetrying(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setStatus("allowed")
        setIsRetrying(false)
        return
      }

      // 1. Fetch user profile
      const { data: profile } = await supabase
        .from("users")
        .select("role, allow_wfh, tenant_id")
        .eq("id", user.id)
        .single()

      // Admins or users with allow_wfh explicitly granted bypass geofence check
      const adminRoles = ["super_admin", "tenant_admin", "owner", "admin"]
      if (profile && (adminRoles.includes(profile.role) || profile.allow_wfh === true)) {
        setStatus("allowed")
        setIsRetrying(false)
        return
      }

      // 2. Fetch configured office locations
      let officeQuery = supabase.from("office_locations").select("name, lat, lng, radius")
      if (profile?.tenant_id) {
        officeQuery = officeQuery.eq("tenant_id", profile.tenant_id)
      }
      const { data: offices } = await officeQuery

      if (!offices || offices.length === 0) {
        // No office geofence configured yet -> allow access
        setStatus("allowed")
        setIsRetrying(false)
        return
      }

      // 3. Request geolocation
      if (!navigator.geolocation) {
        setStatus("blocked")
        setReason("Your browser does not support geolocation verification.")
        setIsRetrying(false)
        return
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          let minDistance = Infinity
          let closestOfficeName = offices[0]?.name || "Office HQ"
          let allowedRadiusKm = offices[0]?.radius || 0.5

          offices.forEach((office) => {
            const distMeters = calculateDistanceInMeters(
              latitude,
              longitude,
              Number(office.lat),
              Number(office.lng)
            )
            if (distMeters < minDistance) {
              minDistance = distMeters
              closestOfficeName = office.name
              allowedRadiusKm = Number(office.radius)
            }
          })

          const allowedRadiusMeters = allowedRadiusKm * 1000

          if (minDistance <= allowedRadiusMeters) {
            setStatus("allowed")
          } else {
            setStatus("blocked")
            setDistanceInfo({
              distanceMeters: Math.round(minDistance),
              officeName: closestOfficeName,
            })
            setReason(
              `You are ${Math.round(minDistance)}m away from ${closestOfficeName} (allowed radius: ${Math.round(
                allowedRadiusMeters
              )}m). Work From Home is not enabled on your account.`
            )
          }
          setIsRetrying(false)
        },
        (error) => {
          setStatus("blocked")
          setReason(
            "Location permission was denied or unavailable. Please enable GPS location permissions in your browser to verify office attendance."
          )
          setIsRetrying(false)
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
      )
    } catch (err) {
      console.error("Geofence check error:", err)
      // Fallback allow on unexpected network errors so users are not locked out due to DB flake
      setStatus("allowed")
      setIsRetrying(false)
    }
  }

  useEffect(() => {
    verifyAccess()
  }, [])

  if (status === "checking") {
    return <>{children}</>
  }

  if (status === "blocked") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white p-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
            <MapPinOff className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold tracking-tight">Office Location Required</h2>
            <p className="text-sm text-slate-400 leading-relaxed">{reason}</p>
          </div>

          {distanceInfo && (
            <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800/80 text-xs text-slate-300 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Nearest Office</span>
                <span className="font-semibold">{distanceInfo.officeName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Your Distance</span>
                <span className="font-mono text-red-400 font-bold">{distanceInfo.distanceMeters} meters</span>
              </div>
            </div>
          )}

          <div className="pt-2 flex flex-col gap-3">
            <Button
              onClick={verifyAccess}
              disabled={isRetrying}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRetrying ? "animate-spin" : ""}`} />
              Retry Location Verification
            </Button>
            <p className="text-[11px] text-slate-500">
              Need remote access? Ask your Tenant Admin to enable Work From Home (WFH) on your profile.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
