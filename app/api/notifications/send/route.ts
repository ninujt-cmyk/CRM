import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import webpush from "web-push"

function configureWebPush() {
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
  const vapidEmail = process.env.VAPID_EMAIL || "mailto:your-email@example.com"

  if (!vapidPublicKey || !vapidPrivateKey) {
    throw new Error("VAPID keys are not configured in environment variables")
  }

  webpush.setVapidDetails(
    vapidEmail,
    vapidPublicKey,
    vapidPrivateKey
  )
}

let isWebPushConfigured = false

try {
  configureWebPush()
  isWebPushConfigured = true
  console.log("Web-push configured successfully")
} catch (error) {
  console.error("Failed to configure web-push:", error instanceof Error ? error.message : "Unknown error")
}

export async function POST(request: NextRequest) {
  try {
    if (!isWebPushConfigured) {
      return NextResponse.json(
        { error: "Push notifications are not configured on the server" },
        { status: 500 }
      )
    }

    const { userIds, type, title, message, follow_up_id, lead_id } = await request.json()
    const supabase = await createClient()

    // Get current user (admin check)
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is admin
    const userRole = user.user_metadata?.role || user.app_metadata?.role
    if (userRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Insert notification for each user
    const notifications = (userIds as string[]).map(user_id => ({
      user_id,
      type,
      title,
      message,
      follow_up_id: follow_up_id || null,
      lead_id: lead_id || null,
      read: false
    }));

    const { error: insertError } = await supabase
      .from("notifications")
      .insert(notifications);

    if (insertError) {
      return NextResponse.json({ error: "Failed to insert notifications", details: insertError.message }, { status: 500 })
    }

    // Optionally, send push notifications to each user
    let pushResults: any[] = []
    for (const user_id of userIds) {
      const { data: subscriptions, error: subError } = await supabase
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", user_id)

      if (subError) {
        console.error("Error fetching subscriptions:", subError)
        continue;
      }

      if (!subscriptions || subscriptions.length === 0) continue

      const payload = JSON.stringify({
        title,
        body: message,
        icon: "/icons/icon-192x192.png",
        badge: "/icons/icon-72x72.png",
        url: "/",
        data: { follow_up_id, lead_id }
      })

      for (const subscription of subscriptions) {
        try {
          const pushSubscription = {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh_key,
              auth: subscription.auth_key,
            },
          }
          await webpush.sendNotification(pushSubscription, payload)
          pushResults.push({ success: true, endpoint: subscription.endpoint })
        } catch (error) {
          console.error("Failed to send notification to endpoint:", subscription.endpoint, error)
          pushResults.push({
            success: false,
            endpoint: subscription.endpoint,
            error: error instanceof Error ? error.message : "Unknown error",
          })
        }
      }
    }

    return NextResponse.json({
      message: `Notifications inserted and push sent`,
      pushResults,
    })
  } catch (error) {
    console.error("Error in send notification endpoint:", error)
    return NextResponse.json(
      { 
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error"
      }, 
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    configured: isWebPushConfigured,
    message: isWebPushConfigured 
      ? "Web-push is configured correctly" 
      : "Web-push is not configured. Check VAPID keys in environment variables."
  })
}
