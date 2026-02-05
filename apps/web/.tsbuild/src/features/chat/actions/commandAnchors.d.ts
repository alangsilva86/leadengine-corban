export namespace CONVERSATION_ACTION_IDS {
    let assign: string;
    let scheduleFollowUp: string;
    let registerResult: string;
    let phone: string;
}
export const COMMAND_ACTION_ANCHOR_ALIASES: {
    'assign-owner': string[];
    'quick-followup': string[];
    'register-result': string[];
    'phone-call': string[];
};
export function getPrimaryCommandAnchorId(actionId: any): string;
export function getAllAnchorIdsForCommand(actionId: any): any[];
export default COMMAND_ACTION_ANCHOR_ALIASES;
