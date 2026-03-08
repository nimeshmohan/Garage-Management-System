import { useState } from "react";
import { useVehicles, useUpdateVehicle } from "@/hooks/use-vehicles";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/status-badge";
import { FileSearch, History, ClipboardList, Pencil, Check, X, AlertCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

export function AdviserDashboard() {
  const { data: vehicles, isLoading } = useVehicles();
  const updateVehicle = useUpdateVehicle();
  const { toast } = useToast();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [findings, setFindings] = useState("");
  const [serviceNotes, setServiceNotes] = useState("");
  const [reopenReason, setReopenReason] = useState("");
  const [reopenId, setReopenId] = useState<number | null>(null);
  const [showConfirmDeliver, setShowConfirmDeliver] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDate, setFilterDate] = useState("");

  // Inline job card editing state
  const [editingJobCardId, setEditingJobCardId] = useState<number | null>(null);
  const [editingJobCardValue, setEditingJobCardValue] = useState("");
  const [jobCardSaving, setJobCardSaving] = useState(false);
  const [jobCardError, setJobCardError] = useState("");

  const filteredVehicles = vehicles?.filter(v => {
    const matchesSearch =
      v.vehicleNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v.jobCardNumber || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDate = !filterDate || (v.createdAt && format(new Date(v.createdAt), 'yyyy-MM-dd') === filterDate);
    return matchesSearch && matchesDate;
  }) || [];

  const ACTIVE_STATUSES = ["Waiting for Adviser", "Vehicle Received", "Ready for Delivery"];
  const pendingInspections = filteredVehicles.filter(v => ACTIVE_STATUSES.includes(v.status));
  const history = filteredVehicles.filter(v => !ACTIVE_STATUSES.includes(v.status));

  const handleDeliver = (id: number) => {
    updateVehicle.mutate({ id, status: "Delivered" }, {
      onSuccess: () => setShowConfirmDeliver(null)
    });
  };

  const handleInspect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    const vehicle = vehicles?.find(v => v.id === selectedId);
    const isPostWork = vehicle?.status === "Ready for Delivery";
    updateVehicle.mutate({
      id: selectedId,
      findings: isPostWork ? (vehicle?.findings || findings) : findings,
      serviceNotes: isPostWork ? (vehicle?.serviceNotes || serviceNotes) : serviceNotes,
      status: isPostWork ? "Delivered" : "Inspection Completed"
    }, {
      onSuccess: () => { setSelectedId(null); setFindings(""); setServiceNotes(""); }
    });
  };

  const handleReopenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reopenId) return;
    updateVehicle.mutate({ id: reopenId, status: "Work in Progress", reopenReason }, {
      onSuccess: () => { setReopenId(null); setReopenReason(""); }
    });
  };

  const startEditJobCard = (v: any) => {
    setEditingJobCardId(v.id);
    setEditingJobCardValue(v.jobCardNumber || "");
    setJobCardError("");
  };

  const cancelEditJobCard = () => {
    setEditingJobCardId(null);
    setEditingJobCardValue("");
    setJobCardError("");
  };

  const saveJobCard = async (vehicleId: number) => {
    const value = editingJobCardValue.trim();
    if (!value) { setJobCardError("Job card number cannot be empty."); return; }
    setJobCardSaving(true);
    setJobCardError("");
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobCardNumber: value }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.message || "Failed to save.";
        setJobCardError(msg);
        toast({ variant: "destructive", title: "Duplicate job card", description: msg });
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['/api/vehicles'] });
      toast({ title: "Job card updated", description: `Set to: ${value}` });
      setEditingJobCardId(null);
      setEditingJobCardValue("");
    } catch {
      const msg = "Failed to save. Please try again.";
      setJobCardError(msg);
      toast({ variant: "destructive", title: "Error", description: msg });
    } finally {
      setJobCardSaving(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hrs}h ${mins}m`;
  };

  const VehicleCard = ({ v, showAction = true }: { v: any; showAction?: boolean }) => {
    const isEditingThis = editingJobCardId === v.id;

    return (
      <Card className="border border-border/50 shadow-md hover:shadow-xl hover:border-primary/20 transition-all duration-300">
        <CardContent className="p-5 sm:p-6">
          <div className="flex justify-between items-start mb-4 gap-2">
            <div className="min-w-0">
              <h3 className="font-bold text-base sm:text-lg truncate">{v.vehicleModel}</h3>
              <p className="text-sm text-muted-foreground">{v.vehicleNumber}</p>
            </div>
            <StatusBadge status={v.status} />
          </div>

          <div className="bg-muted/50 p-3 rounded-lg text-sm mb-5 space-y-2">
            {/* Editable Job Card Row */}
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground shrink-0">Job Card:</span>
                {!isEditingThis ? (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-medium truncate">
                      {v.jobCardNumber || <em className="text-muted-foreground text-xs not-italic">Not assigned</em>}
                    </span>
                    {showAction && (
                      <button
                        onClick={() => startEditJobCard(v)}
                        className="text-muted-foreground hover:text-primary shrink-0 p-0.5 rounded transition-colors"
                        title="Edit job card number"
                        data-testid={`button-edit-jobcard-${v.id}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex-1 min-w-0 ml-2">
                    <div className="flex items-center gap-1">
                      <Input
                        value={editingJobCardValue}
                        onChange={e => { setEditingJobCardValue(e.target.value); setJobCardError(""); }}
                        onKeyDown={e => { if (e.key === 'Enter') saveJobCard(v.id); if (e.key === 'Escape') cancelEditJobCard(); }}
                        className="h-7 text-xs px-2"
                        placeholder="Enter job card no."
                        autoFocus
                        data-testid={`input-jobcard-${v.id}`}
                      />
                      <button
                        onClick={() => saveJobCard(v.id)}
                        disabled={jobCardSaving}
                        className="shrink-0 p-1 rounded bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50 transition-colors"
                        title="Save"
                        data-testid={`button-save-jobcard-${v.id}`}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={cancelEditJobCard}
                        className="shrink-0 p-1 rounded bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                        title="Cancel"
                        data-testid={`button-cancel-jobcard-${v.id}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {jobCardError && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-destructive">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        {jobCardError}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-between"><span className="text-muted-foreground">Customer:</span> <span className="font-medium">{v.customerName}</span></div>
            {v.serviceAdviser && (
              <div className="flex justify-between"><span className="text-muted-foreground">Adviser:</span> <span className="font-medium">{v.serviceAdviser}</span></div>
            )}
            <div className="flex justify-between"><span className="text-muted-foreground">Work Time:</span> <span className="font-medium">{formatDuration(v.totalWorkDuration || 0)}</span></div>
            {v.partsWaitDuration > 0 && (
              <div className="flex justify-between"><span className="text-muted-foreground">Parts Wait:</span> <span className="font-medium text-orange-600">{formatDuration(v.partsWaitDuration)}</span></div>
            )}
            {(v.findings || v.workDetails || v.reopenReason) && (
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
                {v.reopenReason && (
                  <div>
                    <span className="text-destructive block text-xs font-bold mb-1">Reopen Reason:</span>
                    <p className="text-xs text-destructive bg-destructive/5 p-1 rounded">{v.reopenReason}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {showAction && (
            <div className="flex gap-2">
              {v.status === "Ready for Delivery" ? (
                <>
                  <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => setShowConfirmDeliver(v.id)}>
                    Deliver Vehicle
                  </Button>
                  <Button variant="outline" className="flex-1 border-destructive text-destructive" onClick={() => setReopenId(v.id)}>
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
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-display font-bold text-foreground">Service Adviser</h2>
        <p className="text-muted-foreground mt-1">Perform initial inspections and log vehicle issues.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Filter by vehicle number, job card or customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
        </div>
        <div className="w-full md:w-48">
          <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="w-full" />
        </div>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-8">
          <TabsTrigger value="active" className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4" />
            Pending ({pendingInspections.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            History ({history.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
            {isLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : pendingInspections.length === 0 ? (
              <div className="col-span-full py-12 flex flex-col items-center justify-center text-muted-foreground bg-card border border-dashed rounded-2xl">
                <FileSearch className="w-12 h-12 mb-4 text-muted" />
                <p className="text-lg">No vehicles pending.</p>
              </div>
            ) : (
              pendingInspections.map(v => <VehicleCard key={v.id} v={v} />)
            )}
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
            {history.length === 0 ? (
              <div className="col-span-full py-12 flex flex-col items-center justify-center text-muted-foreground bg-card border border-dashed rounded-2xl">
                <History className="w-12 h-12 mb-4 text-muted" />
                <p className="text-lg">No history found.</p>
              </div>
            ) : (
              history.map(v => <VehicleCard key={v.id} v={v} showAction={false} />)
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Inspection Dialog */}
      <Dialog open={!!selectedId} onOpenChange={(val) => !val && setSelectedId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Vehicle Inspection Report</DialogTitle></DialogHeader>
          <form onSubmit={handleInspect} className="space-y-4 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Diagnostic Findings</label>
              <Textarea required placeholder="Detail the issues found..." className="min-h-[100px]" value={findings} onChange={e => setFindings(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Recommended Services / Notes</label>
              <Textarea placeholder="Parts needed, services recommended..." value={serviceNotes} onChange={e => setServiceNotes(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={updateVehicle.isPending}>
              {updateVehicle.isPending ? "Saving..." : "Complete Inspection & Forward"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reopen Dialog */}
      <Dialog open={!!reopenId} onOpenChange={(val) => !val && setReopenId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reopen Job Card</DialogTitle></DialogHeader>
          <form onSubmit={handleReopenSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason for Reopening</label>
              <Textarea required placeholder="Explain why the work needs to be redone..." className="min-h-[100px]" value={reopenReason} onChange={e => setReopenReason(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={updateVehicle.isPending}>
              {updateVehicle.isPending ? "Reopening..." : "Confirm Reopen"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm Delivery Dialog */}
      <Dialog open={!!showConfirmDeliver} onOpenChange={(val) => !val && setShowConfirmDeliver(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirm Delivery</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to mark this vehicle as delivered? This will record the current date and time.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowConfirmDeliver(null)}>Cancel</Button>
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                onClick={() => showConfirmDeliver && handleDeliver(showConfirmDeliver)}
                disabled={updateVehicle.isPending}
              >
                {updateVehicle.isPending ? "Updating..." : "Confirm Delivery"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
