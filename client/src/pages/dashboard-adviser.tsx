import { useState } from "react";
import { useVehicles, useUpdateVehicle } from "@/hooks/use-vehicles";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/status-badge";
import { FileSearch, History, ClipboardList } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function AdviserDashboard() {
  const { data: vehicles, isLoading } = useVehicles();
  const updateVehicle = useUpdateVehicle();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [findings, setFindings] = useState("");
  const [serviceNotes, setServiceNotes] = useState("");

  const pendingInspections = vehicles?.filter(v => v.status === "Vehicle Received" || v.status === "Ready for Delivery") || [];
  const history = vehicles?.filter(v => v.status !== "Vehicle Received" && v.status !== "Ready for Delivery") || [];

  const handleInspect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    
    const vehicle = vehicles?.find(v => v.id === selectedId);
    const isPostWork = vehicle?.status === "Ready for Delivery";
    
    updateVehicle.mutate({
      id: selectedId,
      findings: isPostWork ? vehicle.findings : findings,
      serviceNotes: isPostWork ? vehicle.serviceNotes : serviceNotes,
      status: isPostWork ? "Delivered" : "Inspection Completed"
    }, {
      onSuccess: () => {
        setSelectedId(null);
        setFindings("");
        setServiceNotes("");
      }
    });
  };

  const handleReopen = (id: number) => {
    updateVehicle.mutate({
      id,
      status: "Work in Progress"
    });
  };

  const VehicleCard = ({ v, showAction = true }: { v: any, showAction?: boolean }) => (
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
          {(v.findings || v.workDetails) && (
            <div className="pt-2 mt-2 border-t border-border/50 space-y-2">
              {v.findings && (
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Findings:</span>
                  <p className="text-xs line-clamp-2">{v.findings}</p>
                </div>
              )}
              {v.workDetails && (
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Work Details:</span>
                  <p className="text-xs line-clamp-2">{v.workDetails}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {showAction && (
          <div className="flex gap-2">
            {v.status === "Ready for Delivery" ? (
              <>
                <Button 
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={() => handleInspect({ preventDefault: () => {} } as any)} // Reuse logic for delivery
                >
                  Deliver Vehicle
                </Button>
                <Button 
                  variant="outline"
                  className="flex-1 border-destructive text-destructive"
                  onClick={() => handleReopen(v.id)}
                >
                  Reopen Job
                </Button>
              </>
            ) : (
              <Button 
                className="w-full shadow-lg shadow-primary/20 bg-gradient-to-r from-primary to-primary/80" 
                onClick={() => setSelectedId(v.id)}
              >
                <FileSearch className="w-4 h-4 mr-2" />
                Perform Inspection
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-display font-bold text-foreground">Service Adviser</h2>
        <p className="text-muted-foreground mt-1">Perform initial inspections and log vehicle issues.</p>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-8">
          <TabsTrigger value="active" className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4" />
            Pending Inspection ({pendingInspections.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            Recent History ({history.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {isLoading ? (
              <p className="text-muted-foreground">Loading tasks...</p>
            ) : pendingInspections.length === 0 ? (
              <div className="col-span-full py-12 flex flex-col items-center justify-center text-muted-foreground bg-card border border-dashed rounded-2xl">
                <FileSearch className="w-12 h-12 mb-4 text-muted" />
                <p className="text-lg">No vehicles pending inspection.</p>
              </div>
            ) : (
              pendingInspections.map(v => <VehicleCard key={v.id} v={v} />)
            )}
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {history.length === 0 ? (
              <div className="col-span-full py-12 flex flex-col items-center justify-center text-muted-foreground bg-card border border-dashed rounded-2xl">
                <History className="w-12 h-12 mb-4 text-muted" />
                <p className="text-lg">No inspection history found.</p>
              </div>
            ) : (
              history.map(v => <VehicleCard key={v.id} v={v} showAction={false} />)
            )}
          </div>
        </TabsContent>
      </Tabs>

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

