"use client"
import { useEffect } from "react"
import { createClient } from "@/lib/supabase/client"

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function PushSubscriber() {
  const supabase = createClient()

  useEffect(() => {
    async function registerServiceWorker() {
      if (!PUBLIC_KEY) {
        console.error("VAPID Public Key is missing!")
        return
      }

      if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js')
          
          const permission = await Notification.requestPermission()
          if (permission !== 'granted') return

          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY)
          })

          const subJson = subscription.toJSON()

          if (subJson.keys?.p256dh && subJson.keys?.auth) {
             // NEW: Call the Secure RPC Function
             const { error } = await supabase.rpc('save_push_subscription', {
               p_endpoint: subJson.endpoint,
               p_p256dh_key: subJson.keys.p256dh,
               p_auth_key: subJson.keys.auth
             })

             if (error) console.error("Subscription Error:", error)
             else console.log("✅ Device Subscribed (via Secure RPC)")
          }

        } catch (error) {
          console.error('Push registration failed:', error)
        }
      }
    }

    registerServiceWorker()
  }, [])

  return null
}
