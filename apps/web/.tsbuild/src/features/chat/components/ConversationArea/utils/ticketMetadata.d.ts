export function resolveTicketSourceInstance(ticket: any): string | null;
export function resolveTicketCampaignId(ticket: any): string | null;
export function resolveTicketCampaignName(ticket: any): string | null;
export function resolveTicketProductType(ticket: any): string | null;
export function resolveTicketStrategy(ticket: any): string | null;
export function resolveTicketContext(ticket: any): {
    instance: string | null;
    campaignId: string | null;
    campaignName: string | null;
    productType: string | null;
    strategy: string | null;
};
export function normalizeTicketString(value: any): string | null;
