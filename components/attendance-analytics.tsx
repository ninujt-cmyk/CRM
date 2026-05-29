"use client";

import { useState, useEffect } from "react";
import { 
  format, subDays, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend 
} from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";
import { 
  Calendar, Download, TrendingUp, TrendingDown, Users, Clock,
  AlertCircle, CheckCircle, XCircle
} from "lucide-react";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import type { ValueType } from "recharts/types/component/DefaultTooltipContent";
import type { PieLabelRenderProps } from "recharts/types/polar/Pie";

// Types
interface AttendanceSummary {
  date: string;
  present: number;
  absent: number;
  late: number;
  leave: number;
}

interface EmployeeAttendance {
  id: string;
  name: string;
  department: string;
  present: number;
  absent: number;
  late: number;
  leave: number;
  overtimeHours: number;
}

interface AttendanceTrend {
  name: string;
  value: number;
  [key: string]: any;
}

export function AttendanceAnalytics() {
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: subDays(new Date(), 30),
    end: new Date()
  });
  const [period, setPeriod] = useState<"7d" | "30d" | "90d" | "month">("30d");
  const [attendanceData, setAttendanceData] = useState<AttendanceSummary[]>([]);
  const [employeeData, setEmployeeData] = useState<EmployeeAttendance[]>([]);
  const [trendData, setTrendData] = useState<AttendanceTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, [dateRange, period]);

  const loadData = async () => {
    setLoading(true);
    try {
      await loadAttendanceSummary();
      await loadEmployeeData();
      await loadTrendData();
    } catch (error) {
      console.error("Error loading analytics data:", error);
    } finally {
      setLoading(false);
    }
  };

  // 1. Daily Summary
  const loadAttendanceSummary = async () => {
    const { data, error } = await supabase
      .from("attendance")
      .select("id, check_in, check_out, status")
      .gte("check_in", dateRange.start.toISOString())
      .lte("check_in", dateRange.end.toISOString());

    if (error) {
      console.error("Summary fetch error:", error);
      return;
    }

    const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
    const summary: AttendanceSummary[] = days.map(day => {
      const dayStr = format(day, "yyyy-MM-dd");
      const records = data.filter((r: any) => format(new Date(r.check_in), "yyyy-MM-dd") === dayStr);

      return {
        date: dayStr,
        present: records.length,
        absent: 0, // could calculate if you have total employees
        late: records.filter((r: any) => new Date(r.check_in).getHours() > 9).length,
        leave: records.filter((r: any) => r.status === "leave").length
      };
    });

    setAttendanceData(summary);
  };

  // 2. Employee-level summary
  const loadEmployeeData = async () => {
    const { data, error } = await supabase
  .from("attendance")
  .select(`
    id, check_in, check_out, status,
    user:users!attendance_user_id_fkey(id, full_name, department)
  `)
  .gte("check_in", dateRange.start.toISOString())
  .lte("check_in", dateRange.end.toISOString());


    if (error) {
      console.error("Employee data fetch error:", error);
      return;
    }

    const map: { [id: string]: EmployeeAttendance } = {};
    data.forEach((r: any) => {
      const empId = r.user?.id
      if (!map[empId]) {
        map[empId] = {
          id: empId,
          name: r.user?.full_name || "Unknown",
          department: r.user?.department || "N/A",
          present: 0,
          absent: 0,
          late: 0,
          leave: 0,
          overtimeHours: 0
        };
      }
      map[empId].present += 1;
      if (new Date(r.check_in).getHours() > 9) map[empId].late += 1;
      if (r.status === "leave") map[empId].leave += 1;
      if (r.check_in && r.check_out) {
        const hrs = (new Date(r.check_out).getTime() - new Date(r.check_in).getTime()) / 3600000;
        if (hrs > 8) map[empId].overtimeHours += hrs - 8;
      }
    });

    setEmployeeData(Object.values(map));
  };

  // 3. Trends
  const loadTrendData = async () => {
    if (!attendanceData.length) return;

    const total = attendanceData.reduce((sum, d) => sum + d.present + d.late + d.absent + d.leave, 0);
    if (total === 0) return;

    const punctuality = 100 - ((attendanceData.reduce((s, d) => s + d.late, 0) / total) * 100);
    const attendanceRate = (attendanceData.reduce((s, d) => s + d.present, 0) / total) * 100;
    const leaveRate = (attendanceData.reduce((s, d) => s + d.leave, 0) / total) * 100;

    const data: AttendanceTrend[] = [
      { name: "Punctuality", value: Math.round(punctuality) },
      { name: "Attendance", value: Math.round(attendanceRate) },
      { name: "Leave", value: Math.round(leaveRate) }
    ];
    setTrendData(data);
  };

  const updateDateRange = (newPeriod: typeof period) => {
    setPeriod(newPeriod);
    const today = new Date();
    let start: Date;

    switch (newPeriod) {
      case "7d":
        start = subDays(today, 7);
        break;
      case "30d":
        start = subDays(today, 30);
        break;
      case "90d":
        start = subDays(today, 90);
        break;
      case "month":
        start = startOfMonth(today);
        setDateRange({ start, end: endOfMonth(today) });
        return;
      default:
        start = subDays(today, 30);
    }
    setDateRange({ start, end: today });
  };

  const COLORS = ["#10B981", "#F59E0B", "#3B82F6", "#8B5CF6"];

  if (loading) {
    return <div className="p-6">Loading analytics data...</div>;
  }

  const totalEmployees = employeeData.length;
  const avgAttendance = employeeData.reduce((sum, emp) => sum + emp.present, 0) / (employeeData.length || 1);
  const avgPunctuality = employeeData.reduce((sum, emp) => sum + (emp.late === 0 ? 100 : 100 - (emp.late * 5)), 0) / (employeeData.length || 1);
  const totalOvertime = employeeData.reduce((sum, emp) => sum + emp.overtimeHours, 0);

  return (
    <div className="p-6 space-y-6">
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Attendance Analytics</h1>
          <p className="text-gray-600 mt-1">Comprehensive attendance reports and insights</p>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={(v) => updateDateRange(v as typeof period)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Calendar className="h-4 w-4 mr-2" />
            {format(dateRange.start, "MMM dd")} - {format(dateRange.end, "MMM dd")}
          </Button>
          <Button onClick={() => console.log("Export CSV")}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader><CardContent>
          <div className="text-2xl font-bold">{totalEmployees}</div>
          <p className="text-xs text-muted-foreground">Active team members</p>
        </CardContent></Card>

        <Card><CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Avg. Attendance</CardTitle>
          <CheckCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader><CardContent>
          <div className="text-2xl font-bold">{avgAttendance.toFixed(1)}%</div>
        </CardContent></Card>

        <Card><CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Punctuality Rate</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader><CardContent>
          <div className="text-2xl font-bold">{avgPunctuality.toFixed(1)}%</div>
        </CardContent></Card>

        <Card><CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Total Overtime</CardTitle>
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader><CardContent>
          <div className="text-2xl font-bold">{totalOvertime.toFixed(1)}h</div>
        </CardContent></Card>
      </div>

      {/* charts */}
      <Card><CardHeader><CardTitle>Attendance Overview</CardTitle></CardHeader>
        <CardContent><div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={attendanceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={(value) => format(new Date(value), "MMM dd")} />
              <YAxis />
              <Tooltip formatter={(value) => [value, "Employees"]} />
              <Legend />
              <Bar dataKey="present" name="Present" fill="#10B981" />
              <Bar dataKey="late" name="Late" fill="#F59E0B" />
              <Bar dataKey="absent" name="Absent" fill="#EF4444" />
              <Bar dataKey="leave" name="Leave" fill="#3B82F6" />
            </BarChart>
          </ResponsiveContainer>
        </div></CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card><CardHeader><CardTitle>Top Performing Employees</CardTitle></CardHeader>
          <CardContent>
            {employeeData.sort((a, b) => (b.present + b.overtimeHours) - (a.present + a.overtimeHours))
              .slice(0, 5).map(emp => (
                <div key={emp.id} className="flex justify-between p-3 bg-gray-50 rounded-md mb-2">
                  <div>
                    <div className="font-medium">{emp.name}</div>
                    <div className="text-sm text-gray-500">{emp.department}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{emp.present} days</div>
                    <div className="text-sm text-gray-500">{emp.overtimeHours.toFixed(1)}h overtime</div>
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>

        <Card><CardHeader><CardTitle>Attendance Trends</CardTitle></CardHeader>
          <CardContent><div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={trendData} cx="50%" cy="50%" outerRadius={80} dataKey="value"
                  label={(props: any) => {
                    const { name, percent } = props;
                    return name && percent ? `${name}: ${(Number(percent) * 100).toFixed(0)}%` : "";
                  }}>
                  {trendData.map((entry, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => [`${value}%`, "Percentage"]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div></CardContent>
        </Card>
      </div>
    </div>
  );
}
