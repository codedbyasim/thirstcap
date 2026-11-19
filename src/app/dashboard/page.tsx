import type { Metadata } from "next";
import { Suspense } from "react";
import { Dashboard } from "@/components/dashboard/Dashboard";

export const metadata: Metadata = {
  title: "Control Plane",
  description:
    "Live 72-hour rolling-horizon PuLP CBC MILP water-capacity optimizer across US, Pakistan, and custom global facilities.",
};

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-12 text-sm text-marine-muted">
          Initializing ThirstCap Control Plane…
        </div>
      }
    >
      <Dashboard />
    </Suspense>
  );
}
