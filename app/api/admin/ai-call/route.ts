import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    // 🔒 AUTH CHECK
    const supabase = await createServerClient();
    const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userCheck } = await supabase
      .from("users")
      .select("role")
      .eq("id", currentUser.id)
      .single();

    const allowedRoles = ["super_admin", "tenant_admin", "team_leader"];
    if (!userCheck?.role || !allowedRoles.includes(userCheck.role)) {
      return NextResponse.json({ error: "Forbidden: You do not have permission to execute this admin action." }, { status: 403 });
    }

    // 🔴 1. TIME RESTRICTION (10 AM to 9 PM IST)
    const now = new Date();
    const istHour = parseInt(new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        hour12: false
    }).format(now), 10);

    // If before 10:00 AM or after 21:00 (9 PM), block the call
    if (istHour < 10 || istHour >= 21) {
        return NextResponse.json({ 
            error: "Calls are only allowed between 10:00 AM and 9:00 PM." 
        }, { status: 403 });
    }

    const { leadId, phoneNumber } = await req.json();

    if (!leadId || !phoneNumber) {
      return NextResponse.json({ error: "Missing lead details" }, { status: 400 });
    }

    // Use Service Role to bypass RLS for server-side execution
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 2. Get Lead & Tenant info to verify wallet balance
    const { data: lead } = await supabaseAdmin
      .from('leads')
      .select('tenant_id')
      .eq('id', leadId)
      .single();

    if (!lead?.tenant_id) {
      return NextResponse.json({ error: "Lead or Workspace not found" }, { status: 404 });
    }

    const { data: wallet } = await supabaseAdmin
      .from('tenant_wallets')
      .select('credits_balance')
      .eq('tenant_id', lead.tenant_id)
      .single();

    if (!wallet || wallet.credits_balance <= 0) {
      return NextResponse.json({ error: "Insufficient AI credits" }, { status: 403 });
    }

    // 3. Format number for Fonada OBD
    const safePhone = phoneNumber.replace(/^\+?91/, '').slice(-10);

    // 🔴 4. DAILY ROTATING LEAD NAME
    // Uses the current day of the month to generate a static name for the entire day
    const dayOfMonth = now.getDate(); // Returns 1-31
    const namesList = [
        "Amit", "Rahul", "Priya", "Neha", "Vikram", "Sneha", 
        "Rohan", "Pooja", "Karan", "Anjali"
    ];
    // Pick a name based on the day, and append the date so it changes exactly at midnight
    const dailyLeadName = `${namesList[dayOfMonth % namesList.length]}_${dayOfMonth}`;

    // 5. Exact API mapping from Fonada's cURL
    const obdPayload = {
      leadName: dailyLeadName, 
      campaignId: 194, 
      userId: 59,      
      ukey: "ZTIvWSuaS46CVoDY",
      header: "Phone",
      retryInfo: {
        retryType: "R",
        retryOnFail: 3,
        retryTimeOnFail: 3,
        retryOnBusy: 3, 
        retryTimeOnBusy: 3,
        retryOnAns: 0,
        retryTimeOnAns: 0,
        retryOnNoAns: 3,
        retryTimeOnNoAns: 3,
        noOfRetry: 3
      },
      phoneNumberDetails: [
        {
          phoneNumber: safePhone
        }
      ]
    };

    // Push to the exact v6 dispatcher endpoint provided by Fonada
    const res = await fetch("https://bt.ivrobd.com/api/v1/astrixdispatcher/v6/lead?isDND=false", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(obdPayload),
    });

    const rawText = await res.text();
    console.log(`[AI OBD PUSH] Lead: ${leadId}, DailyName: ${dailyLeadName}, Response: ${rawText}`);

    // If Fonada rejects the call request entirely
    if (!res.ok) {
        throw new Error(`Fonada API Error: ${res.status} - ${rawText}`);
    }

    // 6. Mark Lead as "AI Dialing" in your CRM
    await supabaseAdmin
      .from('leads')
      .update({ 
        status: 'AI Dialing', 
        last_contacted: new Date().toISOString() 
      })
      .eq('id', leadId);

    return NextResponse.json({ success: true, message: "AI Call Initiated!" });

  } catch (error: any) {
    console.error("🔥 [AI DIAL ERROR]:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
