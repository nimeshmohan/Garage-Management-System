import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

function parse<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

export function useVehicles() {
  return useQuery({
    queryKey: [api.vehicles.list.path],
    queryFn: async () => {
      const res = await fetch(api.vehicles.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch vehicles");
      const data = await res.json();
      return parse(api.vehicles.list.responses[200], data);
    }
  });
}

export function useVehicle(id: number) {
  return useQuery({
    queryKey: [api.vehicles.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.vehicles.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch vehicle");
      return parse(api.vehicles.get.responses[200], await res.json());
    },
    enabled: !!id
  });
}

export function useCreateVehicle() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: z.infer<typeof api.vehicles.create.input>) => {
      const res = await fetch(api.vehicles.create.path, {
        method: api.vehicles.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include"
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.message || "Failed to create");
      return parse(api.vehicles.create.responses[201], resData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.vehicles.list.path] });
      toast({ title: "Success", description: "Vehicle registered successfully" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  });
}

export function useUpdateVehicle() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & Partial<z.infer<typeof api.vehicles.update.input>>) => {
      const url = buildUrl(api.vehicles.update.path, { id });
      const res = await fetch(url, {
        method: api.vehicles.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include"
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.message || "Failed to update");
      return parse(api.vehicles.update.responses[200], resData);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.vehicles.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.vehicles.get.path, variables.id] });
      toast({ title: "Updated", description: "Vehicle details updated" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  });
}

export function useTrackVehicle(identifier: string) {
  return useQuery({
    queryKey: [api.vehicles.track.path, identifier],
    queryFn: async () => {
      if (!identifier) return null;
      const url = buildUrl(api.vehicles.track.path, { identifier });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to track vehicle");
      return parse(api.vehicles.track.responses[200], await res.json());
    },
    enabled: false, // Triggered manually
    retry: false
  });
}
