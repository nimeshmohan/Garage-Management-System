import React, { useState, useMemo, ChangeEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Vehicle } from "@shared/schema";
import { 
  LayoutDashboard, 
  Car, 
  Users, 
  ClipboardList, 
  BarChart2, 
  LogOut,
  Loader2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  PieChart, Pie, Cell, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  LineChart, Line, ResponsiveContainer 
} from "recharts";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";

interface AnalyticsData {
  statusDistribution: { name: string; value: number }[];
  advisorPerformance: { name: string; total: number; pending: number; completed: number }[];
  techWorkload: { name: string; assigned: number; active: number }[];
  dailyActivity: { date: string; received: number; completed: number }[];
  pendingDist: { name: string; value: number }[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#ff7300', '#413ea0', '#003f5c', '#58508d', '#bc5090', '#ff6361', '#ffa600'];

// Component for the Analysis Tab
function AnalysisView({ data }: { data: AnalyticsData }) {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Workshop Analysis</h2>
          <p className="text-muted-foreground">Graphical representations of workshop performance and data.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <Card className="shadow-sm border-none bg-background/60 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Vehicles Status Distribution</CardTitle>
            <CardDescription>Current mix of all vehicle statuses</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.statusDistribution}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                >
                  {data.statusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend layout="vertical" align="right" verticalAlign="middle" />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Pending Work Distribution (Donut) */}
        <Card className="shadow-sm border-none bg-background/60 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Pending Work Distribution</CardTitle>
            <CardDescription>Bottleneck analysis by department</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.pendingDist}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {data.pendingDist.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[(index + 4) % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Advisor Performance */}
        <Card className="lg:col-span-2 shadow-sm border-none bg-background/60 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Service Advisor Performance</CardTitle>
            <CardDescription>Efficiency metrics per advisor</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.advisorPerformance} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="total" fill="#8884d8" name="Total Assigned" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pending" fill="#ffbb28" name="Pending" radius={[4, 4, 0, 0]} />
                <Bar dataKey="completed" fill="#82ca9d" name="Completed" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Technician Workload */}
        <Card className="shadow-sm border-none bg-background/60 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Technician Workload</CardTitle>
            <CardDescription>Current job allocation per technician</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.techWorkload} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.1} />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} />
                <Tooltip />
                <Legend />
                <Bar dataKey="assigned" fill="#0088FE" name="Assigned Jobs" radius={[0, 4, 4, 0]} />
                <Bar dataKey="active" fill="#00C49F" name="Active Now" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Daily Activity */}
        <Card className="shadow-sm border-none bg-background/60 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Workshop Daily Activity</CardTitle>
            <CardDescription>Incoming vs completions (Last 14 days)</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.dailyActivity} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                <XAxis dataKey="date" hide />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="received" stroke="#8884d8" strokeWidth={3} dot={false} name="Received" />
                <Line type="monotone" dataKey="completed" stroke="#82ca9d" strokeWidth={3} dot={false} name="Completed" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Summary Component for Dashboard Tab
function DashboardSummary({ vehicles, analytics }: { vehicles: Vehicle[], analytics: AnalyticsData }) {
  const kpis = useMemo(() => [
    { label: "Total Vehicles", value: vehicles.length, color: "bg-blue-500" },
    { label: "In Workshop", value: vehicles.filter(v => v.status !== "Delivered").length, color: "bg-amber-500" },
    { label: "Completed Today", value: analytics.dailyActivity[analytics.dailyActivity.length - 1]?.completed || 0, color: "bg-green-500" },
    { label: "Pending Allocation", value: vehicles.filter(v => v.status === "Waiting for Job Allocation").length, color: "bg-purple-500" },
  ], [vehicles, analytics]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <Card key={i} className="border-none shadow-sm">
            <CardContent className="p-6 flex items-center space-x-4">
              <div className={`w-12 h-12 rounded-full ${kpi.color} flex items-center justify-center text-white`}>
                <Car className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{kpi.label}</p>
                <h3 className="text-2xl font-bold">{kpi.value}</h3>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-none shadow-sm h-fit">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="space-y-4">
               {vehicles.slice(0, 5).map((v) => (
                 <div key={v.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                   <div>
                     <p className="font-semibold">{v.vehicleNumber}</p>
                     <p className="text-xs text-muted-foreground">{v.customerName} • {v.vehicleModel}</p>
                   </div>
                   <div className="text-right">
                     <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                       v.status === 'Work in Progress' ? 'bg-blue-100 text-blue-700' : 
                       v.status === 'Delivered' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                     }`}>
                       {v.status}
                     </span>
                   </div>
                 </div>
               ))}
             </div>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-sm">
           <CardHeader>
             <CardTitle>Quick Actions</CardTitle>
           </CardHeader>
           <CardContent className="flex flex-col gap-3">
             <Button variant="outline" className="w-full justify-start h-12">Search Vehicle...</Button>
             <Button variant="outline" className="w-full justify-start h-12">Export All Data</Button>
             <Button variant="outline" className="w-full justify-start h-12">Manage Technicians</Button>
           </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Vehicles Overview Tab
function VehiclesOverview({ vehicles }: { vehicles: Vehicle[] }) {
  const [search, setSearch] = useState("");
  
  const filtered = vehicles.filter(v => 
    v.vehicleNumber.toLowerCase().includes(search.toLowerCase()) ||
    v.customerName.toLowerCase().includes(search.toLowerCase()) ||
    v.vehicleModel.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Vehicles Overview</h2>
          <p className="text-muted-foreground">Comprehensive list of all vehicles in the system.</p>
        </div>
        <div className="w-72">
           <input 
             type="text" 
             placeholder="Search vehicles..." 
             className="w-full px-4 py-2 rounded-lg border bg-background border-input focus:ring-2 focus:ring-primary outline-none transition-all"
             value={search}
             onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
           />
        </div>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase bg-muted/50 text-muted-foreground font-bold">
              <tr>
                <th className="px-6 py-4">Vehicle No</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Model</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Advisor</th>
                <th className="px-6 py-4">Date Added</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((v) => (
                <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4 font-bold text-primary">{v.vehicleNumber}</td>
                  <td className="px-6 py-4">{v.customerName}</td>
                  <td className="px-6 py-4 truncate max-w-[150px]">{v.vehicleModel}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                      v.status === 'Work in Progress' ? 'bg-blue-100 text-blue-700' : 
                      v.status === 'Delivered' ? 'bg-green-100 text-green-700' : 
                      v.status === 'Job Stopped' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {v.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">{v.serviceAdviser || "-"}</td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {v.createdAt ? new Date(v.createdAt).toLocaleDateString() : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// Staff Performance Tab
function StaffPerformance({ analytics }: { analytics: AnalyticsData }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Staff Performance</h2>
        <p className="text-muted-foreground">Efficiency and workload metrics for all staff members.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle>Advisor Efficiency</CardTitle>
              <CardDescription>Job completion rates per advisor</CardDescription>
            </CardHeader>
            <CardContent>
               <div className="space-y-6">
                 {analytics.advisorPerformance.map((adv) => {
                   const completionRate = adv.total > 0 ? (adv.completed / adv.total) * 100 : 0;
                   return (
                     <div key={adv.name} className="space-y-2">
                        <div className="flex justify-between items-center text-sm">
                          <span className="font-bold">{adv.name}</span>
                          <span className="text-muted-foreground">{adv.completed} / {adv.total} Completed</span>
                        </div>
                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                           <div 
                             className="h-full bg-primary transition-all duration-500" 
                             style={{ width: `${completionRate}%` }}
                           />
                        </div>
                     </div>
                   );
                 })}
               </div>
            </CardContent>
         </Card>

         <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle>Technician Workload</CardTitle>
              <CardDescription>Current jobs assigned to each technician</CardDescription>
            </CardHeader>
            <CardContent>
               <div className="space-y-4">
                 {analytics.techWorkload.map((tech) => (
                   <div key={tech.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                      <div>
                        <p className="font-bold">{tech.name}</p>
                        <p className="text-xs text-muted-foreground">{tech.active} Active Jobs</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-black text-primary">{tech.assigned}</p>
                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-tighter">Total</p>
                      </div>
                   </div>
                 ))}
               </div>
            </CardContent>
         </Card>
      </div>
    </div>
  );
}

// Pending Work Tab
function PendingWork({ vehicles }: { vehicles: Vehicle[] }) {
  const pending = vehicles.filter(v => v.status !== "Delivered" && v.status !== "Job Completed");
  const stopped = vehicles.filter(v => v.status === "Job Stopped");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Pending Work</h2>
        <p className="text-muted-foreground">Track jobs that are currently incomplete or stopped.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-none shadow-sm h-fit">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Delayed & Stopped Jobs</CardTitle>
            <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold">
              {stopped.length} Stopped
            </span>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
               {stopped.length === 0 ? (
                 <p className="text-center py-8 text-muted-foreground italic">No stopped jobs currently.</p>
               ) : (
                 stopped.map(v => (
                   <div key={v.id} className="p-4 rounded-xl border border-red-100 bg-red-50/30 flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-red-900">{v.vehicleNumber}</h4>
                        <p className="text-sm text-red-700/70">{v.vehicleModel}</p>
                        <p className="text-xs mt-2 font-medium text-red-800">Reason: {v.stopReason || "Not specified"}</p>
                      </div>
                      <div className="text-right">
                         <p className="text-xs font-bold uppercase text-red-600">Stopped At</p>
                         <p className="text-sm font-bold text-red-900">
                           {v.stopTimerStartedAt ? new Date(v.stopTimerStartedAt).toLocaleTimeString() : "-"}
                         </p>
                      </div>
                   </div>
                 ))
               )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-primary text-primary-foreground">
          <CardHeader>
            <CardTitle className="text-white">Active Backlog</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-6">
               <h3 className="text-6xl font-black mb-2">{pending.length}</h3>
               <p className="opacity-80 font-medium">Vehicles currently in workshop</p>
            </div>
            <div className="space-y-3 mt-4">
               <div className="flex justify-between text-sm border-t border-white/20 pt-3">
                 <span>Waiting for Allocation</span>
                 <span className="font-bold">{vehicles.filter(v => v.status === "Waiting for Job Allocation").length}</span>
               </div>
               <div className="flex justify-between text-sm border-t border-white/20 pt-3">
                 <span>Work in Progress</span>
                 <span className="font-bold">{vehicles.filter(v => v.status === "Work in Progress").length}</span>
               </div>
               <div className="flex justify-between text-sm border-t border-white/20 pt-3">
                 <span>Inspection Ongoing</span>
                 <span className="font-bold">{vehicles.filter(v => v.status === "Inspection Ongoing").length}</span>
               </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function ServiceHeadAnalysisPage() {
  const { data: analytics, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["/api/analytics"],
    refetchInterval: 30000,
  });

  if (isLoading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!analytics) return null;

  return <AnalysisView data={analytics} />;
}

export function ServiceHeadDashboardPage() {
  const { 
    data: vehicles = [], 
    isLoading: isLoadingVehicles, 
    error: vehiclesError 
  } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
    refetchInterval: 30000,
  });

  const { 
    data: analytics, 
    isLoading: isLoadingAnalytics,
    error: analyticsError
  } = useQuery<AnalyticsData>({
    queryKey: ["/api/analytics"],
    refetchInterval: 30000,
    retry: false // Don't spam retries for auth errors
  });

  if (isLoadingVehicles || isLoadingAnalytics) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  
  if (vehiclesError || analyticsError) {
    const error: any = analyticsError || vehiclesError;
    return (
      <div className="p-8">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800">Error Loading Dashboard</CardTitle>
            <CardDescription className="text-red-600">
              {error?.message || "An unexpected error occurred"}
            </CardDescription>
          </CardHeader>
          <CardContent>
             <p className="text-sm text-red-700 mb-4 text-pretty">
               The dashboard could not be loaded because of a permission or data server issue.
             </p>
             {error?.debug && (
               <div className="bg-red-100 p-4 rounded-lg text-xs font-mono text-red-900 overflow-auto max-h-40">
                 <p className="font-bold mb-1 underline">Debug Information:</p>
                 <pre>{JSON.stringify(error.debug, null, 2)}</pre>
               </div>
             )}
             <Button variant="outline" className="mt-6 border-red-300 text-red-800 hover:bg-red-100" onClick={() => window.location.reload()}>
               Try Refreshing
             </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!analytics) return null;

  return <DashboardSummary vehicles={vehicles} analytics={analytics} />;
}

export function ServiceHeadVehiclesPage() {
  const { data: vehicles = [], isLoading } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
    refetchInterval: 30000,
  });

  if (isLoading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return <VehiclesOverview vehicles={vehicles} />;
}

export function ServiceHeadStaffPage() {
  const { data: analytics, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["/api/analytics"],
    refetchInterval: 30000,
  });

  if (isLoading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!analytics) return null;

  return <StaffPerformance analytics={analytics} />;
}

export function ServiceHeadPendingPage() {
  const { data: vehicles = [], isLoading } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
    refetchInterval: 30000,
  });

  if (isLoading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return <PendingWork vehicles={vehicles} />;
}

