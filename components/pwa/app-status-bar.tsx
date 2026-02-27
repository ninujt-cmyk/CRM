"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Wifi, WifiOff, Battery, Signal } from "lucide-react"

interface NetworkInfo {
  online: boolean
  effectiveType?: string
  downlink?: number
  rtt?: number
}

interface BatteryInfo {
  level: number
  charging: boolean
}

export function AppStatusBar() {
  const [isStandalone, setIsStandalone] = useState(false)
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo>({ online: true })
  const [batteryInfo, setBatteryInfo] = useState<BatteryInfo | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    // 1. Safely check if app is installed as PWA (Fixes SSR Hydration Error)
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone
    setIsStandalone(standalone)

    // If we are in a normal browser, stop running the rest of the scripts
    if (!standalone) return;

    // 2. OVERLAP FIX: Measure this bar and dynamically push the app's body down!
    const adjustAppPadding = () => {
      const bar = document.getElementById('pwa-status-bar');
      if (bar) {
        document.body.style.paddingTop = `${bar.offsetHeight}px`;
      }
    };
    
    // Run immediately and listen for device rotation
    setTimeout(adjustAppPadding, 50);
    window.addEventListener('resize', adjustAppPadding);

    // 3. Network status
    const updateNetworkInfo = () => {
      const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection
      setNetworkInfo({
        online: navigator.onLine,
        effectiveType: connection?.effectiveType,
        downlink: connection?.downlink,
        rtt: connection?.rtt,
      })
    }

    window.addEventListener("online", updateNetworkInfo)
    window.addEventListener("offline", updateNetworkInfo)
    updateNetworkInfo()

    // 4. Battery status
    const updateBatteryInfo = async () => {
      try {
        if ("getBattery" in navigator) {
          const battery = await (navigator as any).getBattery()
          
          const handleBatteryChange = () => {
            setBatteryInfo({
              level: battery.level,
              charging: battery.charging,
            })
          }
          
          handleBatteryChange() // Initial set
          battery.addEventListener("levelchange", handleBatteryChange)
          battery.addEventListener("chargingchange", handleBatteryChange)
        }
      } catch (error) {
        console.log("Battery API not supported")
      }
    }
    updateBatteryInfo()

    // 5. Time updates
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    // Cleanup all listeners when unmounted
    return () => {
      window.removeEventListener('resize', adjustAppPadding)
      document.body.style.paddingTop = '0px' // Reset padding
      window.removeEventListener("online", updateNetworkInfo)
      window.removeEventListener("offline", updateNetworkInfo)
      clearInterval(timeInterval)
    }
  }, [])

  // Do not render anything if not installed on phone
  if (!isStandalone) return null

  return (
    <div 
      id="pwa-status-bar" 
      // 🔴 Added pt-[max(...)] to handle the iPhone notch/safe area natively
      className="fixed top-0 left-0 right-0 z-[100] bg-background/95 backdrop-blur-sm border-b border-border pt-[max(env(safe-area-inset-top),0px)]"
    >
      <div className="flex items-center justify-between px-4 py-2 text-xs">
        {/* Left side - Time */}
        <div className="font-medium">{currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>

        {/* Right side - Status indicators */}
        <div className="flex items-center gap-2">
          {/* Network status */}
          <div className="flex items-center gap-1">
            {networkInfo.online ? (
              <Wifi className="h-3 w-3 text-green-600" />
            ) : (
              <WifiOff className="h-3 w-3 text-red-600" />
            )}
            {networkInfo.effectiveType && (
              <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                {networkInfo.effectiveType.toUpperCase()}
              </Badge>
            )}
          </div>

          {/* Signal strength (mock) */}
          <Signal className="h-3 w-3 text-muted-foreground" />

          {/* Battery status */}
          {batteryInfo && (
            <div className="flex items-center gap-1">
              <Battery
                className={`h-3 w-3 ${
                  batteryInfo.charging
                    ? "text-green-600"
                    : batteryInfo.level > 0.2
                      ? "text-muted-foreground"
                      : "text-red-600"
                }`}
              />
              <span className="text-[10px] font-medium">{Math.round(batteryInfo.level * 100)}%</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
