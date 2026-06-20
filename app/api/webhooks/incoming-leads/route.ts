import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

// ⚠️ Use Service Role key to bypass RLS since Webhooks have no logged-in user context
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-project.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-key"
);

export async function POST(request: NextRequest) {
  console.log("🔔 [INCOMING LEAD WEBHOOK] Received request.");

  try {
    // 1. Get Tenant ID from URL Query Params
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('org_id');

    if (!orgId) {
      console.error("🚨 [INCOMING LEAD WEBHOOK] Missing org_id parameter.");
      return NextResponse.json({ status: "error", message: "Missing org_id parameter. Your Webhook URL must include ?org_id=YOUR_TENANT_ID" }, { status: 400 });
    }

    // Verify Organization exists
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('organizations')
      .select('id, name')
      .eq('id', orgId)
      .single();

    if (tenantError || !tenant) {
        console.error("🚨 [INCOMING LEAD WEBHOOK] Invalid org_id:", orgId);
        return NextResponse.json({ status: "error", message: "Invalid org_id" }, { status: 401 });
    }

    // 2. Parse Body securely
    let body: any = {};
    const rawBody = await request.text();
    if (rawBody) {
      try { 
        body = JSON.parse(rawBody); 
      } catch(e) { 
        body = Object.fromEntries(new URLSearchParams(rawBody)); 
      }
    }

    console.log(`📋 [INCOMING LEAD WEBHOOK] Payload for ${tenant.name}:`, body);

    // Normalize keys to lowercase for robust extraction
    const safeBody: Record<string, any> = {};
    for (const key in body) {
        if (body.hasOwnProperty(key)) {
            safeBody[key.toLowerCase().replace(/[^a-z0-9_]/g, '')] = body[key];
        }
    }

    // Extract core fields flexibly
    const rawPhone = safeBody.phone || safeBody.phonenumber || safeBody.mobile || safeBody.contact || "";
    let cleanPhone = rawPhone ? String(rawPhone).replace(/^\+?91/, '').replace(/\D/g, '').slice(-10) : "";

    const name = safeBody.name || safeBody.fullname || safeBody.firstname || "Unknown Webhook Lead";
    const email = safeBody.email || safeBody.emailaddress || null;
    const source = safeBody.source || safeBody.leadsource || "Webhook Integration";
    const project = safeBody.project || safeBody.product || safeBody.campaign || null;
    const notes = safeBody.notes || safeBody.message || safeBody.description || "Received via Integrations API.";
    
    // Store all remaining raw data as JSON in custom_fields for future reference
    const customFields = body;

    // Validate minimum requirements
    if (!cleanPhone || cleanPhone.length !== 10) {
      return NextResponse.json({ status: "error", message: "A valid 10-digit Indian phone number is required." }, { status: 400 });
    }

    // 3. Insert Lead
    const { data: newLead, error: insertError } = await supabaseAdmin
        .from('leads')
        .insert({
            tenant_id: orgId,
            name: name,
            phone: cleanPhone,
            email: email,
            source: source,
            project: project,
            notes: notes,
            status: "new", // Default status
            custom_fields: customFields,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
        .select()
        .single();

    if (insertError) {
        console.error("🚨 [INCOMING LEAD WEBHOOK] Failed to insert lead:", insertError);
        return NextResponse.json({ status: "error", message: "Failed to create lead" }, { status: 500 });
    }

    console.log(`✅ [INCOMING LEAD WEBHOOK] Successfully saved lead ${cleanPhone} for ${tenant.name}.`);
    
    return NextResponse.json({ 
        status: "success", 
        message: "Lead received and saved.",
        lead_id: newLead.id
    });

  } catch (error) {
    console.error("🔥 [CRITICAL ERROR] Incoming Lead Webhook failed:", error);
    return NextResponse.json({ status: "error", message: "Internal Server Error" }, { status: 500 });
  }
}
