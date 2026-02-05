export function computeLoadLevel(metrics?: {}, ratePercentage?: number): "alta" | "baixa" | "media";
export function computeHealthScore(connectionState: any, metrics?: {}, ratePercentage?: number): number;
export function categorizeHealth(score: any): "alta" | "baixa" | "media";
export function resolveProvider(instance: any): string | null;
export function resolveTimestamp(instance: any): Date | null;
export function useInstanceMetrics({ instanceViewModels, instancesReady }: {
    instanceViewModels: any;
    instancesReady: any;
}): {
    enrichedInstances: any;
    filteredInstances: any;
    providerOptions: any[];
    summary: {
        state: string;
        totals: {
            connected: number;
            attention: number;
            reconnecting: number;
            disconnected: number;
        };
        queueTotal: number;
        failureTotal: number;
        usageAverage: number;
        lastSyncLabel: string;
        healthScore: number;
        total: any;
    };
    priorityInstance: any;
    searchTerm: string;
    setSearchTerm: import("react").Dispatch<import("react").SetStateAction<string>>;
    statusFilter: string;
    setStatusFilter: import("react").Dispatch<import("react").SetStateAction<string>>;
    healthFilter: string;
    setHealthFilter: import("react").Dispatch<import("react").SetStateAction<string>>;
    providerFilter: string;
    setProviderFilter: import("react").Dispatch<import("react").SetStateAction<string>>;
    sortBy: string;
    setSortBy: import("react").Dispatch<import("react").SetStateAction<string>>;
    filtersApplied: number;
    activeInstances: any;
    handleClearFilters: () => void;
};
export default useInstanceMetrics;
