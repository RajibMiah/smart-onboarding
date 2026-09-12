import { Folder } from "lucide-react";

import { ComingSoon } from "@/components/dashboard/ComingSoon";

export default function ProjectsPage() {
  return (
    <ComingSoon
      icon={Folder}
      title="Projects"
      description="Group related recordings and pages into projects your team can browse together."
    />
  );
}
