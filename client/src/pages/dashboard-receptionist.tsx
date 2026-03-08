import { useState, useRef } from "react";
import { useVehicles, useCreateVehicle } from "@/hooks/use-vehicles";
import { format } from "date-fns";
import { Plus, Users, CheckCircle, Clock, Upload, FileSpreadsheet, X, AlertCircle, CalendarClock, CarFront } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import * as XLSX from "xlsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const SERVICE_ADVISERS = [
  "NASIYA NAUSHAD", "ANJALI PT", "JITHIN G NAIR", "MUHAMMAD HAFIZ",
  "MANU JOSEPH MARTIN", "MIDHUN SATYA", "MINHAJ BIN JABIR M V",
  "SUDHIN K", "YADHU KRISHNA"
];

const SERVICE_ORDER_TYPES = [
  "ACC REP", "BS FR", "FFS-KUS", "PAID SER", "PRE-DELINS",
  "RR", "SCH", "INS-SER", "SER"
];

const VEHICLE_MODELS = [
  "SLAVIA", "KUSHAQ", "KODIAQ", "KAROQ", "KYLAQ",
  "SUPERB", "OCTAVIA", "LAURA", "YETI", "RAPID"
];

const TODAY = format(new Date(), 'yyyy-MM-dd');

export function ReceptionistDashboard() {
  const { data: vehicles, isLoading } = useVehicles();
  const createVehicle = useCreateVehicle();
  const { toast } = useToast();

  const [showWalkInForm, setShowWalkInForm] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDate, setFilterDate] = useState("");

  const [formData, setFormData] = useState({
    jobCardNumber: "",
    customerName: "",
    phone: "",
    vehicleNumber: "",
    vehicleModel: "",
    serviceAdviser: "",
    serviceOrderType: "",
  });

  // Excel upload state
  const [excelPreview, setExcelPreview] = useState<any[]>([]);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; skippedRows: string[] } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [fileError, setFileError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleWalkInSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const jobCard = formData.jobCardNumber || `WI-${Date.now()}`;
    createVehicle.mutate({
      ...formData,
      jobCardNumber: jobCard,
      vehicleModel: formData.vehicleModel,
      serviceType: formData.serviceAdviser,
      priority: "Normal",
      status: "Walk-in",
      entryType: "Walk-in",
    }, {
      onSuccess: () => {
        setShowWalkInForm(false);
        setFormData({ jobCardNumber: "", customerName: "", phone: "", vehicleNumber: "", vehicleModel: "", serviceAdviser: "", serviceOrderType: "" });
        toast({ title: "Walk-in entry created" });
      }
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFileError("");
    setExcelPreview([]);
    setImportResult(null);
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls') {
      setFileError("Please upload a valid .xlsx or .xls file.");
      return;
    }

    setExcelFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = ev.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        // Validate required columns
        if (rows.length === 0) { setFileError("The file is empty."); return; }
        const firstRow = rows[0];
        const required = ["Appointment Time", "SSD No", "Service Advisor Name", "Service Order Type", "Sell-to Customer Name", "License No.", "Model"];
        const missing = required.filter(col => !(col in firstRow));
        if (missing.length > 0) {
          setFileError(`Missing columns: ${missing.join(", ")}`);
          return;
        }

        // Filter empty rows and build preview
        const preview = rows.filter(r => r["License No."] && r["Sell-to Customer Name"]).map(r => ({
          appointmentTime: String(r["Appointment Time"] || ""),
          ssdNo: String(r["SSD No"] || ""),
          serviceAdviser: String(r["Service Advisor Name"] || ""),
          serviceOrderType: String(r["Service Order Type"] || ""),
          customerName: String(r["Sell-to Customer Name"] || ""),
          vehicleNumber: String(r["License No."] || "").trim().toUpperCase(),
          vehicleModel: String(r["Model"] || ""),
        }));

        setExcelPreview(preview);
      } catch {
        setFileError("Failed to read file. Please check the format.");
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleImport = async () => {
    if (!excelPreview.length) return;
    setIsImporting(true);
    try {
      const rows = excelPreview.map((r, i) => ({
        jobCardNumber: `APT-${Date.now()}-${i}`,
        customerName: r.customerName,
        phone: "",
        vehicleNumber: r.vehicleNumber,
        vehicleModel: r.vehicleModel,
        serviceAdviser: r.serviceAdviser,
        serviceOrderType: r.serviceOrderType,
        serviceType: r.serviceAdviser,
        appointmentTime: r.appointmentTime,
        ssdNo: r.ssdNo,
        status: "Today's Appointment",
        entryType: "Today's Appointment",
        priority: "Normal",
      }));

      const result = await apiRequest('POST', '/api/vehicles/bulk-import', rows);
      const data = await result.json();
      setImportResult(data);
      queryClient.invalidateQueries({ queryKey: ['/api/vehicles'] });
      toast({ title: `Import complete: ${data.imported} records imported` });
    } catch {
      toast({ title: "Import failed", variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  };

  const resetUpload = () => {
    setExcelFile(null);
    setExcelPreview([]);
    setImportResult(null);
    setFileError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const applyFilters = (list: any[]) => {
    return list.filter(v => {
      const s = searchTerm.toLowerCase();
      const matchesSearch = !s ||
        v.vehicleNumber.toLowerCase().includes(s) ||
        v.jobCardNumber.toLowerCase().includes(s) ||
        v.customerName.toLowerCase().includes(s);
      const matchesDate = !filterDate || (v.createdAt && format(new Date(v.createdAt), 'yyyy-MM-dd') === filterDate);
      return matchesSearch && matchesDate;
    });
  };

  const todayAppointments = applyFilters(vehicles?.filter(v => v.entryType === "Today's Appointment") || []);
  const walkIns = applyFilters(vehicles?.filter(v => v.entryType === "Walk-in" || !v.entryType) || []);
  const allVehicles = applyFilters(vehicles || []);

  const totalVehicles = vehicles?.length || 0;
  const activeJobs = vehicles?.filter(v => v.status !== "Delivered").length || 0;
  const completedJobs = vehicles?.filter(v => v.status === "Delivered").length || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground">Receptionist Desk</h2>
          <p className="text-muted-foreground mt-1">Manage incoming vehicles and appointments.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setShowUploadModal(true)} className="h-11 px-5">
            <Upload className="w-4 h-4 mr-2" /> Upload Appointments
          </Button>
          <Button onClick={() => setShowWalkInForm(true)} className="h-11 px-6 shadow-md shadow-primary/20">
            <Plus className="w-5 h-5 mr-2" /> New Walk-in
          </Button>
        </div>
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
              <h3 className="text-3xl font-display font-bold">{totalVehicles}</h3>
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
              <h3 className="text-3xl font-display font-bold">{activeJobs}</h3>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-gradient-to-br from-card to-card/50">
          <CardContent className="p-6 flex items-center">
            <div className="p-4 rounded-xl bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 mr-4">
              <CheckCircle className="w-8 h-8" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Delivered</p>
              <h3 className="text-3xl font-display font-bold">{completedJobs}</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search by vehicle number, job card, or customer name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
        </div>
        <div className="w-full md:w-48">
          <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="w-full" />
        </div>
        {(searchTerm || filterDate) && (
          <Button variant="ghost" onClick={() => { setSearchTerm(""); setFilterDate(""); }}>
            <X className="w-4 h-4 mr-1" /> Clear
          </Button>
        )}
      </div>

      {/* Tabbed Vehicle Sections */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full max-w-lg grid-cols-3 mb-4">
          <TabsTrigger value="appointments" className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4" /> Today's Appointments ({todayAppointments.length})
          </TabsTrigger>
          <TabsTrigger value="walkins" className="flex items-center gap-2">
            <CarFront className="w-4 h-4" /> Walk-ins ({walkIns.length})
          </TabsTrigger>
          <TabsTrigger value="all">All ({allVehicles.length})</TabsTrigger>
        </TabsList>

        {["appointments", "walkins", "all"].map(tab => {
          const list = tab === "appointments" ? todayAppointments : tab === "walkins" ? walkIns : allVehicles;
          return (
            <TabsContent key={tab} value={tab} className="mt-0">
              <VehicleTable list={list} isLoading={isLoading} />
            </TabsContent>
          );
        })}
      </Tabs>

      {/* Walk-in Form Dialog */}
      <Dialog open={showWalkInForm} onOpenChange={setShowWalkInForm}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl">New Walk-in Entry</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleWalkInSubmit} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Job Card # (optional)</label>
                <Input placeholder="Auto-generated if empty" value={formData.jobCardNumber} onChange={e => setFormData({ ...formData, jobCardNumber: e.target.value })} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Phone Number</label>
                <Input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Customer Name *</label>
              <Input required value={formData.customerName} onChange={e => setFormData({ ...formData, customerName: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Vehicle Reg. No *</label>
                <Input required placeholder="KL01AB1234" value={formData.vehicleNumber} onChange={e => setFormData({ ...formData, vehicleNumber: e.target.value.toUpperCase() })} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Model *</label>
                <Select value={formData.vehicleModel} onValueChange={v => setFormData({ ...formData, vehicleModel: v })} required>
                  <SelectTrigger><SelectValue placeholder="Select model" /></SelectTrigger>
                  <SelectContent>{VEHICLE_MODELS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Service Adviser *</label>
              <Select value={formData.serviceAdviser} onValueChange={v => setFormData({ ...formData, serviceAdviser: v })} required>
                <SelectTrigger><SelectValue placeholder="Select adviser" /></SelectTrigger>
                <SelectContent>{SERVICE_ADVISERS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Service Order Type *</label>
              <Select value={formData.serviceOrderType} onValueChange={v => setFormData({ ...formData, serviceOrderType: v })} required>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>{SERVICE_ORDER_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={createVehicle.isPending}>
              {createVehicle.isPending ? "Saving..." : "Create Walk-in Entry"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Excel Upload Modal */}
      <Dialog open={showUploadModal} onOpenChange={(v) => { if (!v) resetUpload(); setShowUploadModal(v); }}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <FileSpreadsheet className="w-5 h-5 text-green-600" /> Upload Appointment Schedule
            </DialogTitle>
          </DialogHeader>

          {!importResult ? (
            <div className="space-y-4 mt-2">
              {/* Upload area */}
              <div
                className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm font-medium">Click to upload Excel file</p>
                <p className="text-xs text-muted-foreground mt-1">Supports .xlsx and .xls files</p>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
              </div>

              {excelFile && (
                <div className="flex items-center gap-2 text-sm bg-muted/50 p-3 rounded-lg">
                  <FileSpreadsheet className="w-4 h-4 text-green-600" />
                  <span className="font-medium">{excelFile.name}</span>
                  <span className="text-muted-foreground ml-auto">{excelPreview.length} valid rows found</span>
                  <Button variant="ghost" size="sm" onClick={resetUpload}><X className="w-4 h-4" /></Button>
                </div>
              )}

              {fileError && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {fileError}
                </div>
              )}

              {/* Preview table */}
              {excelPreview.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Preview ({excelPreview.length} records)</h3>
                  <div className="overflow-x-auto rounded-lg border border-border max-h-64">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-3 py-2">#</th>
                          <th className="px-3 py-2">Appt. Time</th>
                          <th className="px-3 py-2">SSD No</th>
                          <th className="px-3 py-2">Customer</th>
                          <th className="px-3 py-2">License</th>
                          <th className="px-3 py-2">Model</th>
                          <th className="px-3 py-2">Adviser</th>
                          <th className="px-3 py-2">Order Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {excelPreview.map((r, i) => (
                          <tr key={i} className="border-t border-border/50 hover:bg-muted/20">
                            <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                            <td className="px-3 py-2">{r.appointmentTime}</td>
                            <td className="px-3 py-2">{r.ssdNo}</td>
                            <td className="px-3 py-2 font-medium">{r.customerName}</td>
                            <td className="px-3 py-2">{r.vehicleNumber}</td>
                            <td className="px-3 py-2">{r.vehicleModel}</td>
                            <td className="px-3 py-2">{r.serviceAdviser}</td>
                            <td className="px-3 py-2">{r.serviceOrderType}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Button className="w-full" onClick={handleImport} disabled={isImporting}>
                    {isImporting ? "Importing..." : `Import ${excelPreview.length} Records`}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            /* Import result */
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-3 gap-4">
                <Card className="text-center">
                  <CardContent className="p-4">
                    <p className="text-2xl font-bold text-green-600">{importResult.imported}</p>
                    <p className="text-sm text-muted-foreground">Records Imported</p>
                  </CardContent>
                </Card>
                <Card className="text-center">
                  <CardContent className="p-4">
                    <p className="text-2xl font-bold text-orange-500">{importResult.skipped}</p>
                    <p className="text-sm text-muted-foreground">Duplicates Skipped</p>
                  </CardContent>
                </Card>
                <Card className="text-center">
                  <CardContent className="p-4">
                    <p className="text-2xl font-bold text-blue-500">{importResult.imported + importResult.skipped}</p>
                    <p className="text-sm text-muted-foreground">Total Rows</p>
                  </CardContent>
                </Card>
              </div>

              {importResult.skippedRows.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-orange-600">Skipped Records</h3>
                  <div className="bg-orange-50 dark:bg-orange-900/10 rounded-lg p-3 max-h-40 overflow-y-auto">
                    {importResult.skippedRows.map((row, i) => (
                      <div key={i} className="text-xs text-orange-700 dark:text-orange-300 py-0.5">{i + 1}. {row}</div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={resetUpload}>Upload Another File</Button>
                <Button className="flex-1" onClick={() => { resetUpload(); setShowUploadModal(false); }}>Done</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VehicleTable({ list, isLoading }: { list: any[]; isLoading: boolean }) {
  const sorted = [...list].sort((a, b) => {
    const tA = a.appointmentTime || "";
    const tB = b.appointmentTime || "";
    return tA.localeCompare(tB);
  });

  return (
    <Card className="shadow-lg border-border/50 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
            <tr>
              <th className="px-4 py-3 font-medium">Job Card / Date</th>
              <th className="px-4 py-3 font-medium">Appt. Time</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Vehicle</th>
              <th className="px-4 py-3 font-medium">Adviser</th>
              <th className="px-4 py-3 font-medium">Order Type</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
            ) : sorted.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No records found.</td></tr>
            ) : (
              sorted.map((v, i) => (
                <motion.tr
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  key={v.id}
                  className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="font-semibold">{v.jobCardNumber}</div>
                    <div className="text-xs text-muted-foreground">{v.createdAt ? format(new Date(v.createdAt), 'MMM dd, yyyy') : '-'}</div>
                  </td>
                  <td className="px-4 py-3 text-sm">{v.appointmentTime || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{v.customerName}</div>
                    <div className="text-xs text-muted-foreground">{v.phone || v.ssdNo || ''}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{v.vehicleNumber}</div>
                    <div className="text-xs text-muted-foreground">{v.vehicleModel}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">{v.serviceAdviser || v.serviceType || '-'}</td>
                  <td className="px-4 py-3 text-xs">{v.serviceOrderType || '-'}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={v.status} />
                  </td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
