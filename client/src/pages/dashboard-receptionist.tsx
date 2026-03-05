import { useState } from "react";
import { useVehicles, useCreateVehicle } from "@/hooks/use-vehicles";
import { format } from "date-fns";
import { Plus, Users, CheckCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { motion } from "framer-motion";

export function ReceptionistDashboard() {
  const { data: vehicles, isLoading } = useVehicles();
  const createVehicle = useCreateVehicle();
  const [open, setOpen] = useState(false);

  const [formData, setFormData] = useState({
    jobCardNumber: "",
    customerName: "",
    phone: "",
    vehicleNumber: "",
    vehicleModel: "",
    serviceType: "General Service",
    priority: "Normal"
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createVehicle.mutate(formData, {
      onSuccess: () => {
        setOpen(false);
        setFormData({
          jobCardNumber: "",
          customerName: "", phone: "", vehicleNumber: "", vehicleModel: "", serviceType: "General Service", priority: "Normal"
        });
      }
    });
  };

  const pendingJobs = vehicles?.filter(v => v.status !== "Ready for Delivery").length || 0;
  const completedJobs = vehicles?.filter(v => v.status === "Ready for Delivery").length || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground">Receptionist Desk</h2>
          <p className="text-muted-foreground mt-1">Manage incoming vehicles and customer details.</p>
        </div>
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="h-11 px-6 shadow-md shadow-primary/20 hover:shadow-lg hover:-translate-y-0.5 transition-all">
              <Plus className="w-5 h-5 mr-2" />
              New Job Card
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="text-2xl">Create Job Card</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Job Card #</label>
                  <Input 
                    required
                    placeholder="JC-1234"
                    value={formData.jobCardNumber} 
                    onChange={e => setFormData({...formData, jobCardNumber: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Priority</label>
                  <Select value={formData.priority} onValueChange={(v) => setFormData({...formData, priority: v})}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Low">Low</SelectItem>
                      <SelectItem value="Normal">Normal</SelectItem>
                      <SelectItem value="High">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Customer Name</label>
                <Input required value={formData.customerName} onChange={e => setFormData({...formData, customerName: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Phone Number</label>
                <Input required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Vehicle Reg. No</label>
                  <Input required placeholder="AB 12 CD 3456" value={formData.vehicleNumber} onChange={e => setFormData({...formData, vehicleNumber: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Model</label>
                  <Input required placeholder="Honda Civic" value={formData.vehicleModel} onChange={e => setFormData({...formData, vehicleModel: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Service Type</label>
                <Input required value={formData.serviceType} onChange={e => setFormData({...formData, serviceType: e.target.value})} />
              </div>
              <Button type="submit" className="w-full mt-2" disabled={createVehicle.isPending}>
                {createVehicle.isPending ? "Saving..." : "Create Record"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-sm bg-gradient-to-br from-card to-card/50">
          <CardContent className="p-6 flex items-center">
            <div className="p-4 rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 mr-4">
              <Users className="w-8 h-8" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Vehicles</p>
              <h3 className="text-3xl font-display font-bold">{vehicles?.length || 0}</h3>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-gradient-to-br from-card to-card/50">
          <CardContent className="p-6 flex items-center">
            <div className="p-4 rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 mr-4">
              <Clock className="w-8 h-8" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Active Jobs</p>
              <h3 className="text-3xl font-display font-bold">{pendingJobs}</h3>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-gradient-to-br from-card to-card/50">
          <CardContent className="p-6 flex items-center">
            <div className="p-4 rounded-xl bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 mr-4">
              <CheckCircle className="w-8 h-8" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Completed</p>
              <h3 className="text-3xl font-display font-bold">{completedJobs}</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="shadow-lg border-border/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
              <tr>
                <th className="px-6 py-4 font-medium">Job Card / Date</th>
                <th className="px-6 py-4 font-medium">Customer</th>
                <th className="px-6 py-4 font-medium">Vehicle Info</th>
                <th className="px-6 py-4 font-medium">Service Type</th>
                <th className="px-6 py-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">Loading...</td></tr>
              ) : vehicles?.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">No vehicles found.</td></tr>
              ) : (
                vehicles?.map((v, i) => (
                  <motion.tr 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={v.id} 
                    className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="font-semibold text-foreground">{v.jobCardNumber}</div>
                      <div className="text-xs text-muted-foreground">{v.createdAt ? format(new Date(v.createdAt), 'MMM dd, yyyy') : '-'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-foreground">{v.customerName}</div>
                      <div className="text-xs text-muted-foreground">{v.phone}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-foreground">{v.vehicleNumber}</div>
                      <div className="text-xs text-muted-foreground">{v.vehicleModel}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <span className={`w-2 h-2 rounded-full mr-2 ${v.priority === 'High' ? 'bg-red-500' : v.priority === 'Low' ? 'bg-blue-500' : 'bg-gray-400'}`} />
                        {v.serviceType}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={v.status} />
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
