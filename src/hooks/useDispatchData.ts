import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Load, Driver, Vehicle, Profile, Company, RateCard } from "@/pages/dispatch/types";

export function useDispatchData(dateRangeStart: string, dateRangeEnd: string) {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const { data: loads = [], isLoading: loadsLoading, dataUpdatedAt: loadsUpdatedAt } = useQuery({
        queryKey: ["dispatch-loads", dateRangeStart, dateRangeEnd],
        queryFn: async () => {
            const { data, error } = await supabase.from("daily_loads")
                .select("*")
                .gte("load_date", dateRangeStart)
                .lte("load_date", dateRangeEnd)
                .order("load_date", { ascending: false });
            if (error) throw error;
            return (data ?? []) as Load[];
        },
        staleTime: 30_000,
        retry: 3,
        enabled: !!user,
    });

    const { data: drivers = [] } = useQuery({
        queryKey: ["dispatch-drivers"],
        queryFn: async () => {
            const { data, error } = await supabase.from("drivers").select("id, full_name, hub, status").eq("status", "active");
            if (error) throw error;
            return (data ?? []) as Driver[];
        },
        staleTime: 30_000,
        retry: 3,
        enabled: !!user,
    });

    const { data: vehicles = [] } = useQuery({
        queryKey: ["dispatch-vehicles"],
        queryFn: async () => {
            const { data, error } = await supabase.from("vehicles").select("id, vehicle_name, vehicle_type, hub, status").eq("status", "active");
            if (error) throw error;
            return (data ?? []) as Vehicle[];
        },
        staleTime: 30_000,
        retry: 3,
        enabled: !!user,
    });

    const { data: profiles = [] } = useQuery({
        queryKey: ["dispatch-profiles"],
        queryFn: async () => {
            const { data, error } = await supabase.from("profiles").select("user_id, full_name");
            if (error) throw error;
            return (data ?? []) as Profile[];
        },
        staleTime: 30_000,
        retry: 3,
        enabled: !!user,
    });

    const { data: companies = [] } = useQuery({
        queryKey: ["dispatch-companies"],
        queryFn: async () => {
            const { data, error } = await supabase.from("companies").select("id, name, address, city, state, phone").order("name");
            if (error) throw error;
            return (data ?? []) as Company[];
        },
        staleTime: 30_000,
        retry: 3,
        enabled: !!user,
    });

    const { data: rateCards = [] } = useQuery({
        queryKey: ["dispatch-rate-cards"],
        queryFn: async () => {
            const { data, error } = await supabase.from("rate_cards").select("*");
            if (error) throw error;
            return (data ?? []) as RateCard[];
        },
        staleTime: 30_000,
        retry: 3,
        enabled: !!user,
    });

    const { data: recentAddresses = [] } = useQuery({
        queryKey: ["dispatch-recent-addresses"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("daily_loads")
                .select("pickup_address, delivery_address, pickup_company, delivery_company")
                .not("pickup_address", "is", null)
                .order("created_at", { ascending: false })
                .limit(60);
            if (error) throw error;
            return [...new Set([
                ...(data ?? []).map((d: any) => d.pickup_address),
                ...(data ?? []).map((d: any) => d.delivery_address),
            ].filter(Boolean))].slice(0, 20) as string[];
        },
        staleTime: 30_000,
        retry: 3,
        enabled: !!user,
    });

    const refetchLoads = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ["dispatch-loads", dateRangeStart, dateRangeEnd] });
    }, [queryClient, dateRangeStart, dateRangeEnd]);

    const refetchCompanies = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ["dispatch-companies"] });
    }, [queryClient]);

    return {
        loads,
        loadsLoading,
        loadsUpdatedAt,
        drivers,
        vehicles,
        profiles,
        companies,
        rateCards,
        recentAddresses,
        refetchLoads,
        refetchCompanies,
    };
}
