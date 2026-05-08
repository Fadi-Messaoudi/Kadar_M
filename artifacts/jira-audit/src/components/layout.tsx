import { Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarProvider } from "@/components/ui/sidebar";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, PlusCircle, Activity } from "lucide-react";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <SidebarProvider>
      <div className="min-h-[100dvh] flex w-full bg-background text-foreground">
        <Sidebar className="border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
          <SidebarHeader className="p-4">
            <div className="flex items-center gap-2 font-bold text-lg text-sidebar-primary-foreground">
              <Activity className="h-6 w-6 text-primary" />
              <span>Migration Audit</span>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/"}>
                  <Link href="/" data-testid="link-dashboard">
                    <LayoutDashboard className="h-4 w-4" />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/audit/new"}>
                  <Link href="/audit/new" data-testid="link-new-audit">
                    <PlusCircle className="h-4 w-4" />
                    <span>New Audit</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>
        </Sidebar>
        <main className="flex-1 overflow-auto bg-muted/20 p-6 md:p-10">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}