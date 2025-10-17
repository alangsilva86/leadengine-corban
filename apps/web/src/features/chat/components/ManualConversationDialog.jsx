import { useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button.jsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.jsx';
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

const sanitizePhone = (value) => String(value ?? '').replace(/\D/g, '');

const ManualConversationDialog = ({
  open,
  onOpenChange,
  onSubmit,
  onSuccess,
  isSubmitting = false,
}) => {
  const phoneInputRef = useRef(null);
  const defaultValues = useMemo(() => ({ phone: '', message: '' }), []);
  const form = useForm({
    defaultValues,
  });

  const isProcessing = form.formState.isSubmitting || isSubmitting;

  useEffect(() => {
    if (open) {
      if (typeof window !== 'undefined') {
        window.requestAnimationFrame(() => {
          phoneInputRef.current?.focus?.();
        });
      } else {
        phoneInputRef.current?.focus?.();
      }
    } else {
      form.reset(defaultValues);
    }
  }, [open, form, defaultValues]);

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
      const result = await onSubmit?.(payload);
      await onSuccess?.(result, payload);
    } catch (error) {
      const fallbackMessage =
        error instanceof Error
          ? error.message
          : 'Não foi possível iniciar a conversa. Tente novamente em instantes.';
      form.setError('root', { type: 'manual', message: fallbackMessage });
    }
  });

  const rootError = form.formState.errors.root?.message;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-bold)] text-[color:var(--color-inbox-foreground)] shadow-[var(--shadow-lg)]">
        <DialogHeader className="space-y-1 text-left">
          <DialogTitle className="text-lg font-semibold text-[color:var(--color-inbox-foreground)]">
            Iniciar conversa manual
          </DialogTitle>
          <DialogDescription className="text-xs uppercase tracking-[0.24em] text-[color:var(--color-inbox-foreground-muted)]">
            Cadastre o contato e envie a mensagem inicial diretamente pelo LeadEngine.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-inbox-foreground-muted)]">
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
                  <FormLabel className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-inbox-foreground-muted)]">
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

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-bold)] text-[color:var(--color-inbox-foreground)] hover:bg-[color:color-mix(in_srgb,var(--surface-overlay-inbox-bold)_92%,transparent)]"
                disabled={isProcessing}
                onClick={() => onOpenChange?.(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="rounded-xl bg-success px-4 text-xs font-semibold uppercase tracking-[0.28em] text-success-foreground shadow-[var(--shadow-md)] transition hover:bg-success/90 disabled:opacity-70"
                disabled={isProcessing}
              >
                Iniciar conversa
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default ManualConversationDialog;
