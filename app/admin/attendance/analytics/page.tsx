import { AuthGuard } from "@/components/auth-guard";
import { AttendanceAnalytics } from "@/components/attendance-analytics";

export default function AttendanceAnalyticsPage() {
  return (
    <AuthGuard requiredRole="admin">
      <AttendanceAnalytics />
    </AuthGuard>
  );
}