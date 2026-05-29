import { LeaveManagement } from "@/components/leave-management";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "lucide-react";

export default function TelecallerLeavePage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Leave Management</h1>
        <p className="text-gray-600 mt-1">Apply for and manage your leave requests</p>
      </div>
      
      <LeaveManagement />
    </div>
  );
}