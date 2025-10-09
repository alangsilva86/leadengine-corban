import { GlassPanel } from './glass-panel.jsx';

const DemoContent = ({ title = 'Título do painel', description = 'Descrição breve do conteúdo exibido dentro do painel.' }) => (
  <div className="space-y-3 text-sm">
    <div className="space-y-1">
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <div className="h-10 w-10 rounded-full bg-primary/15" />
      <div className="space-y-1">
        <p className="font-medium text-foreground">Lead Engine</p>
        <p>Widgets e componentes reutilizáveis.</p>
      </div>
    </div>
  </div>
);

export default {
  title: 'Componentes/Base/GlassPanel',
  component: GlassPanel,
  tags: ['autodocs'],
  argTypes: {
    tone: {
      control: 'select',
      options: ['surface', 'overlay'],
    },
    radius: {
      control: 'select',
      options: ['none', 'sm', 'md', 'lg', 'xl', '2xl', 'full'],
    },
    shadow: {
      control: 'select',
      options: ['none', 'sm', 'md', 'lg', 'xl', '2xl'],
    },
  },
  parameters: {
    layout: 'centered',
  },
};

const Template = (args) => (
  <div className="w-[320px] max-w-full">
    <GlassPanel {...args}>
      <DemoContent />
    </GlassPanel>
  </div>
);

export const Playground = {
  render: Template,
  args: {
    tone: 'surface',
    radius: 'lg',
    shadow: 'md',
  },
};

export const Overlay = {
  render: Template,
  args: {
    tone: 'overlay',
    radius: 'xl',
    shadow: 'xl',
  },
};

export const SurfaceElevated = {
  render: Template,
  args: {
    tone: 'surface',
    radius: '2xl',
    shadow: '2xl',
  },
};
