// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Switch } from '@/components/ui/switch.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';
import { AlertCircle, Upload, RefreshCw, Wand2, Save } from 'lucide-react';

type AiAssistantMode = 'IA_AUTO' | 'COPILOTO' | 'HUMANO';

interface AiConfig {
  model: string;
  temperature: number;
  maxOutputTokens: number | null;
  systemPromptReply: string | null;
  systemPromptSuggest: string | null;
  structuredOutputSchema: unknown;
  tools: unknown[] | null;
  vectorStoreEnabled: boolean;
  vectorStoreIds: string[];
  streamingEnabled: boolean;
  defaultMode: AiAssistantMode;
  confidenceThreshold: number | null;
  fallbackPolicy: string | null;
  aiEnabled: boolean;
}

const DEFAULT_MODE: AiAssistantMode = 'COPILOTO';

const DEFAULT_SCHEMA = {
  next_step: 'Descreva o próximo passo.',
  tips: [
    {
      title: 'Sugestão',
      message: 'Apresente orientações ao agente.',
    },
  ],
  objections: [
    {
      label: 'Objeção',
      reply: 'Resposta recomendada.',
    },
  ],
  confidence: 0.5,
};

const stringifyJson = (value: unknown) => {
  try {
    return JSON.stringify(value ?? DEFAULT_SCHEMA, null, 2);
  } catch {
    return JSON.stringify(DEFAULT_SCHEMA, null, 2);
  }
};

const MODE_OPTIONS: Array<{ label: string; value: AiAssistantMode; description: string }> = [
  {
    value: 'IA_AUTO',
    label: 'IA Auto',
    description: 'A IA responde primeiro e só pede ajuda quando necessário.',
  },
  {
    value: 'COPILOTO',
    label: 'Copiloto',
    description: 'A IA sugere respostas e o humano envia quando estiver pronto.',
  },
  {
    value: 'HUMANO',
    label: 'Humano',
    description: 'A conversa começa sempre com o atendente humano.',
  },
];

const AiSettingsTab = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [schemaDraft, setSchemaDraft] = useState(() => stringifyJson(DEFAULT_SCHEMA));

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/ai/config');
        if (!response.ok) {
          throw new Error(`Falha ao carregar configurações (${response.status})`);
        }
        const payload = await response.json();
        const data = payload?.data as AiConfig;
        if (mounted) {
          setConfig({
            ...data,
            defaultMode: data.defaultMode ?? DEFAULT_MODE,
          });
          setSchemaDraft(stringifyJson(data.structuredOutputSchema));
        }
      } catch (err) {
        if (mounted) {
          setError((err as Error).message);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const handleSchemaReset = () => {
    setSchemaDraft(stringifyJson(DEFAULT_SCHEMA));
  };

  const parsedSchema = useMemo(() => {
    try {
      return JSON.parse(schemaDraft);
    } catch {
      return null;
    }
  }, [schemaDraft]);

  const isSchemaValid = !!parsedSchema;

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/ai/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.model,
          temperature: config.temperature,
          maxOutputTokens: config.maxOutputTokens,
          systemPromptReply: config.systemPromptReply,
          systemPromptSuggest: config.systemPromptSuggest,
          structuredOutputSchema: parsedSchema ?? config.structuredOutputSchema,
          tools: config.tools ?? [],
          vectorStoreEnabled: config.vectorStoreEnabled,
          vectorStoreIds: config.vectorStoreIds,
          streamingEnabled: config.streamingEnabled,
          defaultMode: config.defaultMode,
          confidenceThreshold: config.confidenceThreshold,
          fallbackPolicy: config.fallbackPolicy,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message ?? 'Não foi possível salvar as configurações');
      }
      const payload = await response.json();
      const data = payload.data as AiConfig;
      setConfig({
        ...data,
        defaultMode: data.defaultMode ?? DEFAULT_MODE,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const disabled = !config || loading;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Configurações da IA</CardTitle>
            <CardDescription>
              Ajuste o comportamento do copiloto e prepare o terreno para o modo automático.
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            {config?.aiEnabled ? (
              <Badge variant="default">OpenAI conectado</Badge>
            ) : (
              <Badge variant="destructive">Chave ausente</Badge>
            )}
            <Button onClick={handleSave} disabled={disabled || saving || !isSchemaValid}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Salvando...' : 'Salvar ajustes'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <Label htmlFor="ai-model">Modelo</Label>
            <Input
              id="ai-model"
              value={config?.model ?? ''}
              disabled={disabled}
              onChange={(event) =>
                setConfig((prev) => (prev ? { ...prev, model: event.target.value } : prev))
              }
            />
            <p className="text-xs text-muted-foreground">
              Recomendo iniciar com <code>gpt-4o-mini</code> ou semelhante.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ai-temperature">Temperatura</Label>
              <Input
                type="number"
                step="0.1"
                id="ai-temperature"
                disabled={disabled}
                value={config?.temperature ?? 0.3}
                onChange={(event) =>
                  setConfig((prev) =>
                    prev ? { ...prev, temperature: Number(event.target.value) } : prev
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-max-tokens">Máx. tokens</Label>
              <Input
                type="number"
                id="ai-max-tokens"
                disabled={disabled}
                value={config?.maxOutputTokens ?? ''}
                onChange={(event) =>
                  setConfig((prev) =>
                    prev ? { ...prev, maxOutputTokens: Number(event.target.value) || null } : prev
                  )
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Instruções</CardTitle>
            <CardDescription>Personalize os prompts do copiloto.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Prompt de resposta</Label>
              <Textarea
                rows={6}
                disabled={disabled}
                value={config?.systemPromptReply ?? ''}
                onChange={(event) =>
                  setConfig((prev) => (prev ? { ...prev, systemPromptReply: event.target.value } : prev))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Prompt de nota interna</Label>
              <Textarea
                rows={6}
                disabled={disabled}
                value={config?.systemPromptSuggest ?? ''}
                onChange={(event) =>
                  setConfig((prev) => (prev ? { ...prev, systemPromptSuggest: event.target.value } : prev))
                }
              />
            </div>
            <Button
              variant="outline"
              className="flex items-center gap-2"
              disabled={disabled}
              onClick={() =>
                setConfig((prev) =>
                  prev
                    ? {
                        ...prev,
                        systemPromptReply: null,
                        systemPromptSuggest: null,
                      }
                    : prev
                )
              }
            >
              <Wand2 className="h-4 w-4" /> Restaurar prompts padrão
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notas internas (JSON Schema)</CardTitle>
            <CardDescription>Use JSON Schema para garantir o formato 100% válido.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              rows={16}
              value={schemaDraft}
              disabled={disabled}
              onChange={(event) => setSchemaDraft(event.target.value)}
              className="font-mono text-xs"
            />
            <div className="flex items-center gap-3">
              <Switch checked={isSchemaValid} disabled readOnly />
              <span className="text-xs text-muted-foreground">
                {isSchemaValid ? 'Schema válido' : 'Schema com erros de formatação JSON'}
              </span>
              <Button variant="outline" size="sm" onClick={handleSchemaReset} disabled={disabled}>
                Restaurar schema padrão
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ferramentas (Tool Calling)</CardTitle>
            <CardDescription>Cadastre funções que a IA pode acionar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Em breve: edite o schema das funções e teste a integração diretamente aqui.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" disabled>
                <Upload className="h-4 w-4 mr-2" /> Importar funções
              </Button>
              <Button variant="outline" disabled>
                <RefreshCw className="h-4 w-4 mr-2" /> Testar função
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Base de conhecimento (RAG)</CardTitle>
            <CardDescription>Integre scripts, objeções e FAQs através de vector stores.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Switch
                checked={config?.vectorStoreEnabled ?? false}
                disabled={disabled}
                onCheckedChange={(checked) =>
                  setConfig((prev) => (prev ? { ...prev, vectorStoreEnabled: checked } : prev))
                }
              />
              <span className="text-sm">Ativar File Search / Vector Store</span>
            </div>
            <Label>Vector store IDs</Label>
            <Textarea
              rows={4}
              disabled={disabled}
              value={config?.vectorStoreIds.join('\n') ?? ''}
              onChange={(event) =>
                setConfig((prev) =>
                  prev ? { ...prev, vectorStoreIds: event.target.value.split('\n').map((id) => id.trim()).filter(Boolean) } : prev
                )
              }
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Use um ID por linha. Conecte seus arquivos antes de ativar o modo automático.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Streaming e UX</CardTitle>
          <CardDescription>Controle a experiência de digitação em tempo real.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Switch
              checked={config?.streamingEnabled ?? true}
              disabled={disabled}
              onCheckedChange={(checked) =>
                setConfig((prev) => (prev ? { ...prev, streamingEnabled: checked } : prev))
              }
            />
            <span>Resposta em tempo real</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Com streaming ativado o cliente vê a IA digitando. Desative apenas em cenários de auditoria ou
            latência extrema.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Regras operacionais</CardTitle>
          <CardDescription>Defina modo padrão, limites de confiança e fallback.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label id="ai-default-mode-label" htmlFor="ai-default-mode">
              Modo padrão por conversa
            </Label>
            <Select
              value={config?.defaultMode ?? DEFAULT_MODE}
              disabled={disabled}
              onValueChange={(value: AiAssistantMode) =>
                setConfig((prev) => (prev ? { ...prev, defaultMode: value } : prev))
              }
            >
              <SelectTrigger id="ai-default-mode" aria-labelledby="ai-default-mode-label">
                <SelectValue placeholder="Selecione o modo" />
              </SelectTrigger>
              <SelectContent>
                {MODE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {MODE_OPTIONS.find((option) => option.value === (config?.defaultMode ?? DEFAULT_MODE))
                ?.description ?? ''}
            </p>
          </div>
          <div className="space-y-2">
            <Label>Limiar de confiança</Label>
            <Input
              type="number"
              step="0.05"
              min="0"
              max="1"
              disabled={disabled}
              value={config?.confidenceThreshold ?? ''}
              onChange={(event) =>
                setConfig((prev) =>
                  prev ? { ...prev, confidenceThreshold: Number(event.target.value) || 0 } : prev
                )
              }
            />
            <p className="text-xs text-muted-foreground">
              A IA devolve para o humano quando a confiança ficar abaixo deste valor.
            </p>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Política de fallback</Label>
            <Input
              disabled={disabled}
              value={config?.fallbackPolicy ?? ''}
              onChange={(event) =>
                setConfig((prev) => (prev ? { ...prev, fallbackPolicy: event.target.value } : prev))
              }
              placeholder="Ex.: ESCALATE_TO_QUEUE:manual-review"
            />
            <p className="text-xs text-muted-foreground">
              Documente o que deve acontecer quando a IA decidir recuar: transferir, pausar ou sinalizar follow-up.
            </p>
          </div>
        </CardContent>
      </Card>

      {!config?.aiEnabled && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <CardTitle className="text-destructive">Chave da OpenAI não configurada</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-destructive/90">
            Defina <code>OPENAI_API_KEY</code> nas variáveis de ambiente do backend para ativar o copiloto.
          </CardContent>
        </Card>
      )}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading && <p className="text-sm text-muted-foreground">Carregando configurações...</p>}
    </div>
  );
};

export default AiSettingsTab;
