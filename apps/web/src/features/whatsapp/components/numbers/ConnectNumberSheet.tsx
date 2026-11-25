import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, CheckCircle2, Copy, Loader2, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import useMediaQuery from '@/hooks/use-media-query.js';
import { cn } from '@/lib/utils.js';

import QrPreview from '../QrPreview';
import SafetyTipsPopover from '../SafetyTips';
import useNumberPairing from '../../connect/hooks/useNumberPairing';
import { resolveWhatsAppError } from '../../lib/errors';
import type { UseWhatsAppNumbersResult, WhatsAppNumber } from '../../hooks/useWhatsAppNumbers';

type Step = 'name' | 'pair' | 'success';
type Method = 'qr' | 'code';

const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'numero';

const randomSuffix = () => Math.random().toString(36).slice(2, 6);

const formatPairingCode = (code: string) => (code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code);

const QR_STEPS = [
  'Abra o WhatsApp no celular.',
  'Toque em ⋮ (Android) ou em Configurações (iPhone) › Aparelhos conectados.',
  'Toque em Conectar um aparelho.',
  'Aponte a câmera do celular para este código.',
];

const CODE_STEPS = [
  'No celular, abra o WhatsApp › Aparelhos conectados › Conectar um aparelho.',
  'Toque em Conectar com número de telefone.',
  'Digite o código mostrado aqui.',
];

const BEFORE_YOU_START = [
  'Celular com o WhatsApp deste número em mãos',
  'Número dedicado ao comercial (evite o pessoal)',
  'Leva cerca de 2 minutos',
];

const StepList = ({ steps }: { steps: string[] }) => (
  <ol className="space-y-2.5">
    {steps.map((text, index) => (
      <li key={text} className="flex gap-3 text-sm text-foreground">
        <span
          aria-hidden="true"
          className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary-soft-foreground"
        >
          {index + 1}
        </span>
        <span className="pt-0.5">{text}</span>
      </li>
    ))}
  </ol>
);

interface ConnectNumberSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Número existente para (re)conectar. Sem alvo, o fluxo começa criando um número novo. */
  target: WhatsAppNumber | null;
  numbers: UseWhatsAppNumbersResult;
  suggestedName: string;
}

const ConnectNumberSheet = ({ open, onOpenChange, target, numbers, suggestedName }: ConnectNumberSheetProps) => {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const nameFieldId = useId();
  const phoneFieldId = useId();

  const [step, setStep] = useState<Step>('name');
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [name, setName] = useState(suggestedName);
  const [method, setMethod] = useState<Method>('qr');
  const [phoneInput, setPhoneInput] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Identificador estável durante a sessão do assistente: repetir "Continuar" não cria números duplicados.
  const pendingIdRef = useRef<string | null>(null);

  // Prepara o assistente a cada abertura.
  useEffect(() => {
    if (!open) return;
    setCreateError(null);
    setCreating(false);
    setCopied(false);
    setPhoneInput('');
    setMethod(isMobile ? 'code' : 'qr');
    if (target) {
      setInstanceId(target.id);
      setName(target.name);
      setStep(target.status.isConnected ? 'success' : 'pair');
    } else {
      setInstanceId(null);
      setName(suggestedName);
      setStep('name');
      pendingIdRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, target?.id]);

  const liveNumber = useMemo(
    () => (instanceId ? numbers.numbers.find((item) => item.id === instanceId) ?? null : null),
    [instanceId, numbers.numbers],
  );
  const isConnected = Boolean(liveNumber?.status.isConnected);
  const isConnecting = liveNumber?.status.key === 'connecting';

  const pairing = useNumberPairing({
    deps: {
      generateQr: numbers.wa.generateQr,
      setQrData: numbers.wa.setQrData,
      connectInstance: numbers.wa.connectInstance,
      checkInstanceStatus: numbers.wa.checkInstanceStatus,
    },
    instanceId,
    active: open && step === 'pair',
    method,
    connected: isConnected,
  });

  // O celular confirmou: mostra o sucesso.
  useEffect(() => {
    if (open && step === 'pair' && isConnected) {
      setStep('success');
    }
  }, [isConnected, open, step]);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (creating) return;
    const finalName = name.trim() || suggestedName;
    if (!pendingIdRef.current) {
      pendingIdRef.current = `${slugify(finalName)}-${randomSuffix()}`;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const created = await numbers.createNumber({ name: finalName, id: pendingIdRef.current });
      setInstanceId(created?.id ?? pendingIdRef.current);
      setName(finalName);
      setStep('pair');
    } catch (error) {
      setCreateError(resolveWhatsAppError(error, 'Não foi possível criar o número').message);
    } finally {
      setCreating(false);
    }
  };

  const handleCopyCode = async () => {
    if (!pairing.pairingCode) return;
    try {
      await navigator.clipboard.writeText(pairing.pairingCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Não foi possível copiar. Selecione o código e copie manualmente.');
    }
  };

  const statusMessage = (() => {
    if (step !== 'pair') return null;
    if (isConnecting) return 'Celular encontrado. Conectando…';
    if (method === 'qr') {
      if (pairing.qrPhase === 'ready') return 'Aguardando a leitura do QR Code…';
      if (pairing.qrPhase === 'loading') return 'Gerando QR Code…';
      if (pairing.qrPhase === 'paused') return 'QR pausado. Gere um novo quando estiver com o celular em mãos.';
      return null;
    }
    if (pairing.codePhase === 'ready') return 'Aguardando você digitar o código no celular…';
    if (pairing.codePhase === 'requesting') return 'Gerando código…';
    return null;
  })();

  const displayName = liveNumber?.name ?? name;
  const connectedPhone = liveNumber?.phone ?? null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-[480px]">
        {step === 'name' ? (
          <form onSubmit={handleCreate} className="flex min-h-full flex-col">
            <SheetHeader className="gap-1 border-b border-border px-6 py-5">
              <SheetTitle className="text-lg">Conectar número</SheetTitle>
              <SheetDescription>Dê um nome para o time reconhecer este número na Inbox e nas regras de roteamento.</SheetDescription>
            </SheetHeader>
            <div className="flex-1 space-y-6 px-6 py-6">
              <div className="space-y-2">
                <Label htmlFor={nameFieldId}>
                  Nome do número <span className="font-normal text-muted-foreground">(opcional)</span>
                </Label>
                <Input
                  id={nameFieldId}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={suggestedName}
                  maxLength={60}
                  autoComplete="off"
                  disabled={creating}
                />
                <p className="text-xs text-muted-foreground">Ex.: o nome da equipe ou da pessoa que atende.</p>
              </div>

              <div className="space-y-3 rounded-lg border border-border bg-surface-sunken p-4">
                <p className="text-sm font-medium text-foreground">Antes de começar</p>
                <ul className="space-y-2">
                  {BEFORE_YOU_START.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {createError ? (
                <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger-soft-foreground">
                  {createError}
                </p>
              ) : null}
            </div>
            <SheetFooter className="flex-row justify-end gap-2 border-t border-border px-6 py-4">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={creating}>
                Cancelar
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
                {creating ? 'Preparando…' : 'Continuar'}
                {creating ? null : <ArrowRight aria-hidden="true" />}
              </Button>
            </SheetFooter>
          </form>
        ) : null}

        {step === 'pair' ? (
          <div className="flex min-h-full flex-col">
            <SheetHeader className="gap-1 border-b border-border px-6 py-5">
              <SheetTitle className="text-lg">Conectar {displayName}</SheetTitle>
              <SheetDescription>Use o celular que tem o WhatsApp deste número.</SheetDescription>
            </SheetHeader>
            <div className="flex-1 px-6 py-5">
              <Tabs value={method} onValueChange={(value: string) => setMethod(value as Method)} className="gap-5">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="qr">QR Code</TabsTrigger>
                  <TabsTrigger value="code">Código</TabsTrigger>
                </TabsList>

                <TabsContent value="qr" className="space-y-6">
                  <QrPreview
                    phase={pairing.qrPhase}
                    src={pairing.qrSrc}
                    secondsLeft={pairing.secondsLeft}
                    errorMessage={pairing.qrError?.message ?? null}
                    onRegenerate={pairing.restartQr}
                    size={isMobile ? 232 : 264}
                  />
                  <StepList steps={QR_STEPS} />
                  {isMobile ? (
                    <p className="text-xs text-muted-foreground">
                      Está no celular do próprio número? Use a aba <strong>Código</strong>: não dá para ler o QR com a mesma tela.
                    </p>
                  ) : null}
                </TabsContent>

                <TabsContent value="code" className="space-y-6">
                  <form
                    className="space-y-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void pairing.requestPairingCode(phoneInput);
                    }}
                  >
                    <div className="space-y-2">
                      <Label htmlFor={phoneFieldId}>Número do WhatsApp</Label>
                      <Input
                        id={phoneFieldId}
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel-national"
                        placeholder="(11) 91234-5678"
                        value={phoneInput}
                        onChange={(event) => setPhoneInput(event.target.value)}
                        aria-invalid={pairing.codePhase === 'error' || undefined}
                        aria-describedby={`${phoneFieldId}-hint`}
                        disabled={pairing.codePhase === 'requesting'}
                      />
                      <p id={`${phoneFieldId}-hint`} className="text-xs text-muted-foreground">
                        O número que você vai conectar, com DDD.
                      </p>
                    </div>
                    <Button
                      type="submit"
                      className="w-full sm:w-auto"
                      variant={pairing.codePhase === 'ready' ? 'outline' : 'default'}
                      disabled={pairing.codePhase === 'requesting' || !phoneInput.trim()}
                    >
                      {pairing.codePhase === 'requesting' ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
                      {pairing.codePhase === 'ready' ? 'Gerar outro código' : 'Gerar código'}
                    </Button>
                    {pairing.codePhase === 'error' && pairing.codeError ? (
                      <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger-soft-foreground">
                        {pairing.codeError}
                      </p>
                    ) : null}
                  </form>

                  {pairing.pairingCode ? (
                    <div className="space-y-3 rounded-lg border border-border bg-surface-sunken p-4 text-center">
                      <p className="text-xs font-medium text-muted-foreground">Seu código</p>
                      <p className="font-mono text-3xl font-semibold tracking-[0.2em] text-foreground" aria-label={`Código ${pairing.pairingCode.split('').join(' ')}`}>
                        {formatPairingCode(pairing.pairingCode)}
                      </p>
                      <Button type="button" variant="outline" size="sm" onClick={handleCopyCode}>
                        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                        {copied ? 'Copiado' : 'Copiar código'}
                      </Button>
                    </div>
                  ) : null}

                  <StepList steps={CODE_STEPS} />
                </TabsContent>
              </Tabs>
            </div>
            <div
              role="status"
              aria-live="polite"
              className={cn(
                'flex min-h-12 items-center gap-2 border-t border-border px-6 py-3 text-sm text-muted-foreground',
                !statusMessage && 'sr-only',
              )}
            >
              {statusMessage ? (
                <>
                  <span aria-hidden="true" className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-info opacity-60" />
                    <span className="relative inline-flex size-2 rounded-full bg-info" />
                  </span>
                  {statusMessage}
                </>
              ) : null}
            </div>
          </div>
        ) : null}

        {step === 'success' ? (
          <div className="flex min-h-full flex-col">
            <SheetHeader className="sr-only">
              <SheetTitle>Número conectado</SheetTitle>
              <SheetDescription>O número está pronto para receber leads.</SheetDescription>
            </SheetHeader>
            <div role="status" aria-live="polite" className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-10 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-success-soft text-success-soft-foreground">
                <CheckCircle2 aria-hidden="true" className="size-7" />
              </div>
              <div className="space-y-1.5">
                <p className="text-lg font-semibold text-foreground">
                  {connectedPhone ? `${connectedPhone} conectado` : `${displayName} conectado`}
                </p>
                <p className="mx-auto max-w-xs text-sm text-muted-foreground">
                  Mensagens que chegarem neste número já aparecem na Inbox do seu time.
                </p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <Button asChild>
                  <Link to="/inbox">
                    <MessageSquare aria-hidden="true" />
                    Abrir Inbox
                  </Link>
                </Button>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Concluir
                </Button>
              </div>
              <SafetyTipsPopover />
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
};

export default ConnectNumberSheet;
