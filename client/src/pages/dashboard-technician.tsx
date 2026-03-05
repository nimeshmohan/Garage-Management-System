import { useState } from "react";
import { useVehicles, useUpdateVehicle } from "@/hooks/use-vehicles";
import { useUser } from "@/hooks/use-auth";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/status-badge";
import { PlayCircle, CheckCircle2, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function TechnicianDashboard() {
  const { data: user } = useUser();
  const { data: vehicles } = useVehicles();
  const updateVehicle = useUpdateVehicle();
  
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [workDetails, setWorkDetails] = useState("");

  // Only show vehicles assigned to THIS technician
  const myJobs = vehicles?.filter(v => v.technicianId === user?.id && v.status !== "Ready for Delivery") || [];

  const handleUpdateStatus = (id: number, newStatus: string) => {
    updateVehicle.mutate({ id, status: newStatus });
  };

  const handleFinishJob = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    
    updateVehicle.mutate({
      id: selectedId,
      workDetails,
      status: "Ready for Delivery"
    }, {
      onSuccess: () => {
        setSelectedId(null);
        setWorkDetails("");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-display font-bold text-foreground">My Jobs</h2>
        <p className="text-muted-foreground mt-1">Review assigned tasks and update job progress.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {myJobs.length === 0 ? (
          <p className="text-muted-foreground">You have no active jobs assigned.</p>
        ) : (
          myJobs.map(v => (
            <Card key={v.id} className="border-border/50 shadow-lg relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-primary group-hover:w-2 transition-all duration-300"/>
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-xl">{v.vehicleModel}</h3>
                    <p className="text-sm font-medium text-primary">{v.jobCardNumber}</p>
                  </div>
                  <StatusBadge status={v.status} />
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

                <div className="mb-4">
                  <span className="text-muted-foreground block text-xs mb-1">Adviser Notes</span>
                  <p className="text-sm bg-blue-50/50 dark:bg-blue-900/10 p-3 rounded-lg border border-blue-100 dark:border-blue-900/30">
                    {v.serviceNotes || "No specific notes provided."}
                  </p>
                </div>
              </CardContent>
              <CardFooter className="bg-muted/20 border-t p-4 flex gap-3">
                {v.status === "Waiting for Technician Approval" && (
                  <Button 
                    className="w-full shadow-md"
                    onClick={() => handleUpdateStatus(v.id, "Work in Progress")}
                  >
                    <PlayCircle className="w-4 h-4 mr-2" /> Start Work
                  </Button>
                )}
                
                {v.status === "Work in Progress" && (
                  <Button 
                    variant="default" 
                    className="w-full bg-green-600 hover:bg-green-700 shadow-md shadow-green-500/20"
                    onClick={() => setSelectedId(v.id)}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Mark Completed
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))
        )}
      </div>

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
