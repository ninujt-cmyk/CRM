import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

const supabase = createClient(
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

// --- 3. FAIR DISTRIBUTION HELPER FUNCTION ---
async function getFairAssigneeId() {
    const startOfTodayISO = getStartOfTodayIST();

    const { data: attendanceData } = await supabase
        .from("attendance")
        .select("user_id")
        .is("check_out", null)
        .gte("check_in", startOfTodayISO);

    const checkedInUserIds = attendanceData?.map(a => a.user_id) || [];
    if (checkedInUserIds.length === 0) return null;

    let { data: telecallers } = await supabase
        .from("users")
        .select("id, full_name")
        .in("role", ["telecaller", "agent", "user"]); 

    const activeTelecallers = (telecallers || []).filter(t => checkedInUserIds.includes(t.id));
    if (activeTelecallers.length === 0) return null;
        
    const { data: todaysLeads } = await supabase
        .from("leads")
        .select("assigned_to")
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
    
    console.log(`⚖️ [FAIR DISTRIBUTION] Assigned to ${winner.full_name} (Everyone has at least ${minLeads} leads)`);
    return winner.id;
}
// ------------------------------------------

export async function POST(request: NextRequest) {
  console.log("🔔 [IVR WEBHOOK HIT] Received data from Fonada IVR");

  try {
    const rawBody = await request.text();
    let body: any = {};
    if (rawBody) {
      try { body = JSON.parse(rawBody); } 
      catch(e) { body = Object.fromEntries(new URLSearchParams(rawBody)); }
    }

    const customerPhone = body.mobileNumber || body.mobile_number || body.phone;
    const digitsPressed = body.digitsPressed || body.digits_pressed;
    const callDuration = body.callDuration;
    const campaignName = body.campaignName;
    const disposition = body.disposition;

    if (!customerPhone) return NextResponse.json({ status: "ignored", reason: "no_mobile_number" });

    let dbPhone = customerPhone.replace(/^\+?91/, '');
    if (dbPhone.length > 10) dbPhone = dbPhone.slice(-10);

    const { data: lead } = await supabase
      .from("leads")
      .select("id, notes, status")
      .ilike("phone", `%${dbPhone}%`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const digitText = digitsPressed ? `Digit Pressed: **${digitsPressed}**` : "No digit pressed";
    const ivrNote = `🤖 [IVR Auto-Log | Campaign: ${campaignName || 'Unknown'}]\nStatus: ${disposition}\n${digitText}\nDuration: ${callDuration || 0}s.`;

    // -------------------------------------------------------------
    // LOGIC ENGINE: SMART DUPLICATES & RE-ENGAGEMENT
    // -------------------------------------------------------------
    if (lead) {
        // Convert status to lowercase to ensure perfect matching
        const statusLower = (lead.status || "").toLowerCase();

        // 1. SUCCESS CONDITION
        if (statusLower === "disbursed") {
            console.log(`⏭️ [SKIPPED] Lead ${dbPhone} is already Disbursed. Ignoring.`);
            return NextResponse.json({ status: "success", message: "Ignored disbursed lead" });
        }

        // 2. DEAD / RECYCLE CONDITION
        const deadStatuses = ["dead_bucket", "not_interested", "nr", "recycle_pool", "not_eligible", "self_employed"];
        
        if (deadStatuses.includes(statusLower)) {
            console.log(`♻️ [RECYCLE] Lead ${dbPhone} was Dead (${lead.status}). Adding as FRESH NEW LEAD.`);
            
            const assignedToId = await getFairAssigneeId();
            const fakeName = getRandomIndianName();
            
            const { error: insertError } = await supabase.from("leads").insert({
                name: fakeName, 
                phone: dbPhone,
                status: "new",
                notes: `[Recycled from previous status: ${lead.status}]\n\n${ivrNote}`,
                assigned_to: assignedToId,
            });

            if (insertError) console.error("❌ [DB ERROR] Failed to insert recycled lead:", insertError);
            return NextResponse.json({ status: "success", message: "Recycled as new lead" });
        }

        // 3. WARM / RE-ENGAGEMENT CONDITION
        const warmStatuses = ["interested", "documents_sent", "follow_up"];
        
        if (warmStatuses.includes(statusLower)) {
            console.log(`🔥 [RE-ENGAGE] Lead ${dbPhone} was Warm (${lead.status}). Bumping to New.`);
            
            const istDate = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
            const bumpNote = `\n\n🚨 Customer called IVR again on ${istDate}!`;
            const existingNotes = lead.notes ? `${lead.notes}\n\n${ivrNote}${bumpNote}` : `${ivrNote}${bumpNote}`;

            const { error: updateError } = await supabase.from("leads").update({ 
                status: "new",           // Move back to new
                notes: existingNotes,    // Add the special note
                last_contacted: new Date().toISOString() // Bump to top of queue
            }).eq("id", lead.id);

            if (updateError) console.error("❌ [DB ERROR] Failed to bump warm lead:", updateError);
            return NextResponse.json({ status: "success", message: "Warm lead bumped to New" });
        }

        // 4. DEFAULT EXISTING (e.g., already 'new' or 'Login')
        console.log(`📝 [UPDATE] Lead ${dbPhone} is currently ${lead.status}. Just updating notes.`);
        const existingNotes = lead.notes ? `${lead.notes}\n\n${ivrNote}` : ivrNote;
        await supabase.from("leads").update({ notes: existingNotes }).eq("id", lead.id);

    } 
    // -------------------------------------------------------------
    // COMPLETELY NEW NUMBER -> CREATE AND ASSIGN
    // -------------------------------------------------------------
    else {
        console.log(`✨ [NEW LEAD] Phone ${dbPhone} not found. Creating and distributing...`);
        
        const assignedToId = await getFairAssigneeId();
        const fakeName = getRandomIndianName();

        const { data: newLead, error: insertError } = await supabase.from("leads").insert({
            name: fakeName, 
            phone: dbPhone,
            status: "new",
            notes: ivrNote,
            assigned_to: assignedToId,
        }).select("id").single();

        if (insertError) console.error("❌ [DB ERROR] Failed to insert new IVR lead:", insertError);
        else console.log(`✅ [SUCCESS] Created Lead ID: ${newLead.id} (Name: ${fakeName})`);
    }

    return NextResponse.json({ status: "success", message: "IVR data processed successfully" });

  } catch (error) {
    console.error("🔥 [CRITICAL ERROR] IVR Webhook failed:", error);
    return NextResponse.json({ status: "error", message: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "success", message: "IVR Webhook is ready to receive POST requests!" });
}
