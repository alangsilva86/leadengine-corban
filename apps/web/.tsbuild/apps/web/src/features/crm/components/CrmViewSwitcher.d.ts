import type { CrmViewType } from '../state/view-context';
type CrmViewSwitcherProps = {
    onViewChange?: (view: CrmViewType) => void;
};
declare const CrmViewSwitcher: ({ onViewChange }: CrmViewSwitcherProps) => import("react/jsx-runtime").JSX.Element;
export default CrmViewSwitcher;
