import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
export const dynamic = 'force-dynamic'

const MESSAGES = {
  LATE_CHECKIN: ["⏰ It's 9:30 AM! You aren't checked in yet. Don't lose your pay—Clock in NOW! 💸", "Empty chair alert! 🪑 Check in fast or the system marks you Absent.", "Rise and shine! The market is waiting. Mark your attendance ASAP! ☀️"],
  LOW_PERFORMANCE_MORNING: ["📉 It's 11 AM and the board is quiet. Try calling your 'Follow Up' list now for a quick win!", "💡 Tip: Energy is everything! Stand up, stretch, and dial your best leads now.", "Silent morning? Break the ice! Ask for referrals to boost your login count."],
  LUNCH_APPROACHING: ["🍔 Hunger is kicking in! Close one login and earn your Biryani.", "Lunch is coming fast! 🍛 Finish that follow-up call so you can eat in peace.", "Fuel up soon! But first, let's get one approval on the board."],
  POST_LUNCH_BOOST: ["⚡ 2 PM Slump? No way! Splash some water on your face and rock the second half.", "Come back to work and ROCK! 🎸 The afternoon is where the closers shine.", "Coffee time ☕ Wake up! The leads are waiting for your magic."],
  LAST_HOUR_PUSH: ["🏁 It's 5 PM! The final lap. Call those 'Thinking about it' clients NOW.", "🍕 Pizza party vibes? Only if we hit the target! Push hard this last hour.", "Don't go home empty-handed! One last push for the day. You got this! 💪"],
  WEEKEND_VIBES: ["🎉 Weekend is almost here! Push numbers now, enjoy the party later.", "Work hard, Party hard! 🍹 Close this deal and your weekend tastes sweeter.", "Incentive Alert! 💰 Hit the target and the pizza is on us!"]
}

const getRandomMsg = (array: string[]) => array[Math.floor(Math.random() * array.length)]

export async function GET(request: Request) {
  try {
    if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 🔴 1. CHECK TENANT SETTINGS
    const { data: activeSettings } = await supabase.from('tenant_settings').select('tenant_id').eq('cron_smart_notifications', true);
    const enabledTenantIds = activeSettings?.map(s => s.tenant_id) || [];
    
    if (enabledTenantIds.length === 0) return NextResponse.json({ message: "Job paused for all tenants." });

    const now = new Date(); const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
    const istDate = new Date(utcTime + 5.5 * 60 * 60 * 1000)
    const currentHour = istDate.getHours(); const currentMinute = istDate.getMinutes();
    const isWeekend = [5, 6].includes(istDate.getDay()) 

    let notificationsSent = 0

    if (currentHour === 9 && currentMinute >= 30 && currentMinute < 60) {
      const { data: telecallers } = await supabase.from('users').select('id, full_name').eq('role', 'telecaller').eq('is_active', true).in('tenant_id', enabledTenantIds)
      const todayStr = istDate.toISOString().split('T')[0]
      const { data: attendance } = await supabase.from('attendance').select('user_id').eq('date', todayStr).in('tenant_id', enabledTenantIds)
      const checkedInIds = new Set(attendance?.map(a => a.user_id) || [])

      for (const user of (telecallers || [])) {
        if (!checkedInIds.has(user.id)) {
          await sendNotification(user.id, "⚠️ Attendance Alert", getRandomMsg(MESSAGES.LATE_CHECKIN))
          notificationsSent++
        }
      }
    }

    if (currentHour >= 11 && currentHour <= 17) {
      const startOfDay = new Date(istDate.setHours(0,0,0,0)).toISOString()
      const endOfDay = new Date(istDate.setHours(23,59,59,999)).toISOString()
      const { data: telecallers } = await supabase.from('users').select('id, full_name').eq('role', 'telecaller').eq('is_active', true).in('tenant_id', enabledTenantIds)
      const { data: leads } = await supabase.from('leads').select('assigned_to, status').eq('status', 'Login Done').gte('updated_at', startOfDay).lte('updated_at', endOfDay).in('tenant_id', enabledTenantIds)

      const loginCounts: Record<string, number> = {}
      leads?.forEach(l => { loginCounts[l.assigned_to] = (loginCounts[l.assigned_to] || 0) + 1 })

      for (const user of (telecallers || [])) {
        const count = loginCounts[user.id] || 0
        let title = "Performance Update"; let message = ""

        if (currentHour === 11 && count === 0) { title = "📈 Catch Up Required"; message = getRandomMsg(MESSAGES.LOW_PERFORMANCE_MORNING) }
        else if (currentHour === 13) { title = "🍛 Lunch Time Soon"; message = getRandomMsg(MESSAGES.LUNCH_APPROACHING) }
        else if (currentHour === 14) { title = "🚀 Back to Work"; message = getRandomMsg(MESSAGES.POST_LUNCH_BOOST) }
        else if (currentHour === 17) { title = "🏁 Final Hour"; message = isWeekend ? getRandomMsg(MESSAGES.WEEKEND_VIBES) : getRandomMsg(MESSAGES.LAST_HOUR_PUSH) }
        else if (count < 2) { title = "💡 Quick Tip"; message = `You have ${count} logins. Pick up the pace! Call your fresh leads now.` }

        if (message) { await sendNotification(user.id, title, message); notificationsSent++ }
      }
    }

    return NextResponse.json({ success: true, notifications_sent: notificationsSent })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function sendNotification(userId: string, title: string, message: string) {
    await supabase.from('notifications').insert({
        user_id: userId, title: title, message: message, is_read: false, type: 'system', created_at: new Date().toISOString()
    })
}
