import { LayoutDashboard } from "lucide-react";

import { ComingSoon } from "@/components/dashboard/ComingSoon";

const AnalyticsDashboardPage = () => {
  return (
    <ComingSoon
      icon={LayoutDashboard}
      title="Dashboard"
      description="Viewership, completion rates, and engagement analytics will appear here."
    />
  );
};
export default AnalyticsDashboardPage;
