import * as React from "react"
import { Link, useLocation } from "wouter"
import { LayoutDashboard, Building2, Users, Tags, Package, Settings, Search, Bell, Hexagon } from "lucide-react"
import { cn } from "@/lib/utils"

interface SidebarItemProps {
  icon: React.ElementType
  label: string
  href: string
  active?: boolean
}

function SidebarItem({ icon: Icon, label, href, active }: SidebarItemProps) {
  return (
    <Link href={href} className={cn(
      "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
      active 
        ? "bg-primary/10 text-primary" 
        : "text-muted-foreground hover:bg-muted hover:text-foreground"
    )}>
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  )
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation()

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-sidebar flex-shrink-0 flex flex-col">
        <div className="h-14 flex items-center px-6 border-b">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight text-primary">
            <Hexagon className="h-5 w-5 fill-primary" />
            AssetFlow
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          <SidebarItem icon={LayoutDashboard} label="Dashboard" href="/" active={location === "/"} />
          <SidebarItem icon={Building2} label="Departments" href="/departments" active={location.startsWith("/departments")} />
          <SidebarItem icon={Users} label="Employees" href="/employees" active={location.startsWith("/employees")} />
          <SidebarItem icon={Tags} label="Categories" href="/categories" active={location.startsWith("/categories")} />
          <SidebarItem icon={Package} label="Assets" href="/assets" active={location.startsWith("/assets")} />
          
          <div className="pt-4 pb-2">
            <div className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">System</div>
          </div>
          <SidebarItem icon={Settings} label="Configuration" href="/configuration" active={location.startsWith("/configuration")} />
        </div>
        
        <div className="p-4 border-t">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
              AD
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium">Admin User</span>
              <span className="text-xs text-muted-foreground">admin@assetflow.inc</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-14 border-b bg-background flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative w-64">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Search assets, tags..." 
                className="h-8 w-full bg-muted rounded-md pl-8 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="text-muted-foreground hover:text-foreground relative">
              <Bell className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive border-2 border-background"></span>
            </button>
          </div>
        </header>
        
        {/* Page Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
