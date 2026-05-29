# Follow-ups Functionality Documentation

## Overview
The follow-ups functionality allows telecallers to schedule, manage, and receive reminders for follow-up calls with leads. The system includes:

1. **Follow-ups Page** - Displays upcoming and overdue follow-ups
2. **Schedule Modal** - Interface for creating new follow-ups
3. **Notification System** - Browser and in-app notifications for reminders
4. **Reminder Service** - Background service that checks for due follow-ups

## Components

### 1. Follow-ups Page (`/app/telecaller/follow-ups/page.tsx`)
- Displays two sections: Upcoming and Overdue follow-ups
- Shows lead information, scheduled time, and notes
- Provides actions: Call Now, Complete, Reschedule
- Integrates with Notification Bell for reminders

### 2. Schedule Follow-up Modal (`/components/schedule-follow-up-modal.tsx`)
- Date and time selection with calendar picker
- Lead selection from user's assigned leads
- Notes field for follow-up details
- Validation for future dates and required fields

### 3. Notification Bell (`/components/notification-bell.tsx`)
- Shows unread notification count
- Displays in-app notifications from database
- Real-time updates using Supabase subscriptions
- Mark as read functionality

### 4. Reminder Service (`/lib/reminder-service.ts`)
- Runs in background checking for due follow-ups every minute
- Sends browser notifications 5 minutes before scheduled time
- Updates follow-up status when missed
- Creates notification history records

## How It Works

### Scheduling a Follow-up
1. User clicks "Schedule Follow-up" button
2. Modal opens with date/time picker and lead selection
3. User selects future date/time and lead
4. System creates record in `follow_ups` table
5. Follow-up appears in Upcoming section

### Receiving Reminders
1. Reminder service checks every minute for due follow-ups
2. Finds follow-ups scheduled within next 5 minutes
3. Sends browser notification if permission granted
4. Creates in-app notification in `notification_history` table
5. Marks reminder as sent to prevent duplicates

### Managing Follow-ups
- **Complete**: Updates follow-up status to "completed"
- **Reschedule**: Opens modal with current lead pre-selected
- **Call Now**: Opens dialer with lead's phone number

## Permissions and Setup

### Browser Notifications
- Automatically requests permission on page load
- Works best in secure contexts (HTTPS)
- Users can manage permissions in browser settings

### Call Log Access
- Optional feature for automatic call tracking
- Requests permission through CallLogPermission component
- Currently uses mock data due to browser limitations

## Testing

### Manual Testing
1. Navigate to `/telecaller/follow-ups`
2. Click "Schedule Follow-up"
3. Select date/time and lead
4. Verify follow-up appears in Upcoming section
5. Wait for reminder notification (or trigger manually)
6. Test Complete and Reschedule actions

### Automated Testing
Run the test script:
```bash
npm run test:follow-ups
```

## Troubleshooting

### No Notifications
- Check browser notification permissions
- Verify reminder service is running
- Ensure scheduled time is in the future

### Follow-ups Not Appearing
- Check user assignment in leads table
- Verify date range filters
- Confirm database connection

### Date/Time Issues
- Ensure browser timezone is correct
- Check system clock synchronization
- Verify date format compatibility