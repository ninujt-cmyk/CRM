"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export function DetailedReport({ month, year }: { month?: number; year?: number } = {}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Detailed Report</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          This is a placeholder for the detailed attendance report.
        </p>
      </CardContent>
    </Card>
  );
}
