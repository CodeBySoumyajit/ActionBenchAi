import { useAuth } from "@/contexts/auth";
import { Link, useLocation } from "wouter";
import { Scale, Upload, ClipboardCheck, LayoutDashboard, LogOut, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Navbar() {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const links = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["UPLOADER", "REVIEWER", "VIEWER"] },
    { href: "/upload", label: "Upload", icon: Upload, roles: ["UPLOADER"] },
    { href: "/verify", label: "Verify Queue", icon: ClipboardCheck, roles: ["REVIEWER"] },
  ].filter(l => user && l.roles.includes(user.role));

  return (
    <nav className="bg-[#1a3c6e] text-white shadow-lg sticky top-0 z-50">
      <div className="max-w-screen-xl mx-auto px-4 flex items-center justify-between h-14">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold text-base tracking-tight">
            <Scale className="h-5 w-5 text-amber-400" />
            <span className="hidden sm:inline">ActionBenchAI</span>
            <span className="text-xs text-blue-300 hidden md:inline font-normal">Court Judgment Intelligence</span>
          </Link>
          <div className="flex items-center gap-1">
            {links.map(link => {
              const Icon = link.icon;
              const isActive = location === link.href || location.startsWith(link.href + "/");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors",
                    isActive
                      ? "bg-white/20 text-white"
                      : "text-blue-200 hover:text-white hover:bg-white/10"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {user && (
            <div className="hidden sm:flex items-center gap-2 text-sm">
              <span className="text-blue-200">{user.name}</span>
              <span className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded font-semibold">{user.role}</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="text-blue-200 hover:text-white hover:bg-white/10"
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </nav>
  );
}
