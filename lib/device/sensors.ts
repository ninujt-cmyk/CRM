"use client"

export interface DeviceMotionData {
  acceleration: {
    x: number | null
    y: number | null
    z: number | null
  }
  accelerationIncludingGravity: {
    x: number | null
    y: number | null
    z: number | null
  }
  rotationRate: {
    alpha: number | null
    beta: number | null
    gamma: number | null
  }
  interval: number
}

export interface DeviceOrientationData {
  alpha: number | null // Z axis rotation (0-360)
  beta: number | null // X axis rotation (-180 to 180)
  gamma: number | null // Y axis rotation (-90 to 90)
  absolute: boolean
}

export class SensorManager {
  private motionCallback: ((data: DeviceMotionData) => void) | null = null
  private orientationCallback: ((data: DeviceOrientationData) => void) | null = null

  isAvailable(): boolean {
    return SensorManager.isAvailable()
  }

  async requestPermission(): Promise<boolean> {
    // For iOS 13+ devices, we need to request permission
    if (
      typeof DeviceMotionEvent !== "undefined" &&
      typeof (DeviceMotionEvent as any).requestPermission === "function"
    ) {
      try {
        const permission = await (DeviceMotionEvent as any).requestPermission()
        return permission === "granted"
      } catch (error) {
        console.error("Failed to request device motion permission:", error)
        return false
      }
    }

    // For other devices, assume permission is granted if sensors are available
    return this.isAvailable()
  }

  startMotionTracking(callback: (data: DeviceMotionData) => void): void {
    if (!this.isAvailable()) {
      throw new Error("Device motion sensors are not available")
    }

    this.motionCallback = callback

    const handleMotion = (event: DeviceMotionEvent) => {
      callback({
        acceleration: {
          x: event.acceleration?.x || null,
          y: event.acceleration?.y || null,
          z: event.acceleration?.z || null,
        },
        accelerationIncludingGravity: {
          x: event.accelerationIncludingGravity?.x || null,
          y: event.accelerationIncludingGravity?.y || null,
          z: event.accelerationIncludingGravity?.z || null,
        },
        rotationRate: {
          alpha: event.rotationRate?.alpha || null,
          beta: event.rotationRate?.beta || null,
          gamma: event.rotationRate?.gamma || null,
        },
        interval: event.interval,
      })
    }

    window.addEventListener("devicemotion", handleMotion)
  }

  startOrientationTracking(callback: (data: DeviceOrientationData) => void): void {
    if (!this.isAvailable()) {
      throw new Error("Device orientation sensors are not available")
    }

    this.orientationCallback = callback

    const handleOrientation = (event: DeviceOrientationEvent) => {
      callback({
        alpha: event.alpha,
        beta: event.beta,
        gamma: event.gamma,
        absolute: event.absolute,
      })
    }

    window.addEventListener("deviceorientation", handleOrientation)
  }

  stopMotionTracking(): void {
    if (this.motionCallback) {
      window.removeEventListener("devicemotion", this.motionCallback as any)
      this.motionCallback = null
    }
  }

  stopOrientationTracking(): void {
    if (this.orientationCallback) {
      window.removeEventListener("deviceorientation", this.orientationCallback as any)
      this.orientationCallback = null
    }
  }

  stopAllTracking(): void {
    this.stopMotionTracking()
    this.stopOrientationTracking()
  }

  // Detect shake gesture
  detectShake(callback: () => void, threshold = 15, timeout = 1000): void {
    let lastTime = 0
    let lastX = 0
    let lastY = 0
    let lastZ = 0

    this.startMotionTracking((data) => {
      const currentTime = Date.now()
      const timeDifference = currentTime - lastTime

      if (timeDifference > 100) {
        const { x, y, z } = data.accelerationIncludingGravity

        if (x !== null && y !== null && z !== null) {
          const deltaX = Math.abs(x - lastX)
          const deltaY = Math.abs(y - lastY)
          const deltaZ = Math.abs(z - lastZ)

          if (deltaX + deltaY + deltaZ > threshold) {
            callback()
          }

          lastX = x
          lastY = y
          lastZ = z
        }

        lastTime = currentTime
      }
    })
  }

  // Get device orientation as compass heading
  getCompassHeading(): Promise<number> {
    return new Promise((resolve, reject) => {
      if (!this.isAvailable()) {
        reject(new Error("Device orientation is not available"))
        return
      }

      const handleOrientation = (event: DeviceOrientationEvent) => {
        window.removeEventListener("deviceorientation", handleOrientation)

        if (event.alpha !== null) {
          // Convert to compass heading (0-360 degrees)
          let heading = 360 - event.alpha
          if (heading >= 360) heading -= 360
          resolve(heading)
        } else {
          reject(new Error("Compass heading not available"))
        }
      }

      window.addEventListener("deviceorientation", handleOrientation)

      // Timeout after 5 seconds
      setTimeout(() => {
        window.removeEventListener("deviceorientation", handleOrientation)
        reject(new Error("Compass heading timeout"))
      }, 5000)
    })
  }

  // Check if device sensors are available
  static isAvailable(): boolean {
    return typeof DeviceMotionEvent !== "undefined" && typeof DeviceOrientationEvent !== "undefined"
  }

  // Check if device has gyroscope
  static hasGyroscope(): boolean {
    return "ondevicemotion" in window
  }

  // Check if device has accelerometer
  static hasAccelerometer(): boolean {
    return "ondeviceorientation" in window
  }
}

export const sensorManager = new SensorManager()
