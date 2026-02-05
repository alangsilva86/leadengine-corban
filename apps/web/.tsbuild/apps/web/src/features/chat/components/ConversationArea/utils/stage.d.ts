export function isSupportedSalesStageKey(stageKey: any): boolean;
export function getStageValue(stageKey: any, { legacy }?: {
    legacy?: boolean | undefined;
}): any;
export function getLegacyStageValue(stageKey: any): any;
export namespace STAGE_LABELS {
    let NOVO: string;
    let CONECTADO: string;
    let QUALIFICACAO: string;
    let PROPOSTA: string;
    let SIMULADO: string;
    let PROPOSTA_ENVIADA: string;
    let ACEITO: string;
    let DIGITANDO: string;
    let CONCLUIDO: string;
    let DOCUMENTACAO: string;
    let DOCUMENTOS_AVERBACAO: string;
    let AGUARDANDO: string;
    let AGUARDANDO_CLIENTE: string;
    let LIQUIDACAO: string;
    let APROVADO_LIQUIDACAO: string;
    let RECICLAR: string;
    let DESCONHECIDO: string;
}
export namespace STAGE_PRESENTATION {
    export namespace NOVO_1 {
        export { Sparkles as icon };
        export let tone: string;
    }
    export { NOVO_1 as NOVO };
    export namespace CONECTADO_1 {
        export { Link2 as icon };
        let tone_1: string;
        export { tone_1 as tone };
    }
    export { CONECTADO_1 as CONECTADO };
    export namespace QUALIFICACAO_1 {
        export { ClipboardList as icon };
        let tone_2: string;
        export { tone_2 as tone };
    }
    export { QUALIFICACAO_1 as QUALIFICACAO };
    export namespace PROPOSTA_1 {
        export { FileText as icon };
        let tone_3: string;
        export { tone_3 as tone };
    }
    export { PROPOSTA_1 as PROPOSTA };
    export namespace SIMULADO_1 {
        export { ClipboardList as icon };
        let tone_4: string;
        export { tone_4 as tone };
    }
    export { SIMULADO_1 as SIMULADO };
    export namespace PROPOSTA_ENVIADA_1 {
        export { FileText as icon };
        let tone_5: string;
        export { tone_5 as tone };
    }
    export { PROPOSTA_ENVIADA_1 as PROPOSTA_ENVIADA };
    export namespace ACEITO_1 {
        export { FileCheck2 as icon };
        let tone_6: string;
        export { tone_6 as tone };
    }
    export { ACEITO_1 as ACEITO };
    export namespace DIGITANDO_1 {
        export { FileSignature as icon };
        let tone_7: string;
        export { tone_7 as tone };
    }
    export { DIGITANDO_1 as DIGITANDO };
    export namespace CONCLUIDO_1 {
        export { BadgeCheck as icon };
        let tone_8: string;
        export { tone_8 as tone };
    }
    export { CONCLUIDO_1 as CONCLUIDO };
    export namespace DOCUMENTACAO_1 {
        export { FileSignature as icon };
        let tone_9: string;
        export { tone_9 as tone };
    }
    export { DOCUMENTACAO_1 as DOCUMENTACAO };
    export namespace DOCUMENTOS_AVERBACAO_1 {
        export { FileCheck2 as icon };
        let tone_10: string;
        export { tone_10 as tone };
    }
    export { DOCUMENTOS_AVERBACAO_1 as DOCUMENTOS_AVERBACAO };
    export namespace AGUARDANDO_1 {
        export { Hourglass as icon };
        let tone_11: string;
        export { tone_11 as tone };
    }
    export { AGUARDANDO_1 as AGUARDANDO };
    export namespace AGUARDANDO_CLIENTE_1 {
        export { Clock3 as icon };
        let tone_12: string;
        export { tone_12 as tone };
    }
    export { AGUARDANDO_CLIENTE_1 as AGUARDANDO_CLIENTE };
    export namespace LIQUIDACAO_1 {
        export { CircleDollarSign as icon };
        let tone_13: string;
        export { tone_13 as tone };
    }
    export { LIQUIDACAO_1 as LIQUIDACAO };
    export namespace APROVADO_LIQUIDACAO_1 {
        export { BadgeCheck as icon };
        let tone_14: string;
        export { tone_14 as tone };
    }
    export { APROVADO_LIQUIDACAO_1 as APROVADO_LIQUIDACAO };
    export namespace RECICLAR_1 {
        export { RefreshCcw as icon };
        let tone_15: string;
        export { tone_15 as tone };
    }
    export { RECICLAR_1 as RECICLAR };
    export namespace DESCONHECIDO_1 {
        export { HelpCircle as icon };
        let tone_16: string;
        export { tone_16 as tone };
    }
    export { DESCONHECIDO_1 as DESCONHECIDO };
}
export namespace STAGE_VALUE_MAP {
    let NOVO_2: string;
    export { NOVO_2 as NOVO };
    let CONECTADO_2: string;
    export { CONECTADO_2 as CONECTADO };
    let QUALIFICACAO_2: string;
    export { QUALIFICACAO_2 as QUALIFICACAO };
    let PROPOSTA_2: string;
    export { PROPOSTA_2 as PROPOSTA };
    let SIMULADO_2: string;
    export { SIMULADO_2 as SIMULADO };
    let PROPOSTA_ENVIADA_2: string;
    export { PROPOSTA_ENVIADA_2 as PROPOSTA_ENVIADA };
    let ACEITO_2: string;
    export { ACEITO_2 as ACEITO };
    let DIGITANDO_2: string;
    export { DIGITANDO_2 as DIGITANDO };
    let CONCLUIDO_2: string;
    export { CONCLUIDO_2 as CONCLUIDO };
    let DOCUMENTACAO_2: string;
    export { DOCUMENTACAO_2 as DOCUMENTACAO };
    let DOCUMENTOS_AVERBACAO_2: string;
    export { DOCUMENTOS_AVERBACAO_2 as DOCUMENTOS_AVERBACAO };
    let AGUARDANDO_2: string;
    export { AGUARDANDO_2 as AGUARDANDO };
    let AGUARDANDO_CLIENTE_2: string;
    export { AGUARDANDO_CLIENTE_2 as AGUARDANDO_CLIENTE };
    let LIQUIDACAO_2: string;
    export { LIQUIDACAO_2 as LIQUIDACAO };
    let APROVADO_LIQUIDACAO_2: string;
    export { APROVADO_LIQUIDACAO_2 as APROVADO_LIQUIDACAO };
    let RECICLAR_2: string;
    export { RECICLAR_2 as RECICLAR };
    let DESCONHECIDO_2: string;
    export { DESCONHECIDO_2 as DESCONHECIDO };
}
export namespace PRIMARY_ACTION_PRESETS {
    namespace initialContact {
        namespace whatsapp {
            let id: string;
            let label: string;
        }
        namespace validateContact {
            let id_1: string;
            export { id_1 as id };
            let label_1: string;
            export { label_1 as label };
        }
        namespace fallback {
            let id_2: string;
            export { id_2 as id };
            let label_2: string;
            export { label_2 as label };
        }
    }
    namespace keepEngagement {
        export namespace whatsapp_1 {
            let id_3: string;
            export { id_3 as id };
            let label_3: string;
            export { label_3 as label };
        }
        export { whatsapp_1 as whatsapp };
        export namespace validateContact_1 {
            let id_4: string;
            export { id_4 as id };
            let label_4: string;
            export { label_4 as label };
        }
        export { validateContact_1 as validateContact };
        export namespace fallback_1 {
            let id_5: string;
            export { id_5 as id };
            let label_5: string;
            export { label_5 as label };
        }
        export { fallback_1 as fallback };
    }
    namespace qualify {
        namespace _default {
            let id_6: string;
            export { id_6 as id };
            let label_6: string;
            export { label_6 as label };
        }
        export { _default as default };
    }
    namespace proposal {
        namespace _default_1 {
            let id_7: string;
            export { id_7 as id };
            let label_7: string;
            export { label_7 as label };
        }
        export { _default_1 as default };
    }
    namespace documentation {
        namespace _default_2 {
            let id_8: string;
            export { id_8 as id };
            let label_8: string;
            export { label_8 as label };
        }
        export { _default_2 as default };
    }
    namespace followUp {
        export namespace whatsapp_2 {
            let id_9: string;
            export { id_9 as id };
            let label_9: string;
            export { label_9 as label };
        }
        export { whatsapp_2 as whatsapp };
        export namespace fallback_2 {
            let id_10: string;
            export { id_10 as id };
            let label_10: string;
            export { label_10 as label };
        }
        export { fallback_2 as fallback };
    }
    namespace closeDeal {
        namespace _default_3 {
            let id_11: string;
            export { id_11 as id };
            let label_11: string;
            export { label_11 as label };
        }
        export { _default_3 as default };
    }
}
export namespace PRIMARY_ACTION_MAP {
    import NOVO_3 = PRIMARY_ACTION_PRESETS.initialContact;
    export { NOVO_3 as NOVO };
    import CONECTADO_3 = PRIMARY_ACTION_PRESETS.keepEngagement;
    export { CONECTADO_3 as CONECTADO };
    import QUALIFICACAO_3 = PRIMARY_ACTION_PRESETS.qualify;
    export { QUALIFICACAO_3 as QUALIFICACAO };
    import PROPOSTA_3 = PRIMARY_ACTION_PRESETS.proposal;
    export { PROPOSTA_3 as PROPOSTA };
    import SIMULADO_3 = PRIMARY_ACTION_PRESETS.proposal;
    export { SIMULADO_3 as SIMULADO };
    import PROPOSTA_ENVIADA_3 = PRIMARY_ACTION_PRESETS.closeDeal;
    export { PROPOSTA_ENVIADA_3 as PROPOSTA_ENVIADA };
    import ACEITO_3 = PRIMARY_ACTION_PRESETS.closeDeal;
    export { ACEITO_3 as ACEITO };
    import DIGITANDO_3 = PRIMARY_ACTION_PRESETS.closeDeal;
    export { DIGITANDO_3 as DIGITANDO };
    import CONCLUIDO_3 = PRIMARY_ACTION_PRESETS.closeDeal;
    export { CONCLUIDO_3 as CONCLUIDO };
    import DOCUMENTACAO_3 = PRIMARY_ACTION_PRESETS.documentation;
    export { DOCUMENTACAO_3 as DOCUMENTACAO };
    import DOCUMENTOS_AVERBACAO_3 = PRIMARY_ACTION_PRESETS.documentation;
    export { DOCUMENTOS_AVERBACAO_3 as DOCUMENTOS_AVERBACAO };
    import AGUARDANDO_3 = PRIMARY_ACTION_PRESETS.followUp;
    export { AGUARDANDO_3 as AGUARDANDO };
    import AGUARDANDO_CLIENTE_3 = PRIMARY_ACTION_PRESETS.followUp;
    export { AGUARDANDO_CLIENTE_3 as AGUARDANDO_CLIENTE };
    import LIQUIDACAO_3 = PRIMARY_ACTION_PRESETS.closeDeal;
    export { LIQUIDACAO_3 as LIQUIDACAO };
    import APROVADO_LIQUIDACAO_3 = PRIMARY_ACTION_PRESETS.closeDeal;
    export { APROVADO_LIQUIDACAO_3 as APROVADO_LIQUIDACAO };
    import RECICLAR_3 = PRIMARY_ACTION_PRESETS.followUp;
    export { RECICLAR_3 as RECICLAR };
}
export namespace STAGE_SALES_HINTS {
    export namespace SIMULADO_4 {
        let hasSimulation: boolean;
    }
    export { SIMULADO_4 as SIMULADO };
    export namespace PROPOSTA_ENVIADA_4 {
        let hasSimulation_1: boolean;
        export { hasSimulation_1 as hasSimulation };
        export let hasProposal: boolean;
    }
    export { PROPOSTA_ENVIADA_4 as PROPOSTA_ENVIADA };
    export namespace ACEITO_4 {
        let hasSimulation_2: boolean;
        export { hasSimulation_2 as hasSimulation };
        let hasProposal_1: boolean;
        export { hasProposal_1 as hasProposal };
    }
    export { ACEITO_4 as ACEITO };
    export namespace DIGITANDO_4 {
        let hasSimulation_3: boolean;
        export { hasSimulation_3 as hasSimulation };
        let hasProposal_2: boolean;
        export { hasProposal_2 as hasProposal };
    }
    export { DIGITANDO_4 as DIGITANDO };
    export namespace CONCLUIDO_4 {
        let hasSimulation_4: boolean;
        export { hasSimulation_4 as hasSimulation };
        let hasProposal_3: boolean;
        export { hasProposal_3 as hasProposal };
        export let hasDeal: boolean;
    }
    export { CONCLUIDO_4 as CONCLUIDO };
}
export namespace SALES_STAGE_ORDER {
    let SIMULADO_5: number;
    export { SIMULADO_5 as SIMULADO };
    let PROPOSTA_ENVIADA_5: number;
    export { PROPOSTA_ENVIADA_5 as PROPOSTA_ENVIADA };
    let ACEITO_5: number;
    export { ACEITO_5 as ACEITO };
    let DIGITANDO_5: number;
    export { DIGITANDO_5 as DIGITANDO };
    let CONCLUIDO_5: number;
    export { CONCLUIDO_5 as CONCLUIDO };
}
export function normalizeStage(value: any): any;
export function formatStageLabel(stageKey: any): any;
export function getTicketStage(ticket: any): any;
export function getStageInfo(stageKey: any): {
    label: any;
    tone: any;
    icon: any;
} | null;
export function resolvePrimaryAction({ stageKey, hasWhatsApp, needsContactValidation }: {
    stageKey: any;
    hasWhatsApp: any;
    needsContactValidation?: boolean | undefined;
}): any;
export function getStageSalesHints(stageKey: any): any;
export function applyStageSalesHints(stageKey: any, state?: {}): {
    hasSimulation: boolean;
    hasProposal: boolean;
    hasDeal: boolean;
};
export function getSalesStageOrder(stageKey: any): number | null;
import { Sparkles } from 'lucide-react';
import { Link2 } from 'lucide-react';
import { ClipboardList } from 'lucide-react';
import { FileText } from 'lucide-react';
import { FileCheck2 } from 'lucide-react';
import { FileSignature } from 'lucide-react';
import { BadgeCheck } from 'lucide-react';
import { Hourglass } from 'lucide-react';
import { Clock3 } from 'lucide-react';
import { CircleDollarSign } from 'lucide-react';
import { RefreshCcw } from 'lucide-react';
import { HelpCircle } from 'lucide-react';
