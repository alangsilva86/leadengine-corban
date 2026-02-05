export const WHATSAPP_CAMPAIGN_PRODUCTS: {
    value: string;
    label: string;
    description: string;
    defaultMargin: number;
}[];
export const WHATSAPP_CAMPAIGN_STRATEGIES: {
    value: string;
    label: string;
    description: string;
}[];
export function findCampaignProduct(value: any): {
    value: string;
    label: string;
    description: string;
    defaultMargin: number;
} | null;
export function findCampaignStrategy(value: any): {
    value: string;
    label: string;
    description: string;
} | null;
