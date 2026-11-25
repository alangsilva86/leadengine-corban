import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';
import useWhatsAppInstances from '@/features/whatsapp/hooks/useWhatsAppInstances.jsx';
import { validateManualPayload } from '../hooks/useManualConversationLauncher.js';

const ManualConversationDialog = ({
  open,
  onOpenChange,
  onSubmit,
  onSuccess,
  isSubmitting = false,
  error,
  defaultPhone = '',
}) => {
  const phoneInputRef = useRef(null);
  const [validationError, setValidationError] = useState(null);
  const { instances = [], loadInstances } = useWhatsAppInstances();
  const availableInstances = useMemo(
    () =>
      Array.isArray(instances)
        ? instances.filter((instance) => {
            if (!instance || typeof instance.id !== 'string' || instance.id.trim().length === 0) {
              return false;
            }
            if (instance.connected === true) {
              return true;
            }
            if (typeof instance.status === 'string') {
              return instance.status.toLowerCase() === 'connected';
            }
            return false;
          })
        : [],
    [instances]
  );
  const defaultValues = useMemo(
    () => ({
      phone: defaultPhone ?? '',
      message: '',
      instanceId: '',
    }),
    [defaultPhone]
  );
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
      setValidationError(null);
    }
  }, [open, form, defaultValues]);

  useEffect(() => {
    if (open) {
      loadInstances({ forceRefresh: true });
    }
  }, [loadInstances, open]);

  const handleSubmit = form.handleSubmit(async (values) => {
    form.clearErrors();
    setValidationError(null);
    const validation = validateManualPayload(values);

    if (!validation.payload && validation.errors) {
      const messages = Object.values(validation.errors).filter(Boolean);
      Object.entries(validation.errors).forEach(([field, message]) => {
        form.setError(field, { type: 'manual', message });
      });
      if (messages.length > 0) {
        form.setError('root', { type: 'manual', message: messages[0] });
        setValidationError(messages[0]);
      }
      return;
    }

    const { phone, message, instanceId } = validation.payload;
    const payload = { phone, message, instanceId };

    try {
      const result = await onSubmit?.(payload);
      await onSuccess?.(result, payload);
    } catch (submissionError) {
      const fallbackMessage =
        submissionError instanceof Error
          ? submissionError.message
          : 'Não foi possível iniciar a conversa. Tente novamente em instantes.';
      form.setError('root', { type: 'manual', message: fallbackMessage });
      setValidationError(fallbackMessage);
    }
  });

  const mutationErrorMessage =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : error?.message ?? null;

  const rootError = validationError ?? form.formState.errors.root?.message ?? mutationErrorMessage;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border border-border bg-surface text-foreground shadow-[var(--shadow-lg)]">
        <DialogHeader className="space-y-1 text-left">
          <DialogTitle className="text-lg font-semibold text-foreground">
            Iniciar conversa manual
          </DialogTitle>
          <DialogDescription className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
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
                  <FormLabel className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
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
                  <FormLabel className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
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

            <FormField
              control={form.control}
              name="instanceId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Número de WhatsApp
                  </FormLabel>
                  <Select
                    disabled={isProcessing || availableInstances.length === 0}
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="h-9 w-full rounded-lg border-border bg-surface text-sm text-foreground">
                        <SelectValue placeholder="Selecione um número conectado" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="border-border bg-surface-sunken text-foreground">
                      {availableInstances.map((instance) => {
                        const identifier = instance.id.trim();
                        const label =
                          typeof instance.name === 'string' && instance.name.trim().length > 0
                            ? instance.name.trim()
                            : typeof instance.displayId === 'string' && instance.displayId.trim().length > 0
                              ? instance.displayId.trim()
                              : identifier;
                        return (
                          <SelectItem key={identifier} value={identifier}>
                            {label}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {rootError ? <p className="text-sm font-medium text-destructive">{rootError}</p> : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl border-border bg-surface text-foreground hover:bg-surface-hover"
                disabled={isProcessing}
                onClick={() => onOpenChange?.(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="rounded-xl bg-success px-4 text-xs font-semibold uppercase tracking-[0.28em] text-success-foreground shadow-[var(--shadow-md)] transition hover:bg-success/90 disabled:opacity-70"
                disabled={isProcessing || availableInstances.length === 0}
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
