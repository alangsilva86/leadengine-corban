# Inventário de cores — WhatsApp Connect

| Contexto | Utility classes | Variantes light/dark? | Token candidato |
| --- | --- | --- | --- |
| Status "Pendente" (badge/painel) | `border-amber-500/40 bg-amber-500/15 text-amber-200` | Sim | `status.whatsapp.disconnected` |
| Status "Conectando" (badge/painel) | `border-sky-500/40 bg-sky-500/15 text-sky-200` | Sim | `status.whatsapp.connecting` |
| Status "Ativo" (badge/painel) | `border-emerald-500/40 bg-emerald-500/15 text-emerald-200` | Sim | `status.whatsapp.connected` |
| Status "QR necessário" (badge/painel) | `border-purple-500/40 bg-purple-500/15 text-purple-200` | Sim | `status.whatsapp.qr_required` |
| Status padrão (fallback) | `border-white/10 bg-white/10 text-white` | Sim | `status.whatsapp.fallback` |
| Card do painel de instâncias | `border border-[var(--border)]/60 bg-[rgba(15,23,42,0.5)]` | Sim | `surface.panel.instances.translucent` |
| Card das instruções de QR Code | `border border-[var(--border)]/60 bg-[rgba(15,23,42,0.35)]` | Sim | `surface.panel.qr.translucent` |
| Cartões internos/glass tile | `border border-white/10 bg-white/5` | Sim | `surface.tile.glass.default` |
| Cartão vazio (borda tracejada) | `border border-dashed border-white/10 bg-white/5` | Sim | `surface.tile.glass.dashed` |
| Cartão/ação da instância selecionada | `border-primary/60 bg-primary/10 shadow-[0_0_0_1px_rgba(99,102,241,0.45)]` | Sim | `surface.tile.glass.active` |
| Cartão/ação da instância padrão | `border-white/10 bg-white/5 hover:border-primary/30` | Sim | `surface.tile.glass.hover` |
| Banner de erro da integração | `border border-destructive/40 bg-destructive/10 text-destructive` | Sim | `feedback.error.surface` |
| Moldura do preview de QR | `border-[rgba(99,102,241,0.25)] bg-[rgba(99,102,241,0.08)] text-primary shadow-inner` | Sim | `illustration.qr.highlight` |
| Trilha de barras de progresso | `bg-white/10` | Sim | `progress.track.translucent` |
| Indicador das barras de progresso | `bg-primary` | Sim | `progress.fill.primary` |

> Todos os itens acima foram coletados em `apps/web/src/features/whatsapp/WhatsAppConnect.jsx`. Cada linha indica tokens candidatos que precisarão de nomenclatura semântica dedicada.
