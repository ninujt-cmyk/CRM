import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { transferLeadToKyc } from "@/lib/kyc-utils"; // UPDATED IMPORT PATH

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  try {
    const { leadId, kycMemberId } = await request.json();

    if (!leadId || !kycMemberId) {
      return NextResponse.json(
        { error: "Missing required fields: leadId and kycMemberId" },
        { status: 400 }
      );
    }

    // Call the server-side utility function
    await transferLeadToKyc({
        leadId, 
        kycMemberId, 
        telecallerId: user.id 
    });

    return NextResponse.json({ success: true, message: "Lead transferred successfully." }, { status: 200 });
  } catch (e: any) {
    console.error("KYC Transfer API Error:", e);
    return NextResponse.json(
      { error: "Transfer failed: " + e.message },
      { status: 500 }
    );
  }
}
