import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link"; 
import { SummaryAnalytics } from "@/components/admin/summary-analytics"; 
import { TelecallerTable } from "@/components/admin/telecaller-table";
import { Skeleton } from "@/components/ui/skeleton";
import { ShareReportButton } from "@/components/admin/share-report-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const dynamic = 'force-dynamic';

// --- Mapping Short forms to Full forms ---
const STATUS_DICTIONARY = {
  "NEW": "new",
  "INT": "Interested",
  "DOC": "Documents_Sent",
  "LOG": "Login",
  "NR": "nr",
  "SE": "self_employed",
  "DIS": "Disbursed",
  "FU": "follow_up",
  "NI": "Not_Interested",
  "NE": "not_eligible"
};

const LEAD_STATUSES = Object.values(STATUS_DICTIONARY);
const SHORT_STATUSES = Object.keys(STATUS_DICTIONARY);

// --- Data Fetching Logic ---
async function getTelecallerLeadSummary(searchParams: { from?: string; to?: string }) {
  const supabase = await createClient();

  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString(); 
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  
  const fromDate = searchParams.from || firstDay;
  const toDate = searchParams.to || tomorrow.toISOString();

  const { data: users, error: userError } = await supabase
    .from("users")
    .select("id, full_name");

  if (userError) return { data: [], grandTotals: {} };

  let query = supabase
    .from("leads")
    .select("assigned_to, status")
    .not('assigned_to', 'is', null)
    .gte('created_at', fromDate)
    .lte('created_at', toDate);

  const { data: leads, error: leadsError } = await query.range(0, 9999);

  if (leadsError) return { data: [], grandTotals: {} };

  const summaryMap = new Map();
  const grandTotals: any = { total: 0 };
  LEAD_STATUSES.forEach(s => grandTotals[s] = 0);

  users?.forEach((user: any) => {
    summaryMap.set(user.id, {
      telecallerId: user.id,
      telecallerName: user.full_name || "Unknown",
      statusCounts: {},
      totalLeads: 0,
      conversionRate: 0
    });
  });

  leads?.forEach((lead: any) => {
    const tid = lead.assigned_to;
    const status = lead.status;

    if (tid && summaryMap.has(tid)) {
      const summary = summaryMap.get(tid);
      summary.statusCounts[status] = (summary.statusCounts[status] || 0) + 1;
      summary.totalLeads += 1;
      grandTotals[status] = (grandTotals[status] || 0) + 1;
      grandTotals['total'] += 1;
    }
  });

  const processed = Array.from(summaryMap.values())
    .filter((tc: any) => tc.totalLeads > 0)
    .map((tc: any) => {
      const disbursed = tc.statusCounts["Disbursed"] || 0;
      tc.conversionRate = tc.totalLeads > 0 ? (disbursed / tc.totalLeads) * 100 : 0;
      return tc;
    })
    .sort((a: any, b: any) => b.totalLeads - a.totalLeads);

  return { data: processed, grandTotals };
}

// --- Loading Skeleton Component ---
function DashboardSkeleton() {
  return (
    <div className="space-y-6 w-full">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-[400px] w-full rounded-xl" />
    </div>
  );
}

// --- Extracted Async Content Component ---
async function DashboardContent({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const { data: summaryData, grandTotals } = await getTelecallerLeadSummary(searchParams);

  return (
    // ID attached here so the Share button knows what to capture
    <div id="report-container" className="space-y-6 w-full min-w-0 pb-4 bg-gray-50/50">
      <SummaryAnalytics data={summaryData} grandTotals={grandTotals} />
      
      <Card className="shadow-sm border-gray-200 w-full overflow-hidden max-w-[calc(100vw-2rem)] md:max-w-[calc(100vw-4rem)]">
        <CardContent className="p-4 w-full overflow-x-auto scrollbar-thin">
          <div className="w-full">
            {/* Pass the mapped dictionary or statuses to your table so it can render the short forms */}
            <TelecallerTable 
              data={summaryData} 
              grandTotals={grandTotals} 
              statuses={LEAD_STATUSES} 
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// --- Main Page Component ---
export default function TelecallerLeadSummaryPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const now = new Date();
  
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();

  const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString();
  const yesterdayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999).toISOString();

  return (
    <div className="space-y-6 p-4 md:p-8 bg-gray-50/50 min-h-screen w-full max-w-full overflow-x-hidden">
      
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-3">
              <BarChart3 className="w-7 h-7 md:w-8 md:h-8 text-primary" />
              Performance Summary
            </h1>
            
            {/* Clickable Dialog for Status Full Forms */}
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" title="View Status Definitions">
                  <Info className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Status Legend</DialogTitle>
                  <DialogDescription>Full forms for the abbreviations used in the report.</DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {Object.entries(STATUS_DICTIONARY).map(([short, full]) => (
                    <div key={short} className="flex flex-col p-2 border rounded-md bg-slate-50">
                      <span className="font-bold text-slate-800">{short}</span>
                      <span className="text-sm text-slate-500 capitalize">{full.replace('_', ' ')}</span>
                    </div>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          </div>
          
          <p className="text-gray-500 mt-2 text-sm">
            Analysis from <span className="font-mono text-gray-700 bg-white px-2 py-0.5 rounded border">{searchParams.from ? new Date(searchParams.from).toLocaleDateString() : 'Start of Month'}</span> to <span className="font-mono text-gray-700 bg-white px-2 py-0.5 rounded border">{searchParams.to ? new Date(searchParams.to).toLocaleDateString() : 'Now'}</span>.
          </p>
        </div>

        {/* Filter Buttons & Share Action */}
        <div className="flex flex-wrap gap-2 items-center lg:justify-end">
           <Button variant="outline" size="sm" asChild>
             <Link href={`?from=${todayStart}&to=${todayEnd}`}>Today</Link>
           </Button>
           <Button variant="outline" size="sm" asChild>
             <Link href={`?from=${yesterdayStart}&to=${yesterdayEnd}`}>Yesterday</Link>
           </Button>
           <Button variant="outline" size="sm" asChild>
             <Link href="?">This Month</Link>
           </Button>
           <Button variant="outline" size="sm" asChild>
             <Link href="?from=2023-01-01">All Time</Link>
           </Button>
           
           <div className="w-px h-6 bg-gray-300 mx-2 hidden sm:block"></div>
           
           {/* Client Component Button targeting the report div */}
           <ShareReportButton targetId="report-container" />
        </div>
      </div>

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
