"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MapPin, Navigation, Loader2 } from "lucide-react"
import { locationManager, type LocationCoordinates } from "@/lib/device/location"
import { toast } from "sonner"

interface LocationPickerProps {
  onLocationSelect: (location: LocationCoordinates & { address?: string }) => void
  initialLocation?: LocationCoordinates
}

export function LocationPicker({ onLocationSelect, initialLocation }: LocationPickerProps) {
  const [location, setLocation] = useState<LocationCoordinates | null>(initialLocation || null)
  const [address, setAddress] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const [manualCoords, setManualCoords] = useState({
    latitude: initialLocation?.latitude?.toString() || "",
    longitude: initialLocation?.longitude?.toString() || "",
  })

  useEffect(() => {
    if (location) {
      reverseGeocode(location.latitude, location.longitude)
    }
  }, [location])

  const getCurrentLocation = async () => {
    setIsLoading(true)
    try {
      const permission = await locationManager.requestPermission()
      if (permission === "denied") {
        toast.error("Location permission denied")
        return
      }

      const currentLocation = await locationManager.getCurrentLocation({
        enableHighAccuracy: true,
        timeout: 10000,
      })

      setLocation(currentLocation)
      setManualCoords({
        latitude: currentLocation.latitude.toString(),
        longitude: currentLocation.longitude.toString(),
      })

      toast.success("Location obtained successfully")
    } catch (error) {
      console.error("Failed to get location:", error)
      toast.error(error instanceof Error ? error.message : "Failed to get location")
    } finally {
      setIsLoading(false)
    }
  }

  const reverseGeocode = async (latitude: number, longitude: number) => {
    try {
      const addressResult = await locationManager.reverseGeocode(latitude, longitude)
      setAddress(addressResult)
    } catch (error) {
      console.error("Failed to reverse geocode:", error)
      setAddress(`${latitude}, ${longitude}`)
    }
  }

  const handleManualCoordinates = () => {
    const lat = Number.parseFloat(manualCoords.latitude)
    const lng = Number.parseFloat(manualCoords.longitude)

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      toast.error("Please enter valid coordinates")
      return
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      toast.error("Coordinates are out of valid range")
      return
    }

    const manualLocation: LocationCoordinates = {
      latitude: lat,
      longitude: lng,
      accuracy: 0,
    }

    setLocation(manualLocation)
    reverseGeocode(lat, lng)
  }

  const handleConfirm = () => {
    if (!location) {
      toast.error("Please select a location first")
      return
    }

    onLocationSelect({
      ...location,
      address: address || undefined,
    })
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Select Location
          </CardTitle>
          <CardDescription>Get your current location or enter coordinates manually</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Location Button */}
          <Button onClick={getCurrentLocation} disabled={isLoading} className="w-full">
            {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Navigation className="h-4 w-4 mr-2" />}
            {isLoading ? "Getting Location..." : "Use Current Location"}
          </Button>

          {/* Manual Coordinates */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="latitude">Latitude</Label>
                <Input
                  id="latitude"
                  type="number"
                  step="any"
                  placeholder="e.g., 40.7128"
                  value={manualCoords.latitude}
                  onChange={(e) => setManualCoords({ ...manualCoords, latitude: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="longitude">Longitude</Label>
                <Input
                  id="longitude"
                  type="number"
                  step="any"
                  placeholder="e.g., -74.0060"
                  value={manualCoords.longitude}
                  onChange={(e) => setManualCoords({ ...manualCoords, longitude: e.target.value })}
                />
              </div>
            </div>
            <Button variant="outline" onClick={handleManualCoordinates} className="w-full bg-transparent">
              Use Manual Coordinates
            </Button>
          </div>

          {/* Selected Location Display */}
          {location && (
            <div className="p-3 bg-muted rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <span className="font-medium">Selected Location</span>
              </div>
              <div className="text-sm text-muted-foreground">
                <p>Latitude: {location.latitude.toFixed(6)}</p>
                <p>Longitude: {location.longitude.toFixed(6)}</p>
                {location.accuracy && <p>Accuracy: ±{Math.round(location.accuracy)}m</p>}
                {address && <p>Address: {address}</p>}
              </div>
            </div>
          )}

          {/* Confirm Button */}
          <Button onClick={handleConfirm} disabled={!location} className="w-full">
            Confirm Location
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
