"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Send, CheckCircle2, Users } from "lucide-react";
import { KycTeamMember } from "@/lib/kyc-utils"; // UPDATED IMPORT PATH
import { useRouter } from "next/navigation"; 
// import { toast } from "sonner"; 

interface TransferToKycButtonProps {
  leadId: string;
  onTransferSuccess: () => void; 
}

export function TransferToKycButton({ leadId, onTransferSuccess }: TransferToKycButtonProps) {
  const [kycMembers, setKycMembers] = useState<KycTeamMember[]>([]);
  const [selectedKycMemberId, setSelectedKycMemberId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      async function fetchKycMembers() {
        setIsLoading(true);
        // Call the new API route
        const res = await fetch("/api/kyc-members"); 
        if (res.ok) {
            const data = await res.json();
            setKycMembers(data);
        } else {
            console.error("Failed to fetch KYC team members");
            // toast.error("Failed to load KYC team members.");
        }
        setIsLoading(false);
      }
      fetchKycMembers();
    }
  }, [isOpen]);

  const handleTransfer = async () => {
    if (!selectedKycMemberId) {
      // toast.error("Please select a KYC team member.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/transfer-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, kycMemberId: selectedKycMemberId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Transfer failed.");
      }

      // toast.success("Lead successfully transferred to KYC team!");
      onTransferSuccess(); 
      setIsOpen(false);
    } catch (error) {
      // toast.error("Transfer failed. Please try again.");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
            variant="outline" 
            size="sm" 
            className="bg-purple-600 hover:bg-purple-700 text-white"
        >
          <Send className="h-4 w-4 mr-2" />
          Transfer for KYC
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5"/> Transfer Lead for KYC
          </DialogTitle>
          <DialogDescription>
            Select a specific KYC team member to assign this lead for verification.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Select
            value={selectedKycMemberId}
            onValueChange={setSelectedKycMemberId}
            disabled={isLoading || kycMembers.length === 0}
          >
            <SelectTrigger className="w-full">
              {isLoading ? (
                 <span className="text-gray-500 flex items-center"><Loader2 className="h-4 w-4 mr-2 animate-spin"/> Loading team...</span>
              ) : (
                 <SelectValue placeholder="Select KYC Member" />
              )}
            </SelectTrigger>
            <SelectContent>
              {kycMembers.length === 0 && !isLoading ? (
                  <SelectItem disabled value="">No KYC members available</SelectItem>
              ) : (
                  kycMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.full_name}
                    </SelectItem>
                  ))
              )}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button
            onClick={handleTransfer}
            disabled={!selectedKycMemberId || isLoading}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            )}
            Confirm Transfer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
