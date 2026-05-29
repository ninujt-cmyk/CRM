"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, Calendar } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ScheduleFollowUpModal } from "@/components/schedule-follow-up-modal";

export function CompleteFollowUpButton({ followUpId }: { followUpId: string }) {
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  const handleComplete = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("follow_ups")
        .update({ 
          status: "completed",
          completed_at: new Date().toISOString()
        })
        .eq("id", followUpId);

      if (error) {
        console.error("Error completing follow-up:", error);
        toast.error("Failed to complete follow-up");
        return;
      }

      toast.success("Follow-up marked as completed!");
      router.refresh();
    } catch (error) {
      console.error("Error:", error);
      toast.error("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button 
      size="sm" 
      variant="outline" 
      onClick={handleComplete}
      disabled={loading}
    >
      <CheckCircle className="h-4 w-4 mr-1" />
      {loading ? "Completing..." : "Complete"}
    </Button>
  );
}

export function RescheduleFollowUpButton({ 
  followUpId, 
  leadId, 
  currentTime 
}: { 
  followUpId: string; 
  leadId: string;
  currentTime: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button 
        size="sm" 
        variant="outline" 
        className="bg-white"
        onClick={() => setOpen(true)}
      >
        <Calendar className="h-4 w-4 mr-1" />
        Reschedule
      </Button>
      
      <ScheduleFollowUpModal 
        open={open}
        onOpenChange={setOpen}
        defaultLeadId={leadId}
      />
    </>
  );
}