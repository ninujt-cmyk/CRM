import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// --- REALISTIC NAME GENERATOR ---
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
// --------------------------------

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
        await supabase.from("leads").update({ notes: existingNotes }).eq("id", lead.id);
        console.log(`✅ [SUCCESS] Updated existing Lead ID: ${lead.id}`);
    } 
    // -------------------------------------------------------------
    // CASE B: COMPLETELY NEW LEAD (FAIR DISTRIBUTION ALGORITHM)
    // -------------------------------------------------------------
    else {
        console.log(`✨ [NEW LEAD] Phone ${dbPhone} not found. Running Smart Distribution...`);

        // 1. Get all active telecallers
        let { data: activeTelecallers } = await supabase
            .from("users")
            .select("id, full_name")
            .in("role", ["telecaller", "agent", "user"]); 

        let assignedToId = null;

        if (activeTelecallers && activeTelecallers.length > 0) {
            
            // 2. Fetch all leads created TODAY to see who got what
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);

            const { data: todaysLeads } = await supabase
                .from("leads")
                .select("assigned_to")
                .gte("created_at", startOfDay.toISOString());

            // 3. Count leads per telecaller
            const leadCounts: Record<string, number> = {};
            activeTelecallers.forEach(t => leadCounts[t.id] = 0); // Start everyone at 0

            if (todaysLeads) {
                todaysLeads.forEach(l => {
                    if (l.assigned_to && leadCounts[l.assigned_to] !== undefined) {
                        leadCounts[l.assigned_to]++;
                    }
                });
            }

            // 4. Find the minimum number of leads anyone has
            const minLeads = Math.min(...Object.values(leadCounts));

            // 5. Find all telecallers who have this minimum amount (Handles Ties)
            const eligibleTelecallers = activeTelecallers.filter(t => leadCounts[t.id] === minLeads);

            // 6. Pick one of the eligible telecallers randomly
            const winner = eligibleTelecallers[Math.floor(Math.random() * eligibleTelecallers.length)];
            assignedToId = winner.id;
            
            console.log(`⚖️ [FAIR DISTRIBUTION] Everyone has at least ${minLeads} leads today. Assigned to ${winner.full_name}`);
        }

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
