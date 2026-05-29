"use client";

import { useState } from "react";
import { PayrollIntegrationReport } from "@/components/PayrollIntegrationReport";
import { SummaryReport } from "@/components/SummaryReport";
import { DetailedReport } from "@/components/DetailedReport";
import { TrendsReport } from "@/components/TrendsReport";
// 1. IMPORT THE NEW LATE REPORT COMPONENT
import { DailyLateReport } from "@/components/DailyLateReport"; 

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "lucide-react";

export default function AttendanceReportsPageClient() {
  // 2. Add 'late_checkins' to the allowed views state
  const [view, setView] = useState<"summary" | "detailed" | "trends" | "payroll" | "late_checkins">("payroll");

  // DATE STATE
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<string>(String(currentDate.getMonth())); // 0 = Jan
  const [selectedYear, setSelectedYear] = useState<string>(String(currentDate.getFullYear()));

  // Generate Year Options
  const currentYearInt = currentDate.getFullYear();
  const years = [currentYearInt - 1, currentYearInt, currentYearInt + 1];

  const months = [
    { value: "0", label: "January" },
    { value: "1", label: "February" },
    { value: "2", label: "March" },
    { value: "3", label: "April" },
    { value: "4", label: "May" },
    { value: "5", label: "June" },
    { value: "6", label: "July" },
    { value: "7", label: "August" },
    { value: "8", label: "September" },
    { value: "9", label: "October" },
    { value: "10", label: "November" },
    { value: "11", label: "December" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">Attendance Reports</h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Monitor and audit workforce attendance trends, payroll hours, and late-arrival insights.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
           
          {/* YEAR SELECTOR */}
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-0.5 shadow-2xs">
            <Calendar className="h-4 w-4 text-slate-400 dark:text-slate-500" />
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[90px] border-0 focus:ring-0 shadow-none bg-transparent font-semibold text-xs text-slate-700 dark:text-slate-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)} className="text-xs font-semibold">
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* MONTH SELECTOR */}
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[140px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs font-semibold text-xs text-slate-700 dark:text-slate-300">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {months.map((m) => (
                <SelectItem key={m.value} value={m.value} className="text-xs font-semibold">
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* VIEW SELECTOR */}
          <Select value={view} onValueChange={(val) => setView(val as any)}>
            <SelectTrigger className="w-[180px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs font-bold text-xs text-slate-850 dark:text-slate-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="payroll" className="font-bold text-xs">Payroll (Salary)</SelectItem>
              <SelectItem value="late_checkins" className="font-bold text-xs text-rose-600 dark:text-rose-455">🔴 Late Check-ins</SelectItem>
              <SelectItem value="summary" className="font-bold text-xs">Summary View</SelectItem>
              <SelectItem value="detailed" className="font-bold text-xs">Detailed History</SelectItem>
              <SelectItem value="trends" className="font-bold text-xs">Trends & Velocity</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" className="border-slate-200 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl shadow-2xs font-bold text-xs py-5 px-5 flex items-center gap-1.5">
            Export Report
          </Button>
        </div>
      </div>

      {/* RENDER SELECTED REPORT COMPONENT */}
      <div className="border border-slate-200/60 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-sm overflow-hidden min-h-[400px]">
        {view === "summary" && <SummaryReport month={parseInt(selectedMonth)} year={parseInt(selectedYear)} />}
        
        {view === "detailed" && <DetailedReport month={parseInt(selectedMonth)} year={parseInt(selectedYear)} />}
        
        {view === "trends" && <TrendsReport month={parseInt(selectedMonth)} year={parseInt(selectedYear)} />}
        
        {view === "payroll" && <PayrollIntegrationReport month={parseInt(selectedMonth)} year={parseInt(selectedYear)} />}
        
        {view === "late_checkins" && <DailyLateReport />}
      </div>
    </div>
  );
}
