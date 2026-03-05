import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, AlertCircle, Wrench, Package } from "lucide-react";

export function StatusBadge({ status }: { status: string }) {
  const getStatusConfig = () => {
    switch (status) {
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
