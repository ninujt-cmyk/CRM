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

    // 🔴 2. FETCH ORGANIZATIONS WITH WORKFLOW TRIGGERS
    const { data: orgs, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('id, workflow_triggers');

    if (orgError) throw orgError;

    if (!orgs || orgs.length === 0) {
      console.log("⏭️ [CRON] No organizations found. Skipping.");
      return NextResponse.json({ status: "success", message: 'No organizations found.' });
    }

    // Calculate exactly 24 hours ago
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    let sentCount = 0;
    let totalPending = 0;

    // 🔴 3. PROCESS EACH ORGANIZATION
    for (const org of orgs) {
      // Get the document request trigger for this tenant, fallback to "Documents_Sent"
      const docTrigger = org.workflow_triggers?.on_document_request || "Documents_Sent";

      const { data: leads, error } = await supabaseAdmin
        .from('leads')
        .select('id, phone, name, tenant_id')
        .eq('tenant_id', org.id) 
        .eq('status', docTrigger) 
        .eq('kyc_reminder_sent', false)
        .lte('kyc_requested_at', twentyFourHoursAgo);

      if (error) {
        console.error(`❌ [CRON] Error fetching leads for org ${org.id}:`, error);
        continue;
      }

      if (!leads || leads.length === 0) continue;

      totalPending += leads.length;

      // 4. PROCESS WHATSAPP REMINDERS
      for (const lead of leads) {
          console.log(`📱 Sending reminder to: ${lead.name} (${lead.phone}) [Tenant: ${lead.tenant_id}]`);
          
          const res = await sendKYCRequestTemplate(lead.id, lead.phone, true);
          
          if (res.success) {
              sentCount++;
          }
      }
    }

    console.log(`✅ [CRON] Finished processing. Found ${totalPending} pending, sent ${sentCount} reminders.`);

    return NextResponse.json({ 
        status: "success", 
        message: `Fired ${sentCount} reminders out of ${totalPending} pending.` 
    });

  } catch (error: any) {
    console.error("❌ [CRON ERROR]", error);
    return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  }
}
