import * as React from "react"
import { Link, useLocation } from "wouter"
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  Tags, 
  Package, 
  Settings, 
  Search, 
  Bell, 
  Hexagon, 
  LogOut, 
  User as UserIcon, 
  ChevronDown,
  Lock
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

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
  const [location, setLocation] = useLocation()
  const { user, logout, isAdmin, isAssetManager, isDepartmentHead } = useAuth()
  
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false)
  const [isLogoutModalOpen, setIsLogoutModalOpen] = React.useState(false)
  
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  // Handle clicking outside the profile dropdown to close it
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  if (!user) return <>{children}</>

  // Sync avatar url dynamically
  const avatarUrl = localStorage.getItem(`af_avatar_url_${user.id}`) || ""

  const getInitials = (userName: string) => {
    return userName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase()
  }

  // Filter navigation items by role permissions
  const showDepartments = isAdmin || isDepartmentHead
  const showEmployees = isAdmin || isDepartmentHead
  const showCategories = isAdmin || isAssetManager
  const showAssets = true // Admin, Asset Manager, and Employee can view assets (filtered by permission internally)
  const showConfiguration = isAdmin || isAssetManager

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800 bg-slate-900/40 flex-shrink-0 flex flex-col">
        <div className="h-14 flex items-center px-6 border-b border-slate-800">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight text-blue-400">
            <Hexagon className="h-5 w-5 fill-blue-500/20" />
            AssetFlow
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          <SidebarItem icon={LayoutDashboard} label="Dashboard" href="/" active={location === "/"} />
          
          {showDepartments && (
            <SidebarItem icon={Building2} label="Departments" href="/departments" active={location.startsWith("/departments")} />
          )}
          
          {showEmployees && (
            <SidebarItem icon={Users} label="Employees" href="/employees" active={location.startsWith("/employees")} />
          )}
          
          {showCategories && (
            <SidebarItem icon={Tags} label="Categories" href="/categories" active={location.startsWith("/categories")} />
          )}
          
          {showAssets && (
            <SidebarItem icon={Package} label="Assets" href="/assets" active={location.startsWith("/assets")} />
          )}
          
          {showConfiguration && (
            <>
              <div className="pt-4 pb-2">
                <div className="px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">System</div>
              </div>
              <SidebarItem icon={Settings} label="Configuration" href="/configuration" active={location.startsWith("/configuration")} />
            </>
          )}
        </div>
        
        {/* User Summary at Bottom */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/20">
          <Link href="/profile" className="flex items-center gap-3 group">
            <div className="h-8 w-8 rounded-full border border-slate-700 overflow-hidden bg-slate-800 flex items-center justify-center text-slate-300 font-bold text-xs select-none">
              {avatarUrl ? (
                <img src={avatarUrl} alt={user.name} className="h-full w-full object-cover" />
              ) : (
                getInitials(user.name)
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-slate-200 truncate group-hover:text-blue-400 transition-colors">
                {user.name}
              </span>
              <span className="text-[10px] text-slate-500 font-medium capitalize">
                {user.role.replace("_", " ")}
              </span>
            </div>
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-950">
        {/* Topbar */}
        <header className="h-14 border-b border-slate-800 bg-slate-900/10 backdrop-blur flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input 
                type="text" 
                placeholder="Search assets, categories..." 
                className="h-8.5 w-full bg-slate-900 border border-slate-800 rounded-md pl-9 pr-3 text-xs focus:outline-none focus:border-slate-700 focus:ring-1 focus:ring-slate-700 text-slate-200 placeholder-slate-600"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="text-slate-400 hover:text-slate-200 relative p-1.5 rounded-full hover:bg-slate-900/50">
              <Bell className="h-4.5 w-4.5" />
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-red-500"></span>
            </button>

            {/* Profile Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2 pl-2 pr-1.5 py-1 rounded-full border border-slate-800 hover:bg-slate-900/40 transition-colors text-slate-300 hover:text-slate-100"
              >
                <div className="h-6 w-6 rounded-full border border-slate-700 overflow-hidden bg-slate-800 flex items-center justify-center text-slate-300 font-bold text-[10px]">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={user.name} className="h-full w-full object-cover" />
                  ) : (
                    getInitials(user.name)
                  )}
                </div>
                <span className="text-xs font-medium max-w-[100px] truncate">{user.name.split(" ")[0]}</span>
                <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
              </button>

              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-800 bg-slate-950/95 backdrop-blur shadow-2xl py-1 z-50 text-slate-200">
                  <div className="px-4 py-2 border-b border-slate-800">
                    <p className="text-xs font-semibold text-slate-200 truncate">{user.name}</p>
                    <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
                    <Badge variant="outline" className="mt-1.5 bg-blue-600/10 text-blue-400 border-blue-500/20 capitalize text-[9px] px-2 py-0">
                      {user.role.replace("_", " ")}
                    </Badge>
                  </div>
                  
                  <button 
                    onClick={() => { setLocation("/profile"); setIsDropdownOpen(false) }}
                    className="w-full text-left px-4 py-2 text-xs hover:bg-slate-900 flex items-center gap-2.5 transition-colors"
                  >
                    <UserIcon className="h-4 w-4 text-slate-500" />
                    My Profile
                  </button>
                  <button 
                    onClick={() => { setLocation("/profile"); setIsDropdownOpen(false) }}
                    className="w-full text-left px-4 py-2 text-xs hover:bg-slate-900 flex items-center gap-2.5 transition-colors"
                  >
                    <Settings className="h-4 w-4 text-slate-500" />
                    Account Settings
                  </button>
                  <button 
                    onClick={() => { setLocation("/profile"); setIsDropdownOpen(false) }}
                    className="w-full text-left px-4 py-2 text-xs hover:bg-slate-900 flex items-center gap-2.5 transition-colors"
                  >
                    <Lock className="h-4 w-4 text-slate-500" />
                    Change Password
                  </button>
                  <div className="border-t border-slate-800 my-1"></div>
                  <button 
                    onClick={() => { setIsLogoutModalOpen(true); setIsDropdownOpen(false) }}
                    className="w-full text-left px-4 py-2 text-xs text-red-400 hover:bg-slate-900 hover:text-red-300 flex items-center gap-2.5 transition-colors font-semibold"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        
        {/* Page Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>

      {/* Logout Confirmation Modal */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-sm w-full p-6 text-slate-100 shadow-2xl relative">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-red-500"></div>
            
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <LogOut className="h-5 w-5 text-red-500" /> Confirm Logout
            </h3>
            <p className="text-slate-400 text-xs mt-2 leading-relaxed">
              Are you sure you want to end your active session and logout of AssetFlow ERP?
            </p>
            
            <div className="mt-6 flex justify-end gap-3">
              <Button 
                variant="outline" 
                className="border-slate-800 hover:bg-slate-800 hover:text-white text-slate-300 text-xs h-9 px-4 rounded-md"
                onClick={() => setIsLogoutModalOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                className="bg-red-600 hover:bg-red-500 text-white text-xs h-9 px-4 rounded-md shadow-lg shadow-red-600/10"
                onClick={() => { setIsLogoutModalOpen(false); logout() }}
              >
                Logout
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
