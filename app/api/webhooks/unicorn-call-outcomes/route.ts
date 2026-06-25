import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@supabase/supabase-js";
import { sendWhatsAppText } from "@/app/actions/whatsapp";

// This runs entirely server-side (Service Role) since webhooks have no active user session
export async function POST(req: Request) {
  try {
    const payload = await req.json();
    console.log("🦄 [UNICORN AI WEBHOOK] Received payload:", payload);

    // Expected fields from Unicorn AI based on typical structures:
    // (They usually return orderId, orderNumber, status, outcome, etc.)
    const leadId = payload.orderNumber || payload.orderId;
    const callStatus = payload.status || payload.outcome || payload.callStatus;
    const phone = payload.customerPhone || payload.phone;

    if (!leadId) {
      return NextResponse.json({ error: "Missing orderNumber/leadId" }, { status: 400 });
    }

    const supabaseAdmin = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Map Unicorn statuses to our CRM statuses
    let crmStatus = "follow_up"; // default fallback
    const statusLower = String(callStatus).toLowerCase();

    // Naive mapping based on "interested" keywords
    if (statusLower.includes("interested") || statusLower.includes("positive") || statusLower.includes("success")) {
        crmStatus = "Interested";
    } else if (statusLower.includes("not interested") || statusLower.includes("dnd") || statusLower.includes("negative")) {
        crmStatus = "Not_Interested";
    } else if (statusLower.includes("no answer") || statusLower.includes("busy") || statusLower.includes("failed")) {
        crmStatus = "nr";
    }

    // Update Lead Status in Database
    const { data: lead, error: updateError } = await supabaseAdmin
      .from('leads')
      .update({ 
        status: crmStatus, 
        last_contacted: new Date().toISOString()
      })
      .eq('id', leadId)
      .select('id, name, phone, tenant_id')
      .single();

    if (updateError || !lead) {
      console.error("Failed to update lead status:", updateError);
      return NextResponse.json({ error: "Failed to update lead status" }, { status: 500 });
    }

    // Trigger WhatsApp if interested
    if (crmStatus === "Interested" && lead.phone) {
      console.log(`[UNICORN WEBHOOK] Lead ${leadId} is Interested. Triggering WhatsApp...`);
      const message = `Hello ${lead.name || 'Customer'}! Thank you for your interest during our recent call. Let us know how we can assist you further or reply with any questions.`;
      
      // Attempt to send WhatsApp text using the existing action
      const waResult = await sendWhatsAppText(lead.id, lead.phone, message);
      console.log(`[UNICORN WEBHOOK] WhatsApp Result:`, waResult);
    }

    return NextResponse.json({ success: true, message: "Webhook processed" });
  } catch (error: any) {
    console.error("🦄 [UNICORN AI WEBHOOK] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
