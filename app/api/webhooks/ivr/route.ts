import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// Force Next.js to never cache this route
export const dynamic = 'force-dynamic';

// Initialize Supabase Admin Client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// --- 1. REALISTIC INDIAN NAME GENERATOR ---
const INDIAN_FIRST_NAMES = [
  "Rahul", "Amit", "Priya", "Sneha", "Rajesh", "Pooja", "Vikram", "Anjali", "Rohit", "Neha",
  "Suresh", "Kavita", "Manish", "Kiran", "Sanjay", "Jyoti", "Deepak", "Ritu", "Sunil", "Sunita",
  "Ajay", "Swati", "Vijay", "Rakesh", "Anita", "Anil", "Rekha", "Manoj", "Sarita", "Ramesh",
  "Asha", "Tarun", "Meena", "Mukesh", "Nisha", "Vikas", "Renu", "Ashok", "Seema", "Ravi",
  "Poonam", "Santosh", "Manju", "Suraj", "Sushma", "Vinod", "Mamta", "Yogesh", "Usha", "Pravin",
  "Karthik", "Divya", "Arun", "Shruti", "Gaurav", "Ananya", "Sachin", "Bhumika", "Prashant", "Shivani"
];

const INDIAN_LAST_NAMES = [
  "Sharma", "Singh", "Kumar", "Das", "Patel", "Gupta", "Verma", "Jain", "Yadav", "Prasad",
  "Mishra", "Pandey", "Tiwari", "Chauhan", "Thakur", "Reddy", "Patil", "Deshmukh", "Kulkarni", "Joshi",
  "Menon", "Rao", "Iyer", "Nair", "Pillai", "Chatterjee", "Sengupta", "Banerjee", "Bose", "Dasgupta",
  "Bhattacharya", "Roy", "Sen", "Saha", "Nayak", "Biswas", "Chakraborty", "Mukherjee", "Agarwal", "Bansal",
  "Garg", "Mehta", "Choudhary", "Bhatia", "Gowda", "Naidu", "Chacko", "Babu", "Varghese", "Kurian"
];

function getRandomIndianName() {
  const firstName = INDIAN_FIRST_NAMES[Math.floor(Math.random() * INDIAN_FIRST_NAMES.length)];
  const lastName = INDIAN_LAST_NAMES[Math.floor(Math.random() * INDIAN_LAST_NAMES.length)];
  return `${firstName} ${lastName}`;
}

// --- 2. IST TIMEZONE CALCULATOR ---
// Safely calculates 12:00 AM IST "Today" in UTC format for Vercel
function getStartOfTodayIST() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
  const nowIST = new Date(now.getTime() + istOffset);
  nowIST.setUTCHours(0, 0, 0, 0); // Set to midnight IST
  const midnightUTC = new Date(nowIST.getTime() - istOffset);
  return midnightUTC.toISOString();
}
// ------------------------------------------

export async function POST(request: NextRequest) {
  console.log("🔔 [IVR WEBHOOK HIT] Received data from Fonada IVR");

  try {
    const rawBody = await request.text();
    let body: any = {};
    if (rawBody) {
      try {
        body = JSON.parse(rawBody);
      } catch(e) {
        const params = new URLSearchParams(rawBody);
        body = Object.fromEntries(params);
      }
    }

    const customerPhone = body.mobileNumber || body.mobile_number || body.phone;
    const digitsPressed = body.digitsPressed || body.digits_pressed;
    const callDuration = body.callDuration;
    const campaignName = body.campaignName;
    const disposition = body.disposition;

    if (!customerPhone) {
      console.log("⚠️ [IGNORED] Missing mobileNumber in payload");
      return NextResponse.json({ status: "ignored", reason: "no_mobile_number" });
    }

    // Normalize Phone: Extract last 10 digits
    let dbPhone = customerPhone.replace(/^\+?91/, '');
    if (dbPhone.length > 10) dbPhone = dbPhone.slice(-10);

    const { data: lead } = await supabase
      .from("leads")
      .select("id, notes")
      .ilike("phone", `%${dbPhone}%`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const digitText = digitsPressed ? `Digit Pressed: **${digitsPressed}**` : "No digit pressed";
    const ivrNote = `🤖 [IVR Auto-Log | Campaign: ${campaignName || 'Unknown'}]\nStatus: ${disposition}\n${digitText}\nDuration: ${callDuration || 0}s.`;

    // -------------------------------------------------------------
    // CASE A: LEAD ALREADY EXISTS
    // -------------------------------------------------------------
    if (lead) {
        const existingNotes = lead.notes ? `${lead.notes}\n\n${ivrNote}` : ivrNote;
        const { error: updateError } = await supabase.from("leads").update({ notes: existingNotes }).eq("id", lead.id);
        if (updateError) console.error("❌ [DB ERROR] Updating lead notes:", updateError);
        else console.log(`✅ [SUCCESS] Updated existing Lead ID: ${lead.id}`);
    } 
    // -------------------------------------------------------------
    // CASE B: NEW LEAD -> FAIR DISTRIBUTION
    // -------------------------------------------------------------
    else {
        console.log(`✨ [NEW LEAD] Phone ${dbPhone} not found. Searching for active telecallers...`);

        // Get exact 12:00 AM IST today
        const startOfTodayISO = getStartOfTodayIST();

        // B1: FIND WHO IS CHECKED IN *TODAY* ONLY
        const { data: attendanceData, error: attError } = await supabase
            .from("attendance")
            .select("user_id")
            .is("check_out", null)
            .gte("check_in", startOfTodayISO); // <-- FIX: Only looks at check-ins from today

        if (attError) console.error("❌ [DB ERROR] Attendance query failed:", attError);

        const checkedInUserIds = attendanceData?.map(a => a.user_id) || [];
        console.log(`👥 [DEBUG] Found ${checkedInUserIds.length} users checked in TODAY.`);

        // B2: FETCH ALL TELECALLER PROFILES
        let { data: telecallers } = await supabase
            .from("users")
            .select("id, full_name")
            .in("role", ["telecaller", "agent", "user"]); 

        let assignedToId = null;

        // B3: FILTER ONLINE USERS & DISTRIBUTE EQUALLY
        if (telecallers && checkedInUserIds.length > 0) {
            
            // Isolate only the users who are currently checked in today
            const activeTelecallers = telecallers.filter(t => checkedInUserIds.includes(t.id));

            if (activeTelecallers.length > 0) {
                
                // Fetch all leads created TODAY using the safe IST time
                const { data: todaysLeads } = await supabase
                    .from("leads")
                    .select("assigned_to")
                    .gte("created_at", startOfTodayISO); // <-- ACCURATE IST COUNT

                // Count leads per ACTIVE telecaller
                const leadCounts: Record<string, number> = {};
                activeTelecallers.forEach(t => leadCounts[t.id] = 0); 

                if (todaysLeads) {
                    todaysLeads.forEach(l => {
                        if (l.assigned_to && leadCounts[l.assigned_to] !== undefined) {
                            leadCounts[l.assigned_to]++;
                        }
                    });
                }

                // Find the minimum number of leads anyone has
                const minLeads = Math.min(...Object.values(leadCounts));

                // Find all active telecallers who are tied for the lowest amount
                const eligibleTelecallers = activeTelecallers.filter(t => leadCounts[t.id] === minLeads);

                // Pick a random winner from the tie-pool
                const winner = eligibleTelecallers[Math.floor(Math.random() * eligibleTelecallers.length)];
                assignedToId = winner.id;
                
                console.log(`⚖️ [FAIR DISTRIBUTION] Everyone online has at least ${minLeads} leads today. Assigned new lead to ${winner.full_name}`);
            } else {
                console.log("⚠️ [WARNING] No telecallers checked in today. Lead will remain unassigned.");
            }
        } else {
            console.log("⚠️ [WARNING] No attendance records found for today. Lead will remain unassigned.");
        }

        // B4: GENERATE NAME AND INSERT LEAD
        const fakeName = getRandomIndianName();

        const { data: newLead, error: insertError } = await supabase
            .from("leads")
            .insert({
                name: fakeName, 
                phone: dbPhone,
                status: "new",
                notes: ivrNote,
                assigned_to: assignedToId,
            })
            .select("id")
            .single();

        if (insertError) {
            console.error("❌ [DB ERROR] Failed to insert new IVR lead:", insertError);
        } else {
            console.log(`✅ [SUCCESS] Created Lead ID: ${newLead.id} (Name: ${fakeName})`);
        }
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
