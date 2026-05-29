import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import webpush from 'web-push'

// 1. CONFIGURATION
if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:support@bankscart.com', // Put your real admin email here
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-project.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-key"
)

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { record } = body // The 'record' comes from the Supabase Webhook payload
    
    // Safety check: Ensure we have a user_id to target
    if (!record || !record.user_id) {
        return NextResponse.json({ message: 'Invalid payload' }, { status: 400 })
    }

    console.log(`🔔 Processing notification for User: ${record.user_id}`)

    // 2. FETCH SUBSCRIPTIONS FOR THIS USER
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', record.user_id)

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`No devices found for user ${record.user_id}`)
      return NextResponse.json({ message: 'No subscriptions found' })
    }

    // 3. SEND NOTIFICATIONS (Parallel)
    const notificationPayload = JSON.stringify({
      title: record.title || "New Notification",
      body: record.message || "You have a new update.",
      icon: "/icons/icon-192x192.png", // Ensure this path exists in /public
      url: "/"
    })

    const sendPromises = subscriptions.map(async (sub) => {
      try {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh_key,
            auth: sub.auth_key
          }
        }

        // DIRECT SEND - No manual 'atob' decoding needed!
        await webpush.sendNotification(pushSubscription as any, notificationPayload)
        
      } catch (error: any) {
        // If 410 Gone, the subscription is dead (user cleared cache/unsubscribed)
        if (error.statusCode === 410) {
          console.log(`🗑️ Removing dead subscription for user ${sub.user_id}`)
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        } else {
          console.error("❌ Push failed:", error.message)
        }
      }
    })

    await Promise.all(sendPromises)

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error("🔥 Webhook Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
