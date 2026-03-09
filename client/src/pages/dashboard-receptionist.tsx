import { useState, useRef } from "react";
import { useVehicles, useCreateVehicle, useUpdateVehicle } from "@/hooks/use-vehicles";
import { format } from "date-fns";
import {
  Plus, Users, CheckCircle, Clock, Upload, FileSpreadsheet, X,
  AlertCircle, CalendarClock, CarFront, History, LogIn, Pencil, StopCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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

const todayStr = () => format(new Date(), 'yyyy-MM-dd');

export function ReceptionistDashboard() {
  const { data: vehicles, isLoading } = useVehicles();
  const createVehicle = useCreateVehicle();
  const updateVehicle = useUpdateVehicle();
  const { toast } = useToast();

  const [showWalkInForm, setShowWalkInForm] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDate, setFilterDate] = useState("");

  const [receiveDialogVehicle, setReceiveDialogVehicle] = useState<any | null>(null);
  const [receiveAdviserName, setReceiveAdviserName] = useState("");

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
  const [rawExcelRows, setRawExcelRows] = useState<any[][]>([]);
  const [headerRowIndex, setHeaderRowIndex] = useState(0); // 0-indexed
  const [excelPreview, setExcelPreview] = useState<any[]>([]);
  const [headerError, setHeaderError] = useState("");
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; skippedRows: string[] } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [fileError, setFileError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleWalkInSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createVehicle.mutate({
      ...formData,
      jobCardNumber: formData.jobCardNumber || null,
      serviceType: formData.serviceAdviser,
      priority: "Normal",
      status: "Waiting for Adviser",
      entryType: "Walk-in",
    }, {
      onSuccess: () => {
        setShowWalkInForm(false);
        setFormData({ jobCardNumber: "", customerName: "", phone: "", vehicleNumber: "", vehicleModel: "", serviceAdviser: "", serviceOrderType: "" });
        toast({ title: "Walk-in entry created" });
      }
    });
  };

  const handleOpenReceiveDialog = (vehicle: any) => {
    setReceiveDialogVehicle(vehicle);
    const raw = (vehicle.serviceAdviser || "").trim().toLowerCase();
    // Try exact → case-insensitive exact → first-word / contains match
    const matched =
      SERVICE_ADVISERS.find(a => a === vehicle.serviceAdviser) ||
      SERVICE_ADVISERS.find(a => a.toLowerCase() === raw) ||
      SERVICE_ADVISERS.find(a =>
        raw && (
          a.toLowerCase().startsWith(raw) ||
          raw.startsWith(a.toLowerCase().split(" ")[0]) ||
          a.toLowerCase().includes(raw) ||
          raw.includes(a.toLowerCase().split(" ")[0])
        )
      ) ||
      "";
    setReceiveAdviserName(matched);
  };

  const handleConfirmReceive = () => {
    if (!receiveDialogVehicle) return;
    const jobCard = receiveDialogVehicle.ssdNo || null;
    updateVehicle.mutate({
      id: receiveDialogVehicle.id,
      status: "Waiting for Adviser",
      serviceAdviser: receiveAdviserName || receiveDialogVehicle.serviceAdviser,
      ...(jobCard ? { jobCardNumber: jobCard } : {}),
    }, {
      onSuccess: () => {
        toast({
          title: "Vehicle received",
          description: `Assigned to ${receiveAdviserName || receiveDialogVehicle.serviceAdviser || 'adviser'}.`,
        });
        setReceiveDialogVehicle(null);
        setReceiveAdviserName("");
      }
    });
  };

  // Parse preview using the selected header row
  const buildPreview = (rawRows: any[][], headerIdx: number) => {
    setHeaderError("");
    if (rawRows.length <= headerIdx) { setHeaderError("Header row number exceeds file length."); setExcelPreview([]); return; }

    const headers: string[] = rawRows[headerIdx].map((h: any) => String(h || "").trim());
    const required = ["Appointment Time", "SSD No", "Service Advisor Name", "Service Order Type", "Sell-to Customer Name", "License No.", "Model"];
    const missing = required.filter(col => !headers.includes(col));
    if (missing.length > 0) {
      setHeaderError(`Row ${headerIdx + 1} doesn't contain required headers. Missing: ${missing.join(", ")}. Try a different row.`);
      setExcelPreview([]);
      return;
    }

    const dataRows = rawRows.slice(headerIdx + 1);
    const preview = dataRows
      .map(row => {
        const obj: Record<string, any> = {};
        headers.forEach((h, i) => { obj[h] = row[i] !== undefined ? row[i] : ""; });
        return obj;
      })
      .filter(r => r["License No."] && r["Sell-to Customer Name"])
      .map(r => ({
        appointmentTime: String(r["Appointment Time"] ?? ""),
        ssdNo: String(r["SSD No"] ?? ""),
        serviceAdviser: String(r["Service Advisor Name"] ?? ""),
        serviceOrderType: String(r["Service Order Type"] ?? ""),
        customerName: String(r["Sell-to Customer Name"] ?? ""),
        vehicleNumber: String(r["License No."] ?? "").trim().toUpperCase(),
        vehicleModel: String(r["Model"] ?? ""),
      }));

    setExcelPreview(preview);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFileError(""); setHeaderError(""); setExcelPreview([]); setImportResult(null); setRawExcelRows([]); setHeaderRowIndex(0);
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls') { setFileError("Please upload a valid .xlsx or .xls file."); return; }

    setExcelFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = ev.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
        if (rawRows.length === 0) { setFileError("The file is empty."); return; }
        setRawExcelRows(rawRows);
        // Try row 0 first; if it fails silently, user can change
        buildPreview(rawRows, 0);
      } catch { setFileError("Failed to read file. Please check the format."); }
    };
    reader.readAsBinaryString(file);
  };

  const handleHeaderRowChange = (val: string) => {
    const idx = parseInt(val) - 1;
    setHeaderRowIndex(idx);
    buildPreview(rawExcelRows, idx);
  };

  const handleImport = async () => {
    if (!excelPreview.length) return;
    setIsImporting(true);
    try {
      const rows = excelPreview.map(r => ({
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
    } catch { toast({ title: "Import failed", variant: "destructive" }); }
    finally { setIsImporting(false); }
  };

  const resetUpload = () => {
    setExcelFile(null); setExcelPreview([]); setImportResult(null);
    setFileError(""); setHeaderError(""); setRawExcelRows([]); setHeaderRowIndex(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const today = todayStr();

  const applyFilters = (list: any[]) => {
    return list.filter(v => {
      const s = searchTerm.toLowerCase();
      const matchesSearch = !s ||
        v.vehicleNumber?.toLowerCase().includes(s) ||
        (v.jobCardNumber || "").toLowerCase().includes(s) ||
        v.customerName.toLowerCase().includes(s);
      const dateStr = v.createdAt ? format(new Date(v.createdAt), 'yyyy-MM-dd') : '';
      const matchesDate = !filterDate || dateStr === filterDate;
      return matchesSearch && matchesDate;
    });
  };

  const allVehicles = vehicles || [];
  const todayVehicles = allVehicles.filter(v => v.createdAt && format(new Date(v.createdAt), 'yyyy-MM-dd') === today);
  const historyVehicles = allVehicles.filter(v => !v.createdAt || format(new Date(v.createdAt), 'yyyy-MM-dd') !== today);

  const displayList = showHistory ? applyFilters(historyVehicles) : applyFilters(todayVehicles);
  const todayAppointments = applyFilters(todayVehicles.filter(v => v.entryType === "Today's Appointment"));
  const walkIns = applyFilters(todayVehicles.filter(v => v.entryType === "Walk-in" || !v.entryType));

  const totalVehicles = allVehicles.length;
  const totalReceived = allVehicles.filter(v => v.status !== "Today's Appointment").length;
  const totalDelivered = allVehicles.filter(v => v.status === "Delivered").length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-foreground">Receptionist Desk</h2>
          <p className="text-muted-foreground text-sm mt-0.5">Manage incoming vehicles and appointments.</p>
        </div>
        <div className="flex gap-2 flex-wrap w-full sm:w-auto">
          <Button variant="outline" onClick={() => setShowUploadModal(true)} className="flex-1 sm:flex-none h-10 px-4 text-sm" data-testid="button-upload-appointments">
            <Upload className="w-4 h-4 mr-1.5" /> Upload Appointments
          </Button>
          <Button onClick={() => setShowWalkInForm(true)} className="flex-1 sm:flex-none h-10 px-4 text-sm shadow-md shadow-primary/20" data-testid="button-new-walkin">
            <Plus className="w-4 h-4 mr-1.5" /> New Walk-in
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3 sm:gap-5">
        {[
          { label: "Total Vehicles", value: totalVehicles, icon: Users, color: "blue" },
          { label: "Total Received", value: totalReceived, icon: Clock, color: "orange" },
          { label: "Total Delivered", value: totalDelivered, icon: CheckCircle, color: "green" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border-none shadow-sm">
            <CardContent className="p-3 sm:p-5 flex flex-col sm:flex-row items-center sm:items-start gap-2 sm:gap-4">
              <div className={`p-2 sm:p-3 rounded-xl bg-${color}-100 text-${color}-600 dark:bg-${color}-900/30 dark:text-${color}-400 shrink-0`}>
                <Icon className="w-5 h-5 sm:w-7 sm:h-7" />
              </div>
              <div className="text-center sm:text-left">
                <p className="text-xs font-medium text-muted-foreground leading-tight">{label}</p>
                <h3 className="text-2xl sm:text-3xl font-display font-bold">{value}</h3>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters + History Toggle */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1">
            <Input
              placeholder="Search vehicle no., customer, job card..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
              data-testid="input-search"
            />
          </div>
          {showHistory && (
            <div className="w-full sm:w-44">
              <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="w-full" data-testid="input-filter-date" />
            </div>
          )}
          {(searchTerm || filterDate) && (
            <Button variant="ghost" size="sm" onClick={() => { setSearchTerm(""); setFilterDate(""); }}>
              <X className="w-4 h-4 mr-1" /> Clear
            </Button>
          )}
        </div>
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {showHistory ? `Showing history (${displayList.length} records)` : `Today — ${format(new Date(), 'MMM dd, yyyy')} (${displayList.length} vehicles)`}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setShowHistory(!showHistory); setFilterDate(""); setSearchTerm(""); }}
            className="text-xs gap-1"
            data-testid="button-toggle-history"
          >
            <History className="w-3.5 h-3.5" />
            {showHistory ? "Back to Today" : "View History"}
          </Button>
        </div>
      </div>

      {/* Vehicle Sections */}
      {showHistory ? (
        <div>
          <VehicleList list={displayList} isLoading={isLoading} onReceive={handleOpenReceiveDialog} updateVehicle={updateVehicle} />
        </div>
      ) : (
        <Tabs defaultValue="appointments" className="w-full">
          <TabsList className="w-full sm:w-auto flex mb-4 h-auto p-1 gap-1">
            <TabsTrigger value="appointments" className="flex-1 sm:flex-none text-xs sm:text-sm py-1.5 flex items-center gap-1" data-testid="tab-appointments">
              <CalendarClock className="w-3.5 h-3.5 hidden sm:block" />
              Appointments ({todayAppointments.length})
            </TabsTrigger>
            <TabsTrigger value="walkins" className="flex-1 sm:flex-none text-xs sm:text-sm py-1.5 flex items-center gap-1" data-testid="tab-walkins">
              <CarFront className="w-3.5 h-3.5 hidden sm:block" />
              Walk-ins ({walkIns.length})
            </TabsTrigger>
            <TabsTrigger value="all" className="flex-1 sm:flex-none text-xs sm:text-sm py-1.5" data-testid="tab-all">
              All ({applyFilters(todayVehicles).length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="appointments" className="mt-0">
            <VehicleList list={todayAppointments} isLoading={isLoading} onReceive={handleOpenReceiveDialog} updateVehicle={updateVehicle} />
          </TabsContent>
          <TabsContent value="walkins" className="mt-0">
            <VehicleList list={walkIns} isLoading={isLoading} onReceive={handleOpenReceiveDialog} updateVehicle={updateVehicle} />
          </TabsContent>
          <TabsContent value="all" className="mt-0">
            <VehicleList list={applyFilters(todayVehicles)} isLoading={isLoading} onReceive={handleOpenReceiveDialog} updateVehicle={updateVehicle} />
          </TabsContent>
        </Tabs>
      )}

      {/* Walk-in Form Dialog */}
      <Dialog open={showWalkInForm} onOpenChange={setShowWalkInForm}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-xl">New Walk-in Entry</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleWalkInSubmit} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Job Card # (optional)</label>
                <Input placeholder="Auto-generated" value={formData.jobCardNumber} onChange={e => setFormData({ ...formData, jobCardNumber: e.target.value })} data-testid="input-job-card" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Phone</label>
                <Input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} data-testid="input-phone" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Customer Name *</label>
              <Input required value={formData.customerName} onChange={e => setFormData({ ...formData, customerName: e.target.value })} data-testid="input-customer-name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Vehicle Reg. No *</label>
                <Input required placeholder="KL01AB1234" value={formData.vehicleNumber} onChange={e => setFormData({ ...formData, vehicleNumber: e.target.value.toUpperCase() })} data-testid="input-vehicle-number" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Model *</label>
                <Select required value={formData.vehicleModel} onValueChange={v => setFormData({ ...formData, vehicleModel: v })}>
                  <SelectTrigger data-testid="select-vehicle-model"><SelectValue placeholder="Select model" /></SelectTrigger>
                  <SelectContent>{VEHICLE_MODELS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Service Adviser *</label>
              <Select required value={formData.serviceAdviser} onValueChange={v => setFormData({ ...formData, serviceAdviser: v })}>
                <SelectTrigger data-testid="select-service-adviser"><SelectValue placeholder="Select adviser" /></SelectTrigger>
                <SelectContent>{SERVICE_ADVISERS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Service Order Type *</label>
              <Select required value={formData.serviceOrderType} onValueChange={v => setFormData({ ...formData, serviceOrderType: v })}>
                <SelectTrigger data-testid="select-order-type"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>{SERVICE_ORDER_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={createVehicle.isPending} data-testid="button-submit-walkin">
              {createVehicle.isPending ? "Saving..." : "Create Walk-in Entry"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Receive Vehicle Preview Dialog */}
      <Dialog open={!!receiveDialogVehicle} onOpenChange={(open) => { if (!open) { setReceiveDialogVehicle(null); setReceiveAdviserName(""); } }}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <LogIn className="w-5 h-5 text-green-600" /> Receive Vehicle
            </DialogTitle>
          </DialogHeader>
          {receiveDialogVehicle && (
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 bg-muted/40 rounded-xl p-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Customer</p>
                  <p className="font-semibold">{receiveDialogVehicle.customerName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Vehicle No.</p>
                  <p className="font-semibold">{receiveDialogVehicle.vehicleNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Model</p>
                  <p className="font-medium">{receiveDialogVehicle.vehicleModel || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Appt. Time</p>
                  <p className="font-medium">{receiveDialogVehicle.appointmentTime || '—'}</p>
                </div>
                {receiveDialogVehicle.ssdNo && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">SSD No. (Job Card)</p>
                    <p className="font-medium">{receiveDialogVehicle.ssdNo}</p>
                  </div>
                )}
                {receiveDialogVehicle.serviceOrderType && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Order Type</p>
                    <p className="font-medium">{receiveDialogVehicle.serviceOrderType}</p>
                  </div>
                )}
                {receiveDialogVehicle.phone && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Phone</p>
                    <p className="font-medium">{receiveDialogVehicle.phone}</p>
                  </div>
                )}
                <div className="col-span-2 border-t border-border/40 pt-2 mt-1">
                  <p className="text-xs text-muted-foreground mb-0.5">Assigned Service Adviser</p>
                  <p className="font-bold text-base text-primary">{receiveDialogVehicle.serviceAdviser || '—'}</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Service Adviser</label>
                  {!receiveAdviserName && (
                    <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Selection required</span>
                  )}
                </div>
                <Select value={receiveAdviserName} onValueChange={setReceiveAdviserName}>
                  <SelectTrigger data-testid="select-receive-adviser" className={!receiveAdviserName ? "border-amber-400 dark:border-amber-600" : ""}>
                    <SelectValue placeholder="Select adviser to assign" />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_ADVISERS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {receiveAdviserName
                    ? "Pre-matched from import — change only if needed."
                    : `Original value "${receiveDialogVehicle?.serviceAdviser}" didn't match any adviser. Please select manually.`}
                </p>
              </div>

              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => { setReceiveDialogVehicle(null); setReceiveAdviserName(""); }}>
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  onClick={handleConfirmReceive}
                  disabled={updateVehicle.isPending || !receiveAdviserName}
                  data-testid="button-confirm-receive"
                >
                  <LogIn className="w-4 h-4 mr-1.5" />
                  {updateVehicle.isPending ? "Receiving..." : "Confirm Receive"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Excel Upload Modal */}
      <Dialog open={showUploadModal} onOpenChange={(v) => { if (!v) resetUpload(); setShowUploadModal(v); }}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-[860px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <FileSpreadsheet className="w-5 h-5 text-green-600 shrink-0" /> Upload Appointment Schedule
            </DialogTitle>
          </DialogHeader>

          {!importResult ? (
            <div className="space-y-4 mt-2">
              {/* Upload area */}
              <div
                className="border-2 border-dashed border-border rounded-xl p-6 sm:p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
                data-testid="upload-area"
              >
                <Upload className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">Click to upload Excel file</p>
                <p className="text-xs text-muted-foreground mt-1">Supports .xlsx and .xls</p>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} data-testid="input-file-upload" />
              </div>

              {excelFile && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm bg-muted/50 p-3 rounded-lg">
                    <FileSpreadsheet className="w-4 h-4 text-green-600 shrink-0" />
                    <span className="font-medium truncate flex-1">{excelFile.name}</span>
                    <Button variant="ghost" size="sm" onClick={resetUpload} className="shrink-0"><X className="w-4 h-4" /></Button>
                  </div>

                  {/* Header row selector */}
                  <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-blue-600 shrink-0" />
                    <div className="flex-1 text-sm">
                      <span className="font-medium text-blue-700 dark:text-blue-300">Which row contains the column headers?</span>
                    </div>
                    <Select value={String(headerRowIndex + 1)} onValueChange={handleHeaderRowChange}>
                      <SelectTrigger className="w-24 h-8 text-xs" data-testid="select-header-row">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: Math.min(rawExcelRows.length, 10) }, (_, i) => (
                          <SelectItem key={i + 1} value={String(i + 1)}>Row {i + 1}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Show sample of selected header row */}
                  {rawExcelRows.length > 0 && (
                    <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded overflow-x-auto">
                      <span className="font-medium">Row {headerRowIndex + 1} preview: </span>
                      {rawExcelRows[headerRowIndex]?.slice(0, 8).map((h: any, i: number) => (
                        <span key={i} className="inline-block border border-border/60 rounded px-1.5 py-0.5 mr-1 mb-1 bg-background">{String(h || "—")}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {fileError && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {fileError}
                </div>
              )}
              {headerError && (
                <div className="flex items-center gap-2 text-sm text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/10 p-3 rounded-lg">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {headerError}
                </div>
              )}

              {/* Preview table */}
              {excelPreview.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold">{excelPreview.length} valid records found</p>
                  <div className="overflow-x-auto rounded-lg border border-border max-h-52 sm:max-h-64">
                    <table className="w-full text-xs text-left min-w-[600px]">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr>
                          {["#", "Appt. Time", "SSD No", "Customer", "License", "Model", "Adviser", "Order Type"].map(h => (
                            <th key={h} className="px-3 py-2 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {excelPreview.map((r, i) => (
                          <tr key={i} className="border-t border-border/50 hover:bg-muted/20">
                            <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{r.appointmentTime}</td>
                            <td className="px-3 py-2">{r.ssdNo}</td>
                            <td className="px-3 py-2 font-medium whitespace-nowrap">{r.customerName}</td>
                            <td className="px-3 py-2">{r.vehicleNumber}</td>
                            <td className="px-3 py-2">{r.vehicleModel}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{r.serviceAdviser}</td>
                            <td className="px-3 py-2">{r.serviceOrderType}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Button className="w-full" onClick={handleImport} disabled={isImporting} data-testid="button-import">
                    {isImporting ? "Importing..." : `Import ${excelPreview.length} Records as Today's Appointments`}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-3 gap-3">
                <Card className="text-center"><CardContent className="p-4">
                  <p className="text-2xl font-bold text-green-600">{importResult.imported}</p>
                  <p className="text-xs text-muted-foreground">Imported</p>
                </CardContent></Card>
                <Card className="text-center"><CardContent className="p-4">
                  <p className="text-2xl font-bold text-orange-500">{importResult.skipped}</p>
                  <p className="text-xs text-muted-foreground">Skipped</p>
                </CardContent></Card>
                <Card className="text-center"><CardContent className="p-4">
                  <p className="text-2xl font-bold text-blue-500">{importResult.imported + importResult.skipped}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </CardContent></Card>
              </div>
              {importResult.skippedRows.length > 0 && (
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-orange-600">Skipped (duplicates or errors)</p>
                  <div className="bg-orange-50 dark:bg-orange-900/10 rounded-lg p-3 max-h-36 overflow-y-auto">
                    {importResult.skippedRows.map((row, i) => (
                      <div key={i} className="text-xs text-orange-700 dark:text-orange-300 py-0.5">{i + 1}. {row}</div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={resetUpload}>Upload Another</Button>
                <Button className="flex-1" onClick={() => { resetUpload(); setShowUploadModal(false); }} data-testid="button-done-import">Done</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VehicleList({ list, isLoading, onReceive, updateVehicle }: {
  list: any[];
  isLoading: boolean;
  onReceive: (v: any) => void;
  updateVehicle: any;
}) {
  const { toast } = useToast();

  const [editVehicle, setEditVehicle] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ serviceAdviser: "", serviceOrderType: "", phone: "", jobCardNumber: "" });

  const openEdit = (v: any) => {
    setEditVehicle(v);
    setEditForm({
      serviceAdviser: v.serviceAdviser || "",
      serviceOrderType: v.serviceOrderType || "",
      phone: v.phone || "",
      jobCardNumber: v.jobCardNumber || "",
    });
  };

  const saveEdit = () => {
    if (!editVehicle) return;
    updateVehicle.mutate({
      id: editVehicle.id,
      serviceAdviser: editForm.serviceAdviser || undefined,
      serviceOrderType: editForm.serviceOrderType || undefined,
      phone: editForm.phone,
      jobCardNumber: editForm.jobCardNumber || null,
    }, {
      onSuccess: () => {
        toast({ title: "Details updated" });
        setEditVehicle(null);
      }
    });
  };

  const sorted = [...list].sort((a, b) => {
    const tA = a.appointmentTime || "";
    const tB = b.appointmentTime || "";
    return tA.localeCompare(tB);
  });

  if (isLoading) return <div className="py-10 text-center text-muted-foreground text-sm">Loading...</div>;
  if (sorted.length === 0) return (
    <div className="py-12 flex flex-col items-center text-muted-foreground border border-dashed rounded-2xl">
      <CalendarClock className="w-10 h-10 mb-3 text-muted" />
      <p>No records found.</p>
    </div>
  );

  return (
    <>
      {/* Edit Details Dialog */}
      <Dialog open={!!editVehicle} onOpenChange={(open) => { if (!open) setEditVehicle(null); }}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4" /> Edit Vehicle Details
            </DialogTitle>
          </DialogHeader>
          {editVehicle && (
            <div className="space-y-4 mt-2">
              <div className="bg-muted/40 rounded-lg p-3 text-sm">
                <span className="font-bold">{editVehicle.vehicleNumber}</span>
                <span className="text-muted-foreground ml-2">{editVehicle.vehicleModel}</span>
                <span className="text-muted-foreground ml-2">· {editVehicle.customerName}</span>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Service Adviser</label>
                <Select value={editForm.serviceAdviser} onValueChange={v => setEditForm(f => ({ ...f, serviceAdviser: v }))}>
                  <SelectTrigger data-testid="select-edit-adviser"><SelectValue placeholder="Select adviser" /></SelectTrigger>
                  <SelectContent>{SERVICE_ADVISERS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Service Order Type</label>
                <Select value={editForm.serviceOrderType} onValueChange={v => setEditForm(f => ({ ...f, serviceOrderType: v }))}>
                  <SelectTrigger data-testid="select-edit-order-type"><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>{SERVICE_ORDER_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Phone</label>
                  <Input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} data-testid="input-edit-phone" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Job Card #</label>
                  <Input value={editForm.jobCardNumber} onChange={e => setEditForm(f => ({ ...f, jobCardNumber: e.target.value }))} data-testid="input-edit-jobcard" />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setEditVehicle(null)}>Cancel</Button>
                <Button className="flex-1" onClick={saveEdit} disabled={updateVehicle.isPending} data-testid="button-save-edit">
                  {updateVehicle.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Mobile card layout */}
      <div className="flex flex-col gap-3 md:hidden">
        {sorted.map((v, i) => {
          const isReceived = v.status !== "Today's Appointment";
          return (
            <motion.div
              key={v.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Card className="border border-border/50 shadow-sm">
                <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold text-base">{v.vehicleNumber}</div>
                      <div className="text-xs text-muted-foreground">{v.vehicleModel}</div>
                    </div>
                    <StatusBadge status={v.status} />
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div><span className="text-muted-foreground">Customer: </span><span className="font-medium">{v.customerName}</span></div>
                    <div><span className="text-muted-foreground">Job Card: </span><span className="font-medium">{v.jobCardNumber || '—'}</span></div>
                    {v.appointmentTime && <div><span className="text-muted-foreground">Appt: </span><span>{v.appointmentTime}</span></div>}
                    {v.ssdNo && <div><span className="text-muted-foreground">SSD: </span><span>{v.ssdNo}</span></div>}
                    <div className="col-span-2"><span className="text-muted-foreground">Adviser: </span><span className="font-medium">{v.serviceAdviser || '—'}</span></div>
                    {v.serviceOrderType && <div><span className="text-muted-foreground">Order: </span><span>{v.serviceOrderType}</span></div>}
                    {v.receivedAt && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Received: </span>
                        <span className="font-medium text-green-700 dark:text-green-400">{format(new Date(v.receivedAt), 'HH:mm, dd MMM yyyy')}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {v.status === "Today's Appointment" && (
                      <Button
                        size="sm"
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white h-8 text-xs"
                        onClick={() => onReceive(v)}
                        disabled={updateVehicle.isPending}
                        data-testid={`button-receive-mobile-${v.id}`}
                      >
                        <LogIn className="w-3.5 h-3.5 mr-1.5" /> Receive Vehicle
                      </Button>
                    )}
                    {isReceived && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-8 text-xs"
                        onClick={() => openEdit(v)}
                        data-testid={`button-edit-details-mobile-${v.id}`}
                      >
                        <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit Details
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Desktop table layout */}
      <div className="hidden md:block">
        <Card className="shadow-sm border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                <tr>
                  <th className="px-4 py-3">Job Card / Date</th>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Vehicle</th>
                  <th className="px-4 py-3">Adviser</th>
                  <th className="px-4 py-3">Received</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((v, i) => {
                  const isReceived = v.status !== "Today's Appointment";
                  return (
                    <motion.tr
                      key={v.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-xs">{v.jobCardNumber || <span className="text-muted-foreground italic">Pending</span>}</div>
                        <div className="text-xs text-muted-foreground">{v.createdAt ? format(new Date(v.createdAt), 'MMM dd') : '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-sm">{v.appointmentTime || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{v.customerName}</div>
                        <div className="text-xs text-muted-foreground">{v.ssdNo || v.phone || ''}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{v.vehicleNumber}</div>
                        <div className="text-xs text-muted-foreground">{v.vehicleModel}</div>
                      </td>
                      <td className="px-4 py-3 text-xs">{v.serviceAdviser || v.serviceType || '—'}</td>
                      <td className="px-4 py-3 text-xs">
                        {v.receivedAt
                          ? <span className="text-green-700 dark:text-green-400 font-medium">{format(new Date(v.receivedAt), 'HH:mm, dd MMM')}</span>
                          : <span className="text-muted-foreground">—</span>
                        }
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={v.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {!isReceived && (
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white h-7 px-3 text-xs whitespace-nowrap"
                              onClick={() => onReceive(v)}
                              disabled={updateVehicle.isPending}
                              data-testid={`button-receive-${v.id}`}
                            >
                              <LogIn className="w-3 h-3 mr-1" /> Receive
                            </Button>
                          )}
                          {isReceived && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-3 text-xs"
                              onClick={() => openEdit(v)}
                              data-testid={`button-edit-details-${v.id}`}
                            >
                              <Pencil className="w-3 h-3 mr-1" /> Edit
                            </Button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
