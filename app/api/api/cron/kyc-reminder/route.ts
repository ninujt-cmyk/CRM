import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendKYCRequestTemplate } from '@/app/actions/whatsapp';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  console.log("⏰ [CRON] Waking up to check for 24-hour KYC Reminders...");

  try {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Calculate exactly 24 hours ago
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Find leads where:
    // 1. Status is STILL 'Documents_Sent' (If they uploaded docs, you probably changed the status, so it skips them!)
    // 2. Reminder hasn't been sent yet
    // 3. The first request was sent 24+ hours ago
    const { data: leads, error } = await supabase
      .from('leads')
      .select('id, phone, name')
      .eq('status', 'Documents_Sent') 
      .eq('kyc_reminder_sent', false)
      .lte('kyc_requested_at', twentyFourHoursAgo);

    if (error) throw error;

    if (!leads || leads.length === 0) {
        console.log("✅ [CRON] No pending reminders found right now.");
        return NextResponse.json({ status: "success", message: "No reminders needed." });
    }

    console.log(`🚀 [CRON] Found ${leads.length} leads requiring a 24-hour reminder.`);

    let sentCount = 0;

    // Loop through the leads and fire the WhatsApp function
    for (const lead of leads) {
        console.log(`📱 Sending reminder to: ${lead.name} (${lead.phone})`);
        
        // Notice the 'true' at the end! This tells the function it is the reminder.
        const res = await sendKYCRequestTemplate(lead.id, lead.phone, true);
        
        if (res.success) {
            sentCount++;
        }
    }

    return NextResponse.json({ 
        status: "success", 
        message: `Fired ${sentCount} reminders out of ${leads.length} pending.` 
    });

  } catch (error: any) {
    console.error("❌ [CRON ERROR]", error);
    return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  }
}
