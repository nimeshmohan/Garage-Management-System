import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { z } from "zod";

export function useTechnicians() {
  return useQuery({
    queryKey: [api.users.listTechnicians.path],
    queryFn: async () => {
      const res = await fetch(api.users.listTechnicians.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch technicians");
      const data = await res.json();
      return api.users.listTechnicians.responses[200].parse(data);
    }
  });
}
