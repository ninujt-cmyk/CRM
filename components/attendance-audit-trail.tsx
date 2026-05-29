"use client";

import { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { enhancedAttendanceService } from "@/lib/attendance-service-enhanced";
import { 
  User, 
  Clock, 
  MapPin, 
  Wifi, 
  FileText, 
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle
} from "lucide-react";

export function AttendanceAuditTrail({ attendanceId }: { attendanceId: string }) {
  const [auditTrail, setAuditTrail] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadAuditTrail();
  }, [attendanceId]);

  const loadAuditTrail = async () => {
    try {
      setLoading(true);
      const adjustments = await enhancedAttendanceService.getAttendanceAdjustments(attendanceId);
      setAuditTrail(adjustments);
    } catch (error) {
      console.error("Error loading audit trail:", error);
    } finally {
      setLoading(false);
    }
  };

  const getChangeIcon = (field: string) => {
    switch (field) {
      case 'status':
        return <FileText className="h-4 w-4" />;
      case 'check_in':
      case 'check_out':
        return <Clock className="h-4 w-4" />;
      case 'location_check_in':
      case 'location_check_out':
        return <MapPin className="h-4 w-4" />;
      case 'ip_check_in':
      case 'ip_check_out':
        return <Wifi className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const formatChangeValue = (field: string, value: any) => {
    if (value === null || value === undefined) {
      return "None";
    }

    switch (field) {
      case 'check_in':
      case 'check_out':
      case 'created_at':
        return value ? format(parseISO(value), "MMM dd, yyyy hh:mm a") : "None";
      case 'status':
        return value.replace('-', ' ');
      case 'location_check_in':
      case 'location_check_out':
        return value ? `${value.latitude.toFixed(4)}, ${value.longitude.toFixed(4)}` : "None";
      default:
        return String(value);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present':
        return <Badge className="bg-green-100 text-green-800">Present</Badge>;
      case 'late':
        return <Badge className="bg-yellow-100 text-yellow-800">Late</Badge>;
      case 'absent':
        return <Badge className="bg-red-100 text-red-800">Absent</Badge>;
      case 'half-day':
        return <Badge className="bg-orange-100 text-orange-800">Half Day</Badge>;
      case 'leave':
        return <Badge className="bg-blue-100 text-blue-800">Leave</Badge>;
      case 'holiday':
        return <Badge className="bg-purple-100 text-purple-800">Holiday</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">{status}</Badge>;
    }
  };

  if (loading) {
    return <div>Loading audit trail...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Attendance Audit Trail
        </CardTitle>
      </CardHeader>
      <CardContent>
        {auditTrail.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-48">Date & Time</TableHead>
                <TableHead>Adjusted By</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="w-1/2">Changes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditTrail.map((adjustment) => (
                <TableRow key={adjustment.id}>
                  <TableCell>
                    <div className="font-medium">
                      {format(parseISO(adjustment.created_at), "MMM dd, yyyy")}
                    </div>
                    <div className="text-sm text-gray-500">
                      {format(parseISO(adjustment.created_at), "hh:mm a")}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {adjustment.adjusted_by_user?.full_name || "Unknown User"}
                    </div>
                    <div className="text-sm text-gray-500">
                      {adjustment.adjusted_by_user?.email}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-xs truncate" title={adjustment.reason}>
                      {adjustment.reason}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      {Object.entries(adjustment.new_data).map(([key, value]) => {
                        const previousValue = adjustment.previous_data[key];
                        // Only show fields that actually changed
                        if (JSON.stringify(previousValue) !== JSON.stringify(value)) {
                          return (
                            <div key={key} className="flex items-start gap-2 text-sm">
                              <div className="mt-0.5">
                                {getChangeIcon(key)}
                              </div>
                              <div className="flex-1">
                                <div className="font-medium capitalize">{key.replace(/_/g, ' ')}</div>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-sm">
                                    {key === 'status' && previousValue ? getStatusBadge(previousValue) : 
                                     formatChangeValue(key, previousValue)}
                                  </span>
                                  <span className="text-gray-400">→</span>
                                  <span className="text-sm font-medium">
                                    {key === 'status' ? getStatusBadge(value as string) : 
                                     formatChangeValue(key, value)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg">No audit trail records found</p>
            <p className="text-sm mt-1">No adjustments have been made to this attendance record</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}