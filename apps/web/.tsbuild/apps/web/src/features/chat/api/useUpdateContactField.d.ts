type Contact = {
    id?: string | number;
};
type ContactPayload = Record<string, unknown>;
type ContactHookParams = {
    contactId?: string | number;
};
type ContactMutationVariables = {
    targetContactId?: string | number;
    data: ContactPayload;
};
export declare const useUpdateContactField: (params?: Partial<Record<"contactId", string | number>>) => import("@tanstack/react-query").UseMutationResult<Contact | null, unknown, {
    data: ContactPayload;
} & Partial<Record<"targetContactId", string | number>>>;
export type UpdateContactFieldMutation = ReturnType<typeof useUpdateContactField>;
export type UpdateContactFieldVariables = ContactMutationVariables;
export type UpdateContactFieldParams = ContactHookParams;
export default useUpdateContactField;
