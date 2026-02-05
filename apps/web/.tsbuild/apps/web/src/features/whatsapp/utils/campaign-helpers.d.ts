export namespace statusMeta {
    namespace active {
        let label: string;
        let variant: string;
    }
    namespace paused {
        let label_1: string;
        export { label_1 as label };
        let variant_1: string;
        export { variant_1 as variant };
    }
    namespace draft {
        let label_2: string;
        export { label_2 as label };
        let variant_2: string;
        export { variant_2 as variant };
    }
    namespace ended {
        let label_3: string;
        export { label_3 as label };
        let variant_3: string;
        export { variant_3 as variant };
    }
    namespace archived {
        let label_4: string;
        export { label_4 as label };
        let variant_4: string;
        export { variant_4 as variant };
    }
}
export function getCampaignStatusTone(status: any): any;
export function formatNumber(value: any): string;
