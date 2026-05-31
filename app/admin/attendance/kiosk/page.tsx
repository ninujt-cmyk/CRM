"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useFaceAuth } from "@/hooks/use-face-auth";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Camera, RefreshCw, Search, Users, CheckCircle2, 
  Lock, Unlock, Clock, ArrowLeft, History, Sparkles, 
  ShieldAlert, Volume2, UserCheck, Play, Square, ChevronRight, X, Settings, AlertTriangle
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import FaceRegistrationModal from "@/components/attendance/face-registration-modal";

interface EmployeeEmbedding {
  userId: string;
  fullName: string;
  email: string;
  role: string;
  avatarUrl: string;
  embeddings: {
    front: Float32Array | null;
    left: Float32Array | null;
    right: Float32Array | null;
  };
  rawEmbeddings: any;
}

interface KioskLog {
  id: string;
  userId: string;
  fullName: string;
  avatarUrl: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
  timestamp: string;
  action: "check-in" | "check-out";
}

export default function AttendanceKioskPage() {
  const { modelsLoaded, loadingError, detectFaceInVideo, matchFace } = useFaceAuth();
  
  // UI States
  const [employees, setEmployees] = useState<EmployeeEmbedding[]>([]);
  const [logsToday, setLogsToday] = useState<KioskLog[]>([]);
  const [kioskMode, setKioskMode] = useState<"auto" | "check-in" | "check-out">("auto");
  const [cameraActive, setCameraActive] = useState(false);
  const [instruction, setInstruction] = useState("Loading Biometric Kiosk...");
  const [searchQuery, setSearchQuery] = useState("");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isLockActive, setIsLockActive] = useState(false);
  
  // Registration States
  const [isRegistering, setIsRegistering] = useState(false);
  const [registeringUserId, setRegisteringUserId] = useState<string | null>(null);

  // White-label settings states
  const [kioskName, setKioskName] = useState("Office Kiosk Gateway");
  const [kioskLogo, setKioskLogo] = useState("");
  const [kioskVoice, setKioskVoice] = useState("");
  const [kioskTheme, setKioskTheme] = useState("obsidian");
  const [checkoutWaitHours, setCheckoutWaitHours] = useState(1);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [systemVoices, setSystemVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [broadcasts, setBroadcasts] = useState<{ [userId: string]: string }>({});
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [ambientFlashMode, setAmbientFlashMode] = useState("auto");
  const [brightnessLevel, setBrightnessLevel] = useState(100);
  const [isLowLight, setIsLowLight] = useState(false);

  // Settings form temp states
  const [settingsName, setSettingsName] = useState(kioskName);
  const [settingsLogo, setSettingsLogo] = useState(kioskLogo);
  const [settingsVoice, setSettingsVoice] = useState(kioskVoice);
  const [settingsTheme, setSettingsTheme] = useState(kioskTheme);
  const [settingsWait, setSettingsWait] = useState(checkoutWaitHours);
  const [settingsFlashMode, setSettingsFlashMode] = useState(ambientFlashMode);

  // Synchronize form when opened
  useEffect(() => {
    if (isSettingsOpen) {
      setSettingsName(kioskName);
      setSettingsLogo(kioskLogo);
      setSettingsVoice(kioskVoice);
      setSettingsTheme(kioskTheme);
      setSettingsWait(checkoutWaitHours);
      setSettingsFlashMode(ambientFlashMode);
    }
  }, [isSettingsOpen]);
  
  // Scanned HUD display
  const [lastMatch, setLastMatch] = useState<{
    fullName: string;
    time: string;
    action: "check-in" | "check-out";
    avatarUrl?: string;
  } | null>(null);

  // References
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestRef = useRef<number | null>(null);
  const wakeLockRef = useRef<any>(null);
  const cooldownQueueRef = useRef<{ userId: string; time: number }[]>([]);
  const loopActiveRef = useRef(false);
  const loopPausedUntilRef = useRef<number>(0);
  const lastUnregisteredSpeakRef = useRef<number>(0);
  const analyzerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameCounterRef = useRef<number>(0);
  
  const supabase = createClient();

  // Load registered embeddings and logs today on mount
  useEffect(() => {
    loadEmployees();
    loadLogsToday();
    loadBroadcasts();
    checkOfflineQueue();
    
    // Load local storage configuration settings
    if (typeof window !== "undefined") {
      setKioskName(localStorage.getItem("kiosk_name") || "Office Kiosk Gateway");
      setKioskLogo(localStorage.getItem("kiosk_logo") || "");
      setKioskVoice(localStorage.getItem("kiosk_voice") || "");
      setKioskTheme(localStorage.getItem("kiosk_theme") || "obsidian");
      setCheckoutWaitHours(Number(localStorage.getItem("kiosk_checkout_wait") || "1"));
      setAmbientFlashMode(localStorage.getItem("kiosk_light_assist") || "auto");

      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        setSystemVoices(voices.filter(v => v.lang.startsWith("en")));
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;

      // Register background sync hooks
      window.addEventListener("online", triggerBackgroundSync);
      const poller = setInterval(triggerBackgroundSync, 15000);
      return () => {
        window.removeEventListener("online", triggerBackgroundSync);
        clearInterval(poller);
        stopCamera();
        releaseWakeLock();
      };
    }

    // Periodically clean up the cooldown queue
    const queueCleaner = setInterval(() => {
      cooldownQueueRef.current = cooldownQueueRef.current.filter(c => Date.now() - c.time < 5000);
    }, 5000);

    return () => {
      clearInterval(queueCleaner);
      stopCamera();
      releaseWakeLock();
    };
  }, []);

  // --- CLIENT-SIDE INDEXEDDB FOR RESILIENT OFFLINE QUEUEING ---
  const openIndexedDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      if (typeof window === "undefined" || !("indexedDB" in window)) {
        reject(new Error("IndexedDB is not supported on this browser."));
        return;
      }
      const request = window.indexedDB.open("biometric_kiosk_offline_db", 1);
      
      request.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("offline_transactions")) {
          db.createObjectStore("offline_transactions", { keyPath: "id" });
        }
      };
      
      request.onsuccess = (e: any) => resolve(e.target.result);
      request.onerror = (e: any) => reject(e.target.error);
    });
  };

  const queueOfflineTransaction = async (tx: any) => {
    try {
      const db = await openIndexedDB();
      const transaction = db.transaction("offline_transactions", "readwrite");
      const store = transaction.objectStore("offline_transactions");
      store.add({
        id: crypto.randomUUID(),
        ...tx,
        timestamp: new Date().toISOString()
      });
      toast.warning("Offline mode: Attendance transaction queued locally!");
    } catch (err) {
      console.error("IndexedDB store failed:", err);
    }
  };

  const getQueuedTransactions = async (): Promise<any[]> => {
    return new Promise(async (resolve, reject) => {
      try {
        const db = await openIndexedDB();
        const transaction = db.transaction("offline_transactions", "readonly");
        const store = transaction.objectStore("offline_transactions");
        const request = store.getAll();
        
        request.onsuccess = (e: any) => resolve(e.target.result);
        request.onerror = (e: any) => reject(e.target.error);
      } catch (err) {
        reject(err);
      }
    });
  };

  const deleteQueuedTransaction = async (id: string): Promise<void> => {
    return new Promise(async (resolve, reject) => {
      try {
        const db = await openIndexedDB();
        const transaction = db.transaction("offline_transactions", "readwrite");
        const store = transaction.objectStore("offline_transactions");
        const request = store.delete(id);
        
        request.onsuccess = () => resolve();
        request.onerror = (e: any) => reject(e.target.error);
      } catch (err) {
        reject(err);
      }
    });
  };

  const checkOfflineQueue = async () => {
    try {
      const queued = await getQueuedTransactions();
      setOfflineQueueCount(queued.length);
    } catch (e) {
      console.warn("Queue check failed", e);
    }
  };

  const triggerBackgroundSync = async () => {
    if (isSyncing || typeof navigator === "undefined" || !navigator.onLine) return;
    
    try {
      const queued = await getQueuedTransactions();
      if (queued.length === 0) return;
      
      setIsSyncing(true);
      setInstruction(`Syncing ${queued.length} offline transactions...`);
      playKioskSound("click");
      
      for (const tx of queued) {
        let selfieUrl = tx.selfieUrl || "";
        if (tx.selfieBase64) {
          try {
            const res = await fetch(tx.selfieBase64);
            const blob = await res.blob();
            const path = `${tx.userId}/kiosk_${tx.action}_${Date.now()}.jpg`;
            const { data: uploadData } = await supabase.storage
              .from("attendance_selfies")
              .upload(path, blob, {
                contentType: "image/jpeg",
                upsert: true
              });
            if (uploadData) {
              const { data: { publicUrl } } = supabase.storage
                .from("attendance_selfies")
                .getPublicUrl(path);
              selfieUrl = publicUrl;
            }
          } catch (uploadExc) {
            console.warn("Offline selfie upload failed, keeping base64 URL:", uploadExc);
            selfieUrl = tx.selfieBase64;
          }
        }

        if (tx.action === "check-in") {
          await supabase.from("attendance").upsert(
            {
              user_id: tx.userId,
              date: tx.timestamp.split("T")[0],
              check_in: tx.timestamp,
              status: "present",
              location_check_in: { latitude: 0, longitude: 0, accuracy: 9999, source: "offline-sync" },
              ip_check_in: "0.0.0.0",
              device_info_check_in: `${tx.kioskName} (Offline Sync)`,
              selfie_url_check_in: selfieUrl,
              updated_at: tx.timestamp
            },
            { onConflict: "user_id, date" }
          );
        } else {
          const { data: record } = await supabase
            .from("attendance")
            .select("*")
            .eq("user_id", tx.userId)
            .eq("date", tx.timestamp.split("T")[0])
            .maybeSingle();

          if (record) {
            const checkInTime = new Date(record.check_in);
            const checkOutTime = new Date(tx.timestamp);
            const mins = Math.floor((checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60));
            const totalHours = `${Math.floor(mins / 60)}:${(mins % 60).toString().padStart(2, "0")}`;

            await supabase
              .from("attendance")
              .update({
                check_out: tx.timestamp,
                total_hours: totalHours,
                location_check_out: { latitude: 0, longitude: 0, accuracy: 9999, source: "offline-sync" },
                ip_check_out: "0.0.0.0",
                device_info_check_out: `${tx.kioskName} (Offline Sync)`,
                selfie_url_check_out: selfieUrl,
                updated_at: tx.timestamp
              })
              .eq("id", record.id);
          }
        }
        
        await deleteQueuedTransaction(tx.id);
      }
      
      toast.success("All offline biometric logs synced successfully!");
      playKioskSound("success");
      loadLogsToday();
      checkOfflineQueue();
    } catch (err) {
      console.error("Sync error:", err);
    } finally {
      setIsSyncing(false);
      setInstruction("Kiosk Idle");
    }
  };

  const loadBroadcasts = async () => {
    try {
      const { data, error } = await supabase
        .from("employee_broadcasts")
        .select("user_id, message")
        .eq("is_active", true);

      if (error) throw error;
      if (data) {
        const map: { [userId: string]: string } = {};
        data.forEach((item: any) => {
          map[item.user_id] = item.message;
        });
        setBroadcasts(map);
      }
    } catch (e) {
      console.warn("Failed to load broadcasts:", e);
    }
  };

  const saveSettings = (name: string, logo: string, voice: string, theme: string, wait: number, flashMode: string) => {
    localStorage.setItem("kiosk_name", name);
    localStorage.setItem("kiosk_logo", logo);
    localStorage.setItem("kiosk_voice", voice);
    localStorage.setItem("kiosk_theme", theme);
    localStorage.setItem("kiosk_checkout_wait", wait.toString());
    localStorage.setItem("kiosk_light_assist", flashMode);
    
    setKioskName(name);
    setKioskLogo(logo);
    setKioskVoice(voice);
    setKioskTheme(theme);
    setCheckoutWaitHours(wait);
    setAmbientFlashMode(flashMode);
    
    setIsSettingsOpen(false);
    toast.success("Kiosk settings saved successfully!");
    playKioskSound("success");
  };

  const loadEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from("employee_face_data")
        .select(`
          user_id,
          face_embeddings,
          users:user_id (
            id,
            full_name,
            email,
            role,
            is_active
          )
        `);

      if (error) throw error;

      if (data) {
        const loaded: EmployeeEmbedding[] = data.map((item: any) => {
          const u = item.users;
          const emb = item.face_embeddings;
          return {
            userId: item.user_id,
            fullName: u?.full_name || "Unknown Employee",
            email: u?.email || "",
            role: u?.role || "employee",
            avatarUrl: "",
            embeddings: {
              front: emb?.front ? new Float32Array(emb.front) : null,
              left: emb?.left ? new Float32Array(emb.left) : null,
              right: emb?.right ? new Float32Array(emb.right) : null,
            },
            rawEmbeddings: emb
          };
        });
        setEmployees(loaded);
        setInstruction("Kiosk loaded. Click 'Start Kiosk Scanner' to begin.");
      }
    } catch (err: any) {
      console.error("Failed to load employees:", err);
      toast.error("Could not fetch employee biometric registry.");
    }
  };

  const loadLogsToday = async () => {
    try {
      const todayDateStr = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("attendance")
        .select(`
          id,
          user_id,
          date,
          check_in,
          check_out,
          status,
          users:user_id (
            full_name
          )
        `)
        .eq("date", todayDateStr)
        .order("updated_at", { ascending: false });

      if (error) throw error;

      if (data) {
        const formatted: KioskLog[] = data.map((item: any) => {
          const checkOut = item.check_out;
          const checkIn = item.check_in;
          const logTime = checkOut ? new Date(checkOut) : new Date(checkIn);
          return {
            id: item.id,
            userId: item.user_id,
            fullName: item.users?.full_name || "Unknown",
            avatarUrl: "",
            checkIn: checkIn,
            checkOut: checkOut,
            status: item.status,
            timestamp: logTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            action: checkOut ? "check-out" : "check-in"
          };
        });
        setLogsToday(formatted);
      }
    } catch (err: any) {
      console.error("Failed to fetch logs:", err);
    }
  };

  // --- AUDIO SYNTHESIZER ENGINE ---
  const playKioskSound = (type: "success" | "neutral" | "error" | "click") => {
    try {
      if (typeof window === "undefined") return;
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      
      const ctx = new AudioContextClass();
      
      if (type === "success") {
        // Pleasant chord chimes (C5 -> E5 -> G5 -> C6)
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.07);
          gain.gain.setValueAtTime(0.12, ctx.currentTime + idx * 0.07);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.07 + 0.25);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + idx * 0.07);
          osc.stop(ctx.currentTime + idx * 0.07 + 0.25);
        });
      } else if (type === "error") {
        // Low double buzz
        const notes = [150, 130];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);
          gain.gain.setValueAtTime(0.08, ctx.currentTime + idx * 0.12);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.12 + 0.2);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + idx * 0.12);
          osc.stop(ctx.currentTime + idx * 0.12 + 0.2);
        });
      } else if (type === "neutral") {
        // Soft focus lock chime
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.08);
      } else if (type === "click") {
        // High click
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(1100, ctx.currentTime);
        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.04);
      }
    } catch (e) {
      console.warn("Audio Context failed to play sound:", e);
    }
  };

  // --- TEXT-TO-SPEECH (TTS) SYNTHESIS ---
  const speakKioskMessage = (text: string) => {
    try {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      
      // Cancel active queues to avoid delays
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95; // Crisp readability speed
      utterance.pitch = 1.0;
      
      // Select preferred standard English speaker voice
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(v => v.name === kioskVoice) || voices.find(v => 
        v.lang.startsWith("en") && 
        (v.name.includes("Google") || v.name.includes("Natural") || v.name.includes("Samantha"))
      );
      if (preferred) utterance.voice = preferred;
      
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn("Speech Synthesis failed:", err);
    }
  };

  // --- SCREEN WAKE LOCK CONTROL ---
  const requestWakeLock = async () => {
    try {
      if (typeof window === "undefined" || !("wakeLock" in navigator)) return;
      
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      }

      const lock = await (navigator as any).wakeLock.request("screen");
      wakeLockRef.current = lock;
      setIsLockActive(true);
      
      lock.addEventListener("release", () => {
        setIsLockActive(false);
      });
      console.log("Kiosk screen wake lock active.");
    } catch (err) {
      console.warn("Wake lock request rejected:", err);
      setIsLockActive(false);
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLockRef.current) {
      await wakeLockRef.current.release();
      wakeLockRef.current = null;
      setIsLockActive(false);
      console.log("Kiosk screen wake lock released.");
    }
  };

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (wakeLockRef.current !== null && document.visibilityState === "visible") {
        await requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // --- BIOMETRIC REGISTRATION FLOWS ---
  const startRegistration = (userId: string) => {
    playKioskSound("click");
    stopCamera();
    setRegisteringUserId(userId);
    setIsRegistering(true);
    setIsDrawerOpen(false);
  };

  const handleRegistrationSuccess = async () => {
    setIsRegistering(false);
    setRegisteringUserId(null);
    toast.success("Biometric enrollment completed successfully!");
    await loadEmployees();
    await startCamera();
  };

  const handleRegistrationCancel = async () => {
    setIsRegistering(false);
    setRegisteringUserId(null);
    toast.info("Biometric enrollment cancelled.");
    await startCamera();
  };

  // --- CAMERA ACCESS & STREAM CONTROLS ---
  const startCamera = async () => {
    try {
      stopCamera();
      playKioskSound("click");
      
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
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn("Failed to play video stream:", playErr);
        }
      }
      
      setCameraActive(true);
      setInstruction("Initializing Face Engine...");
      loopActiveRef.current = true;
      
      // Lock screen awake immediately
      requestWakeLock();
    } catch (err) {
      console.error("Camera access failed:", err);
      toast.error("Unable to access video camera. Please verify permissions.");
      setInstruction("Camera access failed.");
    }
  };

  const stopCamera = () => {
    loopActiveRef.current = false;
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setInstruction("Kiosk Idle");
    releaseWakeLock();
  };

  const toggleWakeLock = async () => {
    playKioskSound("click");
    if (isLockActive) {
      await releaseWakeLock();
      toast.info("Screen ScreenLock is turned OFF. Kiosk might sleep.");
    } else {
      await requestWakeLock();
      if (wakeLockRef.current) {
        toast.success("Screen ScreenLock is active. Screen will remain ON.");
      } else {
        toast.error("Screen lock not supported on this device.");
      }
    }
  };

  // --- DYNAMIC SNAPSHOT CAPTURE ---
  const captureKioskSelfie = () => {
    if (!videoRef.current) return null;
    const canvas = document.createElement("canvas");
    canvas.width = 360;
    canvas.height = 360;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const size = Math.min(videoRef.current.videoWidth, videoRef.current.videoHeight);
      const sx = (videoRef.current.videoWidth - size) / 2;
      const sy = (videoRef.current.videoHeight - size) / 2;
      ctx.drawImage(videoRef.current, sx, sy, size, size, 0, 0, 360, 360);
      return canvas.toDataURL("image/jpeg", 0.8);
    }
    return null;
  };

  // --- DYNAMIC ATTENDANCE PROCESSOR ---
  const handleAttendanceTransaction = async (
    emp: EmployeeEmbedding, 
    isManual = false,
    manualActionOverride?: "check-in" | "check-out"
  ) => {
    try {
      setInstruction(`${isManual ? "Manual override: " : "Face identified: "} ${emp.fullName}...`);
      
      const todayDateStr = new Date().toISOString().split("T")[0];
      const nowIso = new Date().toISOString();
      const timeStr = new Date(nowIso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      // Query checkin logs
      const { data: existingRecord } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", emp.userId)
        .eq("date", todayDateStr)
        .maybeSingle();

      let transactionAction: "check-in" | "check-out" | "too-soon" | "already-completed" = "check-in";
      const resolvedMode = manualActionOverride || kioskMode;
      
      if (resolvedMode === "check-in") {
        transactionAction = "check-in";
      } else if (resolvedMode === "check-out") {
        transactionAction = "check-out";
      } else {
        // Auto mode logic with guard against immediate toggling
        if (!existingRecord) {
          transactionAction = "check-in";
        } else if (existingRecord.check_in && !existingRecord.check_out) {
          // Prevent checkout within custom cooldown hours of checkin
          const checkInTime = new Date(existingRecord.check_in).getTime();
          const timeSinceCheckIn = Date.now() - checkInTime;
          
          if (timeSinceCheckIn < checkoutWaitHours * 60 * 60 * 1000) {
            transactionAction = "too-soon";
          } else {
            transactionAction = "check-out";
          }
        } else {
          // Already has both check-in and check-out today
          transactionAction = "already-completed";
        }
      }

      // ------------------------------------------------------------
      // INTERCEPT OFFLINE MODES: QUEUE SCANS RESILIENTLY
      // ------------------------------------------------------------
      const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
      if (isOffline) {
        if (transactionAction === "too-soon") {
          playKioskSound("neutral");
          speakKioskMessage(`Hold-on! ${emp.fullName} is already checked in. Please wait ${checkoutWaitHours} ${checkoutWaitHours === 1 ? "hour" : "hours"} to check out.`);
          setInstruction(`${emp.fullName} checked in. Please wait ${checkoutWaitHours} ${checkoutWaitHours === 1 ? "hour" : "hours"} before checking out.`);
          return;
        }
        if (transactionAction === "already-completed") {
          playKioskSound("neutral");
          speakKioskMessage(`${emp.fullName} already completed shift today.`);
          setInstruction(`${emp.fullName} already completed shift today.`);
          return;
        }

        const capturedSelfie = captureKioskSelfie() || "";
        await queueOfflineTransaction({
          userId: emp.userId,
          fullName: emp.fullName,
          action: transactionAction,
          selfieBase64: capturedSelfie,
          kioskName: kioskName
        });
        
        playKioskSound("success");
        setOfflineQueueCount(prev => prev + 1);

        // Fetch local broadcast notice if active
        const broadcastNotice = broadcasts[emp.userId] || "";

        if (transactionAction === "check-in") {
          speakKioskMessage(`Welcome ${emp.fullName}. Queued locally offline. ${broadcastNotice ? `Notice: ${broadcastNotice}` : ""}`);
          loopPausedUntilRef.current = Date.now() + 6000;
          setInstruction(`Welcome ${emp.fullName}! Scanner paused for 6 seconds [Offline].`);
        } else {
          speakKioskMessage(`Thank you ${emp.fullName}. Queued locally offline. ${broadcastNotice ? `Notice: ${broadcastNotice}` : ""}`);
          loopPausedUntilRef.current = Date.now() + 3000;
          setInstruction(`Goodbye ${emp.fullName}! Scanner paused for 3 seconds [Offline].`);
        }

        if (broadcastNotice) {
          toast.info(`Offline Notice for ${emp.fullName}: "${broadcastNotice}"`, { duration: 6000 });
        }

        setLastMatch({
          fullName: emp.fullName,
          time: timeStr,
          action: transactionAction
        });
        return;
      }

      // Handle no-op cases
      if (transactionAction === "too-soon") {
        playKioskSound("neutral");
        speakKioskMessage(`Hold-on! ${emp.fullName} is already checked in. Please wait ${checkoutWaitHours} ${checkoutWaitHours === 1 ? "hour" : "hours"} to check out.`);
        setInstruction(`${emp.fullName} checked in. Please wait ${checkoutWaitHours} ${checkoutWaitHours === 1 ? "hour" : "hours"} before checking out.`);
        toast.info(`Hold-on! ${emp.fullName} is already checked in. Wait ${checkoutWaitHours} ${checkoutWaitHours === 1 ? "hour" : "hours"} to check out.`);
        return;
      }

      if (transactionAction === "already-completed") {
        playKioskSound("neutral");
        speakKioskMessage(`${emp.fullName} already completed shift today.`);
        setInstruction(`${emp.fullName} already completed shift today.`);
        toast.info(`${emp.fullName} already completed check-in & check-out today.`);
        return;
      }

      // Capture selfie (camera screenshot) if streaming, else fallback
      let selfieUrl = "";
      const capturedSelfie = captureKioskSelfie();
      
      if (capturedSelfie) {
        try {
          const res = await fetch(capturedSelfie);
          const blob = await res.blob();
          const path = `${emp.userId}/kiosk_${transactionAction}_${Date.now()}.jpg`;
          
          const { data: uploadData, error: uploadErr } = await supabase.storage
            .from("attendance_selfies")
            .upload(path, blob, {
              contentType: "image/jpeg",
              upsert: true
            });

          if (uploadData) {
            const { data: { publicUrl } } = supabase.storage
              .from("attendance_selfies")
              .getPublicUrl(path);
            selfieUrl = publicUrl;
          }
        } catch (uploadExc) {
          console.warn("Storage upload failed, fallback to offline URI:", uploadExc);
          selfieUrl = capturedSelfie;
        }
      }

      const deviceInfoString = `${kioskName} (WakeLock: ${isLockActive ? "On" : "Off"})${isManual ? " [Manual]" : ""}`;
      const ipAddress = "0.0.0.0";
      
      if (transactionAction === "check-in") {
        const { error } = await supabase
          .from("attendance")
          .upsert(
            {
              user_id: emp.userId,
              date: todayDateStr,
              check_in: nowIso,
              status: "present",
              location_check_in: { latitude: 0, longitude: 0, accuracy: 9999, source: "kiosk-portal" },
              ip_check_in: ipAddress,
              device_info_check_in: deviceInfoString,
              selfie_url_check_in: selfieUrl,
              updated_at: nowIso
            },
            { onConflict: "user_id, date" }
          );
        if (error) throw error;
      } else {
        if (!existingRecord) {
          throw new Error("No check-in record found for today. Please clock-in first.");
        }
        
        const checkInTime = new Date(existingRecord.check_in);
        const checkOutTime = new Date(nowIso);
        const totalMinutes = Math.floor((checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60));
        const totalHours = `${Math.floor(totalMinutes / 60)}:${(totalMinutes % 60).toString().padStart(2, "0")}`;

        const { error } = await supabase
          .from("attendance")
          .update({
            check_out: nowIso,
            total_hours: totalHours,
            location_check_out: { latitude: 0, longitude: 0, accuracy: 9999, source: "kiosk-portal" },
            ip_check_out: ipAddress,
            device_info_check_out: deviceInfoString,
            selfie_url_check_out: selfieUrl,
            updated_at: nowIso
          })
          .eq("id", existingRecord.id);
        if (error) throw error;
      }

      // Successful matching chime sound!
      playKioskSound("success");
      
      // Look up active announcements
      const broadcastNotice = broadcasts[emp.userId] || "";
      
      // Voice welcome / exit greeting with employee name and dynamic pause buffer
      if (transactionAction === "check-in") {
        speakKioskMessage(`Welcome ${emp.fullName}. Checked in successfully. ${broadcastNotice ? `Reminder: ${broadcastNotice}` : ""}`);
        loopPausedUntilRef.current = Date.now() + 6000; // Pause scanner for 6 seconds
      } else {
        speakKioskMessage(`Thank you ${emp.fullName}. Checked out successfully. ${broadcastNotice ? `Reminder: ${broadcastNotice}` : ""}`);
        loopPausedUntilRef.current = Date.now() + 3000; // Pause scanner for 3 seconds
      }

      if (broadcastNotice) {
        toast.info(`Announcement for ${emp.fullName}: "${broadcastNotice}"`, { duration: 6000 });
      }
      
      setLastMatch({
        fullName: emp.fullName,
        time: timeStr,
        action: transactionAction
      });

      toast.success(`${emp.fullName} ${transactionAction.toUpperCase()} saved successfully at ${timeStr}!`);
      
      // Reset Scanner Feedback with Pause Notice
      if (transactionAction === "check-in") {
        setInstruction(`Welcome ${emp.fullName}! Scanner paused for 6 seconds.`);
      } else {
        setInstruction(`Goodbye ${emp.fullName}! Scanner paused for 3 seconds.`);
      }
      
      // Reload logs timeline
      loadLogsToday();

    } catch (err: any) {
      console.error("Attendance marker failed:", err);
      toast.error(err.message || "Attendance marker failed.");
      playKioskSound("error");
    }
  };

  // --- 1:N RECOGNITION LOOP EFFECT ---
  useEffect(() => {
    if (!cameraActive || !modelsLoaded || employees.length === 0 || !loopActiveRef.current) {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
      return;
    }

    let isProcessing = false;

    const runKioskLoop = async () => {
      if (!loopActiveRef.current || !videoRef.current || videoRef.current.paused || videoRef.current.ended) {
        requestRef.current = requestAnimationFrame(runKioskLoop);
        return;
      }

      if (isProcessing) {
        requestRef.current = requestAnimationFrame(runKioskLoop);
        return;
      }

      if (Date.now() < loopPausedUntilRef.current) {
        requestRef.current = requestAnimationFrame(runKioskLoop);
        return;
      }

      isProcessing = true;

      // Ambient Lighting Calibrator (Analyzes pixels once every 40 frames to avoid CPU overhead)
      if (videoRef.current) {
        frameCounterRef.current = (frameCounterRef.current + 1) % 40;
        if (frameCounterRef.current === 0) {
          try {
            if (!analyzerCanvasRef.current) {
              analyzerCanvasRef.current = document.createElement("canvas");
              analyzerCanvasRef.current.width = 40;
              analyzerCanvasRef.current.height = 40;
            }
            const ctx = analyzerCanvasRef.current.getContext("2d");
            if (ctx) {
              ctx.drawImage(videoRef.current, 0, 0, 40, 40);
              const imgData = ctx.getImageData(0, 0, 40, 40);
              const data = imgData.data;
              let totalLuminance = 0;
              for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
                totalLuminance += luminance;
              }
              const avgLuminance = totalLuminance / (data.length / 4);
              const normalizedBrightness = Math.round((avgLuminance / 255) * 100);
              setBrightnessLevel(normalizedBrightness);
              setIsLowLight(normalizedBrightness < 35);
            }
          } catch (err) {
            console.warn("Luminance analyzer failed:", err);
          }
        }
      }

      try {
        const detection = await detectFaceInVideo(videoRef.current);

        if (detection) {
          const currentDescriptor = detection.descriptor;
          let bestMatch: any = null;
          let minDistance = 1.0;

          // 1:N comparison with all loaded descriptors
          for (const emp of employees) {
            const matchResults = [];
            
            if (emp.embeddings.front) {
              matchResults.push(matchFace(currentDescriptor, emp.embeddings.front));
            } else if (Array.isArray(emp.rawEmbeddings)) {
              matchResults.push(matchFace(currentDescriptor, new Float32Array(emp.rawEmbeddings)));
            }
            
            if (emp.embeddings.left) matchResults.push(matchFace(currentDescriptor, emp.embeddings.left));
            if (emp.embeddings.right) matchResults.push(matchFace(currentDescriptor, emp.embeddings.right));

            if (matchResults.length > 0) {
              const bestForEmp = matchResults.reduce((prev, curr) => prev.distance < curr.distance ? prev : curr);
              if (bestForEmp.distance < minDistance) {
                minDistance = bestForEmp.distance;
                bestMatch = { employee: emp, distance: bestForEmp.distance, matched: bestForEmp.matched };
              }
            }
          }

          if (bestMatch && bestMatch.matched) {
            const matchedEmp = bestMatch.employee;
            
            // 4-second intelligent cooldown per employee
            const isCooling = cooldownQueueRef.current.some(c => c.userId === matchedEmp.userId && Date.now() - c.time < 4000);
            
            if (!isCooling) {
              cooldownQueueRef.current.push({ userId: matchedEmp.userId, time: Date.now() });
              await handleAttendanceTransaction(matchedEmp);
            }
          } else {
            // Unrecognized user matches
            const timeSinceLastSpeak = Date.now() - lastUnregisteredSpeakRef.current;
            if (timeSinceLastSpeak > 8000) {
              lastUnregisteredSpeakRef.current = Date.now();
              playKioskSound("neutral");
              speakKioskMessage("Face not recognized. Kindly register your face.");
            }

            if (minDistance < 0.68) {
              setInstruction("Matching... hold still & look straight");
            } else {
              setInstruction("Face not recognized. Kindly register your face.");
            }
          }
        } else {
          setInstruction("Align your face inside the scan circle...");
        }
      } catch (err) {
        console.error("Kiosk scan exception:", err);
      }

      isProcessing = false;
      
      // Delay slightly (~16 FPS) to save mobile processing battery
      if (loopActiveRef.current) {
        setTimeout(() => {
          requestRef.current = requestAnimationFrame(runKioskLoop);
        }, 60);
      }
    };

    requestRef.current = requestAnimationFrame(runKioskLoop);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
    };
  }, [cameraActive, modelsLoaded, employees, kioskMode]);

  // Search Filtered Employees for Manual Overrides
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => 
      emp.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [employees, searchQuery]);

  const themeClasses = {
    obsidian: {
      bg: "bg-slate-950 text-slate-100",
      header: "bg-slate-900/60 border-slate-800/80 backdrop-blur-md",
      sidebar: "bg-slate-900/20 border-slate-900",
      card: "bg-slate-900/60 border-slate-850",
      border: "border-slate-900"
    },
    indigo: {
      bg: "bg-neutral-950 text-indigo-50",
      header: "bg-indigo-950/20 border-indigo-900/40 backdrop-blur-md",
      sidebar: "bg-indigo-950/5 border-indigo-950/20",
      card: "bg-indigo-950/10 border-indigo-900/30",
      border: "border-indigo-900/30"
    },
    slate: {
      bg: "bg-zinc-950 text-zinc-100",
      header: "bg-zinc-900/50 border-zinc-800 backdrop-blur-md",
      sidebar: "bg-zinc-900/10 border-zinc-900",
      card: "bg-zinc-900/40 border-zinc-850",
      border: "border-zinc-800"
    }
  }[kioskTheme as "obsidian" | "indigo" | "slate"] || {
    bg: "bg-slate-950 text-slate-100",
    header: "bg-slate-900/60 border-slate-800",
    sidebar: "bg-slate-900/20 border-slate-900",
    card: "bg-slate-900/60 border-slate-850",
    border: "border-slate-800"
  };

  const isFlashActive = cameraActive && (ambientFlashMode === "always-on" || (ambientFlashMode === "auto" && isLowLight));

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-500 ${themeClasses.bg}`}>
      
      {/* 1. TOP HEADER NAVIGATION */}
      <header className={`px-6 py-4 border-b flex items-center justify-between z-10 transition-colors duration-500 ${themeClasses.header}`}>
        <div className="flex items-center gap-3">
          <Link href="/admin/attendance">
            <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-white rounded-full bg-slate-800/40 border border-slate-800">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-black tracking-tight flex items-center gap-2 leading-none">
              {kioskLogo ? (
                <img src={kioskLogo} alt="Logo" className="h-5.5 w-auto object-contain max-w-[120px]" />
              ) : (
                <Sparkles className="h-4 w-4 text-indigo-500 animate-pulse" />
              )}
              <span>{kioskName}</span>
            </h1>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1 block">Shared Office Entrance Terminal</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Offline Sync Ticker Badge */}
          {offlineQueueCount > 0 && (
            <Badge variant="outline" className="h-9 rounded-full px-3.5 border-amber-500/25 bg-amber-500/10 text-amber-400 text-xs font-semibold gap-1.5 animate-pulse">
              <div className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
              <span>{offlineQueueCount} Offline Logs Queued</span>
            </Badge>
          )}

          {/* Wake Lock Screen Mode Trigger */}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={toggleWakeLock}
            className={`h-9 px-3 rounded-full text-xs font-semibold gap-1.5 transition-all duration-300 border ${
              isLockActive 
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20" 
                : "bg-slate-800/60 text-slate-400 border-slate-800 hover:bg-slate-855"
            }`}
          >
            {isLockActive ? <Lock className="h-3.5 w-3.5 text-emerald-400" /> : <Unlock className="h-3.5 w-3.5" />}
            <span>Screen Lock: {isLockActive ? "ACTIVE" : "OFF"}</span>
          </Button>

          {/* Register Face trigger */}
          <Button 
            onClick={() => { playKioskSound("click"); setIsDrawerOpen(true); }}
            className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-650 text-xs font-semibold rounded-full gap-1.5 shadow-md shadow-indigo-900/10"
          >
            <Camera className="h-3.5 w-3.5 text-indigo-200" /> Register Face
          </Button>

          {/* Manual override drawer switch */}
          <Button 
            onClick={() => { playKioskSound("click"); setIsDrawerOpen(true); }}
            className="h-9 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-750 text-xs font-semibold rounded-full gap-1.5"
          >
            <Users className="h-3.5 w-3.5 text-indigo-400" /> Manual Override
          </Button>

          {/* Settings Cog Button */}
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => { playKioskSound("click"); setIsSettingsOpen(true); }}
            className="h-9 w-9 text-slate-400 hover:text-white rounded-full bg-slate-800/40 border border-slate-800"
          >
            <Settings className="h-4.5 w-4.5 text-indigo-400" />
          </Button>
        </div>
      </header>

      {/* 2. MAIN LAYOUT WORKSPACE */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden h-[calc(100vh-69px)]">
        
        {/* LEFT COLUMN: ACTIVE VIDEO FEED scanner */}
        <div className={`lg:col-span-8 p-6 flex flex-col items-center justify-between border-r overflow-y-auto transition-colors duration-500 ${themeClasses.sidebar} ${themeClasses.border}`}>
          
          {/* CONTROL OPTIONS TOP */}
          <div className="w-full max-w-md flex items-center justify-between gap-4">
            <div className="flex-1">
              <span className="text-[9px] uppercase font-bold text-slate-500 tracking-widest block mb-1">Terminal Mode</span>
              <Select value={kioskMode} onValueChange={(val: any) => { playKioskSound("click"); setKioskMode(val); }}>
                <SelectTrigger className="h-9 rounded-xl border-slate-800 bg-slate-900 text-xs text-slate-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-300">
                  <SelectItem value="auto">Auto-Detect Status (Intelligent Toggle)</SelectItem>
                  <SelectItem value="check-in">Check-In Only (Force Attendance)</SelectItem>
                  <SelectItem value="check-out">Check-Out Only (Force Shift-End)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="shrink-0 pt-4">
              <Badge variant="outline" className="h-8 rounded-xl px-3 border-indigo-900/40 bg-indigo-950/20 text-indigo-400 text-xs font-mono">
                {employees.length} Registered Descriptors
              </Badge>
            </div>
          </div>

          {/* SCANNING CIRCULAR VIEWER */}
          <div className="relative my-8 flex items-center justify-center">
            
            {/* Viewport Circle */}
            <div className={`relative w-80 h-80 rounded-full overflow-hidden border-4 bg-slate-900 flex items-center justify-center transition-all duration-500 ${
              isFlashActive 
                ? "border-white shadow-[0_0_60px_15px_rgba(255,255,255,0.85),inset_0_0_30px_10px_rgba(255,255,255,0.6)]" 
                : cameraActive
                  ? "border-indigo-500/50 shadow-indigo-500/5 shadow-2xl animate-[pulse_3s_infinite]" 
                  : "border-slate-800 shadow-2xl"
            }`}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover scale-x-[-1] ${cameraActive ? "block" : "hidden"}`}
              />
              {!cameraActive && (
                <div className="flex flex-col items-center gap-3 p-6 text-center">
                  <div className="h-16 w-16 bg-slate-800/80 rounded-2xl border border-slate-700/30 text-slate-400 flex items-center justify-center shadow-inner">
                    <Camera className="h-8 w-8" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-300 mt-2">Kiosk Stream Offline</h4>
                  <p className="text-[10px] text-slate-550 max-w-xs leading-relaxed">Mount tablet at entrance and click 'Start Kiosk Scanner' to begin real-time automatic logging.</p>
                </div>
              )}

              {/* HUD guides */}
              {cameraActive && (
                <>
                  <div className="absolute inset-0 rounded-full border-2 border-dashed border-indigo-500/10 animate-[spin_60s_linear_infinite]" />
                  <div className="absolute inset-4 rounded-full border border-indigo-500/10" />
                  <div className="absolute top-4 inset-x-0 flex flex-col items-center gap-1.5 z-20">
                    {isFlashActive && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 border border-amber-500/35 text-amber-400 rounded-full text-[9px] font-black uppercase tracking-wider animate-pulse shadow-md">
                        <AlertTriangle className="h-3 w-3 text-amber-400 animate-[bounce_1s_infinite]" /> Light Assist Active
                      </div>
                    )}
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/15 border border-indigo-500/25 text-indigo-400 rounded-full text-[9px] font-black uppercase tracking-wider animate-pulse">
                      <div className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-ping" /> Scanning active
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Float HUD card for last matched employee */}
            {lastMatch && (
              <div className="absolute -bottom-6 bg-slate-900 border border-slate-800 rounded-2xl p-3 shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-6 duration-300 max-w-xs w-full">
                <Avatar className="h-9 w-9 shrink-0 border border-indigo-500/20">
                  <AvatarFallback className="bg-indigo-650 text-white font-bold text-xs uppercase">
                    {lastMatch.fullName.slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-black text-slate-200 truncate">{lastMatch.fullName}</div>
                  <div className="flex items-center gap-1.5 text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                    <Clock className="h-3 w-3 text-indigo-500" /> 
                    <span>{lastMatch.action.replace("-", " ")}: {lastMatch.time}</span>
                  </div>
                </div>
                <div className="bg-emerald-500/10 text-emerald-400 rounded-full p-1 border border-emerald-500/20">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              </div>
            )}
          </div>

          {/* SCANNER CONTROLLER BOTTOM ACTIONS */}
          <div className="w-full max-w-md space-y-4">
            <div className="text-xs text-slate-400 font-semibold bg-slate-900/60 border border-slate-800/80 px-4 py-3 rounded-2xl min-h-[48px] flex items-center justify-center text-center">
              {instruction}
            </div>

            <div className="flex gap-3">
              {cameraActive ? (
                <Button 
                  onClick={stopCamera} 
                  className="w-full h-11 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs shadow-md shadow-rose-900/20 flex items-center justify-center gap-2"
                >
                  <Square className="h-3.5 w-3.5 fill-current" /> Stop Kiosk Scanner
                </Button>
              ) : (
                <Button 
                  onClick={startCamera} 
                  disabled={!modelsLoaded || employees.length === 0}
                  className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-850 disabled:text-slate-650 disabled:border-slate-800 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-900/20 flex items-center justify-center gap-2"
                >
                  <Play className="h-3.5 w-3.5 fill-current" /> Start Kiosk Scanner
                </Button>
              )}
            </div>
            
            {loadingError && (
              <div className="p-3 bg-rose-950/20 border border-rose-900/30 text-rose-400 text-[10px] font-bold rounded-xl flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>Engine Error: {loadingError}</span>
              </div>
            )}
          </div>

        </div>

        {/* RIGHT COLUMN: REAL-TIME LOGS TIMELINE */}
        <div className={`lg:col-span-4 flex flex-col overflow-hidden h-full border-l transition-colors duration-500 ${themeClasses.sidebar} ${themeClasses.border}`}>
          
          <div className="p-5 border-b border-slate-900 bg-slate-900/40">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5 leading-none">
              <History className="h-4 w-4 text-indigo-500" /> Kiosk Authentication Log
            </h3>
            <span className="text-[10px] text-slate-500 block font-medium mt-1">Live ticker of verified entries today</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
            {logsToday.map((log) => {
              const isCheckIn = log.action === "check-in";
              return (
                <div 
                  key={log.id} 
                  className={`p-3 rounded-2xl flex items-center justify-between gap-3 border transition-colors duration-500 ${themeClasses.card} shadow-xs animate-in slide-in-from-right-4 duration-300`}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8.5 w-8.5 border border-slate-800">
                      <AvatarFallback className="bg-slate-800 text-slate-350 text-xs font-bold uppercase">
                        {log.fullName.slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="text-xs font-bold text-slate-200">{log.fullName}</div>
                      <div className="text-[9px] font-semibold text-slate-500 font-mono mt-0.5">ID: {log.userId.slice(-8)}</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <Badge className={`text-[9px] font-black uppercase tracking-wider rounded-md py-0.5 px-2 ${
                      isCheckIn 
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                        : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                    }`}>
                      {log.action}
                    </Badge>
                    <div className="text-[10px] text-slate-450 font-bold font-mono mt-1">{log.timestamp}</div>
                  </div>
                </div>
              );
            })}
            
            {logsToday.length === 0 && (
              <div className="h-48 flex flex-col items-center justify-center p-6 text-center gap-2">
                <Clock className="h-7 w-7 text-slate-700" />
                <h5 className="text-xs font-bold text-slate-500 mt-1">Timeline Empty</h5>
                <p className="text-[9px] text-slate-600 max-w-[200px] leading-relaxed">No biometric checkins logged today on this kiosk.</p>
              </div>
            )}
          </div>

        </div>

      </main>

      {/* 3. SLIDE-OUT DRAWER MANUAL OVERRIDE OVERLAY */}
      {isDrawerOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[999] flex justify-end animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl relative animate-in slide-in-from-right-12 duration-300">
            
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="font-black text-slate-100 flex items-center gap-1.5">
                  <Users className="h-4.5 w-4.5 text-indigo-400" /> Manual Override Kiosk
                </h4>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">Clock-in employees on sensor bypass</p>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => { playKioskSound("click"); setIsDrawerOpen(false); }}
                className="h-8 w-8 text-slate-400 hover:text-white rounded-full bg-slate-800/40 hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Drawer Search */}
            <div className="p-4 border-b border-slate-800 bg-slate-950/20">
              <div className="relative flex items-center">
                <Search className="absolute left-3.5 text-slate-500 h-4 w-4" />
                <Input
                  placeholder="Search employee by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-slate-950 border-slate-800 text-xs text-slate-200 focus-visible:ring-indigo-500 rounded-xl"
                />
              </div>
            </div>

            {/* Drawer Body Search Results */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {filteredEmployees.map((emp) => (
                <div 
                  key={emp.userId} 
                  className="p-3 bg-slate-950/40 border border-slate-850 rounded-2xl flex flex-col gap-3.5"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8.5 w-8.5 border border-slate-800">
                      <AvatarFallback className="bg-slate-855 text-slate-400 text-xs font-bold uppercase">
                        {emp.fullName.slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-200 truncate">{emp.fullName}</div>
                      <div className="text-[10px] text-slate-500 truncate mt-0.5">{emp.email}</div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 pt-1">
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        onClick={() => handleAttendanceTransaction(emp, true, "check-in")}
                        className="flex-1 h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg gap-1"
                      >
                        <UserCheck className="h-3 w-3" /> Force Check-In
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleAttendanceTransaction(emp, true, "check-out")}
                        className="flex-1 h-8 border-slate-800 hover:bg-slate-850 text-slate-350 text-[10px] font-bold rounded-lg gap-1"
                      >
                        Force Check-Out
                      </Button>
                    </div>
                    <Button 
                      size="sm" 
                      onClick={() => startRegistration(emp.userId)}
                      className="w-full h-8 bg-indigo-650 hover:bg-indigo-700 text-white text-[10px] font-bold rounded-lg gap-1.5 border border-indigo-600"
                    >
                      <Camera className="h-3.5 w-3.5 text-indigo-300 animate-pulse" /> Enroll / Update Face Biometrics
                    </Button>
                  </div>
                </div>
              ))}

              {filteredEmployees.length === 0 && (
                <div className="h-64 flex flex-col items-center justify-center p-6 text-center gap-2">
                  <Search className="h-8 w-8 text-slate-700" />
                  <h5 className="text-xs font-bold text-slate-500 mt-1">No Employees Found</h5>
                  <p className="text-[10px] text-slate-650 max-w-[200px] leading-relaxed">No registered biometric profile matched query: "{searchQuery}".</p>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* 4. SLIDE-OUT DRAWER FOR WHITE-LABEL SETTINGS */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[999] flex justify-end animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl relative animate-in slide-in-from-right-12 duration-300">
            
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="font-black text-slate-100 flex items-center gap-1.5">
                  <Settings className="h-4.5 w-4.5 text-indigo-400" /> Kiosk Accent & Branding
                </h4>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">Configure kiosk styles, logos, and TTS voices</p>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => { playKioskSound("click"); setIsSettingsOpen(false); }}
                className="h-8 w-8 text-slate-400 hover:text-white rounded-full bg-slate-800/40 hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Drawer Body - Settings Form */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              
              {/* Kiosk Name */}
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">Kiosk Instance Name</label>
                <Input
                  value={settingsName}
                  onChange={(e) => setSettingsName(e.target.value)}
                  placeholder="e.g. Main Lobby Gate"
                  className="bg-slate-950 border-slate-800 text-xs text-slate-200 focus-visible:ring-indigo-500 rounded-xl"
                />
                <span className="text-[9px] text-slate-500 block">Identifies this terminal in database logs.</span>
              </div>

              {/* Logo URL */}
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-slate-455 tracking-wider">Custom Brand Logo URL</label>
                <Input
                  value={settingsLogo}
                  onChange={(e) => setSettingsLogo(e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className="bg-slate-950 border-slate-800 text-xs text-slate-200 focus-visible:ring-indigo-500 rounded-xl"
                />
                <span className="text-[9px] text-slate-550 block">Displays on the kiosk header. Leave blank for fallback.</span>
              </div>

              {/* Accent Color / Theme */}
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">Color Theme Accent</label>
                <select 
                  value={settingsTheme} 
                  onChange={(e) => setSettingsTheme(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="obsidian" className="bg-slate-900 text-slate-250">Obsidian Deep (High Contrast Dark)</option>
                  <option value="indigo" className="bg-slate-900 text-slate-250">Midnight Indigo (Premium Purples)</option>
                  <option value="slate" className="bg-slate-900 text-slate-250">Steel Grey (Industrial Minimalist)</option>
                </select>
                <span className="text-[9px] text-slate-500 block">Switches the overall glassmorphic accent coloring across the kiosk.</span>
              </div>

              {/* Text-To-Speech Voice Select */}
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">Speech Accent Voice</label>
                <select 
                  value={settingsVoice} 
                  onChange={(e) => setSettingsVoice(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="" className="bg-slate-900 text-slate-250">System Voice Default</option>
                  {systemVoices.map(voice => (
                    <option key={voice.name} value={voice.name} className="bg-slate-900 text-slate-250">
                      {voice.name} ({voice.lang})
                    </option>
                  ))}
                  {systemVoices.length === 0 && (
                    <option value="default" disabled className="bg-slate-900 text-slate-250">No English voices found in browser</option>
                  )}
                </select>
                <span className="text-[9px] text-slate-550 block">Select the voice model synthesizer for announcements.</span>
              </div>

              {/* Minimum checkout wait duration in hours */}
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">Checkout Lock Cooldown Buffer</label>
                <select 
                  value={settingsWait.toString()} 
                  onChange={(e) => setSettingsWait(Number(e.target.value))}
                  className="w-full h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="0.01" className="bg-slate-900 text-slate-250">No wait delay (Instant toggle)</option>
                  <option value="0.5" className="bg-slate-900 text-slate-250">30 Minutes Wait</option>
                  <option value="1" className="bg-slate-900 text-slate-250">1 Hour Wait (Default standard shift)</option>
                  <option value="2" className="bg-slate-900 text-slate-250">2 Hours Wait</option>
                  <option value="4" className="bg-slate-900 text-slate-250">4 Hours Wait</option>
                  <option value="8" className="bg-slate-900 text-slate-250">8 Hours Wait (Full Shift)</option>
                </select>
                <span className="text-[9px] text-slate-500 block">Restricts immediate checkout toggling when employees pass by the sensor camera.</span>
              </div>

              {/* Ambient Lighting Assist select input */}
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">Ambient Lighting Assist</label>
                <select 
                  value={settingsFlashMode} 
                  onChange={(e) => setSettingsFlashMode(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="auto" className="bg-slate-900 text-slate-250">Auto-Detect (Screen Flash on Dim Lobby)</option>
                  <option value="always-on" className="bg-slate-900 text-slate-250">Always Active (Continuous Entrance Lighting)</option>
                  <option value="always-off" className="bg-slate-900 text-slate-250">Disabled (Always Off)</option>
                </select>
                <span className="text-[9px] text-slate-500 block">Triggers a virtual ring-light halo around viewport in low-light environments to boost face-auth speed.</span>
              </div>

            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex gap-3">
              <Button 
                variant="outline" 
                onClick={() => { playKioskSound("click"); setIsSettingsOpen(false); }}
                className="flex-1 h-10 border-slate-800 text-slate-350 hover:bg-slate-850 text-xs font-bold rounded-xl"
              >
                Cancel
              </Button>
              <Button 
                onClick={() => saveSettings(settingsName, settingsLogo, settingsVoice, settingsTheme, settingsWait, settingsFlashMode)}
                className="flex-1 h-10 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-900/10"
              >
                Save branding
              </Button>
            </div>

          </div>
        </div>
      )}

      {isRegistering && registeringUserId && (
        <div className="relative">
          <FaceRegistrationModal
            userId={registeringUserId}
            onSuccess={handleRegistrationSuccess}
          />
          <div className="fixed top-6 right-6 z-[100000]">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRegistrationCancel}
              className="h-10 w-10 text-white rounded-full bg-slate-950/80 hover:bg-slate-800 border border-slate-700 shadow-2xl"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
      )}

    </div>
  );
}
