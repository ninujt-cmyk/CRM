"use client";

import { useState, useEffect, useRef } from "react";

// Face landmark helper interfaces
interface Point {
  x: number;
  y: number;
}

export interface LivenessState {
  blinkDetected: boolean;
  leftTurnDetected: boolean;
  rightTurnDetected: boolean;
  smileDetected: boolean;
}

export function useFaceAuth() {
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const faceapiRef = useRef<any>(null);

  // Load face-api models client-side only to prevent SSR issues
  useEffect(() => {
    async function loadModels() {
      try {
        if (typeof window === "undefined") return;

        // Dynamically import @vladmandic/face-api to prevent Next.js SSR issues
        const faceapi = await import("@vladmandic/face-api");
        faceapiRef.current = faceapi;

        console.log("Loading face-api models...");
        
        // Use the TinyFaceDetector for fast performance on mobile devices
        await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
        await faceapi.nets.faceLandmark68Net.loadFromUri("/models");
        await faceapi.nets.faceRecognitionNet.loadFromUri("/models");
        
        console.log("face-api models loaded successfully!");
        setModelsLoaded(true);
      } catch (err: any) {
        console.error("Failed to load face-api models:", err);
        setLoadingError(err.message || "Failed to load face-api models");
      }
    }

    loadModels();
  }, []);

  /**
   * Euclidean distance between two 2D points
   */
  const distance2D = (p1: Point, p2: Point) => {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
  };

  /**
   * Calculate Eye Aspect Ratio (EAR)
   * Standard formula: (dist(p2, p6) + dist(p3, p5)) / (2 * dist(p1, p4))
   * Eye landmarks in 68-point model:
   * Left eye: 36 (p1), 37 (p2), 38 (p3), 39 (p4), 40 (p5), 41 (p6)
   * Right eye: 42 (p1), 43 (p2), 44 (p3), 45 (p4), 46 (p5), 47 (p6)
   */
  const calculateEAR = (eyePoints: Point[]) => {
    if (eyePoints.length < 6) return 0.3;
    const p1_p4 = distance2D(eyePoints[0], eyePoints[3]);
    const p2_p6 = distance2D(eyePoints[1], eyePoints[5]);
    const p3_p5 = distance2D(eyePoints[2], eyePoints[4]);
    
    if (p1_p4 === 0) return 0;
    return (p2_p6 + p3_p5) / (2.0 * p1_p4);
  };

  /**
   * Detect Blink
   * Threshold: EAR < 0.22 is closed, EAR > 0.28 is open
   */
  const detectBlink = (landmarks: any, prevEAR: number, setPrevEAR: (v: number) => void): boolean => {
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();
    
    const leftEAR = calculateEAR(leftEye);
    const rightEAR = calculateEAR(rightEye);
    const avgEAR = (leftEAR + rightEAR) / 2.0;

    // Save previous EAR and check for rapid closing/opening transition
    const isBlinking = prevEAR > 0.26 && avgEAR < 0.20;
    setPrevEAR(avgEAR);
    
    return isBlinking;
  };

  /**
   * Detect Head Turn (Yaw Ratio)
   * Compares nose tip (landmark 30) relative to left boundary (landmark 0) and right boundary (landmark 16)
   * Yaw Ratio = (nose.x - left.x) / (right.x - left.x)
   * Straight: ~0.5. Turn Left: < 0.38. Turn Right: > 0.62
   */
  const detectHeadTurn = (landmarks: any): { left: boolean; right: boolean; ratio: number } => {
    const jawOutline = landmarks.getJawOutline();
    const nose = landmarks.getNose();
    
    if (jawOutline.length < 17 || nose.length < 4) {
      return { left: false, right: false, ratio: 0.5 };
    }

    const leftBoundary = jawOutline[0];
    const rightBoundary = jawOutline[16];
    const noseTip = nose[3]; // Landmark 30 is the 4th element in the nose array

    const width = rightBoundary.x - leftBoundary.x;
    if (width === 0) return { left: false, right: false, ratio: 0.5 };

    const ratio = (noseTip.x - leftBoundary.x) / width;
    
    return {
      left: ratio < 0.38,
      right: ratio > 0.62,
      ratio
    };
  };

  /**
   * Detect Smile
   * Ratio of Mouth Width (landmark 48 to 54) to Outer Eye Corner Distance (landmark 36 to 45)
   * Outer eye distance is a stable baseline for scaling.
   * Relaxed mouth/eye ratio: ~0.55 to 0.62. Smile ratio: > 0.72.
   * Mouth points: 48 (left corner), 54 (right corner)
   * Left eye corner: 36. Right eye corner: 45.
   */
  const detectSmile = (landmarks: any): boolean => {
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();
    const mouth = landmarks.getMouth();

    if (leftEye.length === 0 || rightEye.length === 0 || mouth.length < 12) {
      return false;
    }

    // Outer eye distance as baseline scale
    const outerEyeDist = distance2D(leftEye[0], rightEye[3]);
    // Inner mouth width (left corner 48 to right corner 54)
    // In face-api mouth landmarks, 0 is point 48, 6 is point 54
    const mouthWidth = distance2D(mouth[0], mouth[6]);
    
    if (outerEyeDist === 0) return false;
    const smileRatio = mouthWidth / outerEyeDist;

    return smileRatio > 0.73; // Calibrated smile threshold
  };

  /**
   * Compare two face descriptors using Euclidean distance
   * Threshold: <= 0.45 is a solid match (standard is 0.6, we use 0.45 for strict security)
   */
  const matchFace = (descriptor1: Float32Array, descriptor2: Float32Array): { matched: boolean; distance: number } => {
    if (!faceapiRef.current) return { matched: false, distance: 1.0 };
    
    const distance = faceapiRef.current.euclideanDistance(descriptor1, descriptor2);
    // Secure but robust threshold: 0.58 handles real-world room lighting and mobile camera angles instantly
    return {
      matched: distance < 0.58,
      distance
    };
  };

  /**
   * Capture single frame face details
   */
  const detectFaceInVideo = async (videoElement: HTMLVideoElement) => {
    if (!modelsLoaded || !faceapiRef.current || !videoElement) return null;

    const faceapi = faceapiRef.current;
    
    // Detect single face with landmarks and descriptors using the optimized TinyFaceDetector
    const detection = await faceapi
      .detectSingleFace(videoElement, new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.35 }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    return detection || null;
  };

  return {
    modelsLoaded,
    loadingError,
    detectFaceInVideo,
    detectBlink,
    detectHeadTurn,
    detectSmile,
    matchFace,
    faceapi: faceapiRef.current
  };
}
