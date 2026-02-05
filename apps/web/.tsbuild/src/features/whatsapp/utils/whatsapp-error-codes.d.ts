export function normalizeWhatsAppErrorCode(code: any): string | null;
export function resolveWhatsAppErrorCopy(code: any, fallbackMessage: any): {
    code: any;
    title: any;
    description: any;
};
export function isNormalizedWhatsAppError(code: any): boolean;
export function getAllWhatsAppErrorCodes(): string[];
export default NORMALIZED_WHATSAPP_ERRORS;
declare namespace NORMALIZED_WHATSAPP_ERRORS {
    namespace INSTANCE_NOT_CONNECTED {
        let code: string;
        let title: string;
        let description: string;
    }
    namespace INVALID_TO {
        let code_1: string;
        export { code_1 as code };
        let title_1: string;
        export { title_1 as title };
        let description_1: string;
        export { description_1 as description };
    }
    namespace RATE_LIMITED {
        let code_2: string;
        export { code_2 as code };
        let title_2: string;
        export { title_2 as title };
        let description_2: string;
        export { description_2 as description };
    }
    namespace BROKER_TIMEOUT {
        let code_3: string;
        export { code_3 as code };
        let title_3: string;
        export { title_3 as title };
        let description_3: string;
        export { description_3 as description };
    }
    namespace BROKER_NOT_CONFIGURED {
        let code_4: string;
        export { code_4 as code };
        let title_4: string;
        export { title_4 as title };
        let description_4: string;
        export { description_4 as description };
    }
}
