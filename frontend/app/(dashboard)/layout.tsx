import type { ReactNode } from "react";

import { UIProvider } from "@/context/ui-context";
import { TopNav } from "@/components/navigation/TopNav";
import { Sidebar } from "@/components/navigation/Sidebar";
import { FloatingSupportButton } from "@/components/dashboard/FloatingSupportButton";
import { UploadModal } from "@/components/modals/UploadModal";

/**
 * Shell for every dashboard route: global UI state, the persistent nav chrome,
 * and singletons (the upload modal, the support bubble) that only need one
 * instance regardless of which dashboard page is active.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <UIProvider>
      <div className="flex min-h-screen flex-col bg-brand-canvas">
        <TopNav />
        <div className="flex flex-1">
          <Sidebar />
          <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
      <UploadModal />
      <FloatingSupportButton />
    </UIProvider>
  );
}
