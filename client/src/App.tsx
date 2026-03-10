import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useUser } from "@/hooks/use-auth";

// Pages
import NotFound from "@/pages/not-found";
import { Login } from "@/pages/login";
import { Register } from "@/pages/register";
import { Layout } from "@/components/layout";
import { ReceptionistDashboard } from "@/pages/dashboard-receptionist";
import { AdviserDashboard } from "@/pages/dashboard-adviser";
import { ControllerDashboard } from "@/pages/dashboard-controller";
import { TechnicianDashboard } from "@/pages/dashboard-technician";
import { 
  ServiceHeadDashboardPage,
  ServiceHeadVehiclesPage,
  ServiceHeadStaffPage,
  ServiceHeadPendingPage,
  ServiceHeadAnalysisPage
} from "@/pages/dashboard-service-head";
import { TrackVehicle } from "@/pages/track-vehicle";
import { Loader2 } from "lucide-react";

// Protection wrapper
function ProtectedRoute({ component: Component, allowedRoles }: { component: React.ComponentType, allowedRoles?: string[] }) {
  const { data: user, isLoading } = useUser();

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // If they have a role but try to access wrong route, kick them back to their default
    const defaults: Record<string, string> = {
      receptionist: "/receptionist",
      service_adviser: "/service-adviser",
      job_controller: "/job-controller",
      technician: "/technician",
      service_head: "/service-head",
      customer: "/track"
    };
    return <Redirect to={defaults[user.role] || "/"} />;
  }

  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function Router() {
  const { data: user, isLoading } = useUser();

  if (isLoading) return null; // Let the query settle

  return (
    <Switch>
      {/* Public Routes */}
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/track" component={TrackVehicle} />

      {/* Role-based Dashboards */}
      <Route path="/receptionist">
        {() => <ProtectedRoute component={ReceptionistDashboard} allowedRoles={["receptionist"]} />}
      </Route>
      <Route path="/service-adviser">
        {() => <ProtectedRoute component={AdviserDashboard} allowedRoles={["service_adviser"]} />}
      </Route>
      <Route path="/job-controller">
        {() => <ProtectedRoute component={ControllerDashboard} allowedRoles={["job_controller"]} />}
      </Route>
      <Route path="/technician">
        {() => <ProtectedRoute component={TechnicianDashboard} allowedRoles={["technician"]} />}
      </Route>
      
      {/* Service Head Routes */}
      <Route path="/service-head">
        {() => <ProtectedRoute component={ServiceHeadDashboardPage} allowedRoles={["service_head"]} />}
      </Route>
      <Route path="/service-head/vehicles">
        {() => <ProtectedRoute component={ServiceHeadVehiclesPage} allowedRoles={["service_head"]} />}
      </Route>
      <Route path="/service-head/staff">
        {() => <ProtectedRoute component={ServiceHeadStaffPage} allowedRoles={["service_head"]} />}
      </Route>
      <Route path="/service-head/pending">
        {() => <ProtectedRoute component={ServiceHeadPendingPage} allowedRoles={["service_head"]} />}
      </Route>
      <Route path="/service-head/analysis">
        {() => <ProtectedRoute component={ServiceHeadAnalysisPage} allowedRoles={["service_head"]} />}
      </Route>

      {/* Service Head Routes */}
      <Route path="/service-head">
        {() => <ProtectedRoute component={ServiceHeadDashboardPage} allowedRoles={["service_head"]} />}
      </Route>
      <Route path="/service-head/vehicles">
        {() => <ProtectedRoute component={ServiceHeadVehiclesPage} allowedRoles={["service_head"]} />}
      </Route>
      <Route path="/service-head/staff">
        {() => <ProtectedRoute component={ServiceHeadStaffPage} allowedRoles={["service_head"]} />}
      </Route>
      <Route path="/service-head/pending">
        {() => <ProtectedRoute component={ServiceHeadPendingPage} allowedRoles={["service_head"]} />}
      </Route>
      <Route path="/service-head/analysis">
        {() => <ProtectedRoute component={ServiceHeadAnalysisPage} allowedRoles={["service_head"]} />}
      </Route>

      {/* Root redirect */}
      <Route path="/">
        {() => {
          if (!user) return <Redirect to="/login" />;
          const defaults: Record<string, string> = {
            receptionist: "/receptionist",
            service_adviser: "/service-adviser",
            job_controller: "/job-controller",
            technician: "/technician",
            service_head: "/service-head",
            customer: "/track"
          };
          return <Redirect to={defaults[user.role] || "/login"} />;
        }}
      </Route>

      {/* Fallback */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
