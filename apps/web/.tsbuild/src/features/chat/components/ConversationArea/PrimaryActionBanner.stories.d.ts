export default meta;
export namespace Default {
    let args: {};
}
declare namespace meta {
    export let title: string;
    export { PrimaryActionBanner as component };
    export namespace parameters {
        let layout: string;
    }
    export namespace args_1 {
        export let name: string;
        let title_1: string;
        export { title_1 as title };
        export let shortId: string;
        export namespace statusInfo {
            export let label: string;
            export let tone: string;
            export { CheckCircle2 as icon };
        }
        export let stageKey: string;
        export namespace stageInfo {
            let label_1: string;
            export { label_1 as label };
            let tone_1: string;
            export { tone_1 as tone };
            export { ClipboardCheck as icon };
        }
        export namespace originInfo {
            let label_2: string;
            export { label_2 as label };
            export { Headset as icon };
        }
        export let typingAgents: {
            userId: string;
            userName: string;
        }[];
        export namespace primaryAction {
            let label_3: string;
            export { label_3 as label };
        }
        export function onPrimaryAction(): void;
        export namespace jro {
            let state: string;
            let progress: number;
            let deadline: string;
            let remainingLabel: string;
            let msRemaining: number;
        }
        export let commandContext: {};
        export let detailsOpen: boolean;
        export function onRequestDetails(): void;
        export let nextStepValue: string;
        export { ticket };
        export let aiMode: string;
        export let aiConfidence: number;
        export let aiModeChangeDisabled: boolean;
        export function onAiModeChange(): void;
        export function onTakeOver(): void;
        export function onGiveBackToAi(): void;
        export let contactPhone: string;
        export let instanceId: string;
        export namespace instancePresentation {
            let label_4: string;
            export { label_4 as label };
            export let color: string;
            export let number: string;
        }
    }
    export { args_1 as args };
    export function render(args: any): import("react/jsx-runtime").JSX.Element;
}
import PrimaryActionBanner from './PrimaryActionBanner.jsx';
import { CheckCircle2 } from 'lucide-react';
import { ClipboardCheck } from 'lucide-react';
import { Headset } from 'lucide-react';
declare namespace ticket {
    export let id: string;
    let instanceId_1: string;
    export { instanceId_1 as instanceId };
    export let subject: string;
    export namespace contact {
        let id_1: string;
        export { id_1 as id };
        let name_1: string;
        export { name_1 as name };
        export let phone: string;
        export let document: string;
        export let email: string;
    }
    export namespace lead {
        let id_2: string;
        export { id_2 as id };
        export let campaignId: string;
        export let campaignName: string;
        export namespace customFields {
            namespace deal {
                let installmentValue: string;
                let netValue: string;
            }
        }
    }
    export namespace metadata {
        export let sourceInstance: string;
        let campaignId_1: string;
        export { campaignId_1 as campaignId };
        let campaignName_1: string;
        export { campaignName_1 as campaignName };
        export let productType: string;
        export let strategy: string;
        let contactPhone_1: string;
        export { contactPhone_1 as contactPhone };
    }
}
