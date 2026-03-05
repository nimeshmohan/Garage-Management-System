import { useState } from "react";
import { useVehicles, useUpdateVehicle } from "@/hooks/use-vehicles";
import { useTechnicians } from "@/hooks/use-users";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";
import { Wrench, History, ClipboardList } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function ControllerDashboard() {
  const { data: vehicles, isLoading } = useVehicles();
  const { data: technicians } = useTechnicians();
  const updateVehicle = useUpdateVehicle();
  
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [techId, setTechId] = useState("");
  const [estTime, setEstTime] = useState("");

  const pendingAssignments = vehicles?.filter(v => v.status === "Inspection Completed") || [];
  const assignedJobs = vehicles?.filter(v => v.status !== "Inspection Completed" && v.status !== "Vehicle Received") || [];

  const handleAssign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || !techId) return;
    
    updateVehicle.mutate({
      id: selectedId,
      technicianId: parseInt(techId),
      estimatedTime: estTime,
      status: "Waiting for Technician Approval"
    }, {
      onSuccess: () => {
        setSelectedId(null);
        setTechId("");
        setEstTime("");
      }
    });
  };

  const VehicleCard = ({ v, showAction = true }: { v: any, showAction?: boolean }) => {
    const assignedTech = technicians?.find(t => t.id === v.technicianId);
    
    return (
      <Card key={v.id} className={`shadow-md transition-all duration-300 ${showAction ? "border-l-4 border-l-orange-500" : "border border-border/50"}`}>
        <CardContent className="p-6">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-bold text-lg">{v.jobCardNumber}</h3>
              <p className="text-sm text-muted-foreground">{v.vehicleModel} - {v.vehicleNumber}</p>
            </div>
            <StatusBadge status={v.status} />
          </div>
          
          <div className="mt-4 mb-4 grid grid-cols-1 gap-3">
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Findings:</h4>
              <p className="text-sm bg-muted/50 p-3 rounded-lg border border-border/50 line-clamp-2">
                {v.findings || "No findings recorded."}
              </p>
            </div>
            {!showAction && assignedTech && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Wrench className="w-3 h-3" />
                <span>Assigned to: <span className="font-medium text-foreground">{assignedTech.name}</span></span>
              </div>
            )}
          </div>

          {showAction && (
            <Button 
              className="w-full bg-slate-800 hover:bg-slate-900 text-white" 
              onClick={() => setSelectedId(v.id)}
            >
              <Wrench className="w-4 h-4 mr-2" />
              Assign to Technician
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-display font-bold text-foreground">Job Controller</h2>
        <p className="text-muted-foreground mt-1">Assign jobs to technicians and estimate completion times.</p>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-8">
          <TabsTrigger value="active" className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4" />
            Needs Assignment ({pendingAssignments.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            Assigned/History ({assignedJobs.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {isLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : pendingAssignments.length === 0 ? (
              <div className="col-span-full py-12 flex flex-col items-center justify-center text-muted-foreground bg-card border border-dashed rounded-2xl">
                <ClipboardList className="w-12 h-12 mb-4 text-muted" />
                <p className="text-lg">No vehicles need assignment.</p>
              </div>
            ) : (
              pendingAssignments.map(v => <VehicleCard key={v.id} v={v} />)
            )}
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {assignedJobs.length === 0 ? (
              <div className="col-span-full py-12 flex flex-col items-center justify-center text-muted-foreground bg-card border border-dashed rounded-2xl">
                <History className="w-12 h-12 mb-4 text-muted" />
                <p className="text-lg">No job history found.</p>
              </div>
            ) : (
              assignedJobs.map(v => <VehicleCard key={v.id} v={v} showAction={false} />)
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedId} onOpenChange={(val) => !val && setSelectedId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Technician</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAssign} className="space-y-4 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Technician</label>
              <Select value={techId} onValueChange={setTechId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a technician" />
                </SelectTrigger>
                <SelectContent>
                  {technicians?.map(t => (
                    <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Estimated Time</label>
              <Input 
                required 
                placeholder="e.g., 2 Hours, End of Day"
                value={estTime}
                onChange={e => setEstTime(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={updateVehicle.isPending}>
              {updateVehicle.isPending ? "Assigning..." : "Confirm Assignment"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

