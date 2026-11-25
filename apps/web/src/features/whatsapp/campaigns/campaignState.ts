/** Estado da tela de regras (lista, ação em andamento e diálogos). */

export type Nullable<T> = T | null;

export interface CampaignActionState {
  id: string | null;
  type: string | null;
}

export interface CampaignState {
  campaign: Nullable<any>;
  campaigns: any[];
  campaignsLoading: boolean;
  /** Já houve ao menos uma resposta da lista (para distinguir "carregando" de "vazio"). */
  campaignsLoaded: boolean;
  campaignError: string | null;
  campaignAction: CampaignActionState | null;
  isCreateCampaignOpen: boolean;
  pendingReassign: Nullable<any>;
  reassignIntent: 'reassign' | 'disconnect';
  persistentWarning: string | null;
}

export type CampaignStateAction =
  | { type: 'set-campaign'; value: Nullable<any> }
  | { type: 'set-campaigns'; value: any[] }
  | { type: 'set-campaigns-loading'; value: boolean }
  | { type: 'set-campaign-error'; value: string | null }
  | { type: 'set-campaign-action'; value: CampaignActionState | null }
  | { type: 'set-create-campaign-open'; value: boolean }
  | { type: 'set-pending-reassign'; value: Nullable<any> }
  | { type: 'set-reassign-intent'; value: 'reassign' | 'disconnect' }
  | { type: 'set-persistent-warning'; value: string | null };

export const initialCampaignState: CampaignState = {
  campaign: null,
  campaigns: [],
  campaignsLoading: false,
  campaignsLoaded: false,
  campaignError: null,
  campaignAction: null,
  isCreateCampaignOpen: false,
  pendingReassign: null,
  reassignIntent: 'reassign',
  persistentWarning: null,
};

export const campaignReducer = (state: CampaignState, action: CampaignStateAction): CampaignState => {
  switch (action.type) {
    case 'set-campaign':
      return { ...state, campaign: action.value };
    case 'set-campaigns':
      return { ...state, campaigns: action.value, campaignsLoaded: true };
    case 'set-campaigns-loading':
      return state.campaignsLoading === action.value ? state : { ...state, campaignsLoading: action.value };
    case 'set-campaign-error':
      return { ...state, campaignError: action.value };
    case 'set-campaign-action':
      return { ...state, campaignAction: action.value };
    case 'set-create-campaign-open':
      return { ...state, isCreateCampaignOpen: action.value };
    case 'set-pending-reassign':
      return { ...state, pendingReassign: action.value };
    case 'set-reassign-intent':
      return { ...state, reassignIntent: action.value };
    case 'set-persistent-warning':
      return { ...state, persistentWarning: action.value };
    default:
      return state;
  }
};
