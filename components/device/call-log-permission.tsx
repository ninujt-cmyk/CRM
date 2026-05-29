"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Phone, Shield, CheckCircle } from "lucide-react"
import { callLogsManager } from "@/lib/device/call-logs"
import { toast } from "sonner"

interface CallLogPermissionProps {
  onPermissionGranted?: () => void
  onPermissionDenied?: () => void
}

export function CallLogPermission({ onPermissionGranted, onPermissionDenied }: CallLogPermissionProps) {
  const [permissionState, setPermissionState] = useState<PermissionState>("prompt")
  const [isLoading, setIsLoading] = useState(false)
  const [isSupported, setIsSupported] = useState(true)

  useEffect(() => {
    checkPermissionStatus()
  }, [])

  const checkPermissionStatus = async () => {
    try {
      const available = callLogsManager.isAvailable()
      setIsSupported(available)
      setPermissionState(available ? "prompt" : "denied")
    } catch (error) {
      setPermissionState("denied")
      setIsSupported(false)
    }
  }

  const requestPermission = async () => {
    setIsLoading(true)
    try {
      const result = await callLogsManager.requestPermission()
      setPermissionState(result)

      if (result === "granted") {
        toast.success("Call log access granted")
        onPermissionGranted?.()
      } else {
        onPermissionDenied?.()
      }
    } catch (error) {
      setPermissionState("denied")
      onPermissionDenied?.()
    } finally {
      setIsLoading(false)
    }
  }

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Call Log Access
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            Automatic call logging is not supported on this device.
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5" />
          Call Log Access
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="text-sm font-medium">Status</span>
          </div>
          <Badge variant={permissionState === "granted" ? "default" : "secondary"}>
            {permissionState === "granted" ? "Granted" : "Not Granted"}
          </Badge>
        </div>

        {permissionState !== "granted" && (
          <Button 
            onClick={requestPermission} 
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? "Checking..." : "Enable Call Log Access"}
          </Button>
        )}

        {permissionState === "granted" && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 text-green-800">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Access granted</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
