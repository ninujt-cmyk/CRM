import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// --- CONFIGURATION ---
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

// --- CREATIVE MESSAGE BANK ---
const MESSAGES = {
  LATE_CHECKIN: [
    "⏰ It's 9:30 AM! You aren't checked in yet. Don't lose your pay—Clock in NOW! 💸",
    "Empty chair alert! 🪑 Check in fast or the system marks you Absent.",
    "Rise and shine! The market is waiting. Mark your attendance ASAP! ☀️"
  ],
  ON_TIME_CHECKIN: [
    "🚀 You're here! Awesome start. Let's crush today's login targets!",
    "Great to see you! Grab a coffee and let's make some money today. ☕💰",
    "Attendance marked ✅ Now let's mark some success stories!"
  ],
  LOW_PERFORMANCE_MORNING: [
    "📉 It's 11 AM and the board is quiet. Try calling your 'Follow Up' list now for a quick win!",
    "💡 Tip: Energy is everything! Stand up, stretch, and dial your best leads now.",
    "Silent morning? Break the ice! Ask for referrals to boost your login count."
  ],
  LUNCH_APPROACHING: [
    "🍔 Hunger is kicking in! Close one login and earn your Biryani.",
    "Lunch is coming fast! 🍛 Finish that follow-up call so you can eat in peace.",
    "Fuel up soon! But first, let's get one approval on the board."
  ],
  POST_LUNCH_BOOST: [
    "⚡ 2 PM Slump? No way! Splash some water on your face and rock the second half.",
    "Come back to work and ROCK! 🎸 The afternoon is where the closers shine.",
    "Coffee time ☕ Wake up! The leads are waiting for your magic."
  ],
  LAST_HOUR_PUSH: [
    "🏁 It's 5 PM! The final lap. Call those 'Thinking about it' clients NOW.",
    "🍕 Pizza party vibes? Only if we hit the target! Push hard this last hour.",
    "Don't go home empty-handed! One last push for the day. You got this! 💪"
  ],
  WEEKEND_VIBES: [
    "🎉 Weekend is almost here! Push numbers now, enjoy the party later.",
    "Work hard, Party hard! 🍹 Close this deal and your weekend tastes sweeter.",
    "Incentive Alert! 💰 Hit the target and the pizza is on us!"
  ]
}

// Helper to pick random message
const getRandomMsg = (array: string[]) => array[Math.floor(Math.random() * array.length)]

export async function GET(request: Request) {
  try {
    // 1. Security Check
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Determine Time (IST)
    // We adjust UTC time to IST (UTC+5:30)
    const now = new Date()
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000)
    const istOffset = 5.5 * 60 * 60 * 1000
    const istDate = new Date(utcTime + istOffset)
    
    const currentHour = istDate.getHours() // 0-23
    const currentMinute = istDate.getMinutes() // 0-59
    const isWeekend = [5, 6].includes(istDate.getDay()) // 5=Friday, 6=Saturday (Adjust as needed)

    console.log(`⏰ Running Notification Job. Time: ${currentHour}:${currentMinute} (IST)`)

    let notificationsSent = 0

    // =================================================================
    // SCENARIO 1: 9:30 AM - CHECK-IN REMINDERS
    // =================================================================
    if (currentHour === 9 && currentMinute >= 30 && currentMinute < 60) {
      
      // Get all active telecallers
      const { data: telecallers } = await supabase
        .from('users')
        .select('id, full_name')
        .eq('role', 'telecaller')
        .eq('is_active', true)

      if (!telecallers) return NextResponse.json({ message: "No users" })

      // Check attendance for today
      const todayStr = istDate.toISOString().split('T')[0]
      
      const { data: attendance } = await supabase
        .from('attendance')
        .select('user_id')
        .eq('date', todayStr)

      const checkedInIds = new Set(attendance?.map(a => a.user_id) || [])

      for (const user of telecallers) {
        if (!checkedInIds.has(user.id)) {
          // NOT CHECKED IN
          await sendNotification(user.id, "⚠️ Attendance Alert", getRandomMsg(MESSAGES.LATE_CHECKIN))
        } else {
          // CHECKED IN (Optional: Send only once. Using a 'sent_today' flag in DB is better, 
          // but for simplicity, we assume this runs once or we allow duplicate motivation)
           // logic to ensure we don't spam 'Good Morning' every 10 mins omitted for brevity
        }
        notificationsSent++
      }
    }

    // =================================================================
    // SCENARIO 2: HOURLY PERFORMANCE CHECKS (11 AM - 5 PM)
    // =================================================================
    if (currentHour >= 11 && currentHour <= 17) {
      
      // Fetch Logins Today
      const startOfDay = new Date(istDate.setHours(0,0,0,0)).toISOString()
      const endOfDay = new Date(istDate.setHours(23,59,59,999)).toISOString()

      // Get Users & Their Login Counts
      const { data: telecallers } = await supabase.from('users').select('id, full_name').eq('role', 'telecaller').eq('is_active', true)
      const { data: leads } = await supabase.from('leads')
        .select('assigned_to, status')
        .eq('status', 'Login Done') // Check your specific status string
        .gte('updated_at', startOfDay)
        .lte('updated_at', endOfDay)

      // Map Counts
      const loginCounts: Record<string, number> = {}
      leads?.forEach(l => { loginCounts[l.assigned_to] = (loginCounts[l.assigned_to] || 0) + 1 })

      for (const user of (telecallers || [])) {
        const count = loginCounts[user.id] || 0
        let title = "Performance Update"
        let message = ""

        // 11 AM Logic
        if (currentHour === 11) {
            if (count === 0) {
                title = "📈 Catch Up Required"
                message = getRandomMsg(MESSAGES.LOW_PERFORMANCE_MORNING)
            }
        }
        // 1 PM (Lunch)
        else if (currentHour === 13) {
            title = "🍛 Lunch Time Soon"
            message = getRandomMsg(MESSAGES.LUNCH_APPROACHING)
        }
        // 2 PM (Back to work)
        else if (currentHour === 14) {
             title = "🚀 Back to Work"
             message = getRandomMsg(MESSAGES.POST_LUNCH_BOOST)
        }
        // 5 PM (End Day Push)
        else if (currentHour === 17) {
            title = "🏁 Final Hour"
            message = isWeekend ? getRandomMsg(MESSAGES.WEEKEND_VIBES) : getRandomMsg(MESSAGES.LAST_HOUR_PUSH)
        }
        // General Hourly Low Performance Check (12pm, 3pm, 4pm)
        else if (count < 2) { 
            // If logins are very low in middle of day
            title = "💡 Quick Tip"
            message = `You have ${count} logins. Pick up the pace! Call your fresh leads now.`
        }

        if (message) {
            await sendNotification(user.id, title, message)
            notificationsSent++
        }
      }
    }

    return NextResponse.json({ success: true, notifications_sent: notificationsSent })

  } catch (error: any) {
    console.error("❌ Notification Job Failed:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// --- HELPER: INSERT INTO DB ---
async function sendNotification(userId: string, title: string, message: string) {
    // 1. Insert into 'notifications' table
    const { error } = await supabase.from('notifications').insert({
        user_id: userId,
        title: title,
        message: message,
        is_read: false,
        type: 'system', // or 'alert'
        created_at: new Date().toISOString()
    })

    if (error) console.error("DB Insert Error", error)
    
    // 2. (Optional) Trigger Push Notification via your existing API
    // If you want actual device alerts, you can fetch the user's push_subscription here 
    // and send using web-push library.
}
