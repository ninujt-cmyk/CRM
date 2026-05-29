import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Phone, Bell, CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";
import Link from "next/link";
import { ScheduleFollowUpModal } from "@/components/schedule-follow-up-modal";
import { format, isToday, isTomorrow, isAfter } from "date-fns";
import { NotificationBell } from "@/components/notification-bell";
import { redirect } from "next/navigation";
import { CompleteFollowUpButton, RescheduleFollowUpButton } from "@/components/follow-up-actions";

interface Lead {
  id: string;
  name: string;
  phone: string | null;
  company: string | null;
}

interface FollowUp {
  id: string;
  lead_id: string;
  user_id: string;
  scheduled_at: string;
  notes: string | null;
  status: string;
  lead: Lead | null;
}

export default async function FollowUpsPage() {
  const supabase = await createClient();

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  try {
    // Upcoming follow-ups query
    const { data: followUps, error: followUpsError } = await supabase
      .from("follow_ups")
      .select(`
        id,
        lead_id,
        user_id,
        scheduled_at,
        notes,
        status,
        lead:leads(id, name, phone, company),
        user:users!follow_ups_user_id_fkey(full_name)
      `)
      .eq("user_id", user.id)
      .eq("status", "pending")
      .gte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true });

    // Overdue follow-ups query  
    const { data: overdueFollowUps, error: overdueError } = await supabase
      .from("follow_ups")
      .select(`
        id,
        lead_id,
        user_id,
        scheduled_at,
        notes,
        status,
        lead:leads(id, name, phone, company),
        user:users!follow_ups_user_id_fkey(full_name)
      `)
      .eq("user_id", user.id)
      .eq("status", "pending")
      .lt("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: false });
      
    if (followUpsError) {
      console.error("Error fetching follow-ups:", followUpsError);
      // Don't throw error, just show empty state
    }
    
    if (overdueError) {
      console.error("Error fetching overdue follow-ups:", overdueError);
      // Don't throw error, just show empty state
    }

    const getTimeDisplay = (dateString: string) => {
      const date = new Date(dateString);
      if (isToday(date)) return `Today, ${format(date, "hh:mm a")}`;
      if (isTomorrow(date)) return `Tomorrow, ${format(date, "hh:mm a")}`;
      return format(date, "MMM dd, yyyy hh:mm a");
    };

    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Follow-ups & Reminders</h1>
            <p className="text-gray-600 mt-1">Manage your scheduled callbacks and follow-ups</p>
          </div>
          <div className="flex items-center gap-4">
            <NotificationBell />
            <ScheduleFollowUpModal />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming Follow-ups */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Scheduled Follow-ups ({followUps?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {followUps && followUps.length > 0 ? (
                <div className="space-y-4">
                  {(followUps as unknown as FollowUp[]).map((followUp: FollowUp) => (
                    <div key={followUp.id} className="p-4 border rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold">{followUp.lead?.name || "Unknown Lead"}</h3>
                          <p className="text-sm text-gray-600">{followUp.lead?.company || "No company"}</p>
                          <p className="text-sm text-gray-600">{followUp.lead?.phone || "No phone"}</p>
                        </div>
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                          {getTimeDisplay(followUp.scheduled_at)}
                        </span>
                      </div>
                      {followUp.notes && (
                        <p className="text-sm text-gray-700 mt-2">{followUp.notes}</p>
                      )}
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" variant="outline" asChild>
                          <a href={`tel:${followUp.lead?.phone}`}>
                            <Phone className="h-4 w-4 mr-1" />
                            Call Now
                          </a>
                        </Button>
                        <CompleteFollowUpButton followUpId={followUp.id} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No upcoming follow-ups</p>
              )}
            </CardContent>
          </Card>

          {/* Overdue Follow-ups */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <Bell className="h-5 w-5" />
                Overdue Follow-ups ({overdueFollowUps?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {overdueFollowUps && overdueFollowUps.length > 0 ? (
                <div className="space-y-4">
                  {(overdueFollowUps as unknown as FollowUp[]).map((followUp: FollowUp) => (
                    <div key={followUp.id} className="p-4 border border-red-200 rounded-lg bg-red-50">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold">{followUp.lead?.name || "Unknown Lead"}</h3>
                          <p className="text-sm text-gray-600">{followUp.lead?.company || "No company"}</p>
                          <p className="text-sm text-gray-600">{followUp.lead?.phone || "No phone"}</p>
                        </div>
                        <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                          Missed: {format(new Date(followUp.scheduled_at), "MMM dd, hh:mm a")}
                        </span>
                      </div>
                      {followUp.notes && (
                        <p className="text-sm text-gray-700 mt-2">{followUp.notes}</p>
                      )}
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" variant="outline" className="bg-white" asChild>
                          <a href={`tel:${followUp.lead?.phone}`}>
                            <Phone className="h-4 w-4 mr-1" />
                            Call Now
                          </a>
                        </Button>
                        <RescheduleFollowUpButton 
                          followUpId={followUp.id} 
                          leadId={followUp.lead_id} 
                          currentTime={followUp.scheduled_at}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No overdue follow-ups</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  } catch (error) {
    console.error("Error loading follow-ups page:", error);
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-gray-400" />
            <p className="mt-4 text-gray-600">Loading follow-ups...</p>
          </div>
        </div>
      </div>
    );
  }
}