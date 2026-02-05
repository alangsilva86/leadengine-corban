export default ContactsToolbar;
declare function ContactsToolbar({ searchValue, onSearchChange, filters, onFiltersChange, onClearFilters, selectedCount, onClearSelection, onBulkAction, isBulkProcessing, onRefresh, isRefreshing, availableTags, totalCount, onCreateContact, }: {
    searchValue: any;
    onSearchChange: any;
    filters: any;
    onFiltersChange: any;
    onClearFilters: any;
    selectedCount?: number | undefined;
    onClearSelection: any;
    onBulkAction: any;
    isBulkProcessing?: boolean | undefined;
    onRefresh: any;
    isRefreshing?: boolean | undefined;
    availableTags?: never[] | undefined;
    totalCount: any;
    onCreateContact: any;
}): import("react/jsx-runtime").JSX.Element;
