import { Inbox } from "lucide-react";

import { ComingSoon } from "@/components/dashboard/ComingSoon";

export default function RequestsPage() {
  return (
    <ComingSoon
      icon={Inbox}
      title="Requests"
      description="Ask teammates to record a video, and track open requests here."
    />
  );
}
