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

    // 🔴 1. CHECK TENANT SETTINGS
    const { data: activeSettings } = await supabase.from('tenant_settings').select('tenant_id').eq('cron_kyc', true);
    const enabledTenantIds = activeSettings?.map(s => s.tenant_id) || [];
    
    if (enabledTenantIds.length === 0) {
      console.log("⏸️ KYC Reminders paused for all tenants.");
      return NextResponse.json({ message: "Job paused for all tenants." });
    }

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: leads, error } = await supabase
      .from('leads')
      .select('id, phone, name')
      .in('tenant_id', enabledTenantIds) // Isolation
      .eq('status', 'Documents_Sent') 
      .eq('kyc_reminder_sent', false)
      .lte('kyc_requested_at', twentyFourHoursAgo);

    if (error) throw error;
    if (!leads || leads.length === 0) return NextResponse.json({ status: "success", message: "No reminders needed." });

    let sentCount = 0;
    for (const lead of leads) {
        const res = await sendKYCRequestTemplate(lead.id, lead.phone, true);
        if (res.success) sentCount++;
    }

    return NextResponse.json({ status: "success", message: `Fired ${sentCount} reminders out of ${leads.length} pending.` });

  } catch (error: any) {
    console.error("❌ [CRON ERROR]", error);
    return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  }
}
