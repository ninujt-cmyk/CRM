"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, BarChart3, TrendingUp, Users } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

// Define the data shape
interface AnalyticsProps {
  data: any[];
  grandTotals: any;
}

export function SummaryAnalytics({ data, grandTotals }: AnalyticsProps) {
  
  // 1. Prepare Data for Chart (Top 10 Performers)
  const chartData = data
    .sort((a, b) => b.statusCounts.Disbursed - a.statusCounts.Disbursed)
    .slice(0, 10)
    .map(agent => ({
      name: agent.telecallerName.split(' ')[0], // First name only for cleaner chart
      Disbursed: agent.statusCounts.Disbursed || 0,
      Login: agent.statusCounts.Login || 0,
      Total: agent.totalLeads
    }));

  // 2. CSV Export Function
  const handleExport = () => {
    const headers = ["Telecaller ID", "Name", "Total Leads", "Conversion %", "Disbursed", "Login", "Contacted", "New", "Interested", "Follow Up"];
    const rows = data.map(agent => [
      agent.telecallerId,
      agent.telecallerName,
      agent.totalLeads,
      agent.conversionRate.toFixed(2),
      agent.statusCounts.Disbursed || 0,
      agent.statusCounts.Login || 0,
      agent.statusCounts.contacted || 0,
      agent.statusCounts.new || 0,
      agent.statusCounts.Interested || 0,
      agent.statusCounts.follow_up || 0
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `telecaller_summary_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 3. KPI Calculations
  const activeAgents = data.filter(d => d.totalLeads > 0).length;
  const overallConversion = grandTotals.total > 0 
    ? ((grandTotals.Disbursed / grandTotals.total) * 100).toFixed(1) 
    : "0.0";

  return (
    <div className="space-y-6 mb-8">
      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Active Agents</p>
              <h3 className="text-2xl font-bold text-gray-900">{activeAgents}</h3>
            </div>
            <div className="p-3 bg-blue-50 rounded-full"><Users className="h-6 w-6 text-blue-600" /></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Volume</p>
              <h3 className="text-2xl font-bold text-gray-900">{grandTotals.total.toLocaleString()}</h3>
            </div>
            <div className="p-3 bg-gray-100 rounded-full"><BarChart3 className="h-6 w-6 text-gray-600" /></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Overall Conversion</p>
              <h3 className="text-2xl font-bold text-green-600">{overallConversion}%</h3>
            </div>
            <div className="p-3 bg-green-50 rounded-full"><TrendingUp className="h-6 w-6 text-green-600" /></div>
          </CardContent>
        </Card>
      </div>

      {/* CHART & ACTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CHART SECTION */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Top Performers (Disbursed vs Login)</CardTitle>
          </CardHeader>
          <CardContent className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip cursor={{fill: '#f3f4f6'}} />
                <Legend />
                <Bar dataKey="Login" fill="#93c5fd" radius={[4, 4, 0, 0]} name="Logins" />
                <Bar dataKey="Disbursed" fill="#16a34a" radius={[4, 4, 0, 0]} name="Disbursed" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* ACTIONS SECTION */}
        <Card className="flex flex-col justify-center items-center p-6 text-center space-y-4">
          <div className="p-4 bg-gray-50 rounded-full">
            <Download className="h-8 w-8 text-gray-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Export Report</h3>
            <p className="text-sm text-gray-500 mt-1">Download detailed breakdown for Excel/Sheets analysis.</p>
          </div>
          <Button onClick={handleExport} className="w-full gap-2" variant="outline">
            <Download className="h-4 w-4" /> Download CSV
          </Button>
        </Card>
      </div>
    </div>
  );
}
