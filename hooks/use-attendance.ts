"use client";

import { useState, useEffect } from "react";
import { attendanceService, AttendanceRecord } from "@/lib/attendance-service";
import { createClient } from "@/lib/supabase/client"; 

export function useAttendance() {
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    loadTodayAttendance();
  }, []);

  const loadTodayAttendance = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const attendance = await attendanceService.getTodayAttendance(user.id);
        setTodayAttendance(attendance);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load attendance");
    } finally {
      setLoading(false);
    }
  };

  // UPDATED: Added location argument here
  const checkIn = async (notes?: string, location?: string) => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // UPDATED: Pass location to the service
        const attendance = await attendanceService.checkIn(user.id, notes, location);
        setTodayAttendance(attendance);
        return attendance;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to check in");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const checkOut = async (notes?: string) => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const attendance = await attendanceService.checkOut(user.id, notes);
        setTodayAttendance(attendance);
        return attendance;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to check out");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const startLunchBreak = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const attendance = await attendanceService.startLunchBreak(user.id);
        setTodayAttendance(attendance);
        return attendance;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start lunch break");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const endLunchBreak = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const attendance = await attendanceService.endLunchBreak(user.id);
        setTodayAttendance(attendance);
        return attendance;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to end lunch break");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    todayAttendance,
    loading,
    error,
    checkIn,
    checkOut,
    startLunchBreak,
    endLunchBreak,
    refresh: loadTodayAttendance
  };
}
