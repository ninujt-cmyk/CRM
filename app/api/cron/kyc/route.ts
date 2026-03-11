import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendKYCRequestTemplate } from '@/app/actions/whatsapp';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // 1. CRON SECURITY (Optional but recommended to prevent public execution)
  const authHeader = request.headers.get('authorization');
  if (process.env.NODE_ENV !== 'development' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log("⏰ [CRON] Waking up to check for 24-hour KYC Reminders...");

  try {
    // Use the Service Role Key to bypass RLS for background jobs
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 🔴 2. FETCH TENANTS WITH KYC REMINDERS ENABLED
    const { data: activeTenants, error: tenantError } = await supabaseAdmin
      .from('tenant_settings')
      .select('tenant_id')
      .eq('cron_kyc', true);

    if (tenantError) throw tenantError;

    if (!activeTenants || activeTenants.length === 0) {
      console.log("⏭️ [CRON] No tenants have KYC reminders enabled. Skipping.");
      return NextResponse.json({ status: "success", message: 'No tenants opted in.' });
    }

    // Extract the opted-in tenant IDs
    const enabledTenantIds = activeTenants.map(t => t.tenant_id);

    // Calculate exactly 24 hours ago
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // 🔴 3. FETCH LEADS STRICTLY FOR ENABLED TENANTS
    // 1. Status is STILL 'Documents_Sent'
    // 2. Reminder hasn't been sent yet
    // 3. The first request was sent 24+ hours ago
    const { data: leads, error } = await supabaseAdmin
      .from('leads')
      .select('id, phone, name, tenant_id')
      .in('tenant_id', enabledTenantIds) // ISOLATION: Only fetch opted-in companies
      .eq('status', 'Documents_Sent') 
      .eq('kyc_reminder_sent', false)
      .lte('kyc_requested_at', twentyFourHoursAgo);

    if (error) throw error;

    if (!leads || leads.length === 0) {
        console.log("✅ [CRON] No pending reminders found right now for active tenants.");
        return NextResponse.json({ status: "success", message: "No reminders needed." });
    }

    console.log(`🚀 [CRON] Found ${leads.length} leads requiring a 24-hour reminder across active workspaces.`);

    let sentCount = 0;

    // 4. PROCESS WHATSAPP REMINDERS
    // (Your sendKYCRequestTemplate should also be updated to use the tenant's specific WhatsApp API Key internally)
    for (const lead of leads) {
        console.log(`📱 Sending reminder to: ${lead.name} (${lead.phone}) [Tenant: ${lead.tenant_id}]`);
        
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
