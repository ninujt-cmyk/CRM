"use client"

export interface CameraOptions {
  facingMode?: "user" | "environment"
  width?: number
  height?: number
  quality?: number
}

export interface CapturedImage {
  dataUrl: string
  blob: Blob
  file: File
}

export class CameraManager {
  private stream: MediaStream | null = null
  private video: HTMLVideoElement | null = null
  private canvas: HTMLCanvasElement | null = null

  isAvailable(): Promise<boolean> {
    return CameraManager.isAvailable()
  }

  async requestPermission(): Promise<boolean> {
    try {
      const result = await navigator.permissions.query({ name: "camera" as PermissionName })
      return result.state === "granted"
    } catch {
      // Fallback: try to access camera directly
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        stream.getTracks().forEach((track) => track.stop())
        return true
      } catch {
        return false
      }
    }
  }

  async startCamera(videoElement: HTMLVideoElement, options: CameraOptions = {}): Promise<void> {
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: options.facingMode || "environment",
          width: options.width || 1280,
          height: options.height || 720,
        },
      }

      this.stream = await navigator.mediaDevices.getUserMedia(constraints)
      this.video = videoElement

      videoElement.srcObject = this.stream
      await videoElement.play()
    } catch (error) {
      console.error("Failed to start camera:", error)
      throw new Error("Camera access denied or not available")
    }
  }

  async capturePhoto(options: CameraOptions = {}): Promise<CapturedImage> {
    if (!this.video || !this.stream) {
      throw new Error("Camera not started")
    }

    // Create canvas if not exists
    if (!this.canvas) {
      this.canvas = document.createElement("canvas")
    }

    const canvas = this.canvas
    const video = this.video
    const context = canvas.getContext("2d")!

    // Set canvas dimensions
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Convert to blob and data URL
    const dataUrl = canvas.toDataURL("image/jpeg", options.quality || 0.8)

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Failed to capture image"))
            return
          }

          const file = new File([blob], `photo_${Date.now()}.jpg`, {
            type: "image/jpeg",
          })

          resolve({
            dataUrl,
            blob,
            file,
          })
        },
        "image/jpeg",
        options.quality || 0.8,
      )
    })
  }

  stopCamera(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop())
      this.stream = null
    }

    if (this.video) {
      this.video.srcObject = null
      this.video = null
    }
  }

  async switchCamera(): Promise<void> {
    if (!this.video) return

    const currentFacingMode = this.getCurrentFacingMode()
    const newFacingMode = currentFacingMode === "user" ? "environment" : "user"

    this.stopCamera()
    await this.startCamera(this.video, { facingMode: newFacingMode })
  }

  private getCurrentFacingMode(): "user" | "environment" {
    if (!this.stream) return "environment"

    const videoTrack = this.stream.getVideoTracks()[0]
    const settings = videoTrack.getSettings()
    return (settings.facingMode as "user" | "environment") || "environment"
  }

  // Check if camera is available
  static async isAvailable(): Promise<boolean> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      return devices.some((device) => device.kind === "videoinput")
    } catch {
      return false
    }
  }

  // Get available cameras
  static async getAvailableCameras(): Promise<MediaDeviceInfo[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      return devices.filter((device) => device.kind === "videoinput")
    } catch {
      return []
    }
  }
}

export const cameraManager = new CameraManager()
