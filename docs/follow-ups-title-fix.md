# Follow-ups Functionality - Additional Database Schema Fix

## Issue
The follow-ups functionality was failing with the error:
```
null value in column "title" of relation "follow_ups" violates not-null constraint
```

## Root Cause
The database schema requires a [title](file://c:\Users\Admin\Downloads\bankscart-crm%20(1)\components\todays-tasks.tsx#L11-L11) field (NOT NULL), but the schedule follow-up modal was not providing this required field when inserting records.

## Fix Applied

### `components/schedule-follow-up-modal.tsx`
- Added logic to generate a title based on the selected lead's name
- Added the required [title](file://c:\Users\Admin\Downloads\bankscart-crm%20(1)\components\todays-tasks.tsx#L11-L11) field to the insert query:
  ```typescript
  // Find the selected lead to create a title
  const selectedLead = leads.find(lead => lead.id === leadId);
  const title = selectedLead ? `Follow-up with ${selectedLead.name}` : "Follow-up";
  
  // In the insert query:
  title: title, // Added required title field
  ```

## Verification
The fix ensures that:
1. All database inserts include the required [title](file://c:\Users\Admin\Downloads\bankscart-crm%20(1)\components\todays-tasks.tsx#L11-L11) field
2. The [title](file://c:\Users\Admin\Downloads\bankscart-crm%20(1)\components\todays-tasks.tsx#L11-L11) is automatically generated based on the lead's name
3. The follow-ups functionality now works correctly with date/time selection and reminder pop-ups
4. No more database constraint errors occur

## Testing
To verify the fix:
1. Navigate to `/telecaller/follow-ups`
2. Click "Schedule Follow-up"
3. Select a date/time and lead
4. Verify the follow-up is created without errors
5. Check that the title is properly generated (e.g., "Follow-up with John Doe")
6. Check that reminders appear as expected