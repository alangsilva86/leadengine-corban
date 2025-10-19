import { useMutation } from '@tanstack/react-query';

export const MANUAL_CONVERSATION_DEPRECATION_MESSAGE =
  'O fluxo manual de novas conversas foi aposentado. Utilize o canal oficial de abertura de tickets.';

export const useManualConversationLauncher = () => {
  const mutation = useMutation({
    mutationKey: ['lead-inbox', 'manual-conversation'],
    mutationFn: async () => {
      throw new Error(MANUAL_CONVERSATION_DEPRECATION_MESSAGE);
    },
    retry: false,
  });

  return {
    launch: (payload) => mutation.mutateAsync(payload),
    isPending: mutation.isPending,
    error: mutation.error,
    data: mutation.data,
    reset: mutation.reset,
    isAvailable: false,
    unavailableReason: MANUAL_CONVERSATION_DEPRECATION_MESSAGE,
  };
};

export default useManualConversationLauncher;
