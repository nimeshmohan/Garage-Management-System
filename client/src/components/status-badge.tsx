import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, AlertCircle, Wrench, Package, CalendarClock, CarFront } from "lucide-react";

export function StatusBadge({ status }: { status: string }) {
  const getStatusConfig = () => {
    switch (status) {
      case "Waiting for Adviser":
        return { color: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300", icon: Clock };
      case "Today's Appointment":
        return { color: "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300", icon: CalendarClock };
      case "Walk-in":
        return { color: "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300", icon: CarFront };
      case "Vehicle Received":
        return { color: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300", icon: Package };
      case "Inspection Completed":
        return { color: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300", icon: CheckCircle };
      case "Waiting for Technician Approval":
        return { color: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300", icon: AlertCircle };
      case "Work in Progress":
        return { color: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300", icon: Wrench };
      case "Ready for Delivery":
        return { color: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300", icon: CheckCircle };
      case "Delivered":
        return { color: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300", icon: CheckCircle };
      case "Waiting for Parts":
        return { color: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300", icon: Package };
      case "Reopened":
        return { color: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300", icon: AlertCircle };
      default:
        return { color: "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300", icon: Clock };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={`font-medium py-1 px-3 shadow-sm ${config.color}`}>
      <Icon className="w-3.5 h-3.5 mr-1.5" />
      {status}
    </Badge>
  );
}
