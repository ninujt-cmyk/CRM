import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { differenceInMinutes, parseISO } from 'date-fns';

// Force this route to be dynamic so it runs fresh every time
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // 1. Initialize Supabase Admin Client
    // We use the SERVICE_ROLE_KEY to bypass Row Level Security (RLS)
    // so we can update users who are not currently logged in.
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const today = new Date().toISOString().split('T')[0];
    
    // Define the 7:00 PM auto-checkout timestamp for today
    // Note: Adjust the 'T19:00:00' if your server time zone differs from your local time
    const autoCheckoutTimeStr = `${today}T19:00:00`; 
    const autoCheckoutDate = new Date(autoCheckoutTimeStr);

    // 2. Fetch all active sessions (Checked In but NOT Checked Out)
    const { data: activeSessions, error: fetchError } = await supabase
      .from('attendance')
      .select('*')
      .eq('date', today)
      .not('check_in', 'is', null)
      .is('check_out', null);

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!activeSessions || activeSessions.length === 0) {
      return NextResponse.json({ message: 'No active sessions found to auto-checkout.' });
    }

    // 3. Process updates for each user
    const updatePromises = activeSessions.map(async (session) => {
      const checkInDate = new Date(session.check_in);
      
      // Calculate duration: From Check-in time to 7:00 PM
      let totalMinutes = differenceInMinutes(autoCheckoutDate, checkInDate);

      // Subtract Break Time (if they took a lunch break)
      let breakMinutes = 0;
      if (session.lunch_start && session.lunch_end) {
        breakMinutes = differenceInMinutes(parseISO(session.lunch_end), parseISO(session.lunch_start));
      } else if (session.lunch_start && !session.lunch_end) {
        // If they forgot to end lunch, assume lunch ended at 7 PM too (or handle differently)
        // For now, let's just count the time until 7 PM as break if they never came back
        breakMinutes = differenceInMinutes(autoCheckoutDate, parseISO(session.lunch_start));
        
        // Update lunch end as well
        await supabase.from('attendance').update({ lunch_end: autoCheckoutTimeStr }).eq('id', session.id);
      }

      const workingMinutes = Math.max(0, totalMinutes - breakMinutes);
      const hours = Math.floor(workingMinutes / 60);
      const mins = workingMinutes % 60;
      const totalHoursStr = `${hours}:${mins.toString().padStart(2, '0')}`;

      // Append note
      const existingNotes = session.notes ? session.notes + '\n' : '';
      const autoNote = "System: Auto-checked out at 7:00 PM";

      // Perform Update
      return supabase
        .from('attendance')
        .update({
          check_out: autoCheckoutTimeStr,
          total_hours: totalHoursStr,
          status: 'present', // Maintain present status
          notes: existingNotes + autoNote,
          updated_at: new Date().toISOString()
        })
        .eq('id', session.id);
    });

    await Promise.all(updatePromises);

    return NextResponse.json({ 
      success: true, 
      message: `Auto-checked out ${activeSessions.length} employees.`,
      users_affected: activeSessions.map(s => s.user_id)
    });

  } catch (error) {
    console.error("Auto-checkout error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
