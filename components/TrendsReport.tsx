"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export function TrendsReport({ month, year }: { month?: number; year?: number } = {}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Trends Report</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          This is a placeholder for the trends analysis of attendance.
        </p>
      </CardContent>
    </Card>
  );
}
