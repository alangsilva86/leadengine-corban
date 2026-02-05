declare namespace _default {
    export let title: string;
    export { AgreementCard as component };
}
export default _default;
export function Default(args: any): import("react/jsx-runtime").JSX.Element;
export namespace Default {
    namespace args {
        let isSelected: boolean;
        let name: string;
        let description: string;
        let region: string;
        let availableLeads: number;
        let hotLeads: number;
        let tags: string[];
        let lastSyncAt: string;
    }
}
export function Selected(args: any): import("react/jsx-runtime").JSX.Element;
export namespace Selected {
    export namespace args_1 {
        let isSelected_1: boolean;
        export { isSelected_1 as isSelected };
    }
    export { args_1 as args };
}
export function Skeleton(): import("react/jsx-runtime").JSX.Element;
import AgreementCard from './AgreementCard.jsx';
