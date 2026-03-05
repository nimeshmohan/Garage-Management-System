import { useState, useEffect } from "react";
import { useVehicles, useUpdateVehicle } from "@/hooks/use-vehicles";
import { useUser } from "@/hooks/use-auth";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/status-badge";
import { PlayCircle, CheckCircle2, History, ClipboardList, PauseCircle, Package } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function TechnicianDashboard() {
  const { data: user } = useUser();
  const { data: vehicles, isLoading } = useVehicles();
  const updateVehicle = useUpdateVehicle();
  
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [workDetails, setWorkDetails] = useState("");
  const [currentTime, setCurrentTime] = useState<Record<number, number>>({});

  useEffect(() => {
    const timer = setInterval(() => {
      const updates: Record<number, number> = {};
      vehicles?.forEach(v => {
        if (v.isTimerRunning && v.lastTimerStartedAt) {
          const start = new Date(v.lastTimerStartedAt).getTime();
          const now = new Date().getTime();
          const elapsedSinceStart = Math.floor((now - start) / 1000);
          updates[v.id] = (v.totalWorkDuration || 0) + elapsedSinceStart;
        } else {
          updates[v.id] = v.totalWorkDuration || 0;
        }
      });
      setCurrentTime(updates);
    }, 1000);
    return () => clearInterval(timer);
  }, [vehicles]);

  const activeJobs = vehicles?.filter(v => v.technicianId === user?.id && v.status !== "Ready for Delivery" && v.status !== "Delivered") || [];
  const completedJobs = vehicles?.filter(v => v.technicianId === user?.id && (v.status === "Ready for Delivery" || v.status === "Delivered")) || [];

  const handleUpdateStatus = (id: number, newStatus: string) => {
    updateVehicle.mutate({ id, status: newStatus });
  };

  const toggleTimer = (v: any) => {
    const now = new Date().toISOString();
    if (v.isTimerRunning) {
      const start = new Date(v.lastTimerStartedAt).getTime();
      const currentNow = new Date().getTime();
      const elapsed = Math.floor((currentNow - start) / 1000);
      const newTotal = (v.totalWorkDuration || 0) + elapsed;
      
      updateVehicle.mutate({
        id: v.id,
        isTimerRunning: false,
        totalWorkDuration: newTotal,
        lastTimerStartedAt: null
      });
    } else {
      updateVehicle.mutate({
        id: v.id,
        isTimerRunning: true,
        lastTimerStartedAt: now,
        status: "Work in Progress" // Auto-start work if not already
      });
    }
  };

  const togglePartsWaiting = (v: any) => {
    updateVehicle.mutate({
      id: v.id,
      isWaitingForParts: !v.isWaitingForParts
    });
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleFinishJob = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    
    const v = vehicles?.find(veh => veh.id === selectedId);
    let totalDuration = v?.totalWorkDuration || 0;
    if (v?.isTimerRunning && v.lastTimerStartedAt) {
      const start = new Date(v.lastTimerStartedAt).getTime();
      const now = new Date().getTime();
      totalDuration += Math.floor((now - start) / 1000);
    }

    updateVehicle.mutate({
      id: selectedId,
      workDetails,
      status: "Ready for Delivery",
      isTimerRunning: false,
      totalWorkDuration: totalDuration,
      lastTimerStartedAt: null
    }, {
      onSuccess: () => {
        setSelectedId(null);
        setWorkDetails("");
      }
    });
  };

  const VehicleCard = ({ v, showActions = true }: { v: any, showActions?: boolean }) => (
    <Card key={v.id} className="border-border/50 shadow-lg relative overflow-hidden group">
      <div className={`absolute top-0 left-0 w-1 h-full ${showActions ? (v.isWaitingForParts ? "bg-orange-500" : "bg-primary") : "bg-muted-foreground/30"} group-hover:w-2 transition-all duration-300`}/>
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="font-bold text-xl">{v.vehicleModel}</h3>
            <p className="text-sm font-medium text-primary">{v.jobCardNumber}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <StatusBadge status={v.isWaitingForParts ? "Waiting for Parts" : v.status} />
            <div className="text-lg font-mono font-bold bg-muted px-2 py-1 rounded">
              {formatTime(currentTime[v.id] || 0)}
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
          <div className="bg-muted/40 p-3 rounded-lg">
            <span className="text-muted-foreground block text-xs">Service Needed</span>
            <span className="font-medium">{v.serviceType}</span>
          </div>
          <div className="bg-muted/40 p-3 rounded-lg">
            <span className="text-muted-foreground block text-xs">Est. Time</span>
            <span className="font-medium">{v.estimatedTime || "Not set"}</span>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <span className="text-muted-foreground block text-xs mb-1">Adviser Notes</span>
            <p className="text-sm bg-blue-50/50 dark:bg-blue-900/10 p-3 rounded-lg border border-blue-100 dark:border-blue-900/30">
              {v.serviceNotes || "No specific notes provided."}
            </p>
          </div>
          {v.workDetails && (
            <div>
              <span className="text-muted-foreground block text-xs mb-1">Work Done</span>
              <p className="text-sm bg-green-50/50 dark:bg-green-900/10 p-3 rounded-lg border border-green-100 dark:border-green-900/30">
                {v.workDetails}
              </p>
            </div>
          )}
        </div>
      </CardContent>
      {showActions && (
        <CardFooter className="bg-muted/20 border-t p-4 flex flex-wrap gap-2">
          <Button 
            variant={v.isTimerRunning ? "destructive" : "default"}
            className="flex-1 shadow-md"
            onClick={() => toggleTimer(v)}
          >
            {v.isTimerRunning ? <><PauseCircle className="w-4 h-4 mr-2" /> Pause</> : <><PlayCircle className="w-4 h-4 mr-2" /> {v.status === "Waiting for Technician Approval" ? "Start Work" : "Resume"}</>}
          </Button>

          <Button 
            variant="outline"
            className={`flex-1 ${v.isWaitingForParts ? "bg-orange-100 border-orange-500 text-orange-700" : ""}`}
            onClick={() => togglePartsWaiting(v)}
          >
            <Package className="w-4 h-4 mr-2" /> {v.isWaitingForParts ? "Parts Received" : "Waiting for Parts"}
          </Button>
          
          <Button 
            variant="default" 
            className="w-full bg-green-600 hover:bg-green-700 shadow-md shadow-green-500/20"
            onClick={() => setSelectedId(v.id)}
          >
            <CheckCircle2 className="w-4 h-4 mr-2" /> Mark Completed
          </Button>
        </CardFooter>
      )}
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-display font-bold text-foreground">Technician Dashboard</h2>
        <p className="text-muted-foreground mt-1">Review assigned tasks and update job progress.</p>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-8">
          <TabsTrigger value="active" className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4" />
            My Active Jobs ({activeJobs.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            Completed ({completedJobs.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {isLoading ? (
              <p className="text-muted-foreground">Loading jobs...</p>
            ) : activeJobs.length === 0 ? (
              <div className="col-span-full py-12 flex flex-col items-center justify-center text-muted-foreground bg-card border border-dashed rounded-2xl">
                <ClipboardList className="w-12 h-12 mb-4 text-muted" />
                <p className="text-lg">No active jobs assigned.</p>
              </div>
            ) : (
              activeJobs.map(v => <VehicleCard key={v.id} v={v} />)
            )}
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {completedJobs.length === 0 ? (
              <div className="col-span-full py-12 flex flex-col items-center justify-center text-muted-foreground bg-card border border-dashed rounded-2xl">
                <History className="w-12 h-12 mb-4 text-muted" />
                <p className="text-lg">No completed jobs found.</p>
              </div>
            ) : (
              completedJobs.map(v => <VehicleCard key={v.id} v={v} showActions={false} />)
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedId} onOpenChange={(val) => !val && setSelectedId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Job</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleFinishJob} className="space-y-4 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Work Done Details</label>
              <Textarea 
                required 
                placeholder="Describe the repairs and services completed..."
                className="min-h-[120px]"
                value={workDetails}
                onChange={e => setWorkDetails(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={updateVehicle.isPending}>
              {updateVehicle.isPending ? "Submitting..." : "Finish Job & Mark Ready"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

