import { useState } from "react";
import { useTrackVehicle } from "@/hooks/use-vehicles";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Car, ArrowLeft, CheckCircle2, Circle } from "lucide-react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";

export function TrackVehicle() {
  const [identifier, setIdentifier] = useState("");
  const [query, setQuery] = useState("");
  
  const { data: vehicle, isLoading, isError, refetch } = useTrackVehicle(query);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (identifier.trim()) {
      setQuery(identifier.trim());
      setTimeout(() => refetch(), 0);
    }
  };

  const steps = [
    "Vehicle Received",
    "Inspection Completed",
    "Waiting for Technician Approval",
    "Work in Progress",
    "Ready for Delivery"
  ];

  const getCurrentStepIndex = (status: string) => {
    return steps.indexOf(status);
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden pt-12 px-4">
      {/* Decorative bg */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none" />
      
      <div className="max-w-3xl mx-auto relative z-10">
        <Link href="/">
          <span className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground cursor-pointer mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
          </span>
        </Link>
        
        <div className="text-center mb-10">
          <h1 className="text-4xl font-display font-bold text-foreground mb-4">Track Your Vehicle</h1>
          <p className="text-lg text-muted-foreground max-w-lg mx-auto">
            Enter your Job Card Number or Vehicle Registration to check real-time service status.
          </p>
        </div>

        <Card className="border-none shadow-xl shadow-black/5 bg-white/60 backdrop-blur-xl">
          <CardContent className="p-2">
            <form onSubmit={handleSearch} className="flex gap-2 relative">
              <Input 
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                placeholder="e.g. JC-1234 or AB 12 CD 3456"
                className="h-14 text-lg bg-transparent border-none shadow-none focus-visible:ring-0 px-6"
              />
              <Button type="submit" className="h-14 px-8 rounded-xl shadow-lg hover:shadow-primary/25 hover:-translate-y-0.5 transition-all">
                <Search className="w-5 h-5 mr-2" />
                Track
              </Button>
            </form>
          </CardContent>
        </Card>

        <AnimatePresence mode="wait">
          {isLoading && (
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="mt-12 text-center text-muted-foreground">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              Searching records...
            </motion.div>
          )}

          {isError && (
             <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-20}} className="mt-12 text-center">
               <div className="inline-flex items-center justify-center p-4 bg-red-50 text-red-500 rounded-2xl">
                 No vehicle found matching "{query}". Please check your details and try again.
               </div>
             </motion.div>
          )}

          {vehicle && (
            <motion.div 
              initial={{opacity: 0, y: 20}} 
              animate={{opacity: 1, y: 0}} 
              exit={{opacity: 0, y: -20}}
              className="mt-12 space-y-6"
            >
              <Card className="overflow-hidden border-border/50 shadow-lg">
                <div className="bg-muted/30 px-6 py-4 border-b flex justify-between items-center">
                  <div className="flex items-center">
                    <div className="p-2 bg-primary/10 text-primary rounded-lg mr-4">
                      <Car className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{vehicle.vehicleModel}</h3>
                      <p className="text-sm text-muted-foreground font-medium">{vehicle.vehicleNumber}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Job Card</p>
                    <p className="font-mono font-bold text-lg">{vehicle.jobCardNumber}</p>
                  </div>
                </div>
                
                <CardContent className="p-8">
                  <h4 className="text-xl font-display font-bold mb-8">Service Status Timeline</h4>
                  
                  <div className="relative">
                    {/* Progress Line */}
                    <div className="absolute left-[15px] top-4 bottom-4 w-1 bg-muted rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ height: 0 }}
                        animate={{ height: `${(getCurrentStepIndex(vehicle.status) / (steps.length - 1)) * 100}%` }}
                        transition={{ duration: 1, ease: "easeInOut" }}
                        className="w-full bg-primary"
                      />
                    </div>

                    <div className="space-y-8 relative">
                      {steps.map((step, idx) => {
                        const currentIndex = getCurrentStepIndex(vehicle.status);
                        const isCompleted = idx <= currentIndex;
                        const isCurrent = idx === currentIndex;
                        
                        return (
                          <div key={step} className="flex items-start">
                            <div className="relative z-10 bg-card rounded-full mt-0.5">
                              {isCompleted ? (
                                <CheckCircle2 className={`w-8 h-8 ${isCurrent ? 'text-primary' : 'text-green-500'}`} />
                              ) : (
                                <Circle className="w-8 h-8 text-muted-foreground/30" />
                              )}
                            </div>
                            <div className={`ml-6 ${isCompleted ? 'text-foreground' : 'text-muted-foreground/50'}`}>
                              <h5 className={`text-lg font-bold ${isCurrent ? 'text-primary' : ''}`}>{step}</h5>
                              
                              {/* Contextual Subtext based on step & data */}
                              {step === "Vehicle Received" && isCompleted && (
                                <p className="text-sm mt-1">Logged on {format(new Date(vehicle.createdAt!), 'MMM dd, h:mm a')}</p>
                              )}
                              {step === "Work in Progress" && isCurrent && vehicle.estimatedTime && (
                                <p className="text-sm mt-1 bg-primary/10 text-primary px-3 py-1 rounded-md inline-block">
                                  Est. Completion: {vehicle.estimatedTime}
                                </p>
                              )}
                              {step === "Ready for Delivery" && isCompleted && (
                                <p className="text-sm mt-1 text-green-600 font-medium">Your vehicle is ready for pickup!</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
