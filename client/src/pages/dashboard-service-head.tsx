import { useQuery } from "@tanstack/react-query";
import { Vehicle } from "@shared/schema";
import { 
  LayoutDashboard, 
  Car, 
  Users, 
  ClipboardList, 
  BarChart2, 
  LogOut,
  Loader2,
  BarChart3,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  Briefcase,
  AlertCircle,
  CalendarClock,
  AlertOctagon
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  PieChart, Pie, Cell, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  LineChart, Line, ResponsiveContainer 
} from "recharts";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import { useState, useMemo, ChangeEvent } from "react";
import { format } from "date-fns";

// Types matching backend API
interface AnalyticsData {
  stats: {
    appointed: { today: number; monthly: number };
    received: { today: number; monthly: number };
    serviced: { today: number; monthly: number };
    pending: number;
    jobStopped: number;
    delivered: number;
  };
  workflow: {
    waitingAllocation: number;
    assigned: number;
    wip: number;
    finalInspection: number;
    reopened: number;
  };
  techPerformance: Array<{
    id: number;
    name: string;
    activeJobs: number;
    completedToday: number;
  }>;
  alerts: Array<{
    vehicleNumber: string;
    status: string;
    aging: string;
  }>;
  // Chart data from remote version
  statusDistribution?: { name: string; value: number }[];
  advisorPerformance?: { name: string; total: number; pending: number; completed: number }[];
  techWorkload?: { name: string; assigned: number; active: number }[];
  dailyActivity?: { date: string; received: number; completed: number }[];
  pendingDist?: { name: string; value: number }[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#ff7300', '#413ea0', '#003f5c', '#58508d', '#bc5090', '#ff6361', '#ffa600'];

// --- Sub-components for UI elements ---

function StatCard({ title, count, monthly, icon: Icon, color, isStock = false }: any) {
  const colorMap: any = {
    blue: "text-blue-600 bg-blue-100 ring-blue-500/10",
    green: "text-emerald-600 bg-emerald-100 ring-emerald-500/10",
    orange: "text-orange-600 bg-orange-100 ring-orange-500/10",
    red: "text-rose-600 bg-rose-100 ring-rose-500/10"
  };

  return (
    <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
      <Card className="border-border/50 shadow-sm hover:shadow-md transition-all h-full bg-white/50 overflow-hidden">
        <div className={`h-1.5 w-full ${color === 'blue' ? 'bg-blue-500' : color === 'green' ? 'bg-emerald-500' : color === 'orange' ? 'bg-orange-500' : 'bg-rose-500'}`} />
        <CardContent className="p-4 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{title}</span>
            <div className={`p-1.5 rounded-lg ${colorMap[color]}`}>
              <Icon className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">{count || 0}</div>
            <div className="text-[10px] mt-1 flex items-center gap-1.5">
              <span className="text-slate-400 font-medium">{isStock ? "Current" : "Today"}</span>
              {!isStock && monthly !== undefined && (
                <>
                  <ChevronRight className="w-2.5 h-2.5 text-slate-300" />
                  <span className="text-primary font-bold">M: {monthly}</span>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function WorkflowCounter({ label, count, color }: any) {
  const colors: any = {
    yellow: "text-yellow-600 border-yellow-200 bg-yellow-50",
    blue: "text-blue-600 border-blue-200 bg-blue-50",
    purple: "text-purple-600 border-purple-200 bg-purple-50",
    orange: "text-orange-600 border-orange-200 bg-orange-50",
    red: "text-red-600 border-red-200 bg-red-50"
  };

  return (
    <div className={`p-3 rounded-xl border text-center ${colors[color]}`}>
      <div className="text-xl font-black">{count || 0}</div>
      <div className="text-[10px] font-bold uppercase tracking-tight">{label}</div>
    </div>
  );
}

function BottleneckBar({ label, count, max, color }: any) {
  const percentage = Math.min(((count || 0) / max) * 100, 100);
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs font-medium">
        <span>{label}</span>
        <span className="font-bold">{count || 0} Vehicles</span>
      </div>
      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
        <motion.div 
          className={`h-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

// --- Main Views (Tabs) ---

function DashboardSummary({ analytics }: { analytics: AnalyticsData }) {
  const { stats, workflow, techPerformance, alerts } = analytics;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header with Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">Workshop Control Center</h1>
          <p className="text-muted-foreground">Real-time monitoring and operational overview</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="gap-2">
            <Search className="w-4 h-4" />
            Search Vehicle
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <ArrowDownRight className="w-4 h-4" />
            Export Data
          </Button>
          <Badge variant="outline" className="px-3 py-1 text-sm font-medium border-primary/20 bg-primary/5 text-primary ml-2">
            Live Feed
          </Badge>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard title="Appointed" count={stats?.appointed.today} monthly={stats?.appointed.monthly} icon={Clock} color="blue" />
        <StatCard title="Received" count={stats?.received.today} monthly={stats?.received.monthly} icon={Car} color="blue" />
        <StatCard title="Serviced" count={stats?.serviced.today} monthly={stats?.serviced.monthly} icon={CheckCircle2} color="green" />
        <StatCard title="Pending" count={stats?.pending} isStock icon={Clock} color="orange" />
        <StatCard title="Job Stopped" count={stats?.jobStopped} isStock icon={AlertTriangle} color="red" />
        <StatCard title="Delivered" count={stats?.delivered} isStock icon={Briefcase} color="green" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Workshop Activity */}
        <Card className="lg:col-span-2 border-border/50 shadow-sm glass-panel">
          <CardHeader className="border-b border-border/10 bg-muted/20">
            <CardTitle className="text-xl">Workshop Activity Overview</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <WorkflowCounter label="Allocation" count={workflow?.waitingAllocation} color="yellow" />
                <WorkflowCounter label="Assigned" count={workflow?.assigned} color="blue" />
                <WorkflowCounter label="WIP" count={workflow?.wip} color="purple" />
                <WorkflowCounter label="Inspection" count={workflow?.finalInspection} color="orange" />
                <WorkflowCounter label="Reopened" count={workflow?.reopened} color="red" />
              </div>
              <div className="pt-6 border-t border-border/50">
                <h4 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-orange-500" />
                  Workshop Bottleneck Indicator
                </h4>
                <div className="grid gap-4">
                  <BottleneckBar label="Waiting for Allocation" count={workflow?.waitingAllocation} max={20} color="bg-yellow-500" />
                  <BottleneckBar label="Technical Assigned" count={workflow?.assigned} max={20} color="bg-blue-500" />
                  <BottleneckBar label="Work in Progress" count={workflow?.wip} max={20} color="bg-purple-500" />
                  <BottleneckBar label="Final Inspection" count={workflow?.finalInspection} max={20} color="bg-orange-500" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Technician Board */}
        <Card className="border-border/50 shadow-sm glass-panel">
          <CardHeader className="border-b border-border/10 bg-muted/20">
            <CardTitle className="text-xl">Technician Activity</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead>Technician</TableHead>
                  <TableHead className="text-center">Active</TableHead>
                  <TableHead className="text-center">Done</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {techPerformance?.map((tech: any) => (
                  <TableRow key={tech.name} className="hover:bg-muted/20">
                    <TableCell className="font-medium">{tech.name}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="bg-purple-100 text-purple-700">{tech.activeJobs}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="bg-green-100 text-green-700">{tech.completedToday}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Delay Alerts */}
      <Card className="border-border/50 shadow-sm border-l-4 border-l-orange-500 bg-orange-50/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2 text-orange-700">
            <AlertTriangle className="w-5 h-5" />
            Vehicle Delay Alerts
          </CardTitle>
          <CardDescription>Vehicles exceeding 24 hours in workshop</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {alerts?.length > 0 ? alerts.map((alert: any) => (
              <div key={alert.vehicleNumber} className="flex items-center justify-between p-3 bg-white/60 border border-orange-200 rounded-xl shadow-sm">
                <div>
                  <div className="font-bold text-slate-900">{alert.vehicleNumber}</div>
                  <div className="text-xs text-orange-600 font-medium">{alert.status}</div>
                </div>
                <Badge className="bg-orange-500 text-white border-none">{alert.aging} ⚠</Badge>
              </div>
            )) : (
              <div className="col-span-full py-4 text-center text-muted-foreground italic">No critically delayed vehicles detected.</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AnalysisView({ data }: { data: AnalyticsData }) {
  if (!data.statusDistribution) return <div className="p-8 text-center italic text-muted-foreground">Historical data processing in progress...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Workshop Analysis</h2>
        <p className="text-muted-foreground">Graphical representations of workshop performance.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm border-none bg-background/60 backdrop-blur-sm">
          <CardHeader><CardTitle className="text-lg">Status Distribution</CardTitle></CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.statusDistribution} cx="50%" cy="50%" outerRadius={80} fill="#8884d8" dataKey="value" label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}>
                  {data.statusDistribution.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-none bg-background/60 backdrop-blur-sm">
          <CardHeader><CardTitle className="text-lg">Daily Activity (Last 14 Days)</CardTitle></CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.dailyActivity}>
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

        <Card className="lg:col-span-2 shadow-sm border-none bg-background/60 backdrop-blur-sm">
          <CardHeader><CardTitle className="text-lg">Service Advisor Performance</CardTitle></CardHeader>
          <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.advisorPerformance}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="total" fill="#8884d8" name="Total Assigned" radius={[4, 4, 0, 0]} />
                <Bar dataKey="completed" fill="#82ca9d" name="Completed" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function VehiclesOverview({ vehicles, techPerformance }: { vehicles: Vehicle[], techPerformance: any[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("today");

  const filtered = vehicles.filter(v => {
    const matchesSearch = v.vehicleNumber.toLowerCase().includes(search.toLowerCase()) || 
                          v.customerName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || v.status === statusFilter;
    
    const receivedDate = v.receivedAt ? new Date(v.receivedAt) : new Date(v.createdAt);
    const now = new Date();
    let matchesDate = true;
    if (dateFilter === "today") matchesDate = receivedDate.toDateString() === now.toDateString();
    else if (dateFilter === "week") matchesDate = receivedDate >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    else if (dateFilter === "month") matchesDate = receivedDate.getMonth() === now.getMonth() && receivedDate.getFullYear() === now.getFullYear();
    
    return matchesSearch && matchesStatus && matchesDate;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Today's Appointment": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "Work in Progress": return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      case "Job Stopped": return "bg-red-500/10 text-red-500 border-red-500/20";
      case "Delivered": return "bg-green-500/10 text-green-500 border-green-500/20";
      default: return "bg-slate-500/10 text-slate-500 border-slate-500/20";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Vehicles Overview</h2>
          <p className="text-muted-foreground">Complete tracking of all workshop vehicles</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Input placeholder="Search..." className="w-64" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="All Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vehicles</SelectItem>
              <SelectItem value="Work in Progress">In Progress</SelectItem>
              <SelectItem value="Job Stopped">Stopped</SelectItem>
              <SelectItem value="Delivered">Delivered</SelectItem>
            </SelectContent>
          </Select>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Date Range" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="border-border/50 shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/20">
            <TableRow>
              <TableHead>Vehicle No</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Technician</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>In Workshop</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((v) => {
              const receivedDate = v.receivedAt ? new Date(v.receivedAt) : new Date(v.createdAt);
              const diffHours = Math.floor((new Date().getTime() - receivedDate.getTime()) / (1000 * 60 * 60));
              const tech = techPerformance?.find(t => t.id === v.technicianId)?.name || "-";
              return (
                <TableRow key={v.id} className="hover:bg-muted/10 transition-colors">
                  <td className="px-6 py-4 font-bold text-primary">{v.vehicleNumber}</td>
                  <td className="px-6 py-4">{v.customerName}</td>
                  <td className="px-6 py-4">{v.vehicleModel}</td>
                  <td className="px-6 py-4">{tech}</td>
                  <td className="px-6 py-4">
                    <Badge variant="outline" className={getStatusColor(v.status)}>{v.status}</Badge>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground font-medium">{diffHours} Hours</td>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// --- Page Exports ---

export function ServiceHeadDashboardPage() {
  const { data: analytics, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["/api/analytics"],
    refetchInterval: 30000,
  });

  if (isLoading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!analytics) return null;

  return <DashboardSummary analytics={analytics} />;
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

export function ServiceHeadVehiclesPage() {
  const { data: vehicles = [], isLoading: isLoadingVehicles } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });
  const { data: analytics } = useQuery<AnalyticsData>({
    queryKey: ["/api/analytics"],
  });

  if (isLoadingVehicles) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return <VehiclesOverview vehicles={vehicles} techPerformance={analytics?.techPerformance || []} />;
}

export function ServiceHeadStaffPage() {
  const { data: analytics, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["/api/analytics"],
  });

  if (isLoading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!analytics) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Staff Performance</h2>
        <p className="text-muted-foreground">Efficiency and workload metrics.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-none shadow-sm">
          <CardHeader><CardTitle>Technician Workload</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {analytics.techPerformance.map((tech) => (
              <div key={tech.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                <div><p className="font-bold">{tech.name}</p><p className="text-xs text-muted-foreground">{tech.activeJobs} Active</p></div>
                <div className="text-right"><p className="text-xl font-black text-primary">{tech.completedToday}</p><p className="text-[10px] uppercase font-bold text-muted-foreground">Done Today</p></div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function ServiceHeadPendingPage() {
  const { data: vehicles = [], isLoading } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });

  if (isLoading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const pending = vehicles.filter(v => v.status !== "Delivered");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Pending Works</h2>
        <p className="text-muted-foreground">Track all active vehicle jobs.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-primary text-primary-foreground md:col-span-1">
          <CardHeader><CardTitle className="text-white">Active Backlog</CardTitle></CardHeader>
          <CardContent className="text-center py-6">
            <h3 className="text-6xl font-black">{pending.length}</h3>
            <p className="opacity-80">Vehicles in workshop</p>
          </CardContent>
        </Card>
        <Card className="md:col-span-2 shadow-sm">
          <CardHeader><CardTitle>Recent Delayed Vehicles</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Vehicle</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {pending.slice(0, 5).map(v => (
                  <TableRow key={v.id}><TableCell className="font-bold">{v.vehicleNumber}</TableCell><TableCell><Badge variant="outline">{v.status}</Badge></TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
