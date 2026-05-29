import type React from "react";

export default function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <main className="pb-16">
        {children}
      </main>
    </div>
  );
}