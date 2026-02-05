export namespace CONNECTION_STATUS_MAP {
    export let success: string;
    export let info: string;
    export let warning: string;
    export let destructive: string;
    export let secondary: string;
    let _default: string;
    export { _default as default };
}
export function resolveConnectionState(statusInfo: any): any;
