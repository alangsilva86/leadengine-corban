import { forwardRef, useImperativeHandle, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { InboxPrimaryButton } from './shared/InboxPrimaryButton.jsx';
import { InboxSurface } from './shared/InboxSurface.jsx';

const sanitizePhone = (value) => String(value ?? '').replace(/\D/g, '');

const ManualConversationCard = forwardRef(({ onSubmit, onSuccess, isSubmitting = false }, ref) => {
  const cardRef = useRef(null);
  const phoneInputRef = useRef(null);

  const form = useForm({
    defaultValues: { phone: '', message: '' },
  });

  const isProcessing = form.formState.isSubmitting || isSubmitting;

  const handleSubmit = form.handleSubmit(async (values) => {
    const digits = sanitizePhone(values.phone);
    const message = typeof values.message === 'string' ? values.message.trim() : '';

    let hasError = false;

    if (!digits) {
      const errorMessage = 'Informe um telefone válido.';
      form.setError('phone', { type: 'manual', message: errorMessage });
      toast.error(errorMessage);
      hasError = true;
    }

    if (!message) {
      const errorMessage = 'Digite a mensagem inicial.';
      form.setError('message', { type: 'manual', message: errorMessage });
      if (!hasError) {
        toast.error(errorMessage);
      }
      hasError = true;
    }

    if (hasError) {
      return;
    }

    const payload = { phone: digits, message };

    try {
      const result = onSubmit ? await onSubmit(payload) : undefined;
      await onSuccess?.(result, payload);
      form.reset({ phone: '', message: '' });
    } catch (error) {
      const fallbackMessage =
        error instanceof Error
          ? error.message
          : 'Não foi possível iniciar a conversa. Tente novamente em instantes.';
      form.setError('root', { type: 'manual', message: fallbackMessage });
    }
  });

  const rootError = form.formState.errors.root?.message;

  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        phoneInputRef.current?.focus?.();
      },
      scrollIntoView: (options) => {
        cardRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start', ...options });
      },
    }),
    []
  );

  return (
    <InboxSurface as={Card} ref={cardRef} id="manual-conversation-card">
      <CardHeader className="space-y-2 pb-2">
        <CardTitle className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--color-inbox-foreground)]">
          Iniciar conversa manual
        </CardTitle>
        <CardDescription className="text-xs text-[color:var(--color-inbox-foreground-muted)]">
          Cadastre o contato manualmente e envie a mensagem inicial sem sair do LeadEngine.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium uppercase tracking-[0.2em] text-[color:var(--color-inbox-foreground-muted)]">
                    Telefone
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="(00) 00000-0000"
                      autoComplete="tel"
                      inputMode="tel"
                      disabled={isProcessing}
                      {...field}
                      ref={(node) => {
                        field.ref(node);
                        phoneInputRef.current = node;
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium uppercase tracking-[0.2em] text-[color:var(--color-inbox-foreground-muted)]">
                    Mensagem inicial
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Olá! Notei seu interesse e queria continuar a conversa por aqui."
                      rows={3}
                      disabled={isProcessing}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {rootError ? <p className="text-sm font-medium text-destructive">{rootError}</p> : null}

            <InboxPrimaryButton
              type="submit"
              uppercase
              className="w-full rounded-2xl text-sm font-semibold tracking-[0.3em] shadow-[0_12px_34px_color-mix(in_srgb,var(--accent-inbox-primary)_40%,transparent)]"
              disabled={isProcessing}
            >
              Iniciar conversa
            </InboxPrimaryButton>
          </form>
        </Form>
      </CardContent>
    </InboxSurface>
  );
});

ManualConversationCard.displayName = 'ManualConversationCard';

export default ManualConversationCard;
