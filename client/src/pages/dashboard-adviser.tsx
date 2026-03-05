import { useState } from "react";
import { useVehicles, useUpdateVehicle } from "@/hooks/use-vehicles";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/status-badge";
import { FileSearch } from "lucide-react";

export function AdviserDashboard() {
  const { data: vehicles, isLoading } = useVehicles();
  const updateVehicle = useUpdateVehicle();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [findings, setFindings] = useState("");
  const [serviceNotes, setServiceNotes] = useState("");

  const pendingInspections = vehicles?.filter(v => v.status === "Vehicle Received") || [];

  const handleInspect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    
    updateVehicle.mutate({
      id: selectedId,
      findings,
      serviceNotes,
      status: "Inspection Completed"
    }, {
      onSuccess: () => {
        setSelectedId(null);
        setFindings("");
        setServiceNotes("");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-display font-bold text-foreground">Service Adviser</h2>
        <p className="text-muted-foreground mt-1">Perform initial inspections and log vehicle issues.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {isLoading ? (
          <p className="text-muted-foreground">Loading tasks...</p>
        ) : pendingInspections.length === 0 ? (
          <div className="col-span-full py-12 flex flex-col items-center justify-center text-muted-foreground bg-card border border-dashed rounded-2xl">
            <FileSearch className="w-12 h-12 mb-4 text-muted" />
            <p className="text-lg">No vehicles pending inspection.</p>
          </div>
        ) : (
          pendingInspections.map(v => (
            <Card key={v.id} className="border border-border/50 shadow-md hover:shadow-xl hover:border-primary/20 transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-lg">{v.vehicleModel}</h3>
                    <p className="text-sm text-muted-foreground">{v.vehicleNumber}</p>
                  </div>
                  <StatusBadge status={v.status} />
                </div>
                
                <div className="bg-muted/50 p-3 rounded-lg text-sm mb-6 space-y-2">
                  <div className="flex justify-between"><span className="text-muted-foreground">Job Card:</span> <span className="font-medium">{v.jobCardNumber}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Customer:</span> <span className="font-medium">{v.customerName}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Reported Issue:</span> <span className="font-medium">{v.serviceType}</span></div>
                </div>

                <Button 
                  className="w-full shadow-lg shadow-primary/20 bg-gradient-to-r from-primary to-primary/80" 
                  onClick={() => setSelectedId(v.id)}
                >
                  <FileSearch className="w-4 h-4 mr-2" />
                  Perform Inspection
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={!!selectedId} onOpenChange={(val) => !val && setSelectedId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vehicle Inspection Report</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleInspect} className="space-y-4 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Diagnostic Findings</label>
              <Textarea 
                required 
                placeholder="Detail the issues found during inspection..."
                className="min-h-[100px]"
                value={findings}
                onChange={e => setFindings(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Recommended Services (Notes)</label>
              <Textarea 
                placeholder="Parts needed, services recommended..."
                value={serviceNotes}
                onChange={e => setServiceNotes(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={updateVehicle.isPending}>
              {updateVehicle.isPending ? "Saving..." : "Complete Inspection & Forward"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
