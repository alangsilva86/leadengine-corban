import { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import AiSettingsTab from './AiSettingsTab';

type StoryConfig = {
  aiEnabled: boolean;
};

const createMockFetch = (config: StoryConfig) => {
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

  return (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (typeof input === 'string' || input instanceof URL) {
      const url = input.toString();

      if (url.endsWith('/api/ai/config') && (!init || init.method === 'GET')) {
        return Promise.resolve(
          new Response(JSON.stringify(defaultResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }

      if (url.endsWith('/api/ai/config') && init?.method === 'PUT' && init.body) {
        const payload = JSON.parse(init.body as string);
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              data: { ...defaultResponse.data, ...payload },
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        );
      }
    }

    return Promise.resolve(
      new Response(JSON.stringify({ success: false, message: 'Not mocked' }), { status: 404 })
    );
  };
};

const MockedTab = ({ aiEnabled }: StoryConfig) => {
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

  return <AiSettingsTab />;
};

const meta: Meta<typeof MockedTab> = {
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

type Story = StoryObj<typeof MockedTab>;

export const ComOpenAiConfigurada: Story = {
  args: {
    aiEnabled: true,
  },
};

export const SemChaveConfigurada: Story = {
  args: {
    aiEnabled: false,
  },
};
