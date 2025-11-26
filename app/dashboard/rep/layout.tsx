import { UserRole } from "@/app/config/nav-config";
import { AppSidebar } from "@/components/ui/layout/AppSidebar";
import { MobileNav } from "@/components/ui/layout/MobileNav";

export default function RepDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Defines the role for this layout to load the correct menu items
  const userRole: UserRole = "rep";

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Desktop Sidebar */}
      <AppSidebar role={userRole} />

      {/* Main Content Wrapper */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header (Visible only on small screens) */}
        <header className="lg:hidden h-14 bg-white border-b flex items-center px-4 sticky top-0 z-30">
          <MobileNav role={userRole} />
          <span className="ml-4 font-bold text-gray-700">Champika HW</span>
        </header>

        {/* Desktop Header (Visible only on large screens) */}
        <header className="hidden lg:flex h-14 bg-white border-b items-center justify-between px-8 sticky top-0 z-10">
          <h1 className="text-sm font-semibold text-gray-500">
            Sales Representative Portal
          </h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-gray-700">
                  Ajith Bandara
                </p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">
                  Sales Rep
                </p>
              </div>
              <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-bold text-xs border border-green-200">
                RP
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 p-4 md:p-8 overflow-y-auto">{children}</div>
      </main>
    </div>
  );
}
