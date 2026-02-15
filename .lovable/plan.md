

## Add Time to Task Due Date

### Problem
The `due_date` column in the `tasks` table is currently a `date` type (date only, no time component). We need to change it to support date + time.

### Plan

**1. Database Migration**
- Alter the `due_date` column from `date` to `timestamp with time zone` to store both date and time.

**2. Update TaskBoard.tsx**
- Change the due date input from `type="date"` to `type="datetime-local"` in the create/edit form so users can pick both date and time.
- Update the display format on task cards to show date + time (e.g., "Feb 12, 2:30 PM").
- Update the overdue comparison logic to use full timestamp comparison instead of date-only string comparison.

**3. Update CalendarView.tsx**
- Update the calendar view to handle the new timestamp format (it already parses dates, so minimal changes needed -- just ensure `isSameDay` still works with the full timestamp).

### Technical Details

- **Migration SQL**: `ALTER TABLE tasks ALTER COLUMN due_date TYPE timestamptz USING due_date::timestamptz;`
- **Date display**: Use `date-fns` `format()` to show "MMM d, h:mm a" (e.g., "Feb 12, 2:30 PM").
- **Overdue logic**: Compare with `new Date()` directly instead of string-based date comparison.
- **Form input**: `datetime-local` input natively supports date + time picking.

