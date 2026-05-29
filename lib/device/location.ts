"use client"

export interface LocationCoordinates {
  latitude: number
  longitude: number
  accuracy: number
  altitude?: number
  altitudeAccuracy?: number
  heading?: number
  speed?: number
}

export interface LocationOptions {
  enableHighAccuracy?: boolean
  timeout?: number
  maximumAge?: number
}

export class LocationManager {
  private watchId: number | null = null

  isAvailable(): boolean {
    return LocationManager.isAvailable()
  }

  async requestPermission(): Promise<PermissionState> {
    try {
      const result = await navigator.permissions.query({ name: "geolocation" })
      return result.state
    } catch {
      return "prompt"
    }
  }

  async getCurrentLocation(options: LocationOptions = {}): Promise<LocationCoordinates> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by this browser"))
        return
      }

      const defaultOptions: PositionOptions = {
        enableHighAccuracy: options.enableHighAccuracy ?? true,
        timeout: options.timeout ?? 10000,
        maximumAge: options.maximumAge ?? 300000, // 5 minutes
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude || undefined,
            altitudeAccuracy: position.coords.altitudeAccuracy || undefined,
            heading: position.coords.heading || undefined,
            speed: position.coords.speed || undefined,
          })
        },
        (error) => {
          let message = "Failed to get location"
          switch (error.code) {
            case error.PERMISSION_DENIED:
              message = "Location access denied by user"
              break
            case error.POSITION_UNAVAILABLE:
              message = "Location information unavailable"
              break
            case error.TIMEOUT:
              message = "Location request timed out"
              break
          }
          reject(new Error(message))
        },
        defaultOptions,
      )
    })
  }

  watchLocation(
    callback: (location: LocationCoordinates) => void,
    errorCallback?: (error: Error) => void,
    options: LocationOptions = {},
  ): number {
    if (!navigator.geolocation) {
      throw new Error("Geolocation is not supported by this browser")
    }

    const defaultOptions: PositionOptions = {
      enableHighAccuracy: options.enableHighAccuracy ?? true,
      timeout: options.timeout ?? 10000,
      maximumAge: options.maximumAge ?? 60000, // 1 minute for watching
    }

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        callback({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude || undefined,
          altitudeAccuracy: position.coords.altitudeAccuracy || undefined,
          heading: position.coords.heading || undefined,
          speed: position.coords.speed || undefined,
        })
      },
      (error) => {
        let message = "Failed to watch location"
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = "Location access denied by user"
            break
          case error.POSITION_UNAVAILABLE:
            message = "Location information unavailable"
            break
          case error.TIMEOUT:
            message = "Location request timed out"
            break
        }
        errorCallback?.(new Error(message))
      },
      defaultOptions,
    )

    return this.watchId
  }

  stopWatching(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId)
      this.watchId = null
    }
  }

  // Convert coordinates to address (requires external service)
  async reverseGeocode(latitude: number, longitude: number): Promise<string> {
    try {
      // Using a free geocoding service (you might want to use Google Maps API or similar)
      const response = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
      )

      if (!response.ok) {
        throw new Error("Geocoding service unavailable")
      }

      const data = await response.json()
      return data.display_name || `${latitude}, ${longitude}`
    } catch (error) {
      console.error("Reverse geocoding failed:", error)
      return `${latitude}, ${longitude}`
    }
  }

  // Calculate distance between two points (in kilometers)
  static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371 // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1)
    const dLon = this.toRadians(lon2 - lon1)

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180)
  }

  // Check if geolocation is available
  static isAvailable(): boolean {
    return "geolocation" in navigator
  }
}

export const locationManager = new LocationManager()
