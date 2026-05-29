import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { differenceInMinutes, parseISO } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // 1. CRON SECURITY (Optional but recommended)
    const authHeader = request.headers.get('authorization');
    if (process.env.NODE_ENV !== 'development' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log("⏱️ [CRON] Running Multi-Tenant Auto-Checkout...");

    // Initialize Admin Client to bypass RLS for background jobs
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const today = new Date().toISOString().split('T')[0];
    const autoCheckoutTimeStr = `${today}T19:00:00`; 
    const autoCheckoutDate = new Date(autoCheckoutTimeStr);

    // 🔴 2. FETCH TENANTS WITH AUTO-CHECKOUT ENABLED
    const { data: activeTenants, error: tenantError } = await supabaseAdmin
      .from('tenant_settings')
      .select('tenant_id')
      .eq('cron_auto_checkout', true);

    if (tenantError) throw tenantError;

    if (!activeTenants || activeTenants.length === 0) {
      console.log("⏭️ [CRON] No tenants have auto-checkout enabled. Skipping.");
      return NextResponse.json({ message: 'No tenants have auto-checkout enabled.' });
    }

    // Extract just the IDs
    const enabledTenantIds = activeTenants.map(t => t.tenant_id);

    // 🔴 3. FETCH ACTIVE SESSIONS ONLY FOR ENABLED TENANTS
    const { data: activeSessions, error: fetchError } = await supabaseAdmin
      .from('attendance')
      .select('*')
      .in('tenant_id', enabledTenantIds) // ISOLATION: Only fetch from opted-in companies
      .eq('date', today)
      .not('check_in', 'is', null)
      .is('check_out', null);

    if (fetchError) throw fetchError;

    if (!activeSessions || activeSessions.length === 0) {
      console.log("✅ [CRON] No active sessions found to auto-checkout.");
      return NextResponse.json({ message: 'No active sessions found to auto-checkout.' });
    }

    console.log(`⚠️ [CRON] Auto-checking out ${activeSessions.length} users...`);

    // 4. PROCESS CHECKOUTS
    const updatePromises = activeSessions.map(async (session) => {
      const checkInDate = new Date(session.check_in);
      
      let totalMinutes = differenceInMinutes(autoCheckoutDate, checkInDate);
      let breakMinutes = 0;

      if (session.lunch_start && session.lunch_end) {
        breakMinutes = differenceInMinutes(parseISO(session.lunch_end), parseISO(session.lunch_start));
      } else if (session.lunch_start && !session.lunch_end) {
        breakMinutes = differenceInMinutes(autoCheckoutDate, parseISO(session.lunch_start));
        await supabaseAdmin.from('attendance')
            .update({ lunch_end: autoCheckoutTimeStr })
            .eq('id', session.id);
      }

      const workingMinutes = Math.max(0, totalMinutes - breakMinutes);
      const hours = Math.floor(workingMinutes / 60);
      const mins = workingMinutes % 60;
      const totalHoursStr = `${hours}:${mins.toString().padStart(2, '0')}`;

      const existingNotes = session.notes ? session.notes + '\n' : '';
      const autoNote = "System: Auto-checked out at 7:00 PM";

      // 🔴 EXTRA ISOLATION SAFETY: Match both ID and Tenant ID on the update
      return supabaseAdmin
        .from('attendance')
        .update({
          check_out: autoCheckoutTimeStr,
          total_hours: totalHoursStr,
          status: 'present',
          notes: existingNotes + autoNote,
          updated_at: new Date().toISOString()
        })
        .eq('id', session.id)
        .eq('tenant_id', session.tenant_id); 
    });

    await Promise.all(updatePromises);

    console.log(`🏁 [CRON FINISHED] Successfully checked out ${activeSessions.length} employees.`);
    
    return NextResponse.json({ 
      success: true, 
      message: `Auto-checked out ${activeSessions.length} employees across opted-in workspaces.`,
      users_affected: activeSessions.length
    });

  } catch (error) {
    console.error("🔥 [CRON ERROR] Auto-checkout failed:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
