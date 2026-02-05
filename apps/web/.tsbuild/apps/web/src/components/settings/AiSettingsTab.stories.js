import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import AiSettingsTab from './AiSettingsTab';
const createMockFetch = (config) => {
    const defaultResponse = {
        success: true,
        data: {
            model: 'gpt-4o-mini',
            temperature: 0.3,
            maxOutputTokens: 1024,
            systemPromptReply: 'Você é um assistente comercial do LeadEngine.',
            systemPromptSuggest: 'Resuma a conversa e indique próximos passos objetivos.',
            structuredOutputSchema: {
                type: 'object',
                required: ['next_step', 'tips', 'objections', 'confidence'],
            },
            tools: [],
            vectorStoreEnabled: true,
            vectorStoreIds: ['vs_demo_123'],
            streamingEnabled: true,
            defaultMode: 'COPILOTO',
            confidenceThreshold: 0.4,
            fallbackPolicy: 'ESCALATE_TO_QUEUE:review',
            aiEnabled: config.aiEnabled,
        },
    };
    return (input, init) => {
        if (typeof input === 'string' || input instanceof URL) {
            const url = input.toString();
            if (url.endsWith('/api/ai/config') && (!init || init.method === 'GET')) {
                return Promise.resolve(new Response(JSON.stringify(defaultResponse), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                }));
            }
            if (url.endsWith('/api/ai/config') && init?.method === 'PUT' && init.body) {
                const payload = JSON.parse(init.body);
                return Promise.resolve(new Response(JSON.stringify({
                    success: true,
                    data: { ...defaultResponse.data, ...payload },
                }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                }));
            }
        }
        return Promise.resolve(new Response(JSON.stringify({ success: false, message: 'Not mocked' }), { status: 404 }));
    };
};
const MockedTab = ({ aiEnabled }) => {
    const [ready, setReady] = useState(false);
    useEffect(() => {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = createMockFetch({ aiEnabled });
        setReady(true);
        return () => {
            globalThis.fetch = originalFetch;
        };
    }, [aiEnabled]);
    if (!ready) {
        return null;
    }
    return _jsx(AiSettingsTab, {});
};
const meta = {
    title: 'Configurações/IA/Aba de Configuração',
    component: MockedTab,
    parameters: {
        layout: 'fullscreen',
    },
    tags: ['autodocs'],
    args: {
        aiEnabled: true,
    },
};
export default meta;
export const ComOpenAiConfigurada = {
    args: {
        aiEnabled: true,
    },
};
export const SemChaveConfigurada = {
    args: {
        aiEnabled: false,
    },
};
