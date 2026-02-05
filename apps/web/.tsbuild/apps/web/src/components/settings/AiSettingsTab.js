import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Switch } from '@/components/ui/switch.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '@/components/ui/select.jsx';
import { AlertCircle, Upload, RefreshCw, Wand2, Save } from 'lucide-react';
const DEFAULT_MODE = 'COPILOTO';
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
const stringifyJson = (value) => {
    try {
        return JSON.stringify(value ?? DEFAULT_SCHEMA, null, 2);
    }
    catch {
        return JSON.stringify(DEFAULT_SCHEMA, null, 2);
    }
};
const MODE_OPTIONS = [
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
    const [error, setError] = useState(null);
    const [config, setConfig] = useState(null);
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
                const data = payload?.data;
                if (mounted) {
                    setConfig({
                        ...data,
                        defaultMode: data.defaultMode ?? DEFAULT_MODE,
                    });
                    setSchemaDraft(stringifyJson(data.structuredOutputSchema));
                }
            }
            catch (err) {
                if (mounted) {
                    setError(err.message);
                }
            }
            finally {
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
        }
        catch {
            return null;
        }
    }, [schemaDraft]);
    const isSchemaValid = !!parsedSchema;
    const handleSave = async () => {
        if (!config)
            return;
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
            const data = payload.data;
            setConfig({
                ...data,
                defaultMode: data.defaultMode ?? DEFAULT_MODE,
            });
        }
        catch (err) {
            setError(err.message);
        }
        finally {
            setSaving(false);
        }
    };
    const disabled = !config || loading;
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs(Card, { children: [_jsxs(CardHeader, { className: "flex flex-col gap-2 md:flex-row md:items-center md:justify-between", children: [_jsxs("div", { children: [_jsx(CardTitle, { children: "Configura\u00E7\u00F5es da IA" }), _jsx(CardDescription, { children: "Ajuste o comportamento do copiloto e prepare o terreno para o modo autom\u00E1tico." })] }), _jsxs("div", { className: "flex items-center gap-3", children: [config?.aiEnabled ? (_jsx(Badge, { variant: "default", children: "OpenAI conectado" })) : (_jsx(Badge, { variant: "destructive", children: "Chave ausente" })), _jsxs(Button, { onClick: handleSave, disabled: disabled || saving || !isSchemaValid, children: [_jsx(Save, { className: "h-4 w-4 mr-2" }), saving ? 'Salvando...' : 'Salvar ajustes'] })] })] }), _jsxs(CardContent, { className: "grid gap-6 lg:grid-cols-2", children: [_jsxs("div", { className: "space-y-3", children: [_jsx(Label, { htmlFor: "ai-model", children: "Modelo" }), _jsx(Input, { id: "ai-model", value: config?.model ?? '', disabled: disabled, onChange: (event) => setConfig((prev) => (prev ? { ...prev, model: event.target.value } : prev)) }), _jsxs("p", { className: "text-xs text-muted-foreground", children: ["Recomendo iniciar com ", _jsx("code", { children: "gpt-4o-mini" }), " ou semelhante."] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "ai-temperature", children: "Temperatura" }), _jsx(Input, { type: "number", step: "0.1", id: "ai-temperature", disabled: disabled, value: config?.temperature ?? 0.3, onChange: (event) => setConfig((prev) => prev ? { ...prev, temperature: Number(event.target.value) } : prev) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "ai-max-tokens", children: "M\u00E1x. tokens" }), _jsx(Input, { type: "number", id: "ai-max-tokens", disabled: disabled, value: config?.maxOutputTokens ?? '', onChange: (event) => setConfig((prev) => prev ? { ...prev, maxOutputTokens: Number(event.target.value) || null } : prev) })] })] })] })] }), _jsxs("div", { className: "grid gap-6 lg:grid-cols-2", children: [_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Instru\u00E7\u00F5es" }), _jsx(CardDescription, { children: "Personalize os prompts do copiloto." })] }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "Prompt de resposta" }), _jsx(Textarea, { rows: 6, disabled: disabled, value: config?.systemPromptReply ?? '', onChange: (event) => setConfig((prev) => (prev ? { ...prev, systemPromptReply: event.target.value } : prev)) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "Prompt de nota interna" }), _jsx(Textarea, { rows: 6, disabled: disabled, value: config?.systemPromptSuggest ?? '', onChange: (event) => setConfig((prev) => (prev ? { ...prev, systemPromptSuggest: event.target.value } : prev)) })] }), _jsxs(Button, { variant: "outline", className: "flex items-center gap-2", disabled: disabled, onClick: () => setConfig((prev) => prev
                                            ? {
                                                ...prev,
                                                systemPromptReply: null,
                                                systemPromptSuggest: null,
                                            }
                                            : prev), children: [_jsx(Wand2, { className: "h-4 w-4" }), " Restaurar prompts padr\u00E3o"] })] })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Notas internas (JSON Schema)" }), _jsx(CardDescription, { children: "Use JSON Schema para garantir o formato 100% v\u00E1lido." })] }), _jsxs(CardContent, { className: "space-y-4", children: [_jsx(Textarea, { rows: 16, value: schemaDraft, disabled: disabled, onChange: (event) => setSchemaDraft(event.target.value), className: "font-mono text-xs" }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx(Switch, { checked: isSchemaValid, disabled: true }), _jsx("span", { className: "text-xs text-muted-foreground", children: isSchemaValid ? 'Schema válido' : 'Schema com erros de formatação JSON' }), _jsx(Button, { variant: "outline", size: "sm", onClick: handleSchemaReset, disabled: disabled, children: "Restaurar schema padr\u00E3o" })] })] })] })] }), _jsxs("div", { className: "grid gap-6 lg:grid-cols-2", children: [_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Ferramentas (Tool Calling)" }), _jsx(CardDescription, { children: "Cadastre fun\u00E7\u00F5es que a IA pode acionar." })] }), _jsxs(CardContent, { className: "space-y-4", children: [_jsx("p", { className: "text-sm text-muted-foreground", children: "Em breve: edite o schema das fun\u00E7\u00F5es e teste a integra\u00E7\u00E3o diretamente aqui." }), _jsxs("div", { className: "flex gap-2", children: [_jsxs(Button, { variant: "outline", disabled: true, children: [_jsx(Upload, { className: "h-4 w-4 mr-2" }), " Importar fun\u00E7\u00F5es"] }), _jsxs(Button, { variant: "outline", disabled: true, children: [_jsx(RefreshCw, { className: "h-4 w-4 mr-2" }), " Testar fun\u00E7\u00E3o"] })] })] })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Base de conhecimento (RAG)" }), _jsx(CardDescription, { children: "Integre scripts, obje\u00E7\u00F5es e FAQs atrav\u00E9s de vector stores." })] }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx(Switch, { checked: config?.vectorStoreEnabled ?? false, disabled: disabled, onCheckedChange: (checked) => setConfig((prev) => (prev ? { ...prev, vectorStoreEnabled: checked } : prev)) }), _jsx("span", { className: "text-sm", children: "Ativar File Search / Vector Store" })] }), _jsx(Label, { children: "Vector store IDs" }), _jsx(Textarea, { rows: 4, disabled: disabled, value: config?.vectorStoreIds?.join('\n') ?? '', onChange: (event) => setConfig((prev) => prev
                                            ? {
                                                ...prev,
                                                vectorStoreIds: event.target.value
                                                    .split('\n')
                                                    .map((id) => id.trim())
                                                    .filter(Boolean),
                                            }
                                            : prev), className: "font-mono text-xs" }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Use um ID por linha. Conecte seus arquivos antes de ativar o modo autom\u00E1tico." })] })] })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Streaming e UX" }), _jsx(CardDescription, { children: "Controle a experi\u00EAncia de digita\u00E7\u00E3o em tempo real." })] }), _jsxs(CardContent, { className: "flex flex-col gap-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Switch, { checked: config?.streamingEnabled ?? true, disabled: disabled, onCheckedChange: (checked) => setConfig((prev) => (prev ? { ...prev, streamingEnabled: checked } : prev)) }), _jsx("span", { children: "Resposta em tempo real" })] }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Com streaming ativado o cliente v\u00EA a IA digitando. Desative apenas em cen\u00E1rios de auditoria ou lat\u00EAncia extrema." })] })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Regras operacionais" }), _jsx(CardDescription, { children: "Defina modo padr\u00E3o, limites de confian\u00E7a e fallback." })] }), _jsxs(CardContent, { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { id: "ai-default-mode-label", htmlFor: "ai-default-mode", children: "Modo padr\u00E3o por conversa" }), _jsxs(Select, { value: config?.defaultMode ?? DEFAULT_MODE, disabled: disabled, onValueChange: (value) => setConfig((prev) => prev ? { ...prev, defaultMode: value } : prev), children: [_jsx(SelectTrigger, { id: "ai-default-mode", "aria-labelledby": "ai-default-mode-label", children: _jsx(SelectValue, { placeholder: "Selecione o modo" }) }), _jsx(SelectContent, { children: MODE_OPTIONS.map((option) => (_jsx(SelectItem, { value: option.value, children: option.label }, option.value))) })] }), _jsx("p", { className: "text-xs text-muted-foreground", children: MODE_OPTIONS.find((option) => option.value === (config?.defaultMode ?? DEFAULT_MODE))
                                            ?.description ?? '' })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "Limiar de confian\u00E7a" }), _jsx(Input, { type: "number", step: "0.05", min: "0", max: "1", disabled: disabled, value: config?.confidenceThreshold ?? '', onChange: (event) => setConfig((prev) => prev ? { ...prev, confidenceThreshold: Number(event.target.value) || 0 } : prev) }), _jsx("p", { className: "text-xs text-muted-foreground", children: "A IA devolve para o humano quando a confian\u00E7a ficar abaixo deste valor." })] }), _jsxs("div", { className: "space-y-2 md:col-span-2", children: [_jsx(Label, { children: "Pol\u00EDtica de fallback" }), _jsx(Input, { disabled: disabled, value: config?.fallbackPolicy ?? '', onChange: (event) => setConfig((prev) => (prev ? { ...prev, fallbackPolicy: event.target.value } : prev)), placeholder: "Ex.: ESCALATE_TO_QUEUE:manual-review" }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Documente o que deve acontecer quando a IA decidir recuar: transferir, pausar ou sinalizar follow-up." })] })] })] }), !config?.aiEnabled && (_jsxs(Card, { className: "border-destructive/40 bg-destructive/5", children: [_jsxs(CardHeader, { className: "flex items-center gap-2", children: [_jsx(AlertCircle, { className: "h-4 w-4 text-destructive" }), _jsx(CardTitle, { className: "text-destructive", children: "Chave da OpenAI n\u00E3o configurada" })] }), _jsxs(CardContent, { className: "text-sm text-destructive/90", children: ["Defina ", _jsx("code", { children: "OPENAI_API_KEY" }), " nas vari\u00E1veis de ambiente do backend para ativar o copiloto."] })] })), error ? _jsx("p", { className: "text-sm text-destructive", children: error }) : null, loading && _jsx("p", { className: "text-sm text-muted-foreground", children: "Carregando configura\u00E7\u00F5es..." })] }));
};
export default AiSettingsTab;
