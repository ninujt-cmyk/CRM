"use client";

import { useState, useEffect, useMemo } from "react";
import { format, startOfMonth, endOfMonth, subMonths, addMonths, parseISO, isSameDay, isAfter, eachDayOfInterval, subDays, getDay, isWeekend } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Calendar as CalendarIcon, Users, Clock, CheckCircle, XCircle, AlertCircle, 
  Coffee, UserCheck, Search, Settings, ChevronRight, BarChart3, List, MessageSquare, Printer, Building2, Globe, Plus, Trash2, ChevronLeft
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import { toast } from "sonner";

// --- TYPES ---
type User = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  department: string;
  is_active: boolean;
};

type AttendanceRecord = {
  id: string;
  user_id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  total_hours: number | null;
  overtime_hours: number | null;
  status?: string; 
  location_check_in?: any;
  ip_check_in?: string;
  on_break?: boolean;
  updated_at?: string;
  admin_note?: string; 
  user?: User;
};

type ActivityItem = {
  id: string;
  type: 'check-in' | 'check-out' | 'break-start';
  user_name: string;
  time: string;
  timestamp: number;
  location?: any;
};

type Office = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius: number;
};

type Holiday = {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  type: 'public' | 'custom';
  is_working_day: boolean;
};

const ITEMS_PER_PAGE = 10;
const MAX_SHIFT_HOURS = 9;

// --- HELPER: HAVERSINE DISTANCE (KM) ---
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; 
  const dLat = deg2rad(lat2 - lat1);  
  const dLon = deg2rad(lon2 - lon1); 
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c; 
  return d;
}

function deg2rad(deg: number) {
  return deg * (Math.PI/180);
}

// --- MAIN COMPONENT ---
export function AdminAttendanceDashboard() {
  const supabase = createClient();

  // --- STATE ---
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: new Date(),
    end: new Date()
  });
  const [view, setView] = useState<'daily' | 'monthly'>('daily');
  const [users, setUsers] = useState<User[]>([]);
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  
  // Filters & Config
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [lateThresholdHour, setLateThresholdHour] = useState(9);
  const [lateThresholdMinute, setLateThresholdMinute] = useState(30);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Offices
  const [offices, setOffices] = useState<Office[]>([]);
  const [newOfficeName, setNewOfficeName] = useState("");
  const [newOfficeLat, setNewOfficeLat] = useState("");
  const [newOfficeLng, setNewOfficeLng] = useState("");

  // Holidays
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [newHolidayName, setNewHolidayName] = useState("");
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [isFetchingHolidays, setIsFetchingHolidays] = useState(false);

  // Modals & User Data
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [userMonthData, setUserMonthData] = useState<AttendanceRecord[]>([]);
  const [loadingModal, setLoadingModal] = useState(false);

  const [activeEmployees, setActiveEmployees] = useState<number>(0);
  const [employeesOnBreak, setEmployeesOnBreak] = useState<number>(0);

  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [editCheckIn, setEditCheckIn] = useState("");
  const [editCheckOut, setEditCheckOut] = useState("");
  const [editNote, setEditNote] = useState("");
  
  const [missingCheckoutCount, setMissingCheckoutCount] = useState(0);
  const [missingRecords, setMissingRecords] = useState<AttendanceRecord[]>([]);
  const [showReviewModal, setShowReviewModal] = useState(false);

  // --- 1. FETCH OFFICES ON MOUNT ---
  useEffect(() => {
    const fetchOffices = async () => {
      const { data, error } = await supabase.from('office_locations').select('*');
      if (!error && data && data.length > 0) {
        setOffices(data);
      } else {
        setOffices([{ id: 'default-1', name: 'HQ (Default)', lat: 12.9716, lng: 77.5946, radius: 0.5 }]);
      }
    };
    fetchOffices();
  }, []);

  // --- REAL-TIME SUBSCRIPTION ---
  useEffect(() => {
    loadData();
    const channel = supabase
      .channel('attendance-dashboard-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => {
        loadData();
        if(selectedUser) openUserModal(selectedUser);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [dateRange, view]); 

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, departmentFilter, statusFilter, view, dateRange]);

  // --- DATA LOADING ---
  const loadData = async () => {
    setLoading(true);
    try {
      const startDateStr = format(dateRange.start, "yyyy-MM-dd");
      const endDateStr = format(dateRange.end, "yyyy-MM-dd");
      const feedDateStr = format(new Date(), "yyyy-MM-dd"); 
      const yesterdayStr = format(subDays(new Date(), 1), "yyyy-MM-dd");

      const [usersRes, attendanceRes, feedRes, missingRes, holidaysRes] = await Promise.all([
        supabase.from("users").select("*").eq("is_active", true).order("full_name"),
        supabase.from("attendance").select(`*, user:users!attendance_user_id_fkey(full_name, email, department)`)
          .gte("date", startDateStr)
          .lte("date", endDateStr)
          .order("date", { ascending: false }),
        supabase.from("attendance").select(`*, user:users!attendance_user_id_fkey(full_name)`).eq("date", feedDateStr),
        supabase.from("attendance").select(`*, user:users!attendance_user_id_fkey(full_name)`).eq("date", yesterdayStr).not("check_in", "is", null).is("check_out", null),
        supabase.from("holidays").select("*").gte("date", startDateStr).lte("date", endDateStr)
      ]);

      if (usersRes.error) throw usersRes.error;
      if (attendanceRes.error) throw attendanceRes.error;

      setUsers(usersRes.data || []);
      setAttendanceData(attendanceRes.data || []);
      if (holidaysRes.data) setHolidays(holidaysRes.data);
      
      setMissingCheckoutCount(missingRes.data?.length || 0);
      setMissingRecords(missingRes.data || []);

      if (feedRes.data) {
        let feed: ActivityItem[] = [];
        let activeCount = 0;
        let breakCount = 0;

        feedRes.data.forEach((record) => {
          if (record.check_in && !record.check_out) activeCount++;
          if (record.on_break) breakCount++;

          if (record.check_in) {
            feed.push({ id: `${record.id}-in`, type: 'check-in', user_name: record.user?.full_name || 'Unknown', time: record.check_in, timestamp: new Date(record.check_in).getTime(), location: record.location_check_in });
          }
          if (record.check_out) {
            feed.push({ id: `${record.id}-out`, type: 'check-out', user_name: record.user?.full_name || 'Unknown', time: record.check_out, timestamp: new Date(record.check_out).getTime() });
          }
        });

        feed.sort((a, b) => b.timestamp - a.timestamp);
        setActivityFeed(feed);
        setActiveEmployees(activeCount);
        setEmployeesOnBreak(breakCount);
      }
    } catch (error) {
      console.error("Dashboard Load Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const openUserModal = async (user: User) => {
    setSelectedUser(user);
    setLoadingModal(true);
    const monthStart = format(startOfMonth(dateRange.start), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(dateRange.start), "yyyy-MM-dd");

    const { data } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", monthStart)
      .lte("date", monthEnd);

    if (data) {
        const processed = data.map(r => ({ ...r, status: determineStatus(r) }));
        setUserMonthData(processed);
    } else {
        setUserMonthData([]);
    }
    setLoadingModal(false);
  };

  // --- LOGIC HELPERS ---
  const determineStatus = (record: any) => {
    if (!record.check_in) return "absent";
    const checkInTime = parseISO(record.check_in);
    const checkInMinutes = checkInTime.getHours() * 60 + checkInTime.getMinutes();
    const thresholdMinutes = lateThresholdHour * 60 + lateThresholdMinute;
    if (checkInMinutes > thresholdMinutes) return "late";
    return "present";
  };

  const calculateLateMinutes = (checkInTime: string) => {
    const time = parseISO(checkInTime);
    const checkInMinutes = time.getHours() * 60 + time.getMinutes();
    const thresholdMinutes = lateThresholdHour * 60 + lateThresholdMinute;
    return Math.max(0, checkInMinutes - thresholdMinutes);
  };

  const getLocationType = (data: any) => {
    if (!data) return { type: 'unknown', name: 'Unknown', distance: 0 };
    try {
      const loc = typeof data === 'string' ? JSON.parse(data) : data;
      const lat = loc.latitude || (loc.coordinates ? parseFloat(loc.coordinates.split(',')[0]) : 0);
      const lng = loc.longitude || (loc.coordinates ? parseFloat(loc.coordinates.split(',')[1]) : 0);
      
      if (!lat || !lng) return { type: 'unknown', name: 'Unknown', distance: 0 };

      let closestOffice = null;
      let minDistance = Infinity;

      offices.forEach(office => {
        const dist = getDistanceFromLatLonInKm(lat, lng, office.lat, office.lng);
        if (dist < minDistance) {
          minDistance = dist;
          closestOffice = office;
        }
      });

      if (closestOffice && minDistance <= (closestOffice as Office).radius) {
        return { type: 'office', name: (closestOffice as Office).name, distance: minDistance.toFixed(2) };
      } else {
        return { type: 'remote', name: 'Remote', distance: minDistance.toFixed(1) };
      }
    } catch (e) { return { type: 'unknown', name: 'Unknown', distance: 0 }; }
  };

  const getLocationUrl = (data: any) => {
    if (!data) return null;
    try {
      const loc = typeof data === 'string' ? JSON.parse(data) : data;
      if (loc.latitude && loc.longitude) return `https://www.google.com/maps/search/?api=1&query=${loc.latitude},${loc.longitude}`;
      if (loc.coordinates) return `https://www.google.com/maps/search/?api=1&query=${loc.coordinates}`;
    } catch (e) { return null; }
    return null;
  };

  const formatLocationText = (data: any) => {
    const info = getLocationType(data);
    if (info.type === 'office') return `On-Site (${info.name})`;
    if (info.type === 'remote') return `Remote (${info.distance}km)`;
    return "Unknown Location";
  };

  const getReliabilityScore = (userRecords: AttendanceRecord[]) => {
    if (userRecords.length === 0) return 0;
    const present = userRecords.filter(r => r.status !== 'absent').length;
    const lates = userRecords.filter(r => r.status === 'late').length;
    const rawScore = ((present * 3) - (lates * 1)); 
    const basis = Math.max(userRecords.length, 5) * 3; 
    let score = (rawScore / basis) * 100;
    return Math.min(100, Math.max(0, Math.round(score)));
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-emerald-600 bg-emerald-50 border-emerald-200";
    if (score >= 75) return "text-blue-600 bg-blue-50 border-blue-200";
    if (score >= 50) return "text-yellow-600 bg-yellow-50 border-yellow-200";
    return "text-red-600 bg-red-50 border-red-200";
  };

  // --- ACTIONS ---
  
  // -- HOLIDAYS --
  const addCustomHoliday = async () => {
    if (!newHolidayName || !newHolidayDate) return toast.error("Fill all fields");
    const { data, error } = await supabase.from('holidays').insert([{
      date: newHolidayDate, name: newHolidayName, type: 'custom', is_working_day: false
    }]).select().single();
    
    if (error) return toast.error("Failed to add holiday");
    setHolidays([...holidays, data]);
    setNewHolidayName(""); setNewHolidayDate("");
    toast.success("Holiday added!");
  };
  
  const toggleWorkingDay = async (holiday: Holiday) => {
    const { error } = await supabase.from('holidays').update({ is_working_day: !holiday.is_working_day }).eq('id', holiday.id);
    if (!error) {
      setHolidays(holidays.map(h => h.id === holiday.id ? { ...h, is_working_day: !h.is_working_day } : h));
      toast.success("Holiday updated");
    }
  };
  
  const fetchPublicHolidays = async (year: number, countryCode: string = 'IN') => {
    setIsFetchingHolidays(true);
    try {
      const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`);
      const publicHolidays = await res.json();
      
      const formattedHolidays = publicHolidays.map((h: any) => ({
        date: h.date, name: h.localName, type: 'public', is_working_day: false
      }));
  
      const { error } = await supabase.from('holidays').upsert(formattedHolidays, { onConflict: 'date' });
      if (error) throw error;
      
      toast.success(`Imported public holidays for ${year}`);
      loadData(); 
    } catch (e) {
      toast.error("Failed to fetch public holidays");
    } finally {
      setIsFetchingHolidays(false);
    }
  };

  // -- OFFICES --
  const addOffice = async () => {
    if (!newOfficeName || !newOfficeLat || !newOfficeLng) {
      toast.error("Please fill in all fields");
      return;
    }

    const newOffice = {
      name: newOfficeName,
      lat: parseFloat(newOfficeLat),
      lng: parseFloat(newOfficeLng),
      radius: 0.5
    };

    const { data, error } = await supabase.from('office_locations').insert([newOffice]).select().single();
    if (error) { toast.error("Failed to save office"); return; }

    setOffices([...offices, data]);
    setNewOfficeName(""); setNewOfficeLat(""); setNewOfficeLng("");
    toast.success("Office location added");
  };

  const removeOffice = async (id: string) => {
    const prevOffices = [...offices];
    setOffices(offices.filter(o => o.id !== id));
    const { error } = await supabase.from('office_locations').delete().eq('id', id);
    if (error) {
      setOffices(prevOffices);
      toast.error("Failed to delete office");
    } else {
      toast.success("Office removed");
    }
  };

  const handleEdit = (record: AttendanceRecord) => {
    setEditingRecord(record);
    setEditCheckIn(record.check_in ? format(parseISO(record.check_in), "HH:mm") : "");
    setEditCheckOut(record.check_out ? format(parseISO(record.check_out), "HH:mm") : "");
    setEditNote(record.admin_note || "");
  };

  const saveEdit = async () => {
    if (!editingRecord) return;
    try {
        const datePart = editingRecord.date; 
        const updates: any = { admin_note: editNote };
        if (editCheckIn) updates.check_in = `${datePart}T${editCheckIn}:00`;
        if (editCheckOut) updates.check_out = `${datePart}T${editCheckOut}:00`;
        
        if (updates.check_in && updates.check_out) {
            const start = new Date(updates.check_in);
            const end = new Date(updates.check_out);
            const diffMs = end.getTime() - start.getTime();
            const diffHours = diffMs / (1000 * 60 * 60);
            updates.total_hours = parseFloat(diffHours.toFixed(2));
            updates.overtime_hours = Math.max(0, parseFloat((diffHours - 9).toFixed(2))); 
        }

        const { error } = await supabase.from('attendance').update(updates).eq('id', editingRecord.id);
        if (error) throw error;
        
        loadData(); 
        if(selectedUser) openUserModal(selectedUser);
        setEditingRecord(null);
        toast.success("Record updated successfully");
    } catch (e) { console.error(e); toast.error("Failed to update"); }
  };

  const bulkFixCheckout = async () => {
    try {
      const updates = missingRecords.map(record => {
        const checkOutTime = `${record.date}T18:00:00`;
        const start = new Date(record.check_in!);
        const end = new Date(checkOutTime);
        const diffMs = end.getTime() - start.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        
        return {
          id: record.id,
          check_out: checkOutTime,
          total_hours: parseFloat(diffHours.toFixed(2)),
          overtime_hours: 0,
          admin_note: "Auto-fixed missing checkout"
        };
      });

      for (const update of updates) {
        const { id, ...rest } = update;
        await supabase.from('attendance').update(rest).eq('id', id);
      }
      
      setShowReviewModal(false);
      loadData();
      toast.success(`${updates.length} records auto-corrected`);
    } catch (e) {
      console.error(e);
      toast.error("Bulk fix failed");
    }
  };

  // --- MEMOIZED DATA ---
  const processedData = useMemo(() => {
    return attendanceData.map(record => ({
      ...record,
      status: determineStatus(record)
    }));
  }, [attendanceData, lateThresholdHour, lateThresholdMinute]);

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || user.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDept = departmentFilter === "all" || user.department === departmentFilter;
      if (statusFilter === "all") return matchesSearch && matchesDept;
      
      const userRecords = processedData.filter(a => a.user_id === user.id);
      if (view === 'daily') {
        const record = userRecords.find(r => isSameDay(parseISO(r.date), dateRange.start));
        const dayStr = format(dateRange.start, "yyyy-MM-dd");
        const isHoliday = holidays.find(h => h.date === dayStr && !h.is_working_day);
        const status = record ? record.status : (isHoliday ? 'holiday' : 'absent');
        return matchesSearch && matchesDept && status === statusFilter;
      }
      return matchesSearch && matchesDept;
    });
  }, [users, searchTerm, departmentFilter, statusFilter, processedData, view, dateRange, holidays]);

  // --- PAGINATION LOGIC ---
  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredUsers.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredUsers, currentPage]);

  const departments = Array.from(new Set(users.map(u => u.department).filter(Boolean)));

  // --- CHART DATA ---
  const chartData = useMemo(() => {
    const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
    const trend = days.map(day => {
      const dayStr = format(day, "yyyy-MM-dd");
      const records = processedData.filter(r => r.date === dayStr);
      const isHol = holidays.find(h => h.date === dayStr && !h.is_working_day);

      return {
        date: format(day, "MMM dd"),
        present: records.filter(r => r.status === 'present').length,
        late: records.filter(r => r.status === 'late').length,
        absent: isHol ? 0 : users.length - records.length
      };
    }).slice(-14);

    const lateCounts: Record<string, number> = {};
    processedData.filter(r => r.status === 'late').forEach(r => {
        const name = r.user?.full_name || 'Unknown';
        lateCounts[name] = (lateCounts[name] || 0) + 1;
    });
    const topViolators = Object.entries(lateCounts).map(([name, count]) => ({ name, count })).sort((a,b) => b.count - a.count).slice(0, 5);

    return { trend, topViolators };
  }, [processedData, users.length, dateRange, holidays]);

  const stats = useMemo(() => {
    if (view === 'monthly') {
       return { present: processedData.filter(r => r.status === 'present').length, late: processedData.filter(r => r.status === 'late').length, absent: (users.length * 30) - processedData.length };
    }
    const dailyRecords = processedData.filter(r => isSameDay(parseISO(r.date), dateRange.start));
    const dayStr = format(dateRange.start, "yyyy-MM-dd");
    const isHoliday = holidays.find(h => h.date === dayStr && !h.is_working_day);
    
    return { 
      present: dailyRecords.filter(r => r.status === 'present').length, 
      late: dailyRecords.filter(r => r.status === 'late').length, 
      absent: isHoliday ? 0 : users.length - dailyRecords.length,
      isHoliday: !!isHoliday
    };
  }, [processedData, users.length, view, dateRange, holidays]);

  const navigate = (dir: 'prev' | 'next') => {
    if (view === 'daily') {
      const d = new Date(dateRange.start);
      d.setDate(d.getDate() + (dir === 'next' ? 1 : -1));
      setDateRange({ start: d, end: d });
    } else {
      const d = dir === 'prev' ? subMonths(dateRange.start, 1) : addMonths(dateRange.start, 1);
      setDateRange({ start: startOfMonth(d), end: endOfMonth(d) });
    }
  };

  const toggleView = (newView: 'daily' | 'monthly') => {
    setView(newView);
    const today = new Date();
    if (newView === 'monthly') {
      setDateRange({ start: startOfMonth(today), end: endOfMonth(today) });
    } else {
      setDateRange({ start: today, end: today });
    }
  };

  const handlePrint = () => { window.print(); };

  // --- Render Heatmap for Monthly View ---
  const renderMonthlyHeatmap = (userRecords: AttendanceRecord[]) => {
    const start = startOfMonth(dateRange.start);
    const end = endOfMonth(dateRange.start);
    const days = eachDayOfInterval({ start, end });
    
    return (
      <div className="flex gap-1">
        {days.map((day, i) => {
           const dayStr = format(day, "yyyy-MM-dd");
           const record = userRecords.find(r => r.date === dayStr);
           const isWE = isWeekend(day);
           const isHol = holidays.find(h => h.date === dayStr && !h.is_working_day);
           
           let color = "bg-slate-100"; // default empty
           if(isWE) color = "bg-slate-50 border-dashed border-slate-200";
           if(isHol) color = "bg-purple-200"; // Holiday
           
           if(record?.status === 'present') color = "bg-emerald-500";
           if(record?.status === 'late') color = "bg-yellow-400";
           if(!record && !isWE && !isHol && isAfter(new Date(), day)) color = "bg-red-200"; // Absent in past

           return (
             <TooltipProvider key={dayStr}>
               <Tooltip>
                 <TooltipTrigger>
                    <div className={`w-2.5 h-6 rounded-sm ${color} transition-colors`} />
                 </TooltipTrigger>
                 <TooltipContent className="text-xs">
                    <p className="font-bold">{format(day, "MMM dd")}</p>
                    <p>{record ? `${record.status} (${record.check_in ? format(parseISO(record.check_in), "HH:mm") : "?"})` : isHol ? isHol.name : isWE ? "Weekend" : "Absent"}</p>
                 </TooltipContent>
               </Tooltip>
             </TooltipProvider>
           )
        })}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50/50 min-h-screen print:p-0 print:bg-white">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Attendance Manager</h1>
          <p className="text-slate-500 mt-1">Real-time team tracking and analytics</p>
        </div>
        
        <div className="flex flex-wrap gap-2 items-center">
          
          <Button variant="outline" size="icon" onClick={() => setShowSettingsModal(true)}>
             <Settings className="h-4 w-4 text-slate-600"/>
          </Button>

          <div className="flex items-center bg-white rounded-md border shadow-sm">
            <Button variant="ghost" size="icon" onClick={() => navigate('prev')}><span className="sr-only">Prev</span>{"<"}</Button>
            <div className="px-4 font-medium text-sm">
               {view === 'daily' ? format(dateRange.start, "MMM dd, yyyy") : format(dateRange.start, "MMMM yyyy")}
            </div>
            <Button variant="ghost" size="icon" onClick={() => navigate('next')}><span className="sr-only">Next</span>{">"}</Button>
          </div>

          <Button variant="outline" onClick={handlePrint} className="bg-white">
            <Printer className="mr-2 h-4 w-4 text-slate-600" /> Print
          </Button>
        </div>
      </div>

      {/* MISSING CHECKOUT ALERT */}
      {missingCheckoutCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center justify-between print:hidden">
           <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <div>
                 <p className="text-sm font-bold text-red-800">{missingCheckoutCount} employees did not clock out yesterday.</p>
                 <p className="text-xs text-red-600">Please review attendance logs to correct hours.</p>
              </div>
           </div>
           <Button size="sm" variant="destructive" className="h-8" onClick={() => setShowReviewModal(true)}>Review</Button>
        </div>
      )}

      {/* TABS LAYOUT */}
      <Tabs defaultValue="roster" className="w-full">
        <div className="flex justify-between items-center mb-4 print:hidden">
           <TabsList className="bg-white border">
             <TabsTrigger value="roster" className="gap-2"><List className="h-4 w-4"/> Roster</TabsTrigger>
             <TabsTrigger value="analytics" className="gap-2"><BarChart3 className="h-4 w-4"/> Analytics</TabsTrigger>
           </TabsList>
           
           <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
              <Button variant={view === 'daily' ? 'default' : 'ghost'} size="sm" onClick={() => toggleView('daily')} className="text-xs h-7">Daily</Button>
              <Button variant={view === 'monthly' ? 'default' : 'ghost'} size="sm" onClick={() => toggleView('monthly')} className="text-xs h-7">Monthly</Button>
           </div>
        </div>

        {/* --- TAB 1: ROSTER VIEW --- */}
        <TabsContent value="roster" className="space-y-6">
          {view === 'daily' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 print:grid-cols-4">
              <Card className="border-l-4 border-l-blue-500 shadow-sm print:border"><CardContent className="p-4 pt-6 flex justify-between items-center"><div><p className="text-sm font-medium text-slate-500">Total Staff</p><h2 className="text-2xl font-bold">{users.length}</h2></div><div className="p-2 bg-blue-50 rounded-full print:hidden"><Users className="h-6 w-6 text-blue-500" /></div></CardContent></Card>
              <Card className="border-l-4 border-l-green-500 shadow-sm print:border"><CardContent className="p-4 pt-6 flex justify-between items-center"><div><p className="text-sm font-medium text-slate-500">Present</p><h2 className="text-2xl font-bold text-green-600">{stats.present}</h2></div><div className="p-2 bg-green-50 rounded-full print:hidden"><CheckCircle className="h-6 w-6 text-green-500" /></div></CardContent></Card>
              <Card className="border-l-4 border-l-yellow-500 shadow-sm print:border"><CardContent className="p-4 pt-6 flex justify-between items-center"><div><p className="text-sm font-medium text-slate-500">Late</p><h2 className="text-2xl font-bold text-yellow-600">{stats.late}</h2></div><div className="p-2 bg-yellow-50 rounded-full print:hidden"><Clock className="h-6 w-6 text-yellow-500" /></div></CardContent></Card>
              <Card className={`border-l-4 ${stats.isHoliday ? 'border-l-purple-500' : 'border-l-red-500'} shadow-sm print:border`}><CardContent className="p-4 pt-6 flex justify-between items-center"><div><p className="text-sm font-medium text-slate-500">{stats.isHoliday ? 'Holiday' : 'Absent'}</p><h2 className={`text-2xl font-bold ${stats.isHoliday ? 'text-purple-600' : 'text-red-600'}`}>{stats.isHoliday ? 'Yes' : stats.absent}</h2></div><div className={`p-2 ${stats.isHoliday ? 'bg-purple-50' : 'bg-red-50'} rounded-full print:hidden`}><XCircle className={`h-6 w-6 ${stats.isHoliday ? 'text-purple-500' : 'text-red-500'}`} /></div></CardContent></Card>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 print:block">
            <div className="lg:col-span-3 space-y-4">
              <Card className="shadow-sm border-slate-200 print:shadow-none print:border-0">
                <CardHeader className="pb-3 border-b bg-slate-50/50 print:hidden">
                  <div className="flex flex-col sm:flex-row justify-between gap-4">
                    <CardTitle className="text-base font-semibold flex items-center gap-2"><Users className="h-4 w-4" /> Team Attendance</CardTitle>
                    <div className="flex gap-2">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                        <Input placeholder="Search..." className="pl-9 w-40 h-9 bg-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                      </div>
                      <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                        <SelectTrigger className="w-32 h-9 bg-white"><SelectValue placeholder="Dept" /></SelectTrigger>
                        <SelectContent><SelectItem value="all">All Depts</SelectItem>{departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                      </Select>
                      {view === 'daily' && (
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                          <SelectTrigger className="w-32 h-9 bg-white"><SelectValue placeholder="Status" /></SelectTrigger>
                          <SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="present">Present</SelectItem><SelectItem value="late">Late</SelectItem><SelectItem value="absent">Absent</SelectItem><SelectItem value="holiday">Holiday</SelectItem></SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-[200px]">Employee</TableHead>
                        {view === 'daily' ? (
                          <>
                            <TableHead>Status</TableHead>
                            <TableHead>Check-In</TableHead>
                            <TableHead>Check-Out</TableHead>
                            <TableHead>Shift</TableHead>
                            <TableHead>Location</TableHead>
                          </>
                        ) : (
                          <>
                            <TableHead>Reliability</TableHead>
                            <TableHead>Pattern</TableHead>
                            <TableHead>Avg Hrs</TableHead>
                            <TableHead className="print:hidden">Action</TableHead>
                          </>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        [...Array(5)].map((_, i) => <TableRow key={i}><TableCell colSpan={6}><div className="h-8 bg-slate-100 rounded animate-pulse" /></TableCell></TableRow>)
                      ) : paginatedUsers.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-500">No records found.</TableCell></TableRow>
                      ) : (
                        paginatedUsers.map(user => {
                          const userRecords = processedData.filter(a => a.user_id === user.id);

                          if (view === 'daily') {
                            const record = userRecords.find(r => isSameDay(parseISO(r.date), dateRange.start));
                            const dayStr = format(dateRange.start, "yyyy-MM-dd");
                            const isHoliday = holidays.find(h => h.date === dayStr && !h.is_working_day);
                            const status = record ? record.status : (isHoliday ? 'holiday' : 'absent');
                            
                            const progress = Math.min(100, (Number(record?.total_hours || 0) / 9) * 100);
                            const locationInfo = getLocationType(record?.location_check_in);
                            
                            return (
                              <TableRow key={user.id} className="hover:bg-slate-50 cursor-pointer print:cursor-default" onClick={() => openUserModal(user)}>
                                <TableCell>
                                  <div className="font-medium text-slate-900">{user.full_name}</div>
                                  <div className="text-xs text-slate-500">{user.department}</div>
                                </TableCell>
                                <TableCell>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Badge variant="outline" className={
                                            status === 'late' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 
                                            status === 'present' ? 'bg-green-50 text-green-700 border-green-200' : 
                                            status === 'holiday' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                            'bg-red-50 text-red-700 border-red-200'
                                        }>
                                          {status === 'late' ? 'Late' : status === 'present' ? 'Present' : status === 'holiday' ? 'Holiday' : 'Absent'}
                                        </Badge>
                                      </TooltipTrigger>
                                      {status === 'late' && record?.check_in && (
                                        <TooltipContent><p>Late by {calculateLateMinutes(record.check_in)} mins</p></TooltipContent>
                                      )}
                                      {status === 'holiday' && isHoliday && (
                                        <TooltipContent><p>{isHoliday.name}</p></TooltipContent>
                                      )}
                                    </Tooltip>
                                  </TooltipProvider>
                                </TableCell>
                                <TableCell className="font-mono text-xs">{record?.check_in ? format(new Date(record.check_in), "hh:mm a") : "-"}</TableCell>
                                <TableCell className="font-mono text-xs">{record?.check_out ? format(new Date(record.check_out), "hh:mm a") : "-"}</TableCell>
                                <TableCell>
                                   <div className="flex items-center gap-2">
                                      <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden print:hidden">
                                        <div className={`h-full rounded-full ${progress >= 100 ? 'bg-green-500' : record?.total_hours && record.total_hours > MAX_SHIFT_HOURS ? 'bg-orange-500' : 'bg-blue-500'}`} style={{ width: `${progress}%` }} />
                                      </div>
                                      <span className={`text-xs font-mono ${record?.total_hours && record.total_hours > MAX_SHIFT_HOURS ? 'text-orange-600 font-bold' : ''}`}>{record?.total_hours || 0}h</span>
                                   </div>
                                </TableCell>
                                <TableCell>
                                  {record?.location_check_in ? (
                                    <div className="flex items-center gap-1 text-xs">
                                       {locationInfo.type === 'office' ? <Building2 className="h-3 w-3 text-blue-500" /> : <Globe className="h-3 w-3 text-purple-500" />}
                                       <a href={getLocationUrl(record.location_check_in) || '#'} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline print:no-underline print:text-black" onClick={(e) => e.stopPropagation()}>
                                         {formatLocationText(record.location_check_in)}
                                       </a>
                                    </div>
                                  ) : <span className="text-xs text-slate-400">N/A</span>}
                                </TableCell>
                              </TableRow>
                            );
                          } else {
                            const present = userRecords.filter(r => r.status !== 'absent').length;
                            const totalHrs = userRecords.reduce((acc, r) => acc + (Number(r.total_hours) || 0), 0);
                            const avgHrs = present > 0 ? (totalHrs / present).toFixed(1) : "0";
                            const score = getReliabilityScore(userRecords);

                            return (
                              <TableRow key={user.id} className="hover:bg-slate-50 cursor-pointer print:cursor-default" onClick={() => openUserModal(user)}>
                                <TableCell>
                                  <div className="font-medium text-slate-900">{user.full_name}</div>
                                  <div className="text-xs text-slate-500">{user.department}</div>
                                </TableCell>
                                <TableCell>
                                   <Badge variant="outline" className={`${getScoreColor(score)} font-bold`}>{score}%</Badge>
                                </TableCell>
                                <TableCell>
                                   {renderMonthlyHeatmap(userRecords)}
                                </TableCell>
                                <TableCell><span className="font-mono text-sm">{avgHrs}h</span></TableCell>
                                <TableCell className="print:hidden"><Button variant="ghost" size="icon" className="h-8 w-8"><ChevronRight className="h-4 w-4 text-slate-400"/></Button></TableCell>
                              </TableRow>
                            )
                          }
                        })
                      )}
                    </TableBody>
                  </Table>
                  
                  {/* PAGINATION CONTROLS */}
                  {filteredUsers.length > ITEMS_PER_PAGE && (
                    <div className="p-4 border-t flex items-center justify-between">
                       <span className="text-sm text-slate-500">Page {currentPage} of {totalPages}</span>
                       <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4"/></Button>
                          <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage === totalPages}><ChevronRight className="h-4 w-4"/></Button>
                       </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-1 space-y-6 print:hidden">
              <Card className="shadow-sm border-slate-200">
                <CardHeader className="py-4 border-b bg-slate-50/50"><CardTitle className="text-sm font-semibold">Live Snapshot</CardTitle></CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2"><UserCheck className="h-4 w-4 text-green-500"/><span className="text-sm text-slate-600">Active Now</span></div>
                    <span className="font-bold text-lg">{activeEmployees}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2"><Coffee className="h-4 w-4 text-orange-500"/><span className="text-sm text-slate-600">On Break</span></div>
                    <span className="font-bold text-lg">{employeesOnBreak}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-slate-200 flex-1 h-[500px]">
                <CardHeader className="py-4 border-b"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Activity className="h-4 w-4"/> Activity Feed</CardTitle></CardHeader>
                <CardContent className="p-0 overflow-y-auto h-[440px]">
                  {activityFeed.length === 0 ? (
                    <div className="p-4 text-center text-slate-500 text-xs">No activity yet.</div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {activityFeed.map((item) => (
                        <div key={item.id} className="p-3 hover:bg-slate-50 flex gap-3">
                          <div className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${item.type.includes('in') ? 'bg-green-500' : 'bg-slate-400'}`} />
                          <div>
                            <p className="text-sm font-medium text-slate-800">{item.user_name}</p>
                            <p className="text-xs text-slate-500 flex items-center gap-1">
                              {item.type === 'check-in' ? 'Checked In' : item.type === 'check-out' ? 'Checked Out' : 'Break'} 
                              <span className="text-slate-300">•</span> 
                              {format(new Date(item.time), "hh:mm a")}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* --- TAB 2: ANALYTICS VIEW --- */}
        <TabsContent value="analytics" className="space-y-6 print:hidden">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="shadow-sm">
                 <CardHeader><CardTitle className="text-base">Attendance Trend</CardTitle><CardDescription>Present vs Late over time</CardDescription></CardHeader>
                 <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={chartData.trend}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis fontSize={12} tickLine={false} axisLine={false} />
                          <RechartsTooltip cursor={{fill: '#f1f5f9'}} />
                          <Legend />
                          <Bar dataKey="present" fill="#10b981" radius={[4,4,0,0]} stackId="a" />
                          <Bar dataKey="late" fill="#f59e0b" radius={[4,4,0,0]} stackId="a" />
                          <Bar dataKey="absent" fill="#ef4444" radius={[4,4,0,0]} stackId="a" />
                       </BarChart>
                    </ResponsiveContainer>
                 </CardContent>
              </Card>

              <Card className="shadow-sm">
                 <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertCircle className="h-4 w-4 text-red-500"/> Frequent Latecomers</CardTitle><CardDescription>Top employees late this month</CardDescription></CardHeader>
                 <CardContent>
                    <div className="space-y-4">
                       {chartData.topViolators.map((user, idx) => (
                          <div key={idx} className="flex items-center justify-between">
                             <div className="flex items-center gap-3">
                                <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center text-xs font-bold text-red-700">{idx+1}</div>
                                <span className="font-medium text-sm">{user.name}</span>
                             </div>
                             <Badge variant="outline" className="bg-red-50 text-red-700">{user.count} Late</Badge>
                          </div>
                       ))}
                       {chartData.topViolators.length === 0 && <div className="text-center text-slate-400 py-8">No late arrivals recorded.</div>}
                    </div>
                 </CardContent>
              </Card>
           </div>
        </TabsContent>
      </Tabs>

      {/* --- SETTINGS DIALOG --- */}
      <Dialog open={showSettingsModal} onOpenChange={setShowSettingsModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Configuration</DialogTitle>
            <DialogDescription>Manage attendance rules and office locations.</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* LATE THRESHOLD */}
            <div>
              <div className="flex justify-between mb-3">
                <Label className="text-base">Late Threshold</Label>
                <span className="font-mono text-sm bg-slate-100 px-2 py-1 rounded">{lateThresholdHour}:{lateThresholdMinute.toString().padStart(2, '0')} AM</span>
              </div>
              <div className="flex gap-4 items-center">
                 <div className="flex-1 space-y-1">
                    <span className="text-xs text-slate-500">Hour</span>
                    <Slider value={[lateThresholdHour]} min={7} max={11} step={1} onValueChange={(v) => setLateThresholdHour(v[0])} />
                 </div>
                 <div className="flex-1 space-y-1">
                    <span className="text-xs text-slate-500">Minute</span>
                    <Slider value={[lateThresholdMinute]} min={0} max={59} step={5} onValueChange={(v) => setLateThresholdMinute(v[0])} />
                 </div>
              </div>
            </div>

            {/* OFFICE LOCATIONS */}
            <div className="border-t pt-4">
              <Label className="text-base mb-3 block">Office Locations</Label>
              <div className="space-y-2 mb-4 max-h-[150px] overflow-y-auto border rounded-md p-2 bg-slate-50">
                {offices.map(office => (
                  <div key={office.id} className="flex justify-between items-center text-sm bg-white p-2 rounded shadow-sm border">
                    <div>
                      <p className="font-medium text-slate-800">{office.name}</p>
                      <p className="text-[10px] text-slate-500 font-mono">{office.lat.toFixed(4)}, {office.lng.toFixed(4)}</p>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => removeOffice(office.id)}><Trash2 className="h-3 w-3"/></Button>
                  </div>
                ))}
                {offices.length === 0 && <p className="text-xs text-slate-400 text-center py-2">No offices added.</p>}
              </div>
              
              <div className="grid grid-cols-4 gap-2">
                <Input placeholder="Name" className="col-span-4 h-8 text-xs" value={newOfficeName} onChange={e => setNewOfficeName(e.target.value)} />
                <Input placeholder="Latitude" className="col-span-2 h-8 text-xs" value={newOfficeLat} onChange={e => setNewOfficeLat(e.target.value)} />
                <Input placeholder="Longitude" className="col-span-2 h-8 text-xs" value={newOfficeLng} onChange={e => setNewOfficeLng(e.target.value)} />
                <Button size="sm" className="col-span-4 h-8 mt-1" onClick={addOffice}><Plus className="h-3 w-3 mr-1"/> Add Location</Button>
              </div>
            </div>

            {/* HOLIDAY MANAGEMENT */}
            <div className="border-t pt-4 mt-4">
              <div className="flex justify-between items-center mb-3">
                <Label className="text-base">Holiday Management</Label>
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={isFetchingHolidays}
                  onClick={() => fetchPublicHolidays(new Date().getFullYear())}
                >
                  <Globe className="h-3 w-3 mr-2"/> Sync Public Holidays
                </Button>
              </div>
              
              <div className="space-y-2 mb-4 max-h-[150px] overflow-y-auto border rounded-md p-2 bg-slate-50">
                {holidays.map(holiday => (
                  <div key={holiday.id} className="flex justify-between items-center text-sm bg-white p-2 rounded shadow-sm border">
                    <div>
                      <p className="font-medium text-slate-800">
                        {holiday.name} <Badge variant="secondary" className="text-[10px] ml-1">{holiday.type}</Badge>
                      </p>
                      <p className="text-[10px] text-slate-500">{format(parseISO(holiday.date), "MMM dd, yyyy")}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={holiday.is_working_day ? "destructive" : "default"}>
                        {holiday.is_working_day ? "Working Day" : "Holiday"}
                      </Badge>
                      <Button variant="ghost" size="sm" onClick={() => toggleWorkingDay(holiday)}>
                        Toggle
                      </Button>
                    </div>
                  </div>
                ))}
                {holidays.length === 0 && <p className="text-xs text-slate-400 text-center py-2">No holidays set for this period.</p>}
              </div>
              
              <div className="grid grid-cols-5 gap-2">
                <Input type="date" className="col-span-2 h-8 text-xs" value={newHolidayDate} onChange={e => setNewHolidayDate(e.target.value)} />
                <Input placeholder="Holiday Name" className="col-span-2 h-8 text-xs" value={newHolidayName} onChange={e => setNewHolidayName(e.target.value)} />
                <Button size="sm" className="col-span-1 h-8" onClick={addCustomHoliday}>Add</Button>
              </div>
            </div>
          </div>
          <DialogFooter>
             <Button onClick={() => setShowSettingsModal(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- EMPLOYEE MODAL --- */}
      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedUser && (() => {
             const userRecords = userMonthData;
             const lateCount = userRecords.filter(r => r.status === 'late').length;
             const totalHrs = userRecords.reduce((acc, r) => acc + (Number(r.total_hours) || 0), 0);
             
             // Calendar generation
             const monthStart = startOfMonth(dateRange.start);
             const monthEnd = endOfMonth(dateRange.start);
             const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
             const startDayOfWeek = getDay(monthStart); 

             const getDayStatusColor = (day: Date) => {
                const dayStr = format(day, 'yyyy-MM-dd');
                const record = userRecords.find(r => r.date === dayStr);
                const isHol = holidays.find(h => h.date === dayStr && !h.is_working_day);
                
                if (record) {
                    if (record.status === 'late') return 'bg-yellow-50 text-yellow-700 border-yellow-200 font-medium';
                    if (record.status === 'present') return 'bg-emerald-50 text-emerald-700 border-emerald-200 font-medium';
                }
                
                if (isHol) return 'bg-purple-50 text-purple-700 border-purple-200';
                return 'bg-slate-50 text-slate-400';
             };

             return (
               <>
                 <DialogHeader className="mb-4">
                   <div className="flex justify-between items-start">
                     <div>
                       <DialogTitle className="flex items-center gap-2 text-2xl">
                         {selectedUser.full_name}
                         <Badge variant="secondary" className="font-normal">{selectedUser.department}</Badge>
                       </DialogTitle>
                       <DialogDescription>Attendance Report for {format(dateRange.start, "MMMM yyyy")}</DialogDescription>
                     </div>
                   </div>
                 </DialogHeader>
                 
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="col-span-1 space-y-6">
                       <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-center">
                             <div className="text-[10px] text-blue-500 font-bold uppercase">Total Hours</div>
                             <div className="text-xl font-bold text-blue-700">{totalHrs.toFixed(1)}</div>
                          </div>
                          <div className="p-3 bg-yellow-50 border border-yellow-100 rounded-lg text-center">
                             <div className="text-[10px] text-yellow-500 font-bold uppercase">Lates</div>
                             <div className="text-xl font-bold text-yellow-700">{lateCount}</div>
                          </div>
                       </div>

                       <div className="border rounded-md">
                          <div className="bg-slate-50 p-2 border-b font-semibold text-xs uppercase text-slate-500">Recent Activity</div>
                          <div className="max-h-[300px] overflow-y-auto">
                             {userRecords.slice(0, 10).map(r => (
                                <div key={r.id} className="p-3 border-b text-sm flex justify-between items-center hover:bg-slate-50 cursor-pointer" onClick={() => handleEdit(r)}>
                                   <div>
                                      <div className="font-medium">{format(parseISO(r.date), "MMM dd")}</div>
                                      <div className="text-xs text-slate-400">{r.check_in ? format(parseISO(r.check_in), "hh:mm a") : "-"}</div>
                                   </div>
                                   <div className="flex flex-col items-end gap-1">
                                      <Badge variant="outline" className={r.status === 'late' ? "text-yellow-600 bg-yellow-50" : "text-green-600 bg-green-50"}>{r.status}</Badge>
                                      {r.admin_note && <div className="text-[9px] text-slate-400 flex items-center gap-1"><MessageSquare className="w-2 h-2"/> Note</div>}
                                   </div>
                                </div>
                             ))}
                          </div>
                       </div>
                    </div>

                    <div className="col-span-2">
                       <div className="border rounded-xl p-4 shadow-sm">
                          <div className="font-semibold mb-4 text-center">{format(monthStart, "MMMM yyyy")}</div>
                          <div className="grid grid-cols-7 gap-2 text-center text-xs font-medium text-slate-400 mb-2">
                             {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
                          </div>
                          <div className="grid grid-cols-7 gap-2">
                             {Array.from({ length: startDayOfWeek }).map((_, i) => <div key={`empty-${i}`} />)}
                             
                             {monthDays.map(day => {
                                const dayStr = format(day, 'yyyy-MM-dd');
                                const record = userRecords.find(r => r.date === dayStr);
                                const isHol = holidays.find(h => h.date === dayStr && !h.is_working_day);
                                const color = getDayStatusColor(day);
                                
                                return (
                                   <div 
                                     key={dayStr} 
                                     onClick={() => record && handleEdit(record)}
                                     className={`h-16 border rounded-lg p-1 flex flex-col justify-between cursor-pointer hover:ring-2 ring-blue-200 transition-all ${color}`}
                                   >
                                      <div className="text-right font-bold text-xs">{format(day, "d")}</div>
                                      {record ? (
                                         <div className="text-[9px] leading-tight font-mono text-center">
                                            <div>{record.check_in ? format(parseISO(record.check_in), "HH:mm") : ""}</div>
                                         </div>
                                      ) : isHol ? (
                                         <div className="text-[8px] leading-tight text-purple-600 font-semibold text-center mt-1 truncate px-1" title={isHol.name}>
                                            {isHol.name}
                                         </div>
                                      ) : null}
                                   </div>
                                )
                             })}
                          </div>
                       </div>
                    </div>
                 </div>
               </>
             )
          })()}
        </DialogContent>
      </Dialog>

      {/* --- EDIT DIALOG --- */}
      <Dialog open={!!editingRecord} onOpenChange={(o) => !o && setEditingRecord(null)}>
         <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
               <DialogTitle>Edit Attendance</DialogTitle>
               <DialogDescription>Correction for {editingRecord && format(parseISO(editingRecord.date), "MMM dd, yyyy")}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
               <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="in" className="text-right">Check In</Label>
                  <Input id="in" type="time" value={editCheckIn} onChange={e => setEditCheckIn(e.target.value)} className="col-span-3" />
               </div>
               <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="out" className="text-right">Check Out</Label>
                  <Input id="out" type="time" value={editCheckOut} onChange={e => setEditCheckOut(e.target.value)} className="col-span-3" />
               </div>
               <div className="grid grid-cols-4 items-start gap-4">
                  <Label htmlFor="note" className="text-right mt-2">Reason</Label>
                  <Textarea id="note" value={editNote} onChange={e => setEditNote(e.target.value)} placeholder="e.g. System glitch, forgot ID..." className="col-span-3" />
               </div>
            </div>
            <DialogFooter>
               <Button type="submit" onClick={saveEdit}>Save changes</Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>

      {/* --- REVIEW MISSING CHECKOUTS DIALOG --- */}
      <Dialog open={showReviewModal} onOpenChange={setShowReviewModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Missing Checkouts</DialogTitle>
            <DialogDescription>Employees who missed clocking out yesterday.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 my-4">
             {missingRecords.length === 0 ? <p className="text-center text-slate-500">No issues found.</p> : (
               <Table>
                 <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Check In</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
                 <TableBody>
                   {missingRecords.map(r => (
                     <TableRow key={r.id}>
                       <TableCell className="font-medium">{r.user?.full_name}</TableCell>
                       <TableCell>{r.check_in ? format(parseISO(r.check_in), "hh:mm a") : "-"}</TableCell>
                       <TableCell><Button variant="outline" size="sm" onClick={() => handleEdit(r)}>Fix</Button></TableCell>
                     </TableRow>
                   ))}
                 </TableBody>
               </Table>
             )}
          </div>
          <DialogFooter>
             <Button variant="ghost" onClick={() => setShowReviewModal(false)}>Close</Button>
             {missingRecords.length > 0 && <Button onClick={bulkFixCheckout}>Auto-Fix All to 6:00 PM</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
