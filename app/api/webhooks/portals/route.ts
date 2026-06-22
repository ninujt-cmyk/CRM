import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// This endpoint receives incoming leads from real estate portals like 99acres or MagicBricks.
// It uses the Service Role key to bypass RLS since it's a server-to-server call.
export async function POST(req: Request) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 1. Get the webhook secret from headers (for basic auth)
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid Authorization header' }, { status: 401 })
    }
    const token = authHeader.split(' ')[1]

    // 2. Parse payload
    const body = await req.json()
    // Assume standardized payload for this example. Real portals have varying formats.
    const { name, email, phone, portal_name, notes, property_id } = body

    if (!portal_name) {
       return NextResponse.json({ error: 'portal_name is required in payload' }, { status: 400 })
    }

    // 3. Find the tenant associated with this webhook secret
    const { data: credential } = await supabaseAdmin
      .from('portal_credentials')
      .select('tenant_id')
      .eq('webhook_secret', token)
      .eq('portal_name', portal_name)
      .eq('is_active', true)
      .single()

    if (!credential || !credential.tenant_id) {
      return NextResponse.json({ error: 'Invalid webhook secret or inactive integration' }, { status: 403 })
    }

    // 4. Insert the new lead
    const { data: newLead, error: insertError } = await supabaseAdmin
      .from('leads')
      .insert({
        tenant_id: credential.tenant_id,
        name: name || "Unknown Lead",
        email: email || null,
        phone: phone || "0000000000",
        source: portal_name,
        notes: `Incoming from ${portal_name}. ${notes || ''}`,
        status: 'new',
        priority: 'high', // Portal leads are usually high priority
        score: 10 // Give initial points
      })
      .select('id')
      .single()

    if (insertError) throw insertError

    // 5. Assign via Round Robin
    const { assignLeadRoundRobin } = await import('@/app/actions/routing')
    await assignLeadRoundRobin(credential.tenant_id, newLead.id)
    // 5. (Optional) In a full system, you might trigger the automations or scoring engine here
    // import { addLeadScore } from '@/app/actions/scoring'
    // await addLeadScore(newLead.id, 'NEW_PORTAL_LEAD')

    return NextResponse.json({ success: true, lead_id: newLead.id }, { status: 201 })
  } catch (error: any) {
    console.error('Portal webhook error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
