export interface ChatCommandCenterContainerProps {
    tenantId?: string | null;
    currentUser?: {
        id?: string | null;
    } | null;
}
export declare const ChatCommandCenterContainer: ({ tenantId: tenantIdProp, currentUser }: ChatCommandCenterContainerProps) => import("react/jsx-runtime").JSX.Element;
export default ChatCommandCenterContainer;
