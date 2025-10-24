import MessageBubble from './MessageBubble.jsx';

const baseMetadata = {
  sourceInstance: 'demo-instance',
  phoneE164: '+55 11 99999-9999',
};

const createMessage = (overrides = {}) => ({
  id: 'message-id',
  status: 'DELIVERED',
  createdAt: '2024-01-01T12:34:00.000Z',
  direction: 'inbound',
  type: 'text',
  text: 'Mensagem padrão',
  metadata: { ...baseMetadata, ...(overrides.metadata ?? {}) },
  ...overrides,
});

export default {
  title: 'Features/Chat/MessageBubble',
  component: MessageBubble,
  args: {
    message: createMessage(),
  },
  render: (args) => (
    <div className="min-h-screen w-full bg-slate-900 p-8">
      <div className="mx-auto flex max-w-2xl justify-center">
        <MessageBubble {...args} />
      </div>
    </div>
  ),
};

export const TextMessage = {
  args: {
    message: createMessage({
      type: 'text',
      text: 'Olá! Esta é uma mensagem de texto simples com suporte a múltiplas linhas.\nAqui está uma nova linha!',
    }),
  },
};

export const ImageMessage = {
  args: {
    message: createMessage({
      type: 'image',
      direction: 'outbound',
      caption: 'Imagem de demonstração',
      mediaUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800',
    }),
  },
};

export const VideoMessage = {
  args: {
    message: createMessage({
      type: 'video',
      mediaUrl: 'https://samplelib.com/lib/preview/mp4/sample-5s.mp4',
      caption: 'Vídeo curto de demonstração',
    }),
  },
};

export const AudioMessage = {
  args: {
    message: createMessage({
      type: 'audio',
      mediaUrl: 'https://samplelib.com/lib/preview/mp3/sample-3s.mp3',
      caption: 'Mensagem de voz do cliente',
    }),
  },
};

export const DocumentMessage = {
  args: {
    message: createMessage({
      type: 'document',
      mediaUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      fileName: 'relatorio.pdf',
      caption: 'Segue o relatório solicitado.',
    }),
  },
};

export const LocationMessage = {
  args: {
    message: createMessage({
      type: 'location',
      caption: 'Local combinado para a reunião.',
      metadata: {
        ...baseMetadata,
        location: {
          name: 'Ticketz HQ',
          address: 'Av. Paulista, 1000 - São Paulo, SP',
          latitude: -23.561732,
          longitude: -46.655981,
        },
      },
    }),
  },
};

export const ContactMessage = {
  args: {
    message: createMessage({
      type: 'contact',
      metadata: {
        ...baseMetadata,
        contacts: [
          {
            name: 'Ana Oliveira',
            phones: ['+55 11 98888-8888'],
            org: 'Ticketz',
          },
          {
            name: 'Bruno Souza',
            phones: ['+55 21 97777-7777', '+55 21 96666-6666'],
          },
        ],
      },
    }),
  },
};

export const TemplateMessage = {
  args: {
    message: createMessage({
      type: 'template',
      metadata: {
        ...baseMetadata,
        interactive: {
          template: {
            name: 'boas_vindas',
            language: 'pt_BR',
            components: [
              { type: 'HEADER', text: 'Bem-vindo!' },
              { type: 'BODY', text: 'Olá {{1}}, como podemos ajudar?' },
            ],
          },
        },
      },
    }),
  },
};

export const PollMessage = {
  args: {
    message: createMessage({
      type: 'poll',
      metadata: {
        ...baseMetadata,
        poll: {
          id: 'poll-1',
          pollId: 'poll-1',
          question: 'Qual horário prefere?',
          options: [
            { id: 'opt-1', title: '09:00', votes: 5, index: 0 },
            { id: 'opt-2', title: '14:00', votes: 4, index: 1 },
            { id: 'opt-3', title: '17:00', votes: 3, index: 2 },
          ],
          selectedOptions: [{ id: 'opt-2', title: '14:00' }],
          totalVotes: 12,
          totalVoters: 9,
          optionTotals: { 'opt-1': 5, 'opt-2': 4, 'opt-3': 3 },
          aggregates: { totalVotes: 12, totalVoters: 9, optionTotals: { 'opt-1': 5, 'opt-2': 4, 'opt-3': 3 } },
          updatedAt: '2024-01-01T13:05:00.000Z',
        },
      },
    }),
  },
};

export const PollChoiceResponse = {
  args: {
    message: createMessage({
      type: 'text',
      direction: 'inbound',
      text: 'Resposta de enquete recebida.\nEnquete: poll-1\nOpções escolhidas:\n• 14:00',
      metadata: {
        ...baseMetadata,
        origin: 'poll_choice',
        poll: {
          id: 'poll-1',
          pollId: 'poll-1',
          question: 'Qual horário prefere?',
          options: [
            { id: 'opt-1', title: '09:00', votes: 5, index: 0 },
            { id: 'opt-2', title: '14:00', votes: 6, index: 1 },
            { id: 'opt-3', title: '17:00', votes: 1, index: 2 },
          ],
          selectedOptions: [{ id: 'opt-2', title: '14:00' }],
          totalVotes: 12,
          totalVoters: 9,
          optionTotals: { 'opt-1': 5, 'opt-2': 6, 'opt-3': 1 },
          aggregates: { totalVotes: 12, totalVoters: 9, optionTotals: { 'opt-1': 5, 'opt-2': 6, 'opt-3': 1 } },
          updatedAt: '2024-01-01T14:10:00.000Z',
        },
        pollChoice: {
          pollId: 'poll-1',
          voterJid: '5511999999999@s.whatsapp.net',
          options: [
            { id: 'opt-1', title: '09:00', index: 0 },
            { id: 'opt-2', title: '14:00', index: 1 },
            { id: 'opt-3', title: '17:00', index: 2 },
          ],
          vote: {
            optionIds: ['opt-2'],
            selectedOptions: [{ id: 'opt-2', title: '14:00' }],
            timestamp: '2024-01-01T14:10:00.000Z',
          },
        },
      },
    }),
  },
};

export const UnsupportedMessage = {
  args: {
    message: createMessage({
      type: 'sticker',
    }),
  },
};
