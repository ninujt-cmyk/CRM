# Employee Attendance System Documentation

## Overview
This document provides comprehensive documentation for the Employee Attendance System implemented in the Bankscart CRM application. The system includes all core features requested for employee attendance tracking and management.

## Features Implemented

### 1. Daily/Monthly Attendance Dashboard
- List of all employees with their status (Present, Absent, Late, Half-day, Leave)
- Color-coded indicators for easy scanning
- Real-time status updates
- Daily and monthly view options

### 2. Check-In / Check-Out Tracking
- Actual time vs. scheduled time comparison
- Total hours worked per day calculation
- Overtime hours auto-calculated
- Location and IP address verification
- Device information capture

### 3. Leave & Holiday Integration
- Marked leaves (approved/rejected/pending)
- Public/Company holidays auto-excluded
- Balance of paid/unpaid leaves
- Leave application and approval workflow

### 4. Employee Monitoring Functions (Admin Page)
- Real-Time Status
  - Who is currently clocked-in / clocked-out
  - Live activity feed (last check-in, break, meeting)
- Geolocation & IP Tracking
  - Track from where employees clocked in (office location, WFH, remote site)
  - Restrict attendance to registered IPs/devices
- Break & Idle Time
  - Record break start/end
  - Idle time detection

### 5. Analytics & Reports
- Attendance Reports
  - Daily, weekly, monthly, and custom date range
  - Individual employee attendance logs
- Trends & Insights
  - Punctuality trends
  - Absenteeism rates
- Export data to Excel, CSV, PDF
- Sync with payroll systems (auto salary calculation based on attendance)

### 6. Admin Controls
- Manual Adjustments
  - Ability to add/edit attendance (with remarks & audit log)
  - Approve/reject missed punch requests
- Alerts & Notifications
  - Alerts for late check-ins, early logouts, or frequent absences
  - Auto-reminders to employees to mark attendance

### 7. Role-Based Access
- Admin has full control
- Telecallers see only their own attendance

### 8. Audit Trail & Logs
- Every modification tracked with user/time details
- Prevents misuse of manual edits
- Comprehensive change history

### 9. Mobile App Check-In with GPS & Selfie Verification
- GPS location verification
- IP address checking
- Selfie capture for identity verification
- Mobile-optimized interface

## Technical Implementation

### Database Schema
The system uses the following tables:
- `attendance` - Stores attendance records
- `breaks` - Tracks break times
- `leaves` - Manages leave applications
- `holidays` - Company and public holidays
- `attendance_settings` - Configuration settings
- `attendance_adjustments` - Audit trail for modifications

### Core Services
- `EnhancedAttendanceService` - Main service for attendance operations
- `AttendancePermissionManager` - Role-based access control
- `AttendanceNotificationService` - Notification system

### Key Components
- `AdminAttendanceDashboard` - Admin monitoring dashboard
- `MobileAttendance` - Mobile check-in interface
- `AttendanceAuditTrail` - Audit trail viewer
- `AttendanceAnalytics` - Reporting and analytics

## API Endpoints

### Attendance Operations
- `checkIn()` - Record employee check-in
- `checkOut()` - Record employee check-out
- `startBreak()` - Start a break
- `endBreak()` - End a break
- `applyForLeave()` - Submit leave request

### Reporting
- `getAttendanceStats()` - Get attendance statistics
- `getAttendanceHistory()` - Get attendance history
- `exportAttendanceData()` - Export attendance data

### Admin Functions
- `adjustAttendance()` - Manually adjust attendance records
- `getAttendanceAdjustments()` - Get audit trail
- `getClockedInUsers()` - Get currently clocked-in users

## Security Features
- Role-based access control
- Location verification
- IP address restrictions
- Selfie verification
- Audit trail for all modifications
- Data encryption

## Mobile Features
- GPS location tracking
- IP address verification
- Camera access for selfie capture
- Mobile-optimized interface
- Offline capability considerations

## Installation and Setup

1. Run the database setup script: `scripts/010_create_attendance_tables.sql`
2. Configure attendance settings in the admin panel
3. Set up office location and IP restrictions as needed
4. Ensure all users have appropriate roles assigned

## Usage Instructions

### For Employees
1. Navigate to the attendance page
2. Click "Check In" to start your workday
3. Take breaks as needed using the break tracking
4. Click "Check Out" when ending your workday

### For Admins
1. Access the admin attendance dashboard
2. Monitor real-time employee status
3. Review and approve leave requests
4. Generate reports and analytics
5. Make manual adjustments when necessary

## Troubleshooting

### Common Issues
1. **Location verification fails** - Ensure GPS is enabled and permissions are granted
2. **IP verification fails** - Check that the IP address is in the allowed list
3. **Camera access denied** - Grant camera permissions in browser settings

### Support
For technical issues, contact the IT support team with:
- Screenshot of the error
- Steps to reproduce
- Browser and device information

## Future Enhancements
- Integration with payroll systems
- Advanced analytics and machine learning
- Multi-factor authentication
- Enhanced mobile features
- Additional reporting options# Employee Attendance System Documentation

## Overview
This document provides comprehensive documentation for the Employee Attendance System implemented in the Bankscart CRM application. The system includes all core features requested for employee attendance tracking and management.

## Features Implemented

### 1. Daily/Monthly Attendance Dashboard
- List of all employees with their status (Present, Absent, Late, Half-day, Leave)
- Color-coded indicators for easy scanning
- Real-time status updates
- Daily and monthly view options

### 2. Check-In / Check-Out Tracking
- Actual time vs. scheduled time comparison
- Total hours worked per day calculation
- Overtime hours auto-calculated
- Location and IP address verification
- Device information capture

### 3. Leave & Holiday Integration
- Marked leaves (approved/rejected/pending)
- Public/Company holidays auto-excluded
- Balance of paid/unpaid leaves
- Leave application and approval workflow

### 4. Employee Monitoring Functions (Admin Page)
- Real-Time Status
  - Who is currently clocked-in / clocked-out
  - Live activity feed (last check-in, break, meeting)
- Geolocation & IP Tracking
  - Track from where employees clocked in (office location, WFH, remote site)
  - Restrict attendance to registered IPs/devices
- Break & Idle Time
  - Record break start/end
  - Idle time detection

### 5. Analytics & Reports
- Attendance Reports
  - Daily, weekly, monthly, and custom date range
  - Individual employee attendance logs
- Trends & Insights
  - Punctuality trends
  - Absenteeism rates
- Export data to Excel, CSV, PDF
- Sync with payroll systems (auto salary calculation based on attendance)

### 6. Admin Controls
- Manual Adjustments
  - Ability to add/edit attendance (with remarks & audit log)
  - Approve/reject missed punch requests
- Alerts & Notifications
  - Alerts for late check-ins, early logouts, or frequent absences
  - Auto-reminders to employees to mark attendance

### 7. Role-Based Access
- Admin has full control
- Telecallers see only their own attendance

### 8. Audit Trail & Logs
- Every modification tracked with user/time details
- Prevents misuse of manual edits
- Comprehensive change history

### 9. Mobile App Check-In with GPS & Selfie Verification
- GPS location verification
- IP address checking
- Selfie capture for identity verification
- Mobile-optimized interface

## Technical Implementation

### Database Schema
The system uses the following tables:
- `attendance` - Stores attendance records
- `breaks` - Tracks break times
- `leaves` - Manages leave applications
- `holidays` - Company and public holidays
- `attendance_settings` - Configuration settings
- `attendance_adjustments` - Audit trail for modifications

### Core Services
- `EnhancedAttendanceService` - Main service for attendance operations
- `AttendancePermissionManager` - Role-based access control
- `AttendanceNotificationService` - Notification system

### Key Components
- `AdminAttendanceDashboard` - Admin monitoring dashboard
- `MobileAttendance` - Mobile check-in interface
- `AttendanceAuditTrail` - Audit trail viewer
- `AttendanceAnalytics` - Reporting and analytics

## API Endpoints

### Attendance Operations
- `checkIn()` - Record employee check-in
- `checkOut()` - Record employee check-out
- `startBreak()` - Start a break
- `endBreak()` - End a break
- `applyForLeave()` - Submit leave request

### Reporting
- `getAttendanceStats()` - Get attendance statistics
- `getAttendanceHistory()` - Get attendance history
- `exportAttendanceData()` - Export attendance data

### Admin Functions
- `adjustAttendance()` - Manually adjust attendance records
- `getAttendanceAdjustments()` - Get audit trail
- `getClockedInUsers()` - Get currently clocked-in users

## Security Features
- Role-based access control
- Location verification
- IP address restrictions
- Selfie verification
- Audit trail for all modifications
- Data encryption

## Mobile Features
- GPS location tracking
- IP address verification
- Camera access for selfie capture
- Mobile-optimized interface
- Offline capability considerations

## Installation and Setup

1. Run the database setup script: `scripts/010_create_attendance_tables.sql`
2. Configure attendance settings in the admin panel
3. Set up office location and IP restrictions as needed
4. Ensure all users have appropriate roles assigned

## Usage Instructions

### For Employees
1. Navigate to the attendance page
2. Click "Check In" to start your workday
3. Take breaks as needed using the break tracking
4. Click "Check Out" when ending your workday

### For Admins
1. Access the admin attendance dashboard
2. Monitor real-time employee status
3. Review and approve leave requests
4. Generate reports and analytics
5. Make manual adjustments when necessary

## Troubleshooting

### Common Issues
1. **Location verification fails** - Ensure GPS is enabled and permissions are granted
2. **IP verification fails** - Check that the IP address is in the allowed list
3. **Camera access denied** - Grant camera permissions in browser settings

### Support
For technical issues, contact the IT support team with:
- Screenshot of the error
- Steps to reproduce
- Browser and device information

## Future Enhancements
- Integration with payroll systems
- Advanced analytics and machine learning
- Multi-factor authentication
- Enhanced mobile features
- Additional reporting options