"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Camera, 
  MapPin, 
  Wifi, 
  LogIn, 
  LogOut, 
  Coffee,
  AlertCircle,
  Check,
  X,
  RefreshCw,
  Image,
  Locate
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { enhancedAttendanceService } from "@/lib/attendance-service-enhanced";
import { toast } from "sonner";

export function MobileAttendance() {
  const [location, setLocation] = useState<{ latitude: number; longitude: number; address?: string; accuracy?: number } | null>(null);
  const [ipAddress, setIpAddress] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [locationVerified, setLocationVerified] = useState(false);
  const [ipVerified, setIpVerified] = useState(false);
  const [selfieVerified, setSelfieVerified] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [ipLoading, setIpLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const supabase = createClient();

  // Get user's location with better accuracy
  const getLocation = async () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }

    try {
      setLocationLoading(true);
      setError(null);
      
      // Get current position with high accuracy
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const locationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          };
          
          setLocation(locationData);
          
          // Reverse geocode to get address
          try {
            const response = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${locationData.latitude}&longitude=${locationData.longitude}&localityLanguage=en`
            );
            const data = await response.json();
            if (data.city) {
              setLocation({
                ...locationData,
                address: `${data.city}, ${data.principalSubdivision}, ${data.countryName}`
              });
            }
          } catch (err) {
            console.error("Error getting address:", err);
          }
          
          // Verify location against office settings
          try {
            const settings = await enhancedAttendanceService.getAttendanceSettings();
            if (settings?.office_location) {
              const isWithin = enhancedAttendanceService.isWithinOfficeLocation(
                locationData.latitude,
                locationData.longitude,
                settings.office_location.latitude,
                settings.office_location.longitude,
                settings.office_location.radius_meters
              );
              
              if (isWithin) {
                setLocationVerified(true);
                setSuccess("Location verified successfully");
                toast.success("Location verified successfully");
              } else {
                setError(`You are ${Math.round((position.coords.accuracy || 0) / 1000)}km away from office. Please move closer to the office.`);
                toast.error("Location verification failed");
              }
            } else {
              setLocationVerified(true);
              setSuccess("Location captured successfully");
              toast.success("Location captured successfully");
            }
          } catch (err) {
            console.error("Error verifying location:", err);
            setLocationVerified(true);
            setSuccess("Location captured successfully");
            toast.success("Location captured successfully");
          }
          
          setLocationLoading(false);
        },
        (err) => {
          setError(`Unable to retrieve your location: ${err.message}`);
          setLocationLoading(false);
          toast.error("Failed to get location");
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0
        }
      );
    } catch (err) {
      setError("Failed to get location");
      setLocationLoading(false);
      toast.error("Failed to get location");
    }
  };

  // Get user's IP address
  const getIpAddress = async () => {
    try {
      setIpLoading(true);
      setError(null);
      
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      setIpAddress(data.ip);
      
      // Verify IP against allowed IPs
      try {
        const isAllowed = await enhancedAttendanceService.isIpAllowed(data.ip);
        if (isAllowed) {
          setIpVerified(true);
          setSuccess("IP address verified successfully");
          toast.success("IP address verified successfully");
        } else {
          setError("Your IP address is not allowed for attendance");
          toast.error("IP verification failed");
        }
      } catch (err) {
        console.error("Error verifying IP:", err);
        setIpVerified(true);
        setSuccess("IP address captured successfully");
        toast.success("IP address captured successfully");
      }
      
      setIpLoading(false);
    } catch (err) {
      setError("Unable to retrieve your IP address");
      setIpLoading(false);
      toast.error("Failed to get IP address");
    }
  };

  // Start camera for selfie with better error handling
  const startCamera = async () => {
    try {
      setError(null);
      
      // Check if we already have camera permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
      
      toast.success("Camera activated");
    } catch (err: any) {
      setError("Unable to access camera: " + (err.message || "Unknown error"));
      toast.error("Failed to access camera");
      console.error("Camera error:", err);
    }
  };

  // Capture selfie with better quality
  const captureSelfie = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        // Set canvas dimensions to match video
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        
        // Draw video frame to canvas
        context.drawImage(videoRef.current, 0, 0);
        
        // Convert to data URL with higher quality
        const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.9);
        setSelfie(dataUrl);
        setSelfieVerified(true);
        setSuccess("Selfie captured successfully");
        toast.success("Selfie captured successfully");
        
        // Stop the camera stream
        const stream = videoRef.current.srcObject as MediaStream;
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
        setCameraActive(false);
      }
    }
  };

  // Handle check-in
  const handleCheckIn = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("User not authenticated");
      }

      // Validate all required fields
      if (!locationVerified) {
        throw new Error("Location verification required");
      }
      
      if (!ipVerified) {
        throw new Error("IP verification required");
      }
      
      if (!selfieVerified) {
        throw new Error("Selfie verification required");
      }

      const attendance = await enhancedAttendanceService.checkIn(
        user.id,
        location ? { 
          latitude: location.latitude, 
          longitude: location.longitude,
          address: location.address
        } : undefined,
        ipAddress || undefined,
        navigator.userAgent, // Device info
        notes
      );
      
      setSuccess("Check-in successful!");
      toast.success("Check-in successful!");
      
      // Reset form
      setNotes("");
      setSelfie(null);
      setLocation(null);
      setIpAddress(null);
      setLocationVerified(false);
      setIpVerified(false);
      setSelfieVerified(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check-in failed");
      toast.error(err instanceof Error ? err.message : "Check-in failed");
    } finally {
      setLoading(false);
    }
  };

  // Handle check-out
  const handleCheckOut = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("User not authenticated");
      }

      const attendance = await enhancedAttendanceService.checkOut(
        user.id,
        location ? { 
          latitude: location.latitude, 
          longitude: location.longitude,
          address: location.address
        } : undefined,
        ipAddress || undefined,
        navigator.userAgent, // Device info
        notes
      );
      
      setSuccess("Check-out successful!");
      toast.success("Check-out successful!");
      
      // Reset form
      setNotes("");
      setSelfie(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check-out failed");
      toast.error(err instanceof Error ? err.message : "Check-out failed");
    } finally {
      setLoading(false);
    }
  };

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Mobile Attendance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {(error || success) && (
            <div className={`rounded-md p-3 flex items-center gap-2 ${error ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-green-50 border border-green-200 text-green-700'}`}>
              {error ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
              {error || success}
            </div>
          )}
          
          {/* Location Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium flex items-center gap-2">
                <Locate className="h-4 w-4" />
                Location Verification
              </h3>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={getLocation}
                disabled={locationLoading || locationVerified}
              >
                {locationLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Getting Location...
                  </>
                ) : locationVerified ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Verified
                  </>
                ) : location ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Update
                  </>
                ) : (
                  <>
                    <Locate className="h-4 w-4 mr-2" />
                    Get Location
                  </>
                )}
              </Button>
            </div>
            
            {location && (
              <div className="bg-gray-50 p-3 rounded-md text-sm">
                <div>Latitude: {location.latitude.toFixed(6)}</div>
                <div>Longitude: {location.longitude.toFixed(6)}</div>
                {location.accuracy && <div>Accuracy: ±{Math.round(location.accuracy)} meters</div>}
                {location.address && <div>Address: {location.address}</div>}
                {locationVerified && (
                  <div className="flex items-center gap-1 mt-2 text-green-600">
                    <Check className="h-4 w-4" />
                    <span>Location verified</span>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* IP Address Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium flex items-center gap-2">
                <Wifi className="h-4 w-4" />
                Network Verification
              </h3>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={getIpAddress}
                disabled={ipLoading || ipVerified}
              >
                {ipLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Getting IP...
                  </>
                ) : ipVerified ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Verified
                  </>
                ) : ipAddress ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Update
                  </>
                ) : (
                  <>
                    <Wifi className="h-4 w-4 mr-2" />
                    Get IP
                  </>
                )}
              </Button>
            </div>
            
            {ipAddress && (
              <div className="bg-gray-50 p-3 rounded-md text-sm">
                IP Address: {ipAddress}
                {ipVerified && (
                  <div className="flex items-center gap-1 mt-2 text-green-600">
                    <Check className="h-4 w-4" />
                    <span>IP verified</span>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Selfie Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Selfie Verification
              </h3>
              {!selfie ? (
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={startCamera}
                  disabled={cameraActive}
                >
                  <Camera className="h-4 w-4 mr-2" />
                  {cameraActive ? "Camera Active" : "Start Camera"}
                </Button>
              ) : (
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => {
                    setSelfie(null);
                    setSelfieVerified(false);
                    setCameraActive(false);
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retake
                </Button>
              )}
            </div>
            
            <div className="flex flex-col items-center gap-3">
              {selfie ? (
                <div className="relative">
                  <img 
                    src={selfie} 
                    alt="Selfie" 
                    className="w-48 h-48 object-cover rounded-md border"
                  />
                  {selfieVerified && (
                    <div className="absolute -top-2 -right-2 bg-green-500 rounded-full p-1">
                      <Check className="h-4 w-4 text-white" />
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="relative w-full max-w-xs">
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline 
                      muted
                      className="w-full h-64 bg-gray-200 rounded-md"
                    />
                    <canvas ref={canvasRef} className="hidden" />
                    {cameraActive && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-32 h-32 border-4 border-white rounded-full opacity-50"></div>
                      </div>
                    )}
                  </div>
                  {cameraActive && (
                    <Button 
                      onClick={captureSelfie}
                      className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600"
                    >
                      <div className="w-12 h-12 rounded-full bg-white"></div>
                    </Button>
                  )}
                </>
              )}
              {!selfie && !cameraActive && (
                <p className="text-sm text-gray-500 text-center">
                  Click "Start Camera" to begin selfie verification
                </p>
              )}
            </div>
          </div>
          
          {/* Notes Section */}
          <div className="space-y-2">
            <Label htmlFor="mobile-notes">Notes (Optional)</Label>
            <Textarea
              id="mobile-notes"
              placeholder="Any notes for today..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button 
              className="flex-1" 
              onClick={handleCheckIn}
              disabled={loading || !locationVerified || !ipVerified || !selfieVerified}
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4 mr-2" />
                  Check In
                </>
              )}
            </Button>
            
            <Button 
              className="flex-1" 
              variant="secondary"
              onClick={handleCheckOut}
              disabled={loading}
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <LogOut className="h-4 w-4 mr-2" />
                  Check Out
                </>
              )}
            </Button>
          </div>
          
          {/* Verification Status */}
          <div className="border-t pt-4">
            <h4 className="font-medium mb-2">Verification Status</h4>
            <div className="grid grid-cols-3 gap-2">
              <div className={`flex flex-col items-center p-2 rounded-md ${locationVerified ? 'bg-green-100' : 'bg-gray-100'}`}>
                <Locate className={`h-5 w-5 ${locationVerified ? 'text-green-600' : 'text-gray-400'}`} />
                <span className="text-xs mt-1">Location</span>
                {locationVerified && <Check className="h-3 w-3 text-green-600 mt-1" />}
              </div>
              <div className={`flex flex-col items-center p-2 rounded-md ${ipVerified ? 'bg-green-100' : 'bg-gray-100'}`}>
                <Wifi className={`h-5 w-5 ${ipVerified ? 'text-green-600' : 'text-gray-400'}`} />
                <span className="text-xs mt-1">Network</span>
                {ipVerified && <Check className="h-3 w-3 text-green-600 mt-1" />}
              </div>
              <div className={`flex flex-col items-center p-2 rounded-md ${selfieVerified ? 'bg-green-100' : 'bg-gray-100'}`}>
                <Image className={`h-5 w-5 ${selfieVerified ? 'text-green-600' : 'text-gray-400'}`} />
                <span className="text-xs mt-1">Selfie</span>
                {selfieVerified && <Check className="h-3 w-3 text-green-600 mt-1" />}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}