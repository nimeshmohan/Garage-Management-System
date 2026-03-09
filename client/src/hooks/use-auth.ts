import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

// Utility to parse and log
function parseResponse<T>(schema: z.ZodSchema<T>, data: unknown, label: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error(`[Zod Error] ${label}:`, result.error.format());
    throw new Error("Invalid response format from server");
  }
  return result.data;
}

export function useUser() {
  return useQuery({
    queryKey: [api.auth.me.path],
    queryFn: async () => {
      const res = await fetch(api.auth.me.path, { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to fetch user");
      const data = await res.json();
      return parseResponse(api.auth.me.responses[200], data, "auth.me");
    },
    staleTime: Infinity,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  return useMutation({
    mutationFn: async (credentials: z.infer<typeof api.auth.login.input>) => {
      const res = await fetch(api.auth.login.path, {
        method: api.auth.login.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
        credentials: "include",
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        if (res.status === 401) throw new Error(data.message || "Invalid credentials");
        throw new Error("Failed to login");
      }
      
      return parseResponse(api.auth.login.responses[200], data, "auth.login");
    },
    onSuccess: (user) => {
      queryClient.setQueryData([api.auth.me.path], user);
      toast({ title: "Welcome back!", description: `Logged in as ${user.name}` });
      
      // Route based on role
      const routes: Record<string, string> = {
        receptionist: "/receptionist",
        service_adviser: "/service-adviser",
        job_controller: "/job-controller",
        technician: "/technician",
        service_head: "/service-head",
        customer: "/track"
      };
      setLocation(routes[user.role] || "/");
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Login failed", description: error.message });
    }
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  return useMutation({
    mutationFn: async (userData: z.infer<typeof api.auth.register.input>) => {
      const res = await fetch(api.auth.register.path, {
        method: api.auth.register.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userData),
        credentials: "include",
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || "Failed to register");
      }
      
      return parseResponse(api.auth.register.responses[201], data, "auth.register");
    },
    onSuccess: (user) => {
      queryClient.setQueryData([api.auth.me.path], user);
      toast({ title: "Account created!", description: `Welcome ${user.name}` });
      setLocation("/");
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Registration failed", description: error.message });
    }
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  return useMutation({
    mutationFn: async () => {
      await fetch(api.auth.logout.path, {
        method: api.auth.logout.method,
        credentials: "include",
      });
    },
    onSuccess: () => {
      queryClient.setQueryData([api.auth.me.path], null);
      queryClient.clear();
      setLocation("/login");
    }
  });
}
