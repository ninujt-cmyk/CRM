"use client"

import { useState, useEffect } from "react"
import { 
  Wifi, WifiOff, BatteryCharging, BatteryFull, BatteryMedium, 
  BatteryLow, BatteryWarning, SignalHigh, SignalMedium, SignalLow
} from "lucide-react"

interface NetworkInfo {
  online: boolean
  effectiveType?: string
  downlink?: number
  rtt?: number // Ping in milliseconds
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
    // 1. Check if PWA
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone
    setIsStandalone(standalone)

    if (!standalone) return;

    // 2. Dynamic Safe Area Padding Adjuster
    const adjustAppPadding = () => {
      const bar = document.getElementById('pwa-status-bar');
      if (bar) {
        document.body.style.paddingTop = `${bar.offsetHeight}px`;
      }
    };
    
    setTimeout(adjustAppPadding, 50);
    window.addEventListener('resize', adjustAppPadding);

    // 3. Network Tracker
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

    // 4. Battery Tracker
    const updateBatteryInfo = async () => {
      try {
        if ("getBattery" in navigator) {
          const battery = await (navigator as any).getBattery()
          const handleBatteryChange = () => setBatteryInfo({ level: battery.level, charging: battery.charging })
          
          handleBatteryChange()
          battery.addEventListener("levelchange", handleBatteryChange)
          battery.addEventListener("chargingchange", handleBatteryChange)
        }
      } catch (error) {
        console.log("Battery API not supported")
      }
    }
    updateBatteryInfo()

    // 5. Clock Tick
    const timeInterval = setInterval(() => setCurrentTime(new Date()), 1000)

    return () => {
      window.removeEventListener('resize', adjustAppPadding)
      document.body.style.paddingTop = '0px'
      window.removeEventListener("online", updateNetworkInfo)
      window.removeEventListener("offline", updateNetworkInfo)
      clearInterval(timeInterval)
    }
  }, [])

  if (!isStandalone) return null

  // --- UI Helpers ---
  const getBatteryIcon = () => {
    if (!batteryInfo) return <BatteryFull className="h-3.5 w-3.5" />
    if (batteryInfo.charging) return <BatteryCharging className="h-3.5 w-3.5 text-emerald-500" />
    if (batteryInfo.level > 0.8) return <BatteryFull className="h-3.5 w-3.5 text-slate-700" />
    if (batteryInfo.level > 0.4) return <BatteryMedium className="h-3.5 w-3.5 text-slate-600" />
    if (batteryInfo.level > 0.2) return <BatteryLow className="h-3.5 w-3.5 text-amber-500" />
    return <BatteryWarning className="h-3.5 w-3.5 text-red-500 animate-pulse" />
  }

  const getSignalIcon = () => {
    if (!networkInfo.online) return <WifiOff className="h-3 w-3 text-red-500" />
    if (!networkInfo.effectiveType) return <SignalHigh className="h-3 w-3 text-slate-700" />
    if (networkInfo.effectiveType === '4g') return <SignalHigh className="h-3 w-3 text-slate-700" />
    if (networkInfo.effectiveType === '3g') return <SignalMedium className="h-3 w-3 text-slate-600" />
    return <SignalLow className="h-3 w-3 text-amber-600" />
  }

  return (
    <div 
      id="pwa-status-bar" 
      className="fixed top-0 left-0 right-0 z-[100] bg-white/70 backdrop-blur-xl border-b border-slate-200/50 pt-[max(env(safe-area-inset-top),0px)] transition-colors"
    >
      <div className="flex items-center justify-between px-4 py-1.5 text-xs select-none">
        
        {/* LEFT: Time & Date Capsule */}
        <div className="flex items-center gap-1.5 font-medium tracking-tight text-slate-800">
          <span className="text-[13px]">
            {currentTime.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </span>
          <span className="text-[10px] text-slate-400 font-normal ml-1 hidden sm:inline-block">
            {currentTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
        </div>

        {/* CENTER: App Live Status */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-slate-100/80 px-2 py-0.5 rounded-full border border-slate-200/50 shadow-sm">
          <span className={`h-1.5 w-1.5 rounded-full ${networkInfo.online ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
            {networkInfo.online ? 'CRM Syncing' : 'Offline'}
          </span>
        </div>

        {/* RIGHT: System Metrics Capsule */}
        <div className="flex items-center gap-2.5">
          
          {/* Network UI */}
          <div className="flex items-center gap-1.5 bg-slate-100/50 px-2 py-0.5 rounded-full">
            {getSignalIcon()}
            {networkInfo.online ? (
              <div className="flex items-center gap-1">
                <Wifi className="h-3 w-3 text-slate-700" />
                {networkInfo.effectiveType && (
                  <span className="text-[10px] font-bold text-slate-600 uppercase">
                    {networkInfo.effectiveType}
                  </span>
                )}
                {/* Ping Display (If available in browser) */}
                {networkInfo.rtt && (
                  <span className="text-[9px] text-slate-400 font-mono ml-0.5">
                    {networkInfo.rtt}ms
                  </span>
                )}
              </div>
            ) : (
              <span className="text-[10px] font-bold text-red-500">No Connection</span>
            )}
          </div>

          {/* Battery UI */}
          {batteryInfo && (
            <div className="flex items-center gap-1 bg-slate-100/50 px-2 py-0.5 rounded-full">
              <span className={`text-[10px] font-bold ${batteryInfo.level <= 0.2 && !batteryInfo.charging ? 'text-red-600' : 'text-slate-700'}`}>
                {Math.round(batteryInfo.level * 100)}%
              </span>
              {getBatteryIcon()}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
