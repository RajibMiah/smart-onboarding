import { LayoutDashboard } from "lucide-react";

import { ComingSoon } from "@/components/dashboard/ComingSoon";

export default function AnalyticsDashboardPage() {
  return (
    <ComingSoon
      icon={LayoutDashboard}
      title="Dashboard"
      description="Viewership, completion rates, and engagement analytics will appear here."
    />
  );
}
