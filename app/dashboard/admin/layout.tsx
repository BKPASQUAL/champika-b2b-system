import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AppSidebar } from "@/components/ui/layout/AppSidebar";
import { Separator } from "@/components/ui/separator";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Admin Specific Sidebar */}
      <AppSidebar role="admin" />

      <main className="flex-1">
        {/* Admin Header */}
        <header className="h-16 border-b flex items-center justify-between px-6">
            <h1 className="font-semibold text-lg">Administration</h1>
            <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">Mr. Administrator</span>
                <Avatar>
                    <AvatarImage src="https://github.com/shadcn.png" />
                    <AvatarFallback>AD</AvatarFallback>
                </Avatar>
            </div>
        </header>
        <div className="p-6 bg-slate-50/50 min-h-[calc(100vh-64px)]">
            {children}
        </div>
      </main>
    </div>
  );
}