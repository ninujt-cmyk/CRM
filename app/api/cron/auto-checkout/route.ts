import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { differenceInMinutes, parseISO } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 🔴 1. CHECK TENANT SETTINGS
    const { data: activeSettings } = await supabase
      .from('tenant_settings')
      .select('tenant_id')
      .eq('cron_auto_checkout', true);
      
    const enabledTenantIds = activeSettings?.map(s => s.tenant_id) || [];
    
    if (enabledTenantIds.length === 0) {
      console.log("⏸️ Auto-Checkout is paused for all tenants.");
      return NextResponse.json({ message: "Job paused for all tenants." });
    }

    const today = new Date().toISOString().split('T')[0];
    const autoCheckoutTimeStr = `${today}T19:00:00`; 
    const autoCheckoutDate = new Date(autoCheckoutTimeStr);

    // 2. Fetch active sessions ONLY for enabled tenants
    const { data: activeSessions, error: fetchError } = await supabase
      .from('attendance')
      .select('*')
      .in('tenant_id', enabledTenantIds) // Isolation
      .eq('date', today)
      .not('check_in', 'is', null)
      .is('check_out', null);

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
    if (!activeSessions || activeSessions.length === 0) return NextResponse.json({ message: 'No active sessions found.' });

    // 3. Process Updates
    const updatePromises = activeSessions.map(async (session) => {
      const checkInDate = new Date(session.check_in);
      let totalMinutes = differenceInMinutes(autoCheckoutDate, checkInDate);
      let breakMinutes = 0;

      if (session.lunch_start && session.lunch_end) {
        breakMinutes = differenceInMinutes(parseISO(session.lunch_end), parseISO(session.lunch_start));
      } else if (session.lunch_start && !session.lunch_end) {
        breakMinutes = differenceInMinutes(autoCheckoutDate, parseISO(session.lunch_start));
        await supabase.from('attendance').update({ lunch_end: autoCheckoutTimeStr }).eq('id', session.id);
      }

      const workingMinutes = Math.max(0, totalMinutes - breakMinutes);
      const hours = Math.floor(workingMinutes / 60);
      const mins = workingMinutes % 60;
      const totalHoursStr = `${hours}:${mins.toString().padStart(2, '0')}`;

      const existingNotes = session.notes ? session.notes + '\n' : '';
      
      return supabase.from('attendance').update({
          check_out: autoCheckoutTimeStr,
          total_hours: totalHoursStr,
          status: 'present',
          notes: existingNotes + "System: Auto-checked out at 7:00 PM",
          updated_at: new Date().toISOString()
      }).eq('id', session.id);
    });

    await Promise.all(updatePromises);
    return NextResponse.json({ success: true, message: `Auto-checked out ${activeSessions.length} employees.` });

  } catch (error) {
    console.error("Auto-checkout error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
