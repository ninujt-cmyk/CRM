import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ShieldCheck, FileText, Users, ArrowRight, Clock, 
  CheckCircle, TrendingUp, XCircle, IndianRupee, Loader2,
  Inbox
} from "lucide-react";

// Updated Lead type
interface Lead {
    id: string;
    name: string;
    status: string;
    phone: string;
}

// FIX 1: Add the missing 'TRANSFERRED_TO_KYC' status here so the dashboard recognizes it
const STATUSES = {
    LOGIN_DONE: "Login Done",
    TRANSFERRED_TO_KYC: "Transferred to KYC", // <--- ADDED THIS
    UNDERWRITING: "Underwriting",
    REJECTED: "Rejected",
    APPROVED: "Approved",
    DISBURSED: "DISBURSED",
} as const;

export default async function KycTeamDashboard() {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login"); 
    }

    const todayStart = new Date().toISOString().split("T")[0];

    // 2. Data Fetching for Dashboard
    const [
      { count: newAssignments }, // <--- New Count for leads just transferred
      { count: pendingUnderwriting }, 
      { count: approvedToday }, 
      { count: DISBURSEDToday },
      { data: recentLeadsResult }
    ] =
        await Promise.all([
            // Query 1: Count New Assignments (Status = Transferred to KYC)
            supabase.from("leads")
                .select("*", { count: "exact", head: true })
                .eq("kyc_member_id", user.id)
                .eq("status", STATUSES.TRANSFERRED_TO_KYC),

            // Query 2: Count Leads In Underwriting
            supabase.from("leads")
                .select("*", { count: "exact", head: true })
                .eq("kyc_member_id", user.id)
                .eq("status", STATUSES.UNDERWRITING),
            
            // Query 3: Count Leads Approved today
            supabase.from("leads")
                .select("*", { count: "exact", head: true })
                .eq("kyc_member_id", user.id)
                .eq("status", STATUSES.APPROVED)
                .gte("updated_at", todayStart),
            
            // Query 4: Count Leads Disbursed today
            supabase.from("leads")
                .select("*", { count: "exact", head: true })
                .eq("kyc_member_id", user.id)
                .eq("status", STATUSES.DISBURSED)
                .gte("updated_at", todayStart),
            
            // Query 5: Recent Active Leads
            // FIX 2: Added STATUSES.TRANSFERRED_TO_KYC to the .in() filter list
            supabase.from("leads")
                .select("id, name, status, phone") 
                .eq("kyc_member_id", user.id)
                .in("status", [STATUSES.TRANSFERRED_TO_KYC, STATUSES.LOGIN_DONE, STATUSES.UNDERWRITING]) 
                .order("created_at", { ascending: false }) 
                .limit(5)
        ]);

    const stats = [
        // FIX 3: Added a new Card for "New Assignments" so the user sees them immediately
        {
            title: "New Assignments",
            value: newAssignments || 0,
            icon: Inbox,
            color: "text-blue-600",
            bgColor: "bg-blue-50",
            // You might need to ensure your Leads List page handles this status filter too
            link: `/kyc-team/leads?status=${STATUSES.TRANSFERRED_TO_KYC}`
        },
        {
            title: "In Underwriting",
            value: pendingUnderwriting || 0,
            icon: Loader2,
            color: "text-amber-600",
            bgColor: "bg-amber-50",
            link: `/kyc-team/leads?status=${STATUSES.UNDERWRITING}`
        },
        {
            title: "Approved (Today)",
            value: approvedToday || 0,
            icon: CheckCircle,
            color: "text-green-600",
            bgColor: "bg-green-50",
            link: `/kyc-team/leads?status=${STATUSES.APPROVED}`
        },
        {
            title: "DISBURSED (Today)",
            value: DISBURSEDToday || 0,
            icon: IndianRupee,
            color: "text-purple-600",
            bgColor: "bg-purple-50",
            link: `/kyc-team/leads?status=${STATUSES.DISBURSED}`
        },
    ];

    const getStatusBadge = (status: string) => {
        switch (status) {
            case STATUSES.LOGIN_DONE:
                return <Badge className="bg-gray-400 text-white">Login Done</Badge>;
            // FIX 4: Added Badge for new status
            case STATUSES.TRANSFERRED_TO_KYC:
                return <Badge className="bg-blue-600 text-white hover:bg-blue-700">New Assignment</Badge>;
            case STATUSES.UNDERWRITING:
                return <Badge className="bg-amber-500 text-white hover:bg-amber-600">Underwriting</Badge>;
            case STATUSES.REJECTED:
                return <Badge className="bg-red-600 text-white hover:bg-red-700">Rejected</Badge>;
            case STATUSES.APPROVED:
                return <Badge className="bg-green-600 text-white hover:bg-green-700">Approved</Badge>;
            case STATUSES.DISBURSED:
                return <Badge className="bg-purple-600 text-white hover:bg-purple-700">DISBURSED</Badge>;
            default:
                return <Badge variant="secondary">Unknown</Badge>;
        }
    };

    return (
        <div className="space-y-8 pb-8">
            <h1 className="text-3xl font-bold flex items-center gap-2 text-gray-800">
                <ShieldCheck className="w-8 h-8 text-purple-600" />
                KYC Verification Dashboard
            </h1>

            {/* Stats Grid - Updated to 4 columns to fit new card */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, index) => (
                    <Card key={index} className="hover:shadow-xl transition-shadow border-2 border-transparent hover:border-purple-200">
                        <CardContent className="p-6">
                            <Link href={stat.link} className="block group">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                                        <p className="text-4xl font-extrabold text-gray-900 mt-2">{stat.value}</p>
                                    </div>
                                    <div className={`p-4 rounded-full ${stat.bgColor} group-hover:rotate-6 transition-transform`}>
                                        <stat.icon className={`h-8 w-8 ${stat.color}`} />
                                    </div>
                                </div>
                                <div className="flex items-center justify-end pt-4 text-xs font-semibold text-purple-600 group-hover:text-purple-700">
                                    View Leads <ArrowRight className="h-3 w-3 ml-1" />
                                </div>
                            </Link>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Recent Leads Table */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-gray-600" />
                        Active Leads Queue
                    </CardTitle>
                    <Link href="/kyc-team/leads" passHref>
                        <Button variant="ghost" size="sm" className="text-purple-600">View All</Button>
                    </Link>
                </CardHeader>
                <CardContent>
                    {recentLeadsResult?.length ? (
                        <ul className="w-full space-y-3">
                            {recentLeadsResult.map((lead: Lead) => (
                                <li key={lead.id} className="flex justify-between items-center p-3 border rounded-xl bg-white hover:bg-purple-50 transition-colors shadow-sm">
                                    <span className="flex flex-col">
                                        <Link href={`/kyc-team/${lead.id}`} className="font-semibold text-purple-700 hover:underline">
                                            {lead.name}
                                        </Link>
                                        <span className="text-xs text-gray-500">{lead.phone}</span>
                                    </span>
                                    <div className="flex items-center gap-2">
                                        {getStatusBadge(lead.status)}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-center text-gray-500 py-8 flex items-center justify-center gap-2">
                            <Users className="h-5 w-5"/>
                            No active leads in your queue.
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
