import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useManualConversationLauncher } from './useManualConversationLauncher.js';
const MANUAL_CONVERSATION_TOAST_ID = 'manual-conversation';
export const useManualConversationFlow = ({ controller }) => {
    const [isDialogOpen, setDialogOpen] = useState(false);
    const launcher = useManualConversationLauncher();
    useEffect(() => {
        if (!launcher.isAvailable) {
            setDialogOpen(false);
        }
    }, [launcher.isAvailable]);
    const openDialog = useCallback(() => setDialogOpen(true), []);
    const closeDialog = useCallback(() => setDialogOpen(false), []);
    const unavailableFallbackMessage = useMemo(() => launcher.unavailableReason ??
        'Fluxo manual indisponível no momento. Utilize os canais oficiais de abertura ou tente novamente em instantes.', [launcher.unavailableReason]);
    const handleSubmit = useCallback(async (payload) => {
        if (!launcher.isAvailable) {
            toast.error(unavailableFallbackMessage, {
                id: MANUAL_CONVERSATION_TOAST_ID,
                position: 'bottom-right',
            });
            throw new Error(unavailableFallbackMessage);
        }
        toast.loading('Iniciando conversa…', {
            id: MANUAL_CONVERSATION_TOAST_ID,
            position: 'bottom-right',
        });
        try {
            const result = await launcher.launch(payload);
            return result;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Não foi possível iniciar a conversa.';
            const description = launcher.unavailableReason && launcher.unavailableReason !== message ? launcher.unavailableReason : undefined;
            toast.error(message, {
                id: MANUAL_CONVERSATION_TOAST_ID,
                description,
                position: 'bottom-right',
            });
            throw error;
        }
    }, [launcher, unavailableFallbackMessage]);
    const handleSuccess = useCallback(async (result) => {
        toast.success('Conversa iniciada', {
            id: MANUAL_CONVERSATION_TOAST_ID,
            duration: 2500,
            position: 'bottom-right',
        });
        closeDialog();
        const ticketId = result?.ticketId ??
            result?.ticket?.id ??
            result?.message?.ticketId ??
            null;
        try {
            await controller.ticketsQuery?.refetch?.({ cancelRefetch: false });
        }
        catch (error) {
            console.error('Falha ao recarregar tickets após iniciar conversa manual', error);
        }
        if (ticketId && typeof controller.selectTicket === 'function') {
            controller.selectTicket(ticketId);
        }
        return result;
    }, [closeDialog, controller.selectTicket, controller.ticketsQuery]);
    return {
        isDialogOpen,
        setDialogOpen,
        openDialog,
        closeDialog,
        onSubmit: handleSubmit,
        onSuccess: handleSuccess,
        isPending: launcher.isPending,
        error: launcher.error,
        isAvailable: launcher.isAvailable,
        unavailableReason: launcher.unavailableReason,
    };
};
export default useManualConversationFlow;
