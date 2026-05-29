"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

interface PayrollIntegrationReportProps {
  month: number;
  year: number;
}

interface PayrollRow {
  id: string;
  name: string;
  department: string;
  present: number;
  absent: number;
  workingHours: number;
  overtimeHours: number;
  baseSalary: number;
  overtimeRate: number;
  totalPay: number;
}

export function PayrollIntegrationReport({ month, year }: PayrollIntegrationReportProps) {
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newSalary, setNewSalary] = useState<number>(0);
  const supabase = createClient();

  const loadPayroll = useCallback(async () => {
    setLoading(true);
    
    // Calculate Date Range
    const startDate = new Date(year, month, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

    // Fetch Users
    const { data: users, error: userError } = await supabase
      .from("users")
      .select("id, full_name, department, base_salary")
      .eq("is_active", true);

    if (userError) {
      console.error("User fetch error:", userError);
      setLoading(false);
      return;
    }

    // Fetch Attendance
    const { data: attendance, error: attError } = await supabase
      .from("attendance")
      .select("user_id, check_in, check_out, status, date") // Ensure 'date' column is fetched
      .gte("date", startDate)
      .lte("date", endDate);

    if (attError) {
      console.error("Attendance fetch error:", attError);
      setLoading(false);
      return;
    }

    const workingDays = 26;
    const overtimeRate = 200; 

    // Helper to track unique dates per user to prevent double counting
    // Structure: { "user_id": Set("2026-01-02", "2026-01-03") }
    const uniquePresentDates: Record<string, Set<string>> = {};
    const uniqueAbsentDates: Record<string, Set<string>> = {};

    const map: { [id: string]: PayrollRow } = {};

    // 1. Initialize Users
    users?.forEach((u: any) => {
      map[u.id] = {
        id: u.id,
        name: u.full_name || "Unknown",
        department: u.department || "N/A",
        present: 0,
        absent: 0,
        workingHours: 0,
        overtimeHours: 0,
        baseSalary: u.base_salary || 25000,
        overtimeRate,
        totalPay: 0,
      };
      // Init sets
      uniquePresentDates[u.id] = new Set();
      uniqueAbsentDates[u.id] = new Set();
    });

    // 2. Process Attendance
    attendance?.forEach((r: any) => {
      const emp = map[r.user_id];
      if (!emp) return;

      // --- FIX: USE SET TO COUNT UNIQUE DAYS ---
      // We rely on r.date (YYYY-MM-DD) to identify unique days
      const recordDate = r.date || (r.check_in ? r.check_in.split('T')[0] : null);

      if (recordDate) {
        if (r.status === "absent") {
            uniqueAbsentDates[r.user_id].add(recordDate);
        } else {
            // Assume anything else is "Present" (even if they checked in multiple times)
            uniquePresentDates[r.user_id].add(recordDate);
        }
      }

      // --- CALCULATE HOURS (Summing all sessions is correct) ---
      if (r.check_in && r.check_out) {
        const checkIn = new Date(r.check_in);
        const checkOut = new Date(r.check_out);
        const diffMs = checkOut.getTime() - checkIn.getTime();
        
        if (diffMs > 0) {
            const hrs = diffMs / 3600000;
            emp.workingHours += hrs;
            
            // Daily Overtime logic requires grouping by day first, 
            // but for simplicity, we aggregate total monthly overtime here.
            // If you need strict daily OT (e.g. >9h per specific day), logic needs to be per-day group.
            // For now, we keep the simple aggregation or apply a threshold.
        }
      }
    });

    // 3. Final Totals Calculation
    Object.values(map).forEach((emp) => {
      // Assign the count from the Sets
      emp.present = uniquePresentDates[emp.id].size;
      emp.absent = uniqueAbsentDates[emp.id].size;

      // Calculate Overtime (Simple monthly logic: Total Hours - (Present Days * 9 hours))
      // OR keep your previous logic. Here is a safer monthly aggregation:
      const standardHours = emp.present * 9; 
      if (emp.workingHours > standardHours) {
          emp.overtimeHours = emp.workingHours - standardHours;
      } else {
          emp.overtimeHours = 0;
      }

      const perDay = emp.baseSalary / workingDays;
      const basePayEarned = perDay * emp.present;
      const overtimePay = emp.overtimeHours * emp.overtimeRate;
      
      emp.totalPay = basePayEarned + overtimePay;
    });

    setRows(Object.values(map));
    setLoading(false);
  }, [month, year, supabase]);

  useEffect(() => {
    loadPayroll();
  }, [loadPayroll]);

  // ... (handleEdit, handleSave, return JSX remain the same)
  // Just copying the rest of the component structure for completeness
  const handleEdit = (row: PayrollRow) => {
    setEditingId(row.id);
    setNewSalary(row.baseSalary);
  };

  const handleSave = async (id: string) => {
    const { error } = await supabase.from("users").update({ base_salary: newSalary }).eq("id", id);
    if (!error) { setEditingId(null); loadPayroll(); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            Payroll Integration Report
            {loading && <Loader2 className="h-4 w-4 animate-spin text-gray-500" />}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border text-sm">
            <thead className="bg-gray-50">
              <tr className="border-b">
                <th className="text-left p-3 font-medium text-gray-500">Employee</th>
                <th className="text-left p-3 font-medium text-gray-500">Dept</th>
                <th className="text-left p-3 font-medium text-gray-500">Present (Days)</th>
                <th className="text-left p-3 font-medium text-gray-500">Hours</th>
                <th className="text-left p-3 font-medium text-gray-500">Base Salary</th>
                <th className="text-left p-3 font-medium text-gray-500">Overtime (₹)</th>
                <th className="text-left p-3 font-medium text-gray-900">Total Pay</th>
                <th className="text-left p-3 font-medium text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading ? (
                  <tr><td colSpan={8} className="p-4 text-center text-gray-500">No data found.</td></tr>
              ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="border-b hover:bg-gray-50/50">
                      <td className="p-3 font-medium">{row.name}</td>
                      <td className="p-3 text-gray-500">{row.department}</td>
                      <td className="p-3"><span className="inline-flex items-center px-2 py-1 rounded-md bg-green-50 text-green-700 text-xs font-medium">{row.present}</span></td>
                      <td className="p-3">{row.workingHours.toFixed(1)}</td>
                      <td className="p-3">
                        {editingId === row.id ? (
                          <Input type="number" value={newSalary} onChange={(e) => setNewSalary(Number(e.target.value))} className="w-24 h-8" />
                        ) : (`₹${row.baseSalary.toLocaleString()}`)}
                      </td>
                      <td className="p-3 text-gray-600">{row.overtimeHours > 0 ? `+₹${(row.overtimeHours * row.overtimeRate).toFixed(0)}` : '-'}</td>
                      <td className="p-3 font-bold text-green-700">₹{row.totalPay.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      <td className="p-3">
                        {editingId === row.id ? (
                          <Button size="sm" onClick={() => handleSave(row.id)} className="h-8">Save</Button>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => handleEdit(row)} className="h-8 text-blue-600 hover:text-blue-700">Edit Salary</Button>
                        )}
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
