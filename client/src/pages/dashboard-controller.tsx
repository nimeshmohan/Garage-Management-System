import { useState } from "react";
import { useVehicles, useUpdateVehicle } from "@/hooks/use-vehicles";
import { useTechnicians } from "@/hooks/use-users";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";
import { Wrench } from "lucide-react";

export function ControllerDashboard() {
  const { data: vehicles } = useVehicles();
  const { data: technicians } = useTechnicians();
  const updateVehicle = useUpdateVehicle();
  
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [techId, setTechId] = useState("");
  const [estTime, setEstTime] = useState("");

  const pendingAssignments = vehicles?.filter(v => v.status === "Inspection Completed") || [];

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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-display font-bold text-foreground">Job Controller</h2>
        <p className="text-muted-foreground mt-1">Assign jobs to technicians and estimate completion times.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {pendingAssignments.length === 0 ? (
          <p className="text-muted-foreground">No vehicles need assignment right now.</p>
        ) : (
          pendingAssignments.map(v => (
            <Card key={v.id} className="border-l-4 border-l-orange-500 shadow-md">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg">{v.jobCardNumber}</h3>
                    <p className="text-sm text-muted-foreground">{v.vehicleModel} - {v.vehicleNumber}</p>
                  </div>
                  <StatusBadge status={v.status} />
                </div>
                
                <div className="mt-4 mb-6">
                  <h4 className="text-sm font-semibold mb-1">Adviser Findings:</h4>
                  <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg border border-border/50">
                    {v.findings || "No findings recorded."}
                  </p>
                </div>

                <Button 
                  className="w-full bg-slate-800 hover:bg-slate-900 text-white" 
                  onClick={() => setSelectedId(v.id)}
                >
                  <Wrench className="w-4 h-4 mr-2" />
                  Assign to Technician
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

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
