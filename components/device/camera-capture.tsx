"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Camera, RotateCcw, X, Check } from "lucide-react"
import { cameraManager, type CapturedImage } from "@/lib/device/camera"
import { toast } from "sonner"

interface CameraCaptureProps {
  onCapture: (image: CapturedImage) => void
  onCancel: () => void
  facingMode?: "user" | "environment"
}

export function CameraCapture({ onCapture, onCancel, facingMode = "environment" }: CameraCaptureProps) {
  const [isActive, setIsActive] = useState(false)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    startCamera()

    return () => {
      cameraManager.stopCamera()
    }
  }, [])

  const startCamera = async () => {
    try {
      const hasPermission = await cameraManager.requestPermission()
      if (!hasPermission) {
        toast.error("Camera permission denied")
        onCancel()
        return
      }

      if (videoRef.current) {
        await cameraManager.startCamera(videoRef.current, { facingMode })
        setIsActive(true)
      }
    } catch (error) {
      console.error("Failed to start camera:", error)
      toast.error("Failed to access camera")
      onCancel()
    }
  }

  const handleCapture = async () => {
    if (!isActive) return

    setIsCapturing(true)
    try {
      const image = await cameraManager.capturePhoto({ quality: 0.8 })
      setCapturedImage(image.dataUrl)
    } catch (error) {
      console.error("Failed to capture photo:", error)
      toast.error("Failed to capture photo")
    } finally {
      setIsCapturing(false)
    }
  }

  const handleConfirm = async () => {
    if (!capturedImage) return

    try {
      const image = await cameraManager.capturePhoto({ quality: 0.8 })
      onCapture(image)
    } catch (error) {
      console.error("Failed to get captured image:", error)
      toast.error("Failed to process image")
    }
  }

  const handleRetake = () => {
    setCapturedImage(null)
  }

  const handleSwitchCamera = async () => {
    try {
      await cameraManager.switchCamera()
    } catch (error) {
      console.error("Failed to switch camera:", error)
      toast.error("Failed to switch camera")
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <div className="relative h-full flex flex-col">
        {/* Camera View */}
        <div className="flex-1 relative overflow-hidden">
          {capturedImage ? (
            <img src={capturedImage || "/placeholder.svg"} alt="Captured" className="w-full h-full object-cover" />
          ) : (
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />
          )}

          {/* Top Controls */}
          <div className="absolute top-4 left-4 right-4 flex justify-between items-center">
            <Button variant="ghost" size="sm" onClick={onCancel} className="text-white bg-black/50 hover:bg-black/70">
              <X className="h-5 w-5" />
            </Button>

            {!capturedImage && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSwitchCamera}
                className="text-white bg-black/50 hover:bg-black/70"
              >
                <RotateCcw className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>

        {/* Bottom Controls */}
        <div className="p-6 bg-black">
          {capturedImage ? (
            <div className="flex justify-center gap-4">
              <Button
                variant="outline"
                onClick={handleRetake}
                className="flex-1 bg-transparent text-white border-white"
              >
                Retake
              </Button>
              <Button onClick={handleConfirm} className="flex-1">
                <Check className="h-4 w-4 mr-2" />
                Use Photo
              </Button>
            </div>
          ) : (
            <div className="flex justify-center">
              <Button
                size="lg"
                onClick={handleCapture}
                disabled={!isActive || isCapturing}
                className="h-16 w-16 rounded-full bg-white text-black hover:bg-gray-200"
              >
                <Camera className="h-6 w-6" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
