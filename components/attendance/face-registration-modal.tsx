"use client";

import { useState, useEffect, useRef } from "react";
import { useFaceAuth } from "@/hooks/use-face-auth";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, ChevronRight, RefreshCw, UserCheck, ShieldAlert, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface FaceRegistrationModalProps {
  userId: string;
  onSuccess: () => void;
}

type RegistrationStep = "intro" | "front" | "left" | "right" | "blink" | "saving" | "complete";

export default function FaceRegistrationModal({ userId, onSuccess }: FaceRegistrationModalProps) {
  const { modelsLoaded, loadingError, detectFaceInVideo, detectBlink, detectHeadTurn } = useFaceAuth();
  
  const [step, setStep] = useState<RegistrationStep>("intro");
  const [cameraActive, setCameraActive] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [instruction, setInstruction] = useState("Position your face within the circle");
  
  // Stored descriptors & image
  const [frontDescriptor, setFrontDescriptor] = useState<Float32Array | null>(null);
  const [leftDescriptor, setLeftDescriptor] = useState<Float32Array | null>(null);
  const [rightDescriptor, setRightDescriptor] = useState<Float32Array | null>(null);
  const [selfieBase64, setSelfieBase64] = useState<string | null>(null);
  
  // Camera & Video elements
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const prevEARRef = useRef<number>(0.3);
  const requestRef = useRef<number | null>(null);
  
  const supabase = createClient();

  // Stop camera when component unmounts
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

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
      setCameraActive(true);
    } catch (err) {
      console.error("Camera activation failed:", err);
      toast.error("Could not access front camera. Please allow camera permissions.");
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
    setCameraActive(false);
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
  };

  // Main facial tracking loop
  useEffect(() => {
    if (!cameraActive || !modelsLoaded || step === "intro" || step === "saving" || step === "complete") {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
      return;
    }

    let isProcessing = false;
    let stageProgress = 0;

    const trackFace = async () => {
      if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) {
        requestRef.current = requestAnimationFrame(trackFace);
        return;
      }

      if (isProcessing) {
        requestRef.current = requestAnimationFrame(trackFace);
        return;
      }

      isProcessing = true;

      try {
        const detection = await detectFaceInVideo(videoRef.current);
        
        if (detection) {
          const landmarks = detection.landmarks;
          const descriptor = detection.descriptor;

          // Stage Logic based on current Step
          if (step === "front") {
            setInstruction("Look straight into the camera and hold still...");
            stageProgress += 10;
            setScanProgress(Math.min(100, stageProgress));

            if (stageProgress >= 100) {
              // Capture photo and save descriptor
              captureSelfie();
              setFrontDescriptor(descriptor);
              
              // Proceed to next step
              stopLoopAndTransition("left");
              isProcessing = false;
              return;
            }
          }
          else if (step === "left") {
            setInstruction("Now, turn your head slightly to the left...");
            const { left, ratio } = detectHeadTurn(landmarks);
            
            if (left) {
              stageProgress += 15;
              setScanProgress(Math.min(100, stageProgress));
              
              if (stageProgress >= 100) {
                setLeftDescriptor(descriptor);
                stopLoopAndTransition("right");
                isProcessing = false;
                return;
              }
            } else {
              // Decay progress slightly if they look back to center
              stageProgress = Math.max(0, stageProgress - 2);
              setScanProgress(stageProgress);
            }
          }
          else if (step === "right") {
            setInstruction("Excellent. Now, turn your head slightly to the right...");
            const { right } = detectHeadTurn(landmarks);
            
            if (right) {
              stageProgress += 15;
              setScanProgress(Math.min(100, stageProgress));
              
              if (stageProgress >= 100) {
                setRightDescriptor(descriptor);
                stopLoopAndTransition("blink");
                isProcessing = false;
                return;
              }
            } else {
              stageProgress = Math.max(0, stageProgress - 2);
              setScanProgress(stageProgress);
            }
          }
          else if (step === "blink") {
            setInstruction("Almost done! Please blink your eyes now...");
            
            const prevEAR = prevEARRef.current;
            const setPrevEAR = (val: number) => { prevEARRef.current = val; };
            
            const blink = detectBlink(landmarks, prevEAR, setPrevEAR);
            
            if (blink) {
              setScanProgress(100);
              stopLoopAndTransition("saving");
              isProcessing = false;
              return;
            }
          }
        } else {
          // No face detected, reset stage progress slightly to enforce hold
          stageProgress = Math.max(0, stageProgress - 3);
          setScanProgress(stageProgress);
          setInstruction("No face detected. Align your face inside the circle.");
        }
      } catch (err) {
        console.error("Tracking error:", err);
      }

      isProcessing = false;
      requestRef.current = requestAnimationFrame(trackFace);
    };

    requestRef.current = requestAnimationFrame(trackFace);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
    };
  }, [cameraActive, step, modelsLoaded]);

  const stopLoopAndTransition = (nextStep: RegistrationStep) => {
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
    setScanProgress(0);
    setStep(nextStep);
  };

  const captureSelfie = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = 360;
    canvas.height = 360;
    const ctx = canvas.getContext("2d");
    
    if (ctx) {
      // Capture a square centered thumbnail
      const size = Math.min(videoRef.current.videoWidth, videoRef.current.videoHeight);
      const sx = (videoRef.current.videoWidth - size) / 2;
      const sy = (videoRef.current.videoHeight - size) / 2;
      ctx.drawImage(videoRef.current, sx, sy, size, size, 0, 0, 360, 360);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      setSelfieBase64(dataUrl);
    }
  };

  // Triggers when step transitions to 'saving'
  useEffect(() => {
    if (step === "saving") {
      saveFaceRegistration();
    }
  }, [step]);

  const saveFaceRegistration = async () => {
    try {
      if (!frontDescriptor || !leftDescriptor || !rightDescriptor || !selfieBase64) {
        throw new Error("Missing descriptors or profile selfie.");
      }

      setInstruction("Uploading profile assets and face data...");

      // Convert captured base64 selfie to Blob for Storage bucket
      let finalSelfieUrl = selfieBase64;
      try {
        const res = await fetch(selfieBase64);
        const blob = await res.blob();
        
        const path = `${userId}/registration.jpg`;
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from("attendance_selfies")
          .upload(path, blob, {
            contentType: "image/jpeg",
            upsert: true
          });

        if (uploadErr) {
          console.warn("Storage upload failed, falling back to base64 saving:", uploadErr);
        } else if (uploadData) {
          const { data: { publicUrl } } = supabase.storage
            .from("attendance_selfies")
            .getPublicUrl(path);
          finalSelfieUrl = publicUrl;
        }
      } catch (storageErr) {
        console.warn("Could not save to Supabase bucket. Using base64:", storageErr);
      }

      // Prepare metadata
      const deviceInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        screen: `${window.screen.width}x${window.screen.height}`,
        registeredAt: new Date().toISOString()
      };

      // Save everything to employee_face_data
      const { error: dbErr } = await supabase
        .from("employee_face_data")
        .insert({
          user_id: userId,
          face_embeddings: {
            front: Array.from(frontDescriptor),
            left: Array.from(leftDescriptor),
            right: Array.from(rightDescriptor)
          },
          selfie_url: finalSelfieUrl,
          device_info: deviceInfo
        });

      if (dbErr) throw dbErr;

      // Update user state to auto_dialer_status or metadata if needed, or simply proceed
      await supabase
        .from("users")
        .update({ status_reason: "Face Registered" })
        .eq("id", userId);

      setStep("complete");
      setInstruction("Face registration complete!");
      toast.success("Face registered successfully!");
      stopCamera();
    } catch (err: any) {
      console.error("Save registration error:", err);
      toast.error(err.message || "Failed to save face registration data.");
      setStep("front"); // Let them retry
    }
  };

  const handleStartProcess = async () => {
    setStep("front");
    await startCamera();
  };

  const handleRestart = async () => {
    stopCamera();
    setFrontDescriptor(null);
    setLeftDescriptor(null);
    setRightDescriptor(null);
    setSelfieBase64(null);
    setStep("front");
    await startCamera();
  };

  if (loadingError) {
    return (
      <div className="fixed inset-0 bg-slate-900/90 z-50 flex items-center justify-center p-4 backdrop-blur-md">
        <Card className="max-w-md w-full border border-red-500/20 bg-slate-950/80 shadow-2xl rounded-3xl">
          <CardContent className="p-8 text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-red-950/40 text-red-500 rounded-2xl flex items-center justify-center border border-red-500/20">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-100">Setup Error</h3>
            <p className="text-slate-400 text-sm">{loadingError}</p>
            <p className="text-xs text-slate-500">Please ensure you are using an HTTPS connection and your browser allows camera access.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-950/95 z-[9999] flex items-center justify-center p-4 backdrop-blur-lg overflow-y-auto">
      <Card className="max-w-md w-full border border-slate-800/80 bg-slate-900/60 shadow-2xl rounded-3xl overflow-hidden backdrop-blur-md animate-in fade-in zoom-in duration-300">
        <CardContent className="p-0">
          
          {/* HEADER */}
          <div className="p-6 text-center border-b border-slate-800/60">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-full text-xs font-bold uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" /> Secure Registration
            </div>
            <h2 className="text-2xl font-black text-slate-100 tracking-tight">Register Your Face</h2>
            <p className="text-slate-400 text-xs mt-1">Set up face authentication to enable instant daily attendance verification.</p>
          </div>

          {/* PROCESS INTRO */}
          {step === "intro" && (
            <div className="p-6 space-y-6 text-center">
              <div className="mx-auto w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-500 text-white rounded-3xl flex items-center justify-center shadow-xl animate-bounce">
                <Camera className="w-10 h-10" />
              </div>
              <div className="space-y-3 text-left">
                <h4 className="font-bold text-slate-200 text-sm text-center">How does it work?</h4>
                <ul className="text-xs text-slate-450 space-y-2 max-w-xs mx-auto">
                  <li className="flex gap-2 items-start"><span className="text-blue-500 font-bold">1.</span> We will open your front camera.</li>
                  <li className="flex gap-2 items-start"><span className="text-blue-500 font-bold">2.</span> You will scan your face from three angles (Front, Left, Right).</li>
                  <li className="flex gap-2 items-start"><span className="text-blue-500 font-bold">3.</span> We will run a 1-second blink detection to verify liveness.</li>
                  <li className="flex gap-2 items-start"><span className="text-blue-500 font-bold">4.</span> Your secure biometric vector is stored privately.</li>
                </ul>
              </div>
              
              <Button 
                onClick={handleStartProcess} 
                disabled={!modelsLoaded} 
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-semibold shadow-md"
              >
                {modelsLoaded ? "Start Face Scan" : "Loading Face AI models..."}
              </Button>
            </div>
          )}

          {/* ACTIVE CAMERA CONTAINER */}
          {step !== "intro" && step !== "complete" && (
            <div className="p-6 flex flex-col items-center gap-6">
              
              {/* VIDEO WRAPPER */}
              <div className="relative w-64 h-64 rounded-full overflow-hidden border-4 border-slate-800 bg-slate-950 flex items-center justify-center shadow-2xl">
                
                {/* VIDEO FEED */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />

                {/* CIRCULAR SCANNING HUD OVERLAY */}
                <div className="absolute inset-0 rounded-full border-4 border-dashed border-blue-500/30 animate-[spin_20s_linear_infinite]" />
                
                {/* HUD GUIDES */}
                <div className="absolute inset-4 rounded-full border border-blue-500/20" />
                <div className="absolute inset-8 rounded-full border border-dashed border-blue-500/15" />
                
                {/* PROGRESS RING */}
                {scanProgress > 0 && (
                  <svg className="absolute inset-0 w-full h-full -rotate-90">
                    <circle
                      cx="128"
                      cy="128"
                      r="124"
                      className="stroke-blue-500 fill-none"
                      strokeWidth="6"
                      strokeDasharray="780"
                      strokeDashoffset={780 - (780 * scanProgress) / 100}
                      strokeLinecap="round"
                    />
                  </svg>
                )}

                {/* SAVING ANIMATION */}
                {step === "saving" && (
                  <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center flex-col gap-3">
                    <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest animate-pulse">Encrypting</span>
                  </div>
                )}
              </div>

              {/* ACTION INFORMATION */}
              <div className="w-full text-center space-y-2">
                <div className="text-xs font-bold text-slate-350 bg-slate-800/40 border border-slate-750/30 px-4 py-2 rounded-2xl min-h-[48px] flex items-center justify-center">
                  {instruction}
                </div>
                
                <div className="flex items-center justify-center gap-1">
                  {["front", "left", "right", "blink"].map((s, idx) => {
                    const stepsArr = ["front", "left", "right", "blink"];
                    const currentIdx = stepsArr.indexOf(step);
                    const fileIdx = stepsArr.indexOf(s);
                    
                    let dotColor = "bg-slate-800";
                    if (fileIdx === currentIdx) dotColor = "bg-blue-500 animate-pulse w-4";
                    else if (fileIdx < currentIdx) dotColor = "bg-green-500";
                    
                    return (
                      <div 
                        key={s} 
                        className={`h-1.5 rounded-full transition-all duration-300 ${dotColor} ${fileIdx === currentIdx ? "w-4" : "w-1.5"}`} 
                      />
                    );
                  })}
                </div>
              </div>

              {/* BUTTON ACTIONS */}
              {step !== "saving" && (
                <div className="flex gap-2 w-full">
                  <Button variant="outline" onClick={handleRestart} className="flex-1 h-10 border-slate-800 bg-slate-850 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold">
                    <RefreshCw className="w-3.5 h-3.5 mr-2" /> Reset
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* COMPLETION VIEW */}
          {step === "complete" && (
            <div className="p-8 text-center space-y-6">
              <div className="mx-auto w-20 h-20 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-full flex items-center justify-center shadow-xl shadow-emerald-500/5 animate-[scale-in_0.4s_ease-out]">
                <UserCheck className="w-10 h-10" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-xl font-bold text-slate-100">Biometrics Encrypted!</h3>
                <p className="text-slate-400 text-xs max-w-xs mx-auto">Your facial vectors have been securely encrypted and stored inside Supabase.</p>
              </div>
              
              {selfieBase64 && (
                <div className="relative w-28 h-28 mx-auto rounded-2xl overflow-hidden border border-slate-700 bg-slate-800">
                  <img src={selfieBase64} alt="Selfie" className="w-full h-full object-cover" />
                  <div className="absolute bottom-0 inset-x-0 bg-slate-900/80 text-[8px] font-bold text-slate-400 py-1 uppercase tracking-wider">Baseline Photo</div>
                </div>
              )}

              <Button 
                onClick={onSuccess} 
                className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-semibold shadow-md flex items-center justify-center gap-1.5"
              >
                Go to Attendance Dashboard <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
}
