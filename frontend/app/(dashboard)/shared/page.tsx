import { Share2 } from "lucide-react";

import { ComingSoon } from "@/components/dashboard/ComingSoon";

const SharedWithMePage = () => {
  return (
    <ComingSoon
      icon={Share2}
      title="Shared with me"
      description="Content colleagues share with you directly will show up here."
    />
  );
};
export default SharedWithMePage;
