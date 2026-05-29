"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { MobileAttendance } from "@/components/mobile-attendance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  User, 
  MapPin, 
  Wifi, 
  Camera, 
  Info,
  Shield
} from "lucide-react";
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion";
import { MobileAttendanceNav } from "@/components/mobile/mobile-attendance-nav";

export default function MobileAttendancePage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
  const fetchUser = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const { data: userData, error } = await supabase
          .from("users")
          .select("full_name, email, role")
          .eq("id", authUser.id)
          .maybeSingle();

        if (error) {
          console.error("Error fetching user data:", error.message);
        }

        setUser({
          ...authUser,
          ...userData
        });
      }
    } catch (error) {
      console.error("Error fetching user:", error);
    } finally {
      setLoading(false);
    }
  };

  fetchUser();
}, []);


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <div className="max-w-md mx-auto space-y-6 p-4">
        {/* Header */}
        <div className="text-center py-6">
          <h1 className="text-2xl font-bold text-gray-900">Mobile Attendance</h1>
          <p className="text-gray-600 mt-1">Check in and out from anywhere</p>
        </div>

        {/* User Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Welcome, {user?.full_name || "User"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Email:</span>
                <span>{user?.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Role:</span>
                <span className="capitalize">{user?.role || "telecaller"}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Attendance Component */}
        <MobileAttendance />

        {/* Information Section */}
        <Accordion type="single" collapsible>
          <AccordionItem value="requirements">
            <AccordionTrigger className="text-sm">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4" />
                Requirements
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3 text-sm text-gray-600">
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-0.5 text-blue-500" />
                  <div>
                    <div className="font-medium">Location Access</div>
                    <div>Required to verify your location during check-in</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Wifi className="h-4 w-4 mt-0.5 text-green-500" />
                  <div>
                    <div className="font-medium">Network Access</div>
                    <div>Required to verify your IP address</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Camera className="h-4 w-4 mt-0.5 text-purple-500" />
                  <div>
                    <div className="font-medium">Camera Access</div>
                    <div>Required to capture your selfie for verification</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Shield className="h-4 w-4 mt-0.5 text-yellow-500" />
                  <div>
                    <div className="font-medium">Privacy Notice</div>
                    <div>Your data is securely stored and only used for attendance purposes</div>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Footer */}
        <div className="text-center text-xs text-gray-500 py-4">
          <p>© 2023 Company Name. All rights reserved.</p>
          <p className="mt-1">Attendance data is securely stored and encrypted</p>
        </div>
      </div>

      {/* Mobile Navigation */}
      <MobileAttendanceNav />
    </div>
  );
}
