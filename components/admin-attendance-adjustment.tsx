"use client";

import { useState, useEffect } from "react";
import { format, parseISO, parse } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Calendar, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Search,
  Edit3,
  UserCheck,
  UserX,
  Coffee,
  MapPin,
  Wifi
} from "lucide-react";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { createClient } from "@/lib/supabase/client";
import { enhancedAttendanceService } from "@/lib/attendance-service-enhanced";
import { AttendanceAuditTrail } from "@/components/attendance-audit-trail";

export function AdminAttendanceAdjustment() {
  const [users, setUsers] = useState<any[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [showAdjustDialog, setShowAdjustDialog] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [newCheckIn, setNewCheckIn] = useState("");
  const [newCheckOut, setNewCheckOut] = useState("");
  const [newLocation, setNewLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [newIp, setNewIp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAuditTrail, setShowAuditTrail] = useState(false);
  const [auditRecordId, setAuditRecordId] = useState("");
  const supabase = createClient();

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (selectedUser) {
      loadAttendanceRecords();
    }
  }, [selectedUser, date]);

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("id, full_name, email, department")
        .eq("is_active", true)
        .order("full_name");

      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      setError("Failed to load users");
      console.error(err);
    }
  };

  const loadAttendanceRecords = async () => {
    try {
      setLoading(true);
      const records = await enhancedAttendanceService.getAttendanceHistory(
        selectedUser,
        date,
        date
      );
      setAttendanceRecords(records);
    } catch (err) {
      setError("Failed to load attendance records");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustAttendance = async () => {
    if (!selectedRecord || !adjustmentReason) {
      setError("Please select a record and provide a reason for adjustment");
      return;
    }

    try {
      setLoading(true);
      const { data: { user: adminUser } } = await supabase.auth.getUser();
      if (!adminUser) throw new Error("Admin user not found");

      // Prepare adjustment data
      const newData: any = {};
      if (newStatus) newData.status = newStatus;
      if (newCheckIn) newData.check_in = newCheckIn;
      if (newCheckOut) newData.check_out = newCheckOut;
      if (newLocation) newData.location_check_in = newLocation;
      if (newIp) newData.ip_check_in = newIp;

      await enhancedAttendanceService.adjustAttendance(
        adminUser.id,
        selectedRecord.id,
        newData,
        adjustmentReason
      );

      // Refresh records
      await loadAttendanceRecords();
      
      // Reset form
      setShowAdjustDialog(false);
      setSelectedRecord(null);
      setAdjustmentReason("");
      setNewStatus("");
      setNewCheckIn("");
      setNewCheckOut("");
      setNewLocation(null);
      setNewIp("");
      setSuccess("Attendance record updated successfully");
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError("Failed to adjust attendance");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "present": return "bg-green-100 text-green-800";
      case "late": return "bg-yellow-100 text-yellow-800";
      case "absent": return "bg-red-100 text-red-800";
      case "half-day": return "bg-orange-100 text-orange-800";
      case "leave": return "bg-blue-100 text-blue-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "present": return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "late": return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case "absent": return <XCircle className="h-4 w-4 text-red-500" />;
      case "half-day": return <Clock className="h-4 w-4 text-orange-500" />;
      case "leave": return <Coffee className="h-4 w-4 text-blue-500" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const filteredUsers = users.filter(user => 
    user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleViewAuditTrail = (recordId: string) => {
    setAuditRecordId(recordId);
    setShowAuditTrail(true);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Edit3 className="h-5 w-5" />
            Manual Attendance Adjustment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {(error || success) && (
            <div className={`rounded-md p-3 ${error ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-green-50 border border-green-200 text-green-700'}`}>
              {error || success}
            </div>
          )}
          
          {/* User Selection */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <Label>Employee</Label>
              <div className="flex gap-2 mt-1">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search employees..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredUsers.map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        <div className="flex items-center gap-2">
                          <span>{user.full_name}</span>
                          {user.department && (
                            <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                              {user.department}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className="w-full justify-start text-left font-normal mt-1"
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {date ? format(parseISO(date), "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarComponent
                    mode="single"
                    selected={date ? parseISO(date) : undefined}
                    onSelect={(selectedDate) => 
                      selectedDate && setDate(format(selectedDate, "yyyy-MM-dd"))
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          
          {/* Attendance Records */}
          {selectedUser && (
            <div>
              <h3 className="font-medium mb-3">Attendance Records</h3>
              {loading ? (
                <div>Loading records...</div>
              ) : attendanceRecords.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Check-in</TableHead>
                      <TableHead>Check-out</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead>Location/IP</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendanceRecords.map(record => (
                      <TableRow key={record.id}>
                        <TableCell>
                          {format(parseISO(record.date), "MMM dd, yyyy")}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(record.status)}
                            <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(record.status)}`}>
                              {record.status.replace('-', ' ')}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {record.check_in ? format(parseISO(record.check_in), "hh:mm a") : '-'}
                        </TableCell>
                        <TableCell>
                          {record.check_out ? format(parseISO(record.check_out), "hh:mm a") : '-'}
                        </TableCell>
                        <TableCell>
                          {record.total_hours || '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col text-xs">
                            {record.location_check_in && (
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-blue-500" />
                                <span>
                                  {record.location_check_in.latitude.toFixed(4)}, 
                                  {record.location_check_in.longitude.toFixed(4)}
                                </span>
                              </div>
                            )}
                            {record.ip_check_in && (
                              <div className="flex items-center gap-1">
                                <Wifi className="h-3 w-3 text-green-500" />
                                <span>{record.ip_check_in}</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => {
                                setSelectedRecord(record);
                                setShowAdjustDialog(true);
                                setNewStatus(record.status);
                                setNewCheckIn(record.check_in || "");
                                setNewCheckOut(record.check_out || "");
                                setNewLocation(record.location_check_in || null);
                                setNewIp(record.ip_check_in || "");
                              }}
                            >
                              <Edit3 className="h-4 w-4 mr-1" />
                              Adjust
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => handleViewAuditTrail(record.id)}
                            >
                              <UserCheck className="h-4 w-4 mr-1" />
                              Audit
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No attendance records found for this date</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Adjustment Dialog */}
      <Dialog open={showAdjustDialog} onOpenChange={setShowAdjustDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Adjust Attendance</DialogTitle>
            <DialogDescription>
              Make changes to the attendance record. All adjustments are logged for audit purposes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
            {selectedRecord && (
              <div className="bg-gray-50 p-3 rounded-md">
                <div className="font-medium">{selectedRecord.user?.full_name}</div>
                <div className="text-sm text-gray-500">
                  {format(parseISO(selectedRecord.date), "EEEE, MMMM dd, yyyy")}
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="late">Late</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                  <SelectItem value="half-day">Half Day</SelectItem>
                  <SelectItem value="leave">Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Check-in Time</Label>
                <Input
                  type="datetime-local"
                  value={newCheckIn}
                  onChange={(e) => setNewCheckIn(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Check-out Time</Label>
                <Input
                  type="datetime-local"
                  value={newCheckOut}
                  onChange={(e) => setNewCheckOut(e.target.value)}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Location (Latitude, Longitude)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Latitude"
                    value={newLocation?.latitude || ""}
                    onChange={(e) => setNewLocation(prev => ({
                      latitude: parseFloat(e.target.value) || 0,
                      longitude: prev?.longitude || 0
                    }))}
                  />
                  <Input
                    type="number"
                    placeholder="Longitude"
                    value={newLocation?.longitude || ""}
                    onChange={(e) => setNewLocation(prev => ({
                      longitude: parseFloat(e.target.value) || 0,
                      latitude: prev?.latitude || 0
                    }))}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>IP Address</Label>
                <Input
                  placeholder="IP Address"
                  value={newIp}
                  onChange={(e) => setNewIp(e.target.value)}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Reason for Adjustment *</Label>
              <Textarea
                placeholder="Reason for making this adjustment..."
                value={adjustmentReason}
                onChange={(e) => setAdjustmentReason(e.target.value)}
                rows={3}
              />
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setShowAdjustDialog(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleAdjustAttendance}
                disabled={loading || !adjustmentReason}
                className="flex-1"
              >
                {loading ? "Saving..." : "Save Adjustment"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Audit Trail Dialog */}
      <Dialog open={showAuditTrail} onOpenChange={setShowAuditTrail}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Attendance Audit Trail</DialogTitle>
            <DialogDescription>
              View all modifications made to this attendance record.
            </DialogDescription>
          </DialogHeader>
          <div>
            <AttendanceAuditTrail attendanceId={auditRecordId} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}