# Project TODO

## Configuração Inicial
- [x] Configurar schema do banco de dados para leads
- [x] Criar rotas tRPC para gerenciamento de leads
- [x] Configurar tema escuro e paleta de cores

## Design e Layout
- [x] Implementar layout base com tipografia e cores
- [x] Criar componentes reutilizáveis (buttons, cards, inputs)
- [x] Adicionar fontes do Google Fonts

## Seções do Site
- [x] Hero - "Produto pronto, marca sua"
- [x] Como funciona (linha do tempo)
- [x] Arquitetura 360 (tabela de camadas)
- [x] Modelos de participação (cards interativos)
- [x] Diferenciais estratégicos
- [x] Economia do negócio (exemplo de escala)
- [x] Governança & compliance
- [x] Integrações & stack
- [x] FAQ decisivo
- [x] CTA final de alto contraste

## Formulário de Qualificação
- [x] Implementar campos obrigatórios
- [x] Adicionar validações e máscaras
- [x] Implementar sistema de scoring de leads
- [ ] Integrar webhook para CRM (opcional - pode ser configurado depois)
- [x] Adicionar campos ocultos (UTM, referrer, device)

## SEO e Acessibilidade
- [x] Configurar meta tags e Open Graph
- [x] Implementar JSON-LD schema (Product, FAQPage, Organization)
- [x] Garantir contraste mínimo 4.5:1
- [x] Implementar navegação por teclado
- [x] Adicionar aria-labels apropriados

## Performance e Otimizações
- [x] Otimizar imagens (AVIF/WebP) - usando SVG inline
- [x] Implementar lazy loading - via viewport animations
- [x] Adicionar animações com Framer Motion
- [ ] Configurar rate limiting no formulário (backend - opcional)
- [ ] Implementar reCAPTCHA v3 (opcional - pode ser adicionado depois)

## Analytics e Mensuração
- [x] Configurar GTM dataLayer
- [x] Implementar eventos de conversão
- [ ] Adicionar tracking de scroll depth (opcional - pode ser adicionado depois)

## Integração e Deploy
- [x] Integrar com repositório GitHub
- [x] Criar checkpoint final
- [x] Gerar guia do usuário


## Refinamentos Baseados em Feedback

### Hero
- [x] Adicionar linha de validação na subheadline
- [x] Simplificar para 1 CTA primário destacado
- [ ] Adicionar mockup ou visual do produto (opcional)

### Visualizações
- [x] Transformar fluxo "Como funciona" em fluxograma horizontal animado
- [ ] Criar gráfico visual em camadas para Arquitetura 360
- [ ] Adicionar comparativo visual nos modelos de participação

### Simulador Interativo
- [x] Criar simulador de margem com sliders dinâmicos
- [x] Adicionar cálculo em tempo real de volume e margem
- [x] Incluir visualização gráfica dos resultados

### Design
- [x] Melhorar tipografia com pesos mais fortes
- [x] Ajustar paleta de cores (azul teal + laranja)
- [x] Aumentar espaçamento entre seções (py-32 = 128px)
- [x] Atualizar iconografia para estilo mais robusto

### Copywriting
- [x] Reescrever mensagens focando em oportunidade e controle
- [x] Adicionar frases de impacto sobre autonomia
- [x] Melhorar CTAs com benefícios claros

### Animações
- [x] Adicionar fluxo de processamento animado
- [x] Implementar hover states nos cards de modelos
- [x] Animar transições de seções


## Correção de Cores e UX/UI (Feedback 2)

### Problemas Identificados
- [x] Cores ainda aparecem brancas/neutras ao invés de azul teal
- [x] UX/UI precisa de melhorias significativas
- [x] Falta contraste e hierarquia visual
- [x] Componentes precisam de mais destaque

### Ações Corretivas
- [x] Aplicar cores teal diretamente nos componentes (não apenas CSS variables)
- [x] Adicionar backgrounds coloridos nas seções
- [x] Melhorar contraste entre elementos
- [x] Aumentar tamanho de fontes em títulos
- [x] Adicionar mais gradientes e efeitos visuais
- [x] Melhorar espaçamento interno dos cards
- [x] Adicionar bordas e sombras coloridas
- [x] Refinar animações e transições
