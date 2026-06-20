import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

// Lazy load the heavy recharts component to prevent blocking the main thread
const AttendanceAnalytics = dynamic(
  () => import("@/components/attendance-analytics").then((mod) => mod.AttendanceAnalytics),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-[600px] flex items-center justify-center p-6">
        <div className="flex flex-col gap-4 w-full h-full">
          <Skeleton className="h-12 w-[300px]" />
          <Skeleton className="h-[400px] w-full rounded-2xl" />
        </div>
      </div>
    )
  }
);
export default function AttendanceAnalyticsPage() {
  return (
      <AttendanceAnalytics />
  );
}