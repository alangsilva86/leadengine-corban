export function useCampaignFilters({ campaigns, selectedAgreementId }: {
    campaigns: any;
    selectedAgreementId: any;
}): {
    agreementFilter: string;
    availableAgreements: any[];
    availableInstances: any[];
    filteredCampaigns: any;
    handleAgreementFilterChange: (value: any) => void;
    instanceFilter: string;
    isFiltered: boolean;
    setInstanceFilter: import("react").Dispatch<import("react").SetStateAction<string>>;
};
