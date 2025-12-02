// app/dashboard/office/layout.tsx
import { UserRole } from "@/app/config/nav-config";
import { AppSidebar } from "@/components/ui/layout/AppSidebar";
import { MobileNav } from "@/components/ui/layout/MobileNav";

export default function OfficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userRole: UserRole = "office";

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AppSidebar role={userRole} />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="lg:hidden h-14 bg-white border-b flex items-center px-4 sticky top-0 z-30">
          <MobileNav role={userRole} />
          <span className="ml-4 font-bold text-gray-700">Champika HW</span>
        </header>
        <header className="hidden lg:flex h-14 bg-white border-b items-center justify-between px-8 sticky top-0 z-10">
          <h1 className="text-sm font-semibold text-gray-500">Office Portal</h1>
          <div className="flex items-center gap-4">
            <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs">
              OF
            </div>
          </div>
        </header>
        <div className="flex-1 p-4 md:p-8 overflow-y-auto">{children}</div>
      </main>
    </div>
  );
}
