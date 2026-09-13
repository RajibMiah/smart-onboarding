import { Inbox } from "lucide-react";

import { ComingSoon } from "@/components/dashboard/ComingSoon";

const RequestsPage = () => {
  return (
    <ComingSoon
      icon={Inbox}
      title="Requests"
      description="Ask teammates to record a video, and track open requests here."
    />
  );
};
export default RequestsPage;
