import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Fallback number (e.g., your general IVR or a manager's number)
const FALLBACK_NUMBER = "919876543210"; 

export async function POST(request: NextRequest) {
  console.log("📞 [INBOUND ROUTING] Fonada is asking where to route a call...");

  try {
    const rawBody = await request.text();
    let body: any = {};
    if (rawBody) {
      try { body = JSON.parse(rawBody); } 
      catch(e) { body = Object.fromEntries(new URLSearchParams(rawBody)); }
    }

    const customerPhone = body.caller_number || body.from || body.mobile;

    if (!customerPhone) {
      // If we can't read the number, route to the fallback IVR
      return NextResponse.json({ action: "route", destination: FALLBACK_NUMBER });
    }

    // Normalize phone
    let dbPhone = customerPhone.replace(/^\+?91/, '');
    if (dbPhone.length > 10) dbPhone = dbPhone.slice(-10);

    // 1. Find the Lead and their Assigned Telecaller
    const { data: lead } = await supabase
      .from("leads")
      .select("assigned_to, name")
      .ilike("phone", `%${dbPhone}%`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lead && lead.assigned_to) {
        // 2. Check if the assigned agent is currently online and ready
        const { data: agent } = await supabase
            .from("users")
            .select("phone, current_status")
            .eq("id", lead.assigned_to)
            .single();

        if (agent && agent.phone) {
            // 3. Routing Logic based on Agent State
            if (agent.current_status === 'ready') {
                console.log(`🎯 [STICKY ROUTING] Routing ${lead.name} directly to assigned agent.`);
                
                // Set agent to 'on_call' so they don't receive an auto-dialer call simultaneously
                await supabase.from("users").update({
                    current_status: 'on_call',
                    status_updated_at: new Date().toISOString()
                }).eq("id", lead.assigned_to);

                let routePhone = agent.phone.replace(/^\+?91/, '');
                
                // Note: Adjust the JSON response format to match exactly what Fonada's API expects for dynamic routing
                return NextResponse.json({ 
                    action: "dial", 
                    destination: `91${routePhone}`,
                    timeout: 30 
                });
            } else {
                console.log(`⏳ [AGENT BUSY] Agent is ${agent.current_status}. Routing to fallback.`);
            }
        }
    }

    // 4. Fallback Routing (If lead is unassigned or agent is busy/offline)
    console.log("🔀 [FALLBACK ROUTING] Routing to general queue.");
    return NextResponse.json({ 
        action: "dial", 
        destination: FALLBACK_NUMBER 
    });

  } catch (error) {
    console.error("🔥 [ROUTING ERROR]:", error);
    return NextResponse.json({ action: "dial", destination: FALLBACK_NUMBER });
  }
}
