export default function useQrImageSource(qrPayload: any): {
    src: any;
    isGenerating: boolean;
    error: null;
    meta: import("../utils/qr.js").QrImageMeta;
};
export namespace __testing {
    function clearCache(): void;
    function getCacheSnapshot(): Map<any, any>;
}
