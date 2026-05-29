"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Loader2, Clock, AlertTriangle } from "lucide-react";

interface LateEntry {
  id: string;
  user_name: string;
  check_in_time: string;
  check_in_raw: Date;
  expected_out_time: string;
  late_by: string;
}

export function DailyLateReport() {
  const [data, setData] = useState<LateEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const OFFICE_START_HOUR = 9;
  const OFFICE_START_MINUTE = 30;

  useEffect(() => {
    fetchLateComers();
  }, []);

  const fetchLateComers = async () => {
    setLoading(true);
    const todayStr = new Date().toISOString().split("T")[0];

    // FIX: Added '!attendance_user_id_fkey' to resolve the ambiguous relationship error
    const { data: attendance, error } = await supabase
      .from("attendance")
      .select("id, check_in, user_id, users!attendance_user_id_fkey(full_name)")
      .eq("date", todayStr)
      .not("check_in", "is", null);

    if (error) {
      console.error("Error fetching attendance:", error);
      setLoading(false);
      return;
    }

    const lateList: LateEntry[] = [];
    const officeStartTime = new Date();
    officeStartTime.setHours(OFFICE_START_HOUR, OFFICE_START_MINUTE, 0, 0);

    attendance?.forEach((record: any) => {
      if (!record.check_in) return;

      const checkInTime = new Date(record.check_in);
      
      // Normalize comparison time to today
      const checkInCompare = new Date(officeStartTime);
      checkInCompare.setHours(checkInTime.getHours(), checkInTime.getMinutes(), 0, 0);

      if (checkInCompare > officeStartTime) {
        // Late By calculation
        const diffMs = checkInCompare.getTime() - officeStartTime.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const lateByStr = `${Math.floor(diffMins / 60)}h ${diffMins % 60}m`;

        // Expected Exit (+8h 30m)
        const WORK_DURATION_MS = (8 * 60 + 30) * 60 * 1000;
        const expectedOutDate = new Date(checkInTime.getTime() + WORK_DURATION_MS);

        lateList.push({
          id: record.id,
          // Handle the nested user object safely
          user_name: Array.isArray(record.users) ? record.users[0]?.full_name : record.users?.full_name || "Unknown",
          check_in_raw: checkInTime,
          check_in_time: checkInTime.toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          }),
          expected_out_time: expectedOutDate.toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          }),
          late_by: lateByStr.replace("0h ", ""),
        });
      }
    });

    lateList.sort((a, b) => b.check_in_raw.getTime() - a.check_in_raw.getTime());
    setData(lateList);
    setLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-600">
          <AlertTriangle className="h-5 w-5" />
          Late Arrivals (Today)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : data.length === 0 ? (
          <div className="text-center p-8 text-green-600 font-medium">
            🎉 No late check-ins today! Everyone is on time.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-red-50 text-red-900 font-bold">
                <tr>
                  <th className="text-left p-3 rounded-tl-lg">Employee</th>
                  <th className="text-left p-3">Check In</th>
                  <th className="text-left p-3">Late By</th>
                  <th className="text-left p-3 rounded-tr-lg">
                    Expected Check Out
                    <span className="block text-[10px] font-normal opacity-75">
                      hrs
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="p-3 font-medium text-gray-800">
                      {row.user_name}
                    </td>
                    <td className="p-3 text-red-600 font-bold">
                      {row.check_in_time}
                    </td>
                    <td className="p-3">
                      <span className="inline-flex items-center px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold">
                        {row.late_by}
                      </span>
                    </td>
                    <td className="p-3 text-blue-700 font-mono font-medium flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      {row.expected_out_time}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
