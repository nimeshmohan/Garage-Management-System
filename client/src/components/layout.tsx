import { ReactNode } from "react";
import { useUser, useLogout } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { 
  CarFront, 
  LayoutDashboard, 
  Wrench, 
  ClipboardCheck, 
  Search, 
  LogOut, 
  User,
  Settings,
  Menu,
  BarChart2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { data: user } = useUser();
  const logout = useLogout();
  const [location] = useLocation();

  if (!user) return <>{children}</>;

  const getLinks = () => {
    switch (user.role) {
      case "receptionist":
        return [{ href: "/receptionist", label: "Dashboard", icon: LayoutDashboard }];
      case "service_adviser":
        return [{ href: "/service-adviser", label: "Inspections", icon: ClipboardCheck }];
      case "job_controller":
        return [{ href: "/job-controller", label: "Job Control", icon: Settings }];
      case "technician":
        return [{ href: "/technician", label: "My Jobs", icon: Wrench }];
      case "service_head":
        return [
          { href: "/service-head", label: "Dashboard", icon: LayoutDashboard },
          { href: "/service-head/vehicles", label: "Vehicle Overview", icon: CarFront },
          { href: "/service-head/staff", label: "Staff Performance", icon: User },
          { href: "/service-head/pending", label: "Pending Works", icon: ClipboardCheck },
          { href: "/service-head/analysis", label: "Analysis", icon: BarChart2 },
        ];
      case "customer":
        return [{ href: "/track", label: "Track Vehicle", icon: Search }];
      default:
        return [];
    }
  };

  const links = getLinks();

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 bg-sidebar border-r border-sidebar-border flex flex-col hidden md:flex">
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border bg-sidebar-accent/50">
          <CarFront className="w-8 h-8 text-sidebar-primary mr-3" />
          <h1 className="text-xl font-display font-bold text-sidebar-foreground">AutoPro CMS</h1>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = location === link.href;
            return (
              <Link key={link.href} href={link.href}>
                <div className={`
                  flex items-center px-4 py-3 rounded-xl cursor-pointer transition-all duration-200
                  ${isActive 
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-primary/20 font-medium' 
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  }
                `}>
                  <Icon className="w-5 h-5 mr-3" />
                  {link.label}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border bg-sidebar-accent/20">
          <div className="flex items-center bg-sidebar-accent/40 p-3 rounded-xl">
            <Avatar className="h-10 w-10 border-2 border-sidebar-border">
              <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground">
                {user.name.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="ml-3 flex-1 overflow-hidden">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{user.name}</p>
              <p className="text-xs text-sidebar-foreground/50 capitalize truncate">{user.role.replace('_', ' ')}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => logout.mutate()} title="Logout" className="text-sidebar-foreground/60 hover:text-destructive">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Mobile Header */}
        <header className="h-16 border-b bg-card flex items-center justify-between px-4 md:hidden">
          <div className="flex items-center">
            <CarFront className="w-6 h-6 text-primary mr-2" />
            <h1 className="font-display font-bold text-foreground">AutoPro</h1>
          </div>
          <Button variant="ghost" size="icon">
            <Menu className="h-6 w-6" />
          </Button>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-muted/30">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
