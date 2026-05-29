import { NextResponse } from "next/server";
import { getKycTeamMembers } from "@/lib/kyc-utils"; // UPDATED IMPORT PATH

export async function GET() {
  try {
    const kycMembers = await getKycTeamMembers();
    return NextResponse.json(kycMembers, { status: 200 });
  } catch (error) {
    console.error("API Error fetching KYC members:", error);
    return NextResponse.json(
      { error: "Failed to fetch KYC team members" },
      { status: 500 }
    );
  }
}
