"use client";

import { useState, useEffect, useRef } from "react";
import { useFaceAuth } from "@/hooks/use-face-auth";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Camera, ShieldCheck, ShieldAlert, Sparkles, Navigation, Monitor } from "lucide-react";
import { toast } from "sonner";
import { attendanceService } from "@/lib/attendance-service";

interface FaceAuthModalProps {
  userId: string;
  action: "check-in" | "check-out" | "break" | "resume";
  registeredEmbeddings: {
    front: number[];
    left: number[];
    right: number[];
  };
  notes?: string;
  onSuccess: (record: any) => void;
  onClose: () => void;
}

type AuthStep = "loading" | "scanning" | "liveness-blink" | "liveness-smile" | "verifying" | "success" | "error";

export default function FaceAuthModal({
  userId,
  action,
  registeredEmbeddings,
  notes = "",
  onSuccess,
  onClose
}: FaceAuthModalProps) {
  const { modelsLoaded, loadingError, detectFaceInVideo, detectBlink, detectSmile, matchFace } = useFaceAuth();
  
  const [authStep, setAuthStep] = useState<AuthStep>("loading");
  const [instruction, setInstruction] = useState("Initializing Front Camera...");
  const [attempts, setAttempts] = useState(0);
  
  // Liveness validation states
  const [livenessBlink, setLivenessBlink] = useState(false);
  const [livenessSmile, setLivenessSmile] = useState(false);
  
  // Camera references
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const prevEARRef = useRef<number>(0.3);
  const requestRef = useRef<number | null>(null);
  
  // Saved outputs
  const [capturedSelfie, setCapturedSelfie] = useState<string | null>(null);
  const [gpsData, setGpsData] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  
  const supabase = createClient();

  useEffect(() => {
    if (modelsLoaded) {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [modelsLoaded]);

  const startCamera = async () => {
    try {
      stopCamera();
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setAuthStep("scanning");
      setInstruction("Position your face inside the scan circle...");
      
      // Grab GPS location in background immediately to save transaction time!
      requestGpsLocation();
    } catch (err) {
      console.error("Camera error:", err);
      setAuthStep("error");
      setInstruction("Camera access denied. Please grant permissions.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
  };

  const requestGpsLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setGpsData({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        },
        (error) => {
          console.warn("GPS Access failed:", error);
          // Set a mock location if they deny GPS, to allow the checkin process to proceed (highly resilient fallbacks)
          setGpsData({
            latitude: 0,
            longitude: 0,
            accuracy: 9999
          });
        },
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
      );
    }
  };

  // Tracking loop for Facial recognition & Liveness
  useEffect(() => {
    if (authStep !== "scanning" && authStep !== "liveness-blink" && authStep !== "liveness-smile") {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
      return;
    }

    let isProcessing = false;
    let matchSuccessCount = 0;
    
    // Cast embeddings arrays to Float32Array
    const regFront = new Float32Array(registeredEmbeddings.front);
    const regLeft = new Float32Array(registeredEmbeddings.left);
    const regRight = new Float32Array(registeredEmbeddings.right);

    const runAuthLoop = async () => {
      if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) {
        requestRef.current = requestAnimationFrame(runAuthLoop);
        return;
      }

      if (isProcessing) {
        requestRef.current = requestAnimationFrame(runAuthLoop);
        return;
      }

      isProcessing = true;

      try {
        const detection = await detectFaceInVideo(videoRef.current);

        if (detection) {
          const landmarks = detection.landmarks;
          const currentDescriptor = detection.descriptor;

          // 1. BIOMETRIC MATCH CHECK
          // Compare against registered front, left, or right embeddings (highly resilient)
          const matchFront = matchFace(currentDescriptor, regFront);
          const matchLeft = matchFace(currentDescriptor, regLeft);
          const matchRight = matchFace(currentDescriptor, regRight);

          const isMatched = matchFront.matched || matchLeft.matched || matchRight.matched;

          if (isMatched) {
            matchSuccessCount++;
            
            // Wait for 3 consecutive matching frames to prevent noise
            if (matchSuccessCount >= 3) {
              
              if (authStep === "scanning") {
                // Biometrics verified! Capture attendance snapshot first
                captureAttendanceSelfie();
                
                // Transition to Blink Liveness Check
                setAuthStep("liveness-blink");
                setInstruction("Biometrics verified! Now, please blink your eyes...");
                matchSuccessCount = 0;
                isProcessing = false;
                return;
              }
              
              if (authStep === "liveness-blink") {
                // Track blinks
                const prevEAR = prevEARRef.current;
                const setPrevEAR = (val: number) => { prevEARRef.current = val; };
                const blink = detectBlink(landmarks, prevEAR, setPrevEAR);
                
                if (blink || livenessBlink) {
                  setLivenessBlink(true);
                  // Transition to Smile Liveness Check
                  setAuthStep("liveness-smile");
                  setInstruction("Liveness 50% verified. Now, please smile!");
                  matchSuccessCount = 0;
                  isProcessing = false;
                  return;
                }
              }
              
              if (authStep === "liveness-smile") {
                // Track smile
                const smile = detectSmile(landmarks);
                
                if (smile || livenessSmile) {
                  setLivenessSmile(true);
                  // Complete liveness
                  setAuthStep("verifying");
                  setInstruction("Liveness verified. Submitting attendance record...");
                  stopCamera();
                  isProcessing = false;
                  // Trigger final submissions
                  completeAttendanceTransaction();
                  return;
                }
              }

            }
          } else {
            // Decelerate match counter if no matches in current frame
            matchSuccessCount = Math.max(0, matchSuccessCount - 1);
            if (authStep === "scanning") {
              setInstruction("Position your face inside the circle...");
            }
          }
        } else {
          matchSuccessCount = Math.max(0, matchSuccessCount - 1);
          setInstruction("No face detected. Align your face inside the circle.");
        }
      } catch (err) {
        console.error("Auth Loop Error:", err);
      }

      isProcessing = false;
      requestRef.current = requestAnimationFrame(runAuthLoop);
    };

    requestRef.current = requestAnimationFrame(runAuthLoop);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
    };
  }, [authStep, registeredEmbeddings]);

  const captureAttendanceSelfie = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = 360;
    canvas.height = 360;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const size = Math.min(videoRef.current.videoWidth, videoRef.current.videoHeight);
      const sx = (videoRef.current.videoWidth - size) / 2;
      const sy = (videoRef.current.videoHeight - size) / 2;
      ctx.drawImage(videoRef.current, sx, sy, size, size, 0, 0, 360, 360);
      const base64 = canvas.toDataURL("image/jpeg", 0.85);
      setCapturedSelfie(base64);
    }
  };

  const completeAttendanceTransaction = async () => {
    try {
      if (!capturedSelfie) {
        throw new Error("Missing attendance selfie photo.");
      }

      // 1. Upload selfie to Supabase Bucket
      let selfieUrl = capturedSelfie;
      try {
        const res = await fetch(capturedSelfie);
        const blob = await res.blob();
        const path = `${userId}/attendance_${action}_${Date.now()}.jpg`;
        
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from("attendance_selfies")
          .upload(path, blob, {
            contentType: "image/jpeg",
            upsert: true
          });

        if (uploadErr) {
          console.warn("Storage upload failed, using base64 URL fallback:", uploadErr);
        } else if (uploadData) {
          const { data: { publicUrl } } = supabase.storage
            .from("attendance_selfies")
            .getPublicUrl(path);
          selfieUrl = publicUrl;
        }
      } catch (err) {
        console.warn("Selfie upload bucket exception, falling back to base64:", err);
      }

      // 2. Fetch Device Info and Coordinates
      const finalGps = gpsData || { latitude: 0, longitude: 0, accuracy: 9999 };
      const locationJson = {
        latitude: finalGps.latitude,
        longitude: finalGps.longitude,
        accuracy: finalGps.accuracy,
        timestamp: new Date().toISOString()
      };

      const deviceInfoString = `${navigator.userAgent} (${navigator.platform}) screen:${window.screen.width}x${window.screen.height}`;
      const todayDateStr = new Date().toISOString().split("T")[0];
      const nowIso = new Date().toISOString();

      let ipAddress = "0.0.0.0";
      try {
        const ipRes = await fetch("https://api.ipify.org?format=json");
        const ipData = await ipRes.json();
        ipAddress = ipData.ip;
      } catch (e) {
        console.warn("Could not determine IP", e);
      }

      // 3. Mark Attendance using Supabase directly to update selfie & device fields
      // First check if there is an existing record for today
      const { data: existingRecord } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", userId)
        .eq("date", todayDateStr)
        .maybeSingle();

      let dbResult: any = null;

      if (action === "check-in") {
        const { data, error } = await supabase
          .from("attendance")
          .upsert(
            {
              user_id: userId,
              date: todayDateStr,
              check_in: nowIso,
              status: "present",
              notes: notes || null,
              location_check_in: locationJson,
              ip_check_in: ipAddress,
              device_info_check_in: deviceInfoString,
              selfie_url_check_in: selfieUrl,
              updated_at: nowIso
            },
            { onConflict: "user_id, date" }
          )
          .select()
          .single();
        if (error) throw error;
        dbResult = data;
      } 
      else if (action === "check-out") {
        if (!existingRecord) {
          throw new Error("No check-in record found for today. Please check in first.");
        }
        
        // Calculate work hours
        const checkInTime = new Date(existingRecord.check_in);
        const checkOutTime = new Date(nowIso);
        const totalMinutes = Math.floor((checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60));
        
        let breakMinutes = 0;
        if (existingRecord.lunch_start && existingRecord.lunch_end) {
          breakMinutes = Math.floor((new Date(existingRecord.lunch_end).getTime() - new Date(existingRecord.lunch_start).getTime()) / (1000 * 60));
        }
        const workingMinutes = Math.max(0, totalMinutes - breakMinutes);
        const totalHours = `${Math.floor(workingMinutes / 60)}:${(workingMinutes % 60).toString().padStart(2, "0")}`;
        const breakHoursStr = breakMinutes > 0 ? `${Math.floor(breakMinutes / 60)}:${(breakMinutes % 60).toString().padStart(2, "0")}` : null;

        const { data, error } = await supabase
          .from("attendance")
          .update({
            check_out: nowIso,
            total_hours: totalHours,
            break_hours: breakHoursStr,
            location_check_out: locationJson,
            ip_check_out: ipAddress,
            device_info_check_out: deviceInfoString,
            selfie_url_check_out: selfieUrl,
            updated_at: nowIso,
            notes: notes || existingRecord.notes
          })
          .eq("id", existingRecord.id)
          .select()
          .single();
        if (error) throw error;
        dbResult = data;
      }
      else if (action === "break") {
        if (!existingRecord) {
          throw new Error("Please check in first before going on a break.");
        }
        const { data, error } = await supabase
          .from("attendance")
          .update({
            lunch_start: nowIso,
            updated_at: nowIso
          })
          .eq("id", existingRecord.id)
          .select()
          .single();
        if (error) throw error;
        dbResult = data;
      }
      else if (action === "resume") {
        if (!existingRecord) {
          throw new Error("No attendance record found.");
        }
        const { data, error } = await supabase
          .from("attendance")
          .update({
            lunch_end: nowIso,
            updated_at: nowIso
          })
          .eq("id", existingRecord.id)
          .select()
          .single();
        if (error) throw error;
        dbResult = data;
      }

      setAuthStep("success");
      setInstruction("Attendance saved successfully!");
      toast.success(`Success! Handled attendance action: ${action}`);
      
      // Delay success trigger by 2 seconds so they can view the gorgeous success indicator
      setTimeout(() => {
        onSuccess(dbResult);
      }, 2000);

    } catch (err: any) {
      console.error("Attendance transaction failure:", err);
      toast.error(err.message || "Failed to mark attendance.");
      setAuthStep("error");
      setInstruction(err.message || "Attendance submission failed.");
    }
  };

  const handleRetry = () => {
    setAttempts(a => a + 1);
    setLivenessBlink(false);
    setLivenessSmile(false);
    setAuthStep("loading");
    setInstruction("Re-initializing front camera...");
    startCamera();
  };

  // Color border ring based on state
  const ringColorMap = {
    loading: "border-slate-800",
    scanning: "border-blue-500/50 animate-pulse",
    "liveness-blink": "border-amber-400/80 animate-[ping_2s_infinite]",
    "liveness-smile": "border-amber-400/80 animate-[ping_2s_infinite]",
    verifying: "border-blue-500/80 animate-pulse",
    success: "border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)]",
    error: "border-rose-500"
  };

  return (
    <div className="fixed inset-0 bg-slate-950/95 z-[9999] flex items-center justify-center p-4 backdrop-blur-md">
      <Card className="max-w-md w-full border border-slate-800/80 bg-slate-900/60 shadow-2xl rounded-3xl overflow-hidden backdrop-blur-md animate-in fade-in zoom-in duration-300">
        <CardContent className="p-0">
          
          {/* HEADER */}
          <div className="p-6 text-center border-b border-slate-800/60">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-full text-xs font-bold uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" /> Biometric Gate
            </div>
            <h2 className="text-2xl font-black text-slate-100 tracking-tight capitalize">{action.replace("-", " ")} Flow</h2>
            <p className="text-slate-400 text-xs mt-1">Biometric face recognition and GPS location check-in.</p>
          </div>

          {/* MAIN STREAM VIEWPORT */}
          <div className="p-6 flex flex-col items-center gap-6">
            
            {/* VIEWPORT CIRCLE */}
            <div className={`relative w-64 h-64 rounded-full overflow-hidden border-4 bg-slate-950 flex items-center justify-center shadow-2xl transition-all duration-500 ${ringColorMap[authStep]}`}>
              
              {/* VIDEO LAYER */}
              {(authStep === "loading" || authStep === "scanning" || authStep === "liveness-blink" || authStep === "liveness-smile" || authStep === "verifying") && (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
              )}

              {/* SUCCESS STATIC PREVIEW */}
              {authStep === "success" && capturedSelfie && (
                <div className="absolute inset-0 bg-slate-900">
                  <img src={capturedSelfie} alt="Verified Selfie" className="w-full h-full object-cover scale-x-[-1]" />
                  <div className="absolute inset-0 bg-emerald-500/10 backdrop-blur-3xs flex items-center justify-center">
                    <div className="w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg border-4 border-slate-900 animate-[scale-in_0.3s_ease-out]">
                      <ShieldCheck className="w-9 h-9" />
                    </div>
                  </div>
                </div>
              )}

              {/* ERROR STATE */}
              {authStep === "error" && (
                <div className="absolute inset-0 bg-slate-950 flex items-center justify-center flex-col gap-3 p-6 text-center">
                  <div className="w-14 h-14 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center border border-rose-500/20">
                    <ShieldAlert className="w-7 h-7" />
                  </div>
                  <span className="text-xs font-bold text-rose-400 uppercase tracking-widest">Access Denied</span>
                </div>
              )}

              {/* LOADING INDICATOR */}
              {authStep === "loading" && (
                <div className="absolute inset-0 bg-slate-950 flex items-center justify-center flex-col gap-3">
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Activating Camera</span>
                </div>
              )}

              {/* SAVING SUBMISSION HUD */}
              {authStep === "verifying" && (
                <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center flex-col gap-3">
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                  <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest animate-pulse">Saving Logs</span>
                </div>
              )}

              {/* CIRCULAR GUIDES */}
              {(authStep === "scanning" || authStep === "liveness-blink" || authStep === "liveness-smile") && (
                <>
                  <div className="absolute inset-0 rounded-full border-2 border-dashed border-blue-500/10 animate-[spin_40s_linear_infinite]" />
                  <div className="absolute inset-4 rounded-full border border-blue-500/10" />
                  
                  {/* LIVENESS HUD PROGRESS BARS */}
                  <div className="absolute top-4 inset-x-0 flex justify-center gap-1.5 z-25">
                    <div className={`h-1.5 rounded-full transition-all duration-300 ${livenessBlink ? "w-10 bg-green-500" : "w-10 bg-slate-800 border border-slate-700"} flex items-center justify-center`}>
                      <span className="text-[7px] font-black uppercase text-white scale-75">Blink</span>
                    </div>
                    <div className={`h-1.5 rounded-full transition-all duration-300 ${livenessSmile ? "w-10 bg-green-500" : "w-10 bg-slate-800 border border-slate-700"} flex items-center justify-center`}>
                      <span className="text-[7px] font-black uppercase text-white scale-75">Smile</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* FEEDBACK & TEXT GUIDES */}
            <div className="w-full text-center space-y-4">
              <div className="text-xs font-bold text-slate-350 bg-slate-800/40 border border-slate-750/30 px-4 py-2.5 rounded-2xl min-h-[48px] flex items-center justify-center">
                {instruction}
              </div>

              {/* GPS HUD RADAR */}
              <div className="flex justify-center gap-4 text-[10px] text-slate-400 font-bold uppercase font-mono bg-slate-800/20 p-3 rounded-2xl border border-slate-800/30">
                <div className="flex items-center gap-1.5">
                  <Navigation className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span>GPS: {gpsData ? `${gpsData.latitude.toFixed(4)}, ${gpsData.longitude.toFixed(4)}` : "Locating..."}</span>
                </div>
                <div className="w-px bg-slate-800" />
                <div className="flex items-center gap-1.5">
                  <Monitor className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span>Accuracy: {gpsData ? `${gpsData.accuracy.toFixed(0)}m` : "Checking..."}</span>
                </div>
              </div>
            </div>

            {/* FOOTER ACTIONS */}
            <div className="flex gap-2 w-full border-t border-slate-800/60 pt-4">
              {authStep === "error" ? (
                <>
                  <Button variant="outline" onClick={onClose} className="flex-1 h-11 border-slate-800 bg-slate-850 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold">Cancel</Button>
                  <Button onClick={handleRetry} className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-md"><Camera className="w-3.5 h-3.5 mr-2" /> Retry Scan</Button>
                </>
              ) : (
                <Button variant="outline" onClick={onClose} disabled={authStep === "verifying" || authStep === "success"} className="w-full h-11 border-slate-800 bg-slate-850 hover:bg-slate-800 text-slate-350 rounded-xl text-xs font-semibold">
                  Abort Scan
                </Button>
              )}
            </div>

          </div>

        </CardContent>
      </Card>
    </div>
  );
}
