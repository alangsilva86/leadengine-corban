export default useInboxLayoutState;
declare function useInboxLayoutState({ defaultContextOpen, contextAvailable, currentUser, telemetry, }?: {
    defaultContextOpen?: boolean | undefined;
    contextAvailable?: boolean | undefined;
    telemetry?: ((event: any, payload?: {}) => void) | undefined;
}): {
    canPersistPreferences: boolean;
    contextOpen: boolean;
    contextDrawerOpen: boolean;
    setContextOpen: import("react").Dispatch<import("react").SetStateAction<boolean>>;
    desktopListVisible: boolean;
    setDesktopListVisible: import("react").Dispatch<import("react").SetStateAction<boolean>>;
    mobileListOpen: boolean;
    setMobileListOpen: import("react").Dispatch<import("react").SetStateAction<boolean>>;
    headerListButtonLabel: string;
    handleToggleListVisibility: () => void;
    handleToggleContext: () => void;
    shouldRenderSplitLayout: boolean;
    isDesktop: boolean;
};
