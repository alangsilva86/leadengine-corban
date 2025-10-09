import { Check, CircleDashed, MessageCircle, X } from 'lucide-react';

import { StatusPill } from './status-pill.jsx';

const toneOptions = ['neutral', 'primary', 'success', 'warning', 'danger', 'whatsapp'];

export default {
  title: 'Componentes/Base/StatusPill',
  component: StatusPill,
  tags: ['autodocs'],
  argTypes: {
    tone: {
      control: 'select',
      options: toneOptions,
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    withDot: {
      control: 'boolean',
    },
  },
  args: {
    tone: 'neutral',
    size: 'md',
    withDot: true,
    children: 'Em conversa',
  },
};

export const Playground = {
  args: {
    tone: 'neutral',
    children: 'Em conversa',
  },
};

export const ComIcone = {
  render: (args) => (
    <StatusPill {...args}>
      <Check className="size-3.5" aria-hidden />
      Lead ganhado
    </StatusPill>
  ),
  args: {
    tone: 'success',
    withDot: false,
  },
};

export const Estados = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      <StatusPill {...args} tone="neutral">
        <CircleDashed className="size-3.5" aria-hidden />
        Novo lead
      </StatusPill>
      <StatusPill {...args} tone="primary">
        <MessageCircle className="size-3.5" aria-hidden />
        Respondendo
      </StatusPill>
      <StatusPill {...args} tone="success">
        <Check className="size-3.5" aria-hidden />
        Ganhou
      </StatusPill>
      <StatusPill {...args} tone="danger">
        <X className="size-3.5" aria-hidden />
        Perdido
      </StatusPill>
      <StatusPill {...args} tone="whatsapp">
        <MessageCircle className="size-3.5" aria-hidden />
        WhatsApp
      </StatusPill>
    </div>
  ),
  args: {
    withDot: false,
    size: 'md',
  },
  parameters: {
    controls: {
      exclude: ['children', 'tone'],
    },
  },
};
