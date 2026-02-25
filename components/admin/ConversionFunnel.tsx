"use client"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Filter, TrendingDown } from "lucide-react"

export function ConversionFunnel() {
    const [funnel, setFunnel] = useState<{status: string, count: number, percentage: number}[]>([])
    const supabase = createClient()

    useEffect(() => {
        const fetchFunnel = async () => {
            const { data } = await supabase.from('leads').select('status');
            if (!data) return;

            // Map and count exact statuses
            const counts = {
                'Total Leads': data.length,
                'Contacted': data.filter(d => ['Contacted', 'Follow Up', 'Interested', 'Login Done', 'Disbursed'].includes(d.status)).length,
                'Interested': data.filter(d => ['Interested', 'Documents_Sent', 'Login Done', 'Disbursed'].includes(d.status)).length,
                'Login Done': data.filter(d => ['Login Done', 'Transferred to KYC', 'Disbursed'].includes(d.status)).length,
                'Disbursed': data.filter(d => d.status === 'Disbursed').length,
            };

            const total = counts['Total Leads'] || 1; // Prevent div by zero
            const formattedData = Object.entries(counts).map(([status, count]) => ({
                status, count, percentage: Math.round((count / total) * 100)
            }));

            setFunnel(formattedData);
        }
        fetchFunnel();
    }, [supabase])

    return (
        <Card className="shadow-lg border-slate-200">
            <CardHeader className="border-b flex flex-row items-center justify-between">
                <CardTitle className="text-xl flex items-center gap-2"><Filter className="h-5 w-5 text-indigo-600" /> Pipeline Conversion Funnel</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
                {funnel.map((step, index) => {
                    // Previous step count for drop-off calculation
                    const prevCount = index === 0 ? step.count : funnel[index - 1].count;
                    const dropOff = prevCount > 0 ? Math.round(((prevCount - step.count) / prevCount) * 100) : 0;

                    return (
                        <div key={step.status} className="relative">
                            <div className="flex justify-between text-sm font-bold text-slate-700 mb-1">
                                <span>{step.status}</span>
                                <span>{step.count} ({step.percentage}%)</span>
                            </div>
                            <div className="h-8 w-full bg-slate-100 rounded-md overflow-hidden flex items-center relative">
                                <div 
                                    className="h-full bg-indigo-500 rounded-md transition-all duration-1000" 
                                    style={{ width: `${step.percentage}%` }}
                                ></div>
                            </div>
                            {index > 0 && dropOff > 0 && (
                                <div className="absolute -top-4 right-0 text-[10px] text-red-500 font-bold flex items-center gap-1">
                                    <TrendingDown className="h-3 w-3" /> {dropOff}% Drop-off
                                </div>
                            )}
                        </div>
                    )
                })}
            </CardContent>
        </Card>
    )
}
