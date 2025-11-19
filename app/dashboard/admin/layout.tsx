import { UserRole } from "@/app/config/nav-config";
import { AppSidebar } from "@/components/ui/layout/AppSidebar";
import { MobileNav } from "@/components/ui/layout/MobileNav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // TODO: In a real app, fetch the user role from your Supabase session
  const userRole: UserRole = "admin";

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Desktop Sidebar - Hidden on Mobile, Visible on Desktop */}
      <AppSidebar role={userRole} />

      {/* Main Content Wrapper */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header - Only visible on Mobile */}
        <header className="lg:hidden h-14 bg-white border-b flex items-center px-4 sticky top-0 z-30">
          {" "}
          <MobileNav role={userRole} />
          <span className="ml-4 font-bold text-gray-700">Champika HW</span>
        </header>

        {/* Desktop Header (Optional - specific to desktop view) */}
        <header className="hidden lg:flex h-14 bg-white border-b items-center justify-between px-8 sticky top-0 z-10">
          {" "}
          <h1 className="text-sm font-semibold text-gray-500">Overview</h1>
          <div className="flex items-center gap-4">
            <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs">
              AD
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 p-4 md:p-8 overflow-y-auto">{children}</div>
      </main>
    </div>
  );
}
