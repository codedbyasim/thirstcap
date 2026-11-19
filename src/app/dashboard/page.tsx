import type { Metadata } from "next";
import { Suspense } from "react";
import { Dashboard } from "@/components/dashboard/Dashboard";

export const metadata: Metadata = {
  title: "Demo",
  description: "Run a sample 72-hour water plan for Des Moines, Phoenix, Lahore, or Karachi.",
};

export default function DashboardPage() {
  return (
    <Suspense fallback={<p className="px-6 py-16 text-sm text-ink-soft">Loading the demo…</p>}>
      <Dashboard />
    </Suspense>
  );
}
