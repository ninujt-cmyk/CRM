// app/api/webhooks/ivr/route.ts
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// --- 1. REALISTIC INDIAN NAME GENERATOR ---
const INDIAN_FIRST_NAMES = ["Rahul", "Amit", "Priya", "Sneha", "Rajesh", "Pooja", "Vikram", "Anjali", "Rohit", "Neha", "Suresh", "Kavita", "Manish", "Kiran", "Sanjay", "Jyoti", "Deepak", "Ritu", "Sunil", "Sunita", "Ajay", "Swati", "Vijay", "Rakesh", "Anita", "Anil", "Rekha", "Manoj", "Sarita", "Ramesh", "Asha", "Tarun", "Meena", "Mukesh", "Nisha", "Vikas", "Renu", "Ashok", "Seema", "Ravi", "Poonam", "Santosh", "Manju", "Suraj", "Sushma", "Vinod", "Mamta", "Yogesh", "Usha", "Pravin", "Karthik", "Divya", "Arun", "Shruti", "Gaurav", "Ananya", "Sachin", "Bhumika", "Prashant", "Shivani"];
const INDIAN_LAST_NAMES = ["Sharma", "Singh", "Kumar", "Das", "Patel", "Gupta", "Verma", "Jain", "Yadav", "Prasad", "Mishra", "Pandey", "Tiwari", "Chauhan", "Thakur", "Reddy", "Patil", "Deshmukh", "Kulkarni", "Joshi", "Menon", "Rao", "Iyer", "Nair", "Pillai", "Chatterjee", "Sengupta", "Banerjee", "Bose", "Dasgupta", "Bhattacharya", "Roy", "Sen", "Saha", "Nayak", "Biswas", "Chakraborty", "Mukherjee", "Agarwal", "Bansal", "Garg", "Mehta", "Choudhary", "Bhatia", "Gowda", "Naidu", "Chacko", "Babu", "Varghese", "Kurian"];

function getRandomIndianName() {
  return `${INDIAN_FIRST_NAMES[Math.floor(Math.random() * INDIAN_FIRST_NAMES.length)]} ${INDIAN_LAST_NAMES[Math.floor(Math.random() * INDIAN_LAST_NAMES.length)]}`;
}

// --- 2. IST TIMEZONE CALCULATOR ---
function getStartOfTodayIST() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const nowIST = new Date(now.getTime() + istOffset);
  nowIST.setUTCHours(0, 0, 0, 0); 
  return new Date(nowIST.getTime() - istOffset).toISOString();
}

// --- 3. FAIR DISTRIBUTION HELPER FUNCTION (TENANT AWARE) ---
async function getFairAssigneeId(tenantId: string) {
    const startOfTodayISO = getStartOfTodayIST();

    const { data: attendanceData } = await supabaseAdmin
        .from("attendance")
        .select("user_id")
        .eq("tenant_id", tenantId) // 🔴 ISOLATION
        .is("check_out", null)
        .gte("check_in", startOfTodayISO);

    const checkedInUserIds = attendanceData?.map(a => a.user_id) || [];
    if (checkedInUserIds.length === 0) return null;

    let { data: telecallers } = await supabaseAdmin
        .from("users")
        .select("id, full_name")
        .eq("tenant_id", tenantId) // 🔴 ISOLATION
        .in("role", ["telecaller", "agent", "user"]); 

    const activeTelecallers = (telecallers || []).filter(t => checkedInUserIds.includes(t.id));
    if (activeTelecallers.length === 0) return null;
        
    const { data: todaysLeads } = await supabaseAdmin
        .from("leads")
        .select("assigned_to")
        .eq("tenant_id", tenantId) // 🔴 ISOLATION
        .gte("created_at", startOfTodayISO); 

    const leadCounts: Record<string, number> = {};
    activeTelecallers.forEach(t => leadCounts[t.id] = 0); 

    if (todaysLeads) {
        todaysLeads.forEach(l => {
            if (l.assigned_to && leadCounts[l.assigned_to] !== undefined) leadCounts[l.assigned_to]++;
        });
    }

    const minLeads = Math.min(...Object.values(leadCounts));
    const eligibleTelecallers = activeTelecallers.filter(t => leadCounts[t.id] === minLeads);
    const winner = eligibleTelecallers[Math.floor(Math.random() * eligibleTelecallers.length)];
    
    return winner.id;
}
// ------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    let body: any = {};
    
    // 💡 ROBUST PARSING ENGINE
    if (rawBody) {
      try { 
        const cleanedBody = rawBody.replace(/~/g, ',');
        body = JSON.parse(cleanedBody); 
      } catch(e) { 
        try {
            body = Object.fromEntries(new URLSearchParams(rawBody)); 
        } catch (fallbackErr) {
            console.error("Total parse failure:", rawBody);
            return NextResponse.json({ status: "error", message: "Invalid payload format" }, { status: 400 });
        }
      }
    }

    // 💡 SECURE VARIABLE EXTRACTION
    const customerPhone = body.mobileNumber || body.mobile_number || body.phone;
    const digitsPressed = body.digitsPressed || body['digitsPressed=CDR.digitpressed'] || body.digits_pressed;
    const callDuration = body.callDuration || 0;
    const campaignName = body.campaignName || 'Auto-IVR';
    const disposition = body.disposition || 'UNKNOWN';
    
    // 🔴 EXTRACT TENANT ID
    // You MUST configure Fonada to pass the tenant_id in their IVR webhook payload.
    // They usually allow appending custom variables or URL parameters (e.g., ?tenant=123...)
    const tenantId = body.tenantId || body.tenant || request.nextUrl.searchParams.get("tenant") || null;

    if (!customerPhone) {
        console.warn("⚠️ Ignored: No mobile number provided.");
        return NextResponse.json({ status: "ignored", reason: "no_mobile_number" });
    }
    
    if (!tenantId) {
        console.error("🚨 CRITICAL: IVR Webhook hit without a Tenant ID. Cannot securely route data.");
        return NextResponse.json({ status: "error", reason: "missing_tenant_id" }, { status: 400 });
    }

    let dbPhone = customerPhone.replace(/^\+?91/, '');
    if (dbPhone.length > 10) dbPhone = dbPhone.slice(-10);

    // 🔴 1. SEARCH FOR LEAD ONLY WITHIN THIS TENANT
    const { data: lead } = await supabaseAdmin
      .from("leads")
      .select("id, notes, status")
      .eq("tenant_id", tenantId) // STRICT ISOLATION
      .ilike("phone", `%${dbPhone}%`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const digitText = digitsPressed ? `Digit Pressed: **${digitsPressed}**` : "No digit pressed";
    const ivrNote = `🤖 [IVR Auto-Log | Campaign: ${campaignName}]\nStatus: ${disposition}\n${digitText}\nDuration: ${callDuration}s.`;

    // -------------------------------------------------------------
    // LOGIC ENGINE
    // -------------------------------------------------------------
    if (lead) {
        const statusLower = (lead.status || "").toLowerCase();

        if (statusLower === "disbursed") {
            return NextResponse.json({ status: "success", message: "Ignored disbursed lead" });
        }

        const deadStatuses = ["dead_bucket", "not_interested", "nr", "recycle_pool", "not_eligible", "self_employed"];
        
        if (deadStatuses.includes(statusLower)) {
            const assignedToId = await getFairAssigneeId(tenantId); // Pass tenant
            const fakeName = getRandomIndianName();
            
            // 🔴 2. EXPLICITLY INJECT TENANT ID ON INSERT
            await supabaseAdmin.from("leads").insert({
                tenant_id: tenantId,
                name: fakeName, 
                phone: dbPhone,
                status: "new",
                notes: `[Recycled from previous status: ${lead.status}]\n\n${ivrNote}`,
                assigned_to: assignedToId,
            });

            return NextResponse.json({ status: "success", message: "Recycled as new lead" });
        }

        const warmStatuses = ["interested", "documents_sent", "follow_up"];
        
        if (warmStatuses.includes(statusLower)) {
            const istDate = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
            const bumpNote = `\n\n🚨 Customer called IVR again on ${istDate}!`;
            const existingNotes = lead.notes ? `${lead.notes}\n\n${ivrNote}${bumpNote}` : `${ivrNote}${bumpNote}`;

            await supabaseAdmin.from("leads").update({ 
                status: "new",           
                notes: existingNotes,    
                last_contacted: new Date().toISOString() 
            }).eq("id", lead.id);

            return NextResponse.json({ status: "success", message: "Warm lead bumped to New" });
        }

        const existingNotes = lead.notes ? `${lead.notes}\n\n${ivrNote}` : ivrNote;
        await supabaseAdmin.from("leads").update({ notes: existingNotes }).eq("id", lead.id);

    } 
    else {
        const assignedToId = await getFairAssigneeId(tenantId); // Pass tenant
        const fakeName = getRandomIndianName();

        // 🔴 3. EXPLICITLY INJECT TENANT ID ON INSERT
        await supabaseAdmin.from("leads").insert({
            tenant_id: tenantId,
            name: fakeName, 
            phone: dbPhone,
            status: "new",
            notes: ivrNote,
            assigned_to: assignedToId,
        });
    }

    return NextResponse.json({ status: "success", message: "IVR data processed securely" });

  } catch (error) {
    console.error("🔥 [CRITICAL ERROR] IVR Webhook failed:", error);
    return NextResponse.json({ status: "error", message: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "success", message: "Multi-Tenant IVR Webhook is ready!" });
}
