"use client";

import { useState, useEffect, useMemo } from "react";
import { useAttendance } from "@/hooks/use-attendance";
import { Button } from "@/components/ui/button"; 
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Clock, Coffee, LogIn, LogOut, CheckCircle, MapPin, 
  AlertTriangle, Loader2, Timer, ThumbsUp, WifiOff, Building2
} from "lucide-react";
import { format, setHours, setMinutes, isAfter, differenceInSeconds } from "date-fns";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

// --- CONFIGURATION ---
const WORK_DAY_HOURS = 9;
const LATE_THRESHOLD_HOUR = 9;
const LATE_THRESHOLD_MINUTE = 30;

type Office = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius: number; // Stored in KM
};

export function AttendanceWidget() {
  const {
    todayAttendance,
    loading,
    checkIn,
    checkOut,
    startLunchBreak,
    endLunchBreak,
  } = useAttendance();

  const supabase = createClient();

  // --- STATE ---
  const [notes, setNotes] = useState("");
  const [showCheckInDialog, setShowCheckInDialog] = useState(false);
  const [showCheckOutDialog, setShowCheckOutDialog] = useState(false);
  const [showBreakDialog, setShowBreakDialog] = useState(false);
  
  // Locations
  const [offices, setOffices] = useState<Office[]>([]);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [distanceInfo, setDistanceInfo] = useState<{ meters: number; isFar: boolean; officeName: string } | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  // Timer
  const [elapsedTime, setElapsedTime] = useState(0);

  // --- 1. FETCH OFFICES & NETWORK LISTENER ---
  useEffect(() => {
    // Fetch dynamic office locations from database
    const fetchOffices = async () => {
      const { data, error } = await supabase.from('office_locations').select('*');
      if (!error && data) {
        setOffices(data);
      }
    };
    fetchOffices();

    // Network status
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // --- 2. LIVE TIMER ---
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (todayAttendance?.check_in && !todayAttendance.check_out) {
      const start = new Date(todayAttendance.check_in);
      const updateTimer = () => {
        const now = new Date();
        let seconds = differenceInSeconds(now, start);
        if (todayAttendance.lunch_start && todayAttendance.lunch_end) {
            seconds -= differenceInSeconds(new Date(todayAttendance.lunch_end), new Date(todayAttendance.lunch_start));
        } else if (todayAttendance.lunch_start && !todayAttendance.lunch_end) {
            seconds = differenceInSeconds(new Date(todayAttendance.lunch_start), start);
        }
        setElapsedTime(seconds > 0 ? seconds : 0);
      };
      updateTimer();
      interval = setInterval(updateTimer, 1000);
    }
    return () => clearInterval(interval);
  }, [todayAttendance]);

  // --- 3. DYNAMIC GEOLOCATION & GEOFENCING ---
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in meters
  };

  const getCurrentLocation = (): Promise<string | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setLocationError("Geolocation not supported");
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          
          // Geofencing Check against all offices
          if (offices.length > 0) {
            let minDistance = Infinity;
            let closestOffice: Office | null = null;

            offices.forEach(office => {
              const dist = calculateDistance(latitude, longitude, office.lat, office.lng);
              if (dist < minDistance) {
                minDistance = dist;
                closestOffice = office;
              }
            });

            if (closestOffice) {
              // Convert DB radius (KM) to meters for comparison
              const allowedRadiusMeters = closestOffice.radius * 1000;
              setDistanceInfo({ 
                meters: Math.round(minDistance), 
                isFar: minDistance > allowedRadiusMeters,
                officeName: closestOffice.name
              });
            }
          }

          resolve(`${latitude},${longitude}`);
        },
        (error) => {
          console.error("Location Error:", error);
          setLocationError("Unable to retrieve location. Please enable GPS.");
          resolve(null); 
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  };

  // --- HANDLERS ---
  const handleCheckInTrigger = async () => {
      setShowCheckInDialog(true);
      setIsLocating(true);
      setDistanceInfo(null);
      await getCurrentLocation(); // Pre-fetch location when dialog opens
      setIsLocating(false);
  }

  const handleCheckInConfirm = async () => {
    setIsLocating(true);
    try {
      const locationString = await getCurrentLocation();
      
      let finalNotes = notes;
      if (distanceInfo?.isFar) {
          finalNotes = `[REMOTE CHECK-IN: ${distanceInfo.meters}m away from ${distanceInfo.officeName}] ${notes}`;
      } else if (distanceInfo) {
          finalNotes = `[ON-SITE: ${distanceInfo.officeName}] ${notes}`;
      }

      await checkIn(finalNotes, locationString || undefined); 
      toast.success(distanceInfo?.isFar ? "Checked in remotely!" : "Checked in from Office!");
      
      setNotes("");
      setShowCheckInDialog(false);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLocating(false);
    }
  };

  const handleCheckOut = async () => {
    try {
      await checkOut(notes);
      toast.success("Shift ended. Good job!");
      setNotes("");
      setShowCheckOutDialog(false);
    } catch (error: any) { toast.error(error.message); }
  };

  const handleLunch = async () => {
    try {
      if (todayAttendance?.lunch_start && !todayAttendance.lunch_end) {
        await endLunchBreak();
        toast.success("Welcome back!");
      } else {
        await startLunchBreak();
        toast.success("Enjoy your meal!");
      }
      setShowBreakDialog(false);
    } catch (error: any) { toast.error(error.message); }
  };

  // --- HELPERS ---
  const formatDuration = (s: number) => {
    const h = Math.floor(s / 3600).toString().padStart(2, '0');
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${h}:${m}:${sec}`;
  };

  const isLateNow = () => isAfter(new Date(), setMinutes(setHours(new Date(), LATE_THRESHOLD_HOUR), LATE_THRESHOLD_MINUTE));
  const wasLate = useMemo(() => todayAttendance?.check_in && isAfter(new Date(todayAttendance.check_in), setMinutes(setHours(new Date(todayAttendance.check_in), LATE_THRESHOLD_HOUR), LATE_THRESHOLD_MINUTE)), [todayAttendance]);
  const progressPercentage = Math.min((elapsedTime / (WORK_DAY_HOURS * 3600)) * 100, 100);

  if (loading) return <Card className="animate-pulse h-[200px] bg-slate-50 border-slate-200" />;

  return (
    <div className="space-y-4">
      {/* Network Warning */}
      {!isOnline && (
          <div className="bg-red-50 text-red-600 px-3 py-2 rounded-md text-xs font-medium flex items-center justify-center gap-2 animate-pulse">
              <WifiOff className="h-3 w-3" /> You are offline. Changes will sync when online.
          </div>
      )}

      <Card className="shadow-sm border-slate-200 overflow-hidden relative">
        {/* Weekly Streak Dots (Visual Gamification) */}
        <div className="absolute top-3 right-4 flex gap-1">
            {[1,1,1,0,1].map((status, i) => (
                <TooltipProvider key={i}>
                    <Tooltip>
                        <TooltipTrigger>
                            <div className={`w-2 h-2 rounded-full ${status ? 'bg-green-400' : 'bg-slate-200'}`} />
                        </TooltipTrigger>
                        <TooltipContent className="text-[10px]">{status ? "Present" : "Absent"}</TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            ))}
        </div>

        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-5 w-5 text-blue-600" />
            <span className="text-slate-900">Work Status</span>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-5">
          
          {/* 1. Main Status & Timer */}
          <div className="flex items-end justify-between">
             <div className="space-y-1">
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">CURRENT STATUS</p>
                {todayAttendance?.check_in ? (
                    todayAttendance.check_out ? (
                        <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200 px-2 py-1 text-sm"><CheckCircle className="h-3.5 w-3.5 mr-1"/> Shift Ended</Badge>
                    ) : (
                        <div className="flex items-center gap-2">
                            <Badge className="bg-green-50 text-green-700 hover:bg-green-50 border-green-200 px-2 py-1 text-sm animate-pulse">
                                <span className="w-2 h-2 rounded-full bg-green-500 mr-2"/> On Duty
                            </Badge>
                            {todayAttendance.lunch_start && !todayAttendance.lunch_end && (
                                <Badge variant="secondary" className="bg-orange-50 text-orange-700 border-orange-200"><Coffee className="h-3 w-3 mr-1"/> Break</Badge>
                            )}
                        </div>
                    )
                ) : (
                    <Badge variant="secondary" className="bg-slate-100 text-slate-500">Not Checked In</Badge>
                )}
             </div>

             {/* Live Big Timer */}
             {todayAttendance?.check_in && !todayAttendance.check_out && (
                 <div className="text-right">
                    <div className="text-2xl font-mono font-bold text-slate-800 tracking-tight">
                        {formatDuration(elapsedTime)}
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium">TOTAL HOURS</p>
                 </div>
             )}
          </div>

          {/* 2. Progress Bar */}
          {todayAttendance?.check_in && !todayAttendance.check_out && (
              <div className="space-y-1.5">
                  <Progress value={progressPercentage} className="h-1.5 bg-slate-100" />
                  <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                      <span>{Math.round(progressPercentage)}% Shift Goal</span>
                      <span>Target: {WORK_DAY_HOURS}h</span>
                  </div>
              </div>
          )}

          {/* 3. Info Grid */}
          <div className="grid grid-cols-2 gap-3 pt-2">
             <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex justify-between mb-1">
                    <span className="text-xs text-slate-500 font-semibold">IN TIME</span>
                    {todayAttendance?.check_in && (wasLate ? <span className="text-[9px] text-red-600 bg-red-50 px-1 rounded font-bold">LATE</span> : <span className="text-[9px] text-green-600 bg-green-50 px-1 rounded font-bold">ON TIME</span>)}
                </div>
                <div className="text-sm font-bold text-slate-900">
                    {todayAttendance?.check_in ? format(new Date(todayAttendance.check_in), "hh:mm a") : "--:--"}
                </div>
             </div>
             <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-xs text-slate-500 font-semibold block mb-1">OUT TIME</span>
                <div className="text-sm font-bold text-slate-900">
                    {todayAttendance?.check_out ? format(new Date(todayAttendance.check_out), "hh:mm a") : "--:--"}
                </div>
             </div>
          </div>

          {/* 4. Primary Action Button */}
          <div className="pt-2">
            {!todayAttendance?.check_in ? (
              <Dialog open={showCheckInDialog} onOpenChange={setShowCheckInDialog}>
                <DialogTrigger asChild>
                  <Button onClick={handleCheckInTrigger} className="w-full h-12 text-base shadow-lg shadow-blue-500/20 bg-blue-600 hover:bg-blue-700 transition-all" disabled={!isOnline}>
                    <LogIn className="h-5 w-5 mr-2" /> Check In
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Start Your Shift</DialogTitle>
                    <DialogDescription>Location and time will be recorded.</DialogDescription>
                  </DialogHeader>
                  
                  {/* Late Warning */}
                  {isLateNow() && (
                    <div className="bg-amber-50 border border-amber-200 p-3 rounded-md flex gap-3">
                        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                        <div className="text-xs text-amber-800">
                            <p className="font-bold">You are checking in late.</p>
                            <p>Shift starts at {LATE_THRESHOLD_HOUR}:{LATE_THRESHOLD_MINUTE} AM.</p>
                        </div>
                    </div>
                  )}

                  {/* Geofencing Status */}
                  <div className="bg-slate-50 border p-3 rounded-md">
                      <div className="flex items-center justify-between text-xs mb-2">
                          <span className="text-slate-500 font-medium flex items-center gap-1"><MapPin className="h-3 w-3"/> Location Status</span>
                          {isLocating && <Loader2 className="h-3 w-3 animate-spin text-blue-500"/>}
                      </div>
                      
                      {!isLocating && distanceInfo ? (
                          <div className={`flex items-center gap-2 text-sm font-medium ${distanceInfo.isFar ? "text-orange-600" : "text-green-600"}`}>
                              {distanceInfo.isFar ? <Building2 className="h-4 w-4"/> : <CheckCircle className="h-4 w-4"/>}
                              {distanceInfo.isFar ? `Remote (${distanceInfo.meters}m from ${distanceInfo.officeName})` : `You are at ${distanceInfo.officeName}`}
                          </div>
                      ) : !isLocating && offices.length === 0 ? (
                          <div className="text-sm text-slate-500 italic">No offices defined. Remote check-in enabled.</div>
                      ) : (
                          <div className="text-sm text-slate-400 italic">Acquiring satellite lock...</div>
                      )}
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1">
                        <Label>Notes</Label>
                        <Textarea placeholder="Today's plan..." value={notes} onChange={(e) => setNotes(e.target.value)} />
                    </div>
                    <Button onClick={handleCheckInConfirm} className="w-full" disabled={isLocating}>
                      {isLocating ? "Getting Location..." : "Confirm Check In"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            ) : !todayAttendance.check_out ? (
              <div className="flex gap-3">
                <Dialog open={showBreakDialog} onOpenChange={setShowBreakDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="flex-1 border-slate-300 hover:bg-slate-50 h-11" disabled={!isOnline}>
                      <Coffee className="h-4 w-4 mr-2 text-orange-500" />
                      {todayAttendance.lunch_start && !todayAttendance.lunch_end ? "End Break" : "Break"}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Break Time</DialogTitle></DialogHeader>
                    <p className="text-sm text-slate-600">
                        {todayAttendance.lunch_start && !todayAttendance.lunch_end ? "Ready to get back to work?" : "Taking a short break?"}
                    </p>
                    <div className="flex gap-2 justify-end mt-2">
                        <Button variant="ghost" onClick={() => setShowBreakDialog(false)}>Cancel</Button>
                        <Button onClick={handleLunch}>Confirm</Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog open={showCheckOutDialog} onOpenChange={setShowCheckOutDialog}>
                  <DialogTrigger asChild>
                    <Button className="flex-1 bg-slate-900 hover:bg-slate-800 text-white h-11" disabled={!isOnline}>
                      <LogOut className="h-4 w-4 mr-2" /> Check Out
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>End Shift</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                        <div className="bg-blue-50 text-blue-700 p-3 rounded-md text-sm flex gap-2">
                            <ThumbsUp className="h-4 w-4 mt-0.5"/>
                            <div>
                                <p className="font-bold">Great work today!</p>
                                <p className="text-xs opacity-80">You worked for {formatDuration(elapsedTime)}.</p>
                            </div>
                        </div>
                        <Textarea placeholder="End of day report (optional)..." value={notes} onChange={(e) => setNotes(e.target.value)} />
                        <Button onClick={handleCheckOut} className="w-full bg-red-600 hover:bg-red-700">Confirm Check Out</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            ) : (
                <div className="bg-slate-50 border border-slate-100 rounded-lg p-4 text-center">
                    <p className="text-sm text-slate-600 font-medium">Shift completed. See you tomorrow!</p>
                </div>
            )}
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
