import { ArrowRight, Loader2, Plus } from 'lucide-react';

import { Button } from './button.jsx';

export default {
  title: 'Componentes/Base/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
    },
    size: {
      control: 'select',
      options: ['sm', 'default', 'lg', 'icon'],
    },
  },
  args: {
    children: 'Ação principal',
    variant: 'default',
    size: 'default',
  },
};

export const Playground = {
  args: {
    children: 'Ação principal',
  },
};

export const ComIcone = {
  render: (args) => (
    <Button {...args}>
      <span>Continuar</span>
      <ArrowRight className="size-4" aria-hidden />
    </Button>
  ),
  args: {
    variant: 'default',
    size: 'default',
  },
};

export const Circular = {
  args: {
    variant: 'secondary',
    size: 'icon',
    children: <Plus className="size-5" aria-hidden />,
    'aria-label': 'Adicionar',
  },
};

export const Carregando = {
  render: (args) => (
    <Button {...args} disabled>
      <Loader2 className="size-4 animate-spin" aria-hidden />
      Processando
    </Button>
  ),
  args: {
    variant: 'default',
    size: 'default',
  },
};
