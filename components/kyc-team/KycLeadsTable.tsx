// components/kyc-team/KycLeadsTable.tsx
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface KycLeadsTableProps {
    currentUserId: string;
    initialStatus: string;
}

export default function KycLeadsTable({ currentUserId, initialStatus }: KycLeadsTableProps) {
  const [leads, setLeads] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState<string>("");

  const supabase = createClient();

  const fetchLeads = async () => {
    setIsLoading(true);
    console.log("🔄 Fetching leads for user:", currentUserId);

    try {
      // Test 1: Check kyc_member_id
      const { data: kycData, error: kycError } = await supabase
        .from("leads")
        .select("*")
        .eq("kyc_member_id", currentUserId);

      console.log("📊 kyc_member_id results:", kycData);

      // Test 2: Check assigned_to  
      const { data: assignedData, error: assignedError } = await supabase
        .from("leads")
        .select("*")
        .eq("assigned_to", currentUserId);

      console.log("📊 assigned_to results:", assignedData);

      // Test 3: Check all leads to see what exists
      const { data: allLeads, error: allError } = await supabase
        .from("leads")
        .select("id, name, kyc_member_id, assigned_to, status")
        .limit(10);

      console.log("📊 All leads sample:", allLeads);

      setDebugInfo(`
KYC Member ID Query: ${kycData?.length || 0} leads
Assigned To Query: ${assignedData?.length || 0} leads  
All Leads Sample: ${allLeads?.length || 0} leads

Your User ID: ${currentUserId}
      `);

      // Combine results from both queries
      const combinedLeads = [...(kycData || []), ...(assignedData || [])];
      setLeads(combinedLeads);

    } catch (error) {
      console.error("❌ Error:", error);
      setDebugInfo(`Error: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [currentUserId]);

  return (
    <div className="space-y-4">
      {/* Debug Card */}
      <Card className="p-4 bg-yellow-50">
        <h3 className="font-bold mb-2">Debug Information</h3>
        <Button onClick={fetchLeads} className="mb-2">
          Test Queries
        </Button>
        <pre className="text-sm whitespace-pre-wrap">{debugInfo}</pre>
      </Card>

      {/* Results */}
      <Card className="p-4">
        <h3 className="font-bold mb-2">Results</h3>
        {isLoading ? (
          <p>Loading...</p>
        ) : leads.length === 0 ? (
          <div>
            <p>No leads found for your account.</p>
            <p className="text-sm text-gray-600 mt-2">
              This means:
              <br />- No leads with kyc_member_id = {currentUserId.substring(0, 8)}...
              <br />- No leads with assigned_to = {currentUserId.substring(0, 8)}...
            </p>
          </div>
        ) : (
          <div>
            <p>Found {leads.length} leads:</p>
            <div className="mt-2 space-y-2">
              {leads.map((lead) => (
                <div key={lead.id} className="p-2 border rounded">
                  <p><strong>{lead.name}</strong></p>
                  <p className="text-sm">Status: {lead.status}</p>
                  <p className="text-sm">KYC Member: {lead.kyc_member_id?.substring(0, 8)}...</p>
                  <p className="text-sm">Assigned To: {lead.assigned_to?.substring(0, 8)}...</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
