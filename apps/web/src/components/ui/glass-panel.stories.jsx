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
  title: 'Design System/GlassPanel',
  component: GlassPanel,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
    },
  },
};

const Template = (args) => (
  <div className="w-[320px] max-w-full">
    <GlassPanel {...args}>
      <DemoContent />
    </GlassPanel>
  </div>
);

export const Surface = {
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
    className: 'border-slate-900/70 bg-slate-950/80 text-slate-100',
  },
};

export const SurfaceElevated = {
  render: Template,
  args: {
    tone: 'surface',
    radius: '2xl',
    shadow: '2xl',
    className: 'border-white/20',
  },
};
