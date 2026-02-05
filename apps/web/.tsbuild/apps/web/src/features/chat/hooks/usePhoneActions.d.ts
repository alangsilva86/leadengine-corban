export function usePhoneActions(rawPhone: any, options?: {}): (action: any, overridePhone: any) => boolean;
export namespace PHONE_ACTIONS {
    let CALL: string;
    let WHATSAPP: string;
    let SMS: string;
    let COPY: string;
}
export default usePhoneActions;
