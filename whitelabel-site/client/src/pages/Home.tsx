import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  CheckCircle2, 
  ArrowRight, 
  Zap, 
  Shield, 
  TrendingUp, 
  Users, 
  Building2,
  Lock,
  Globe,
  ChevronDown,
  FileCheck,
  Database,
  Smartphone
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import LeadForm from "@/components/LeadForm";
import SEO from "@/components/SEO";
import MarginSimulator from "@/components/MarginSimulator";
import { useState } from "react";

export default function Home() {
  const [showForm, setShowForm] = useState(false);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen">
      <SEO />
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#0D9488]/10 via-[#0E0E11] to-[#FF6B06]/10">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0D9488]/30 via-transparent to-[#FF6B06]/20" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjAzIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-40" />
        
        <div className="container relative z-10 max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center space-y-8"
          >
            <h1 className="text-6xl md:text-8xl font-extrabold tracking-tight leading-tight">
              Lance seu próprio cartão benefício.{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0D9488] via-[#14B8A6] to-[#FF6B06]">
                Nós operamos o motor.
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
              Seu cartão roda em 45 dias. Sem dor de cabeça, sem desenvolvimento, sem risco operacional.{" "}
              <span className="text-foreground font-semibold">Averbadoras e bancarizadoras já plugadas.</span>
            </p>
            
            <div className="inline-flex items-center gap-2 px-6 py-3 bg-[#0D9488]/20 border border-[#0D9488]/40 rounded-full">
              <CheckCircle2 className="h-5 w-5 text-[#0D9488]" />
              <p className="text-base font-medium text-[#0D9488]">
                Já integrado com averbadoras e bancarizadoras homologadas
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-6">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button 
                  size="lg" 
                  className="text-xl px-14 py-8 bg-gradient-to-r from-[#0D9488] to-[#14B8A6] hover:from-[#0B7A70] hover:to-[#0D9488] transition-all shadow-2xl shadow-[#0D9488]/50 border-2 border-[#14B8A6]/30 font-bold"
                  onClick={() => setShowForm(true)}
                >
                  Receber Plano Comercial
                  <ArrowRight className="ml-3 h-7 w-7" />
                </Button>
              </motion.div>
            </div>
            
            <button 
              onClick={() => scrollToSection("how-it-works")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
            >
              Ver como funciona ↓
            </button>

            <div className="flex flex-wrap gap-6 justify-center pt-12 text-lg">
              <div className="flex items-center gap-3 px-5 py-3 bg-[#0D9488]/10 rounded-lg border border-[#0D9488]/20">
                <CheckCircle2 className="h-6 w-6 text-[#FF6B06]" />
                <span className="font-semibold text-foreground">Você controla a marca</span>
              </div>
              <div className="flex items-center gap-3 px-5 py-3 bg-[#0D9488]/10 rounded-lg border border-[#0D9488]/20">
                <CheckCircle2 className="h-6 w-6 text-[#FF6B06]" />
                <span className="font-semibold text-foreground">Não fica refém de banco</span>
              </div>
              <div className="flex items-center gap-3 px-5 py-3 bg-[#0D9488]/10 rounded-lg border border-[#0D9488]/20">
                <CheckCircle2 className="h-6 w-6 text-[#FF6B06]" />
                <span className="font-semibold text-foreground">Você distribui, nós operamos</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 1 }}
            className="absolute bottom-10 left-1/2 -translate-x-1/2"
          >
            <ChevronDown className="h-8 w-8 text-muted-foreground animate-bounce" />
          </motion.div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-32 bg-gradient-to-b from-[#0D9488]/5 to-transparent">
        <div className="container max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-5xl md:text-6xl font-extrabold mb-4">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0D9488] to-[#14B8A6]">Como funciona</span>
            </h2>
            <p className="text-xl text-muted-foreground">
              Da captação ao repasse: fluxo completo e automatizado
            </p>
          </motion.div>

          {/* Fluxograma horizontal */}
          <div className="relative">
            {/* Desktop: Horizontal flow */}
            <div className="hidden lg:block">
              <div className="flex items-center justify-between gap-2 mb-8">
                {[
                  { step: "1", title: "Captação", icon: <Smartphone className="h-6 w-6" /> },
                  { step: "2", title: "Margem", icon: <Database className="h-6 w-6" /> },
                  { step: "3", title: "Proposta", icon: <FileCheck className="h-6 w-6" /> },
                  { step: "4", title: "Formalização", icon: <Shield className="h-6 w-6" /> },
                  { step: "5", title: "Averbação", icon: <CheckCircle2 className="h-6 w-6" /> },
                  { step: "6", title: "Emissão", icon: <Zap className="h-6 w-6" /> },
                  { step: "7", title: "Repasse", icon: <TrendingUp className="h-6 w-6" /> },
                ].map((item, index) => (
                  <motion.div
                    key={item.step}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.15 }}
                    className="flex-1 relative"
                  >
                    <div className="flex flex-col items-center">
                      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#0D9488] to-[#14B8A6] flex items-center justify-center text-white mb-3 shadow-lg shadow-[#0D9488]/30 hover:scale-110 transition-transform">
                        {item.icon}
                      </div>
                      <div className="text-center">
                        <div className="text-xs font-bold text-muted-foreground mb-1">ETAPA {item.step}</div>
                        <div className="font-semibold text-sm">{item.title}</div>
                      </div>
                    </div>
                    {index < 6 && (
                      <div className="absolute top-10 -right-1 w-2 h-0.5 bg-gradient-to-r from-[#0D9488] to-[#14B8A6]">
                        <ArrowRight className="absolute -right-2 -top-2 h-5 w-5 text-[#0D9488]" />
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
              
              {/* Descrições detalhadas */}
              <div className="grid grid-cols-7 gap-4 mt-12">
                {[
                  { desc: "Seus canais (app, URA, WhatsApp)" },
                  { desc: "Averbadoras homologadas" },
                  { desc: "CET, IOF parametrizáveis" },
                  { desc: "SMS, e-mail, biometria" },
                  { desc: "Convênios e órgãos" },
                  { desc: "Bancarizadoras" },
                  { desc: "Conciliação diária" },
                ].map((item, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.5 + index * 0.1 }}
                    className="text-center text-sm text-muted-foreground"
                  >
                    {item.desc}
                  </motion.div>
                ))}
              </div>
            </div>
            
            {/* Mobile: Vertical flow */}
            <div className="lg:hidden space-y-4">
              {[
                { step: "1", title: "Captação", desc: "pelos seus canais (app, URA, WhatsApp, parceiros)", icon: <Smartphone className="h-5 w-5" /> },
                { step: "2", title: "Consulta de margem", desc: "via averbadoras (Econsig, Consignet, NeoConsig)", icon: <Database className="h-5 w-5" /> },
                { step: "3", title: "Simulação e proposta", desc: "com CET, IOF e taxas parametrizáveis", icon: <FileCheck className="h-5 w-5" /> },
                { step: "4", title: "Formalização digital", desc: "por SMS, WhatsApp, e-mail e biometria", icon: <Shield className="h-5 w-5" /> },
                { step: "5", title: "Averbação automática", desc: "com convênios e órgãos públicos", icon: <CheckCircle2 className="h-5 w-5" /> },
                { step: "6", title: "Liberação e emissão", desc: "pelas bancarizadoras homologadas", icon: <Zap className="h-5 w-5" /> },
                { step: "7", title: "Repasse e gestão", desc: "com conciliação diária e cobrança inteligente", icon: <TrendingUp className="h-5 w-5" /> },
              ].map((item, index) => (
                <motion.div
                  key={item.step}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="flex gap-4 items-start"
                >
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-[#0D9488] to-[#14B8A6] flex items-center justify-center text-white shadow-lg shadow-[#0D9488]/30">
                    {item.icon}
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-bold text-muted-foreground mb-1">ETAPA {item.step}</div>
                    <h3 className="text-lg font-semibold mb-1">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Architecture 360 Section */}
      <section className="py-32 bg-gradient-to-b from-transparent to-[#FF6B06]/5">
        <div className="container max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-5xl md:text-6xl font-extrabold mb-4">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF6B06] to-[#FF8534]">Arquitetura 360</span>
            </h2>
            <p className="text-xl text-muted-foreground">
              Seu cartão, sua marca, nossa engrenagem
            </p>
          </motion.div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 font-semibold">Camada</th>
                  <th className="text-left p-4 font-semibold">O que entra</th>
                  <th className="text-left p-4 font-semibold">Quem lidera</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { 
                    layer: "Front-Brand", 
                    what: "Marca, design, comunicação, CRM, canais de venda", 
                    who: "Você (operadora)",
                    icon: <Building2 className="h-5 w-5" />
                  },
                  { 
                    layer: "Core Operacional", 
                    what: "Motor de crédito, formalização, APIs, emissão e cobrança", 
                    who: "Fatorcard",
                    icon: <Zap className="h-5 w-5" />
                  },
                  { 
                    layer: "Infra Financeira", 
                    what: "Funding, repasses, conciliação e liquidação", 
                    who: "FIDC próprio ou parceiro",
                    icon: <TrendingUp className="h-5 w-5" />
                  },
                  { 
                    layer: "Compliance & Regulação", 
                    what: "BACEN, LGPD, Lei 10.820, antifraude e auditoria", 
                    who: "Núcleo Fatorcard",
                    icon: <Shield className="h-5 w-5" />
                  },
                ].map((row, index) => (
                  <motion.tr
                    key={row.layer}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                    className="border-b border-border/50 hover:bg-muted/50 transition-colors"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="text-primary">{row.icon}</div>
                        <span className="font-semibold">{row.layer}</span>
                      </div>
                    </td>
                    <td className="p-4 text-muted-foreground">{row.what}</td>
                    <td className="p-4">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-primary/10 text-primary">
                        {row.who}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Models Section */}
      <section className="py-32 bg-gradient-to-b from-[#FF6B06]/5 via-[#0D9488]/5 to-transparent">
        <div className="container max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-5xl md:text-6xl font-extrabold mb-4">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0D9488] to-[#FF6B06]">Modelos de participação</span>
            </h2>
            <p className="text-xl text-muted-foreground">
              Escolha o modelo que melhor se adapta ao seu negócio
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: "White Label SaaS",
                desc: "Use nossa estrutura operacional e capital. Pague taxa de uso e receba comissão de originação.",
                risk: "Baixo",
                return: "Moderado",
                icon: <Globe className="h-8 w-8" />,
              },
              {
                title: "Co-Funding",
                desc: "Invista em pool com nosso FIDC. Ganhe sobre a cota e sobre a distribuição.",
                risk: "Médio",
                return: "Alto",
                icon: <Users className="h-8 w-8" />,
              },
              {
                title: "Funding Próprio",
                desc: "Rode com seu FIDC e nossa operação. Soberania máxima de capital.",
                risk: "Alto",
                return: "Máximo",
                icon: <Lock className="h-8 w-8" />,
              },
            ].map((model, index) => (
              <motion.div
                key={model.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="h-full hover:shadow-2xl hover:shadow-[#0D9488]/30 transition-all duration-300 hover:-translate-y-2 border-2 border-[#0D9488]/20 hover:border-[#0D9488]/50 bg-gradient-to-br from-card to-card/50">
                  <CardHeader>
                    <div className="mb-4 p-4 bg-gradient-to-br from-[#0D9488] to-[#14B8A6] rounded-xl inline-block text-white shadow-lg shadow-[#0D9488]/30">{model.icon}</div>
                    <CardTitle className="text-2xl font-bold">{model.title}</CardTitle>
                    <CardDescription className="text-base">{model.desc}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-[#0D9488]/5 rounded-lg">
                        <span className="text-sm font-medium text-muted-foreground">Risco:</span>
                        <span className="font-bold text-[#FF6B06]">{model.risk}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-[#0D9488]/5 rounded-lg">
                        <span className="text-sm font-medium text-muted-foreground">Retorno:</span>
                        <span className="font-bold text-[#0D9488]">{model.return}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Differentials Section */}
      <section className="py-32 bg-gradient-to-b from-transparent to-[#0D9488]/5">
        <div className="container max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-5xl md:text-6xl font-extrabold mb-4">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0D9488] to-[#14B8A6]">Diferenciais estratégicos</span>
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              "Go-to-market em até 45 dias",
              "Zero custo de desenvolvimento do core",
              "Integrações ativas com averbadoras e bancarizadoras",
              "Painel administrativo com controle por convênio e canal",
              "Compliance robusto, trilhas de auditoria e antifraude",
              "Escala multi-tenant para centenas de convênios",
            ].map((differential, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="flex items-start gap-4 p-6 rounded-xl bg-gradient-to-br from-[#0D9488]/10 to-transparent border-2 border-[#0D9488]/20 hover:border-[#0D9488]/40 hover:shadow-lg hover:shadow-[#0D9488]/20 transition-all duration-300 hover:-translate-y-1"
              >
                <div className="p-2 bg-gradient-to-br from-[#0D9488] to-[#14B8A6] rounded-lg flex-shrink-0">
                  <CheckCircle2 className="h-5 w-5 text-white" />
                </div>
                <span className="text-lg font-medium">{differential}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Economics Section */}
      <section className="py-32 bg-gradient-to-b from-[#0D9488]/5 to-[#FF6B06]/5">
        <div className="container max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-5xl md:text-6xl font-extrabold mb-4">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0D9488] to-[#FF6B06]">Economia do negócio</span>
            </h2>
            <p className="text-xl text-muted-foreground">Exemplo de escala</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-gradient-to-br from-card to-card/50 border-border/50">
              <CardContent className="p-8">
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold mb-2">Simulador de Margem Interativo</h3>
                  <p className="text-muted-foreground">Ajuste os parâmetros e veja o potencial de receita em tempo real</p>
                </div>
                <MarginSimulator />
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Governance Section */}
      <section className="py-32 bg-gradient-to-b from-[#FF6B06]/5 to-transparent">
        <div className="container max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-5xl md:text-6xl font-extrabold mb-4">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF6B06] to-[#FF8534]">Governança & compliance</span>
            </h2>
            <p className="text-xl text-muted-foreground">
              Operação segura e auditável
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                icon: <FileCheck className="h-6 w-6" />,
                title: "Padrão Fatorcard de risco",
                desc: "Operação segue padrão Fatorcard de risco e controles de compliance"
              },
              {
                icon: <Shield className="h-6 w-6" />,
                title: "Política de crédito",
                desc: "Parceiro sugere ajustes comerciais, sem alterar política de crédito"
              },
              {
                icon: <Database className="h-6 w-6" />,
                title: "Funding auditável",
                desc: "Funding próprio requer lastro auditável e registros"
              },
              {
                icon: <Lock className="h-6 w-6" />,
                title: "Evidências digitalizadas",
                desc: "Registros, logs e evidências digitalizadas (assinatura, biometria, IP, device)"
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="flex gap-4 p-6 rounded-lg bg-card border border-border hover:border-primary/50 transition-colors"
              >
                <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  {item.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                  <p className="text-muted-foreground">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations Section */}
      <section className="py-32 bg-gradient-to-b from-transparent to-[#0D9488]/5">
        <div className="container max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-5xl md:text-6xl font-extrabold mb-4">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0D9488] to-[#14B8A6]">Integrações & stack</span>
            </h2>
            <p className="text-xl text-muted-foreground">
              Conectado com os principais players do mercado
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-primary" />
                  Averbadoras
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {["Econsig", "Consignet", "NeoConsig", "Consiglog"].map((item) => (
                    <span key={item} className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
                      {item}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  Bancarizadoras / Emissão
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {["CDC Bank", "Presença Bank", "UY3", "Processadoras homologadas"].map((item) => (
                    <span key={item} className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
                      {item}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-primary" />
                  Canais
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {["URA Reversa", "WhatsApp", "SMS", "Web App"].map((item) => (
                    <span key={item} className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
                      {item}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  Stack
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {["API-first", "Eventos", "Dashboards com BI"].map((item) => (
                    <span key={item} className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
                      {item}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-32 bg-gradient-to-b from-[#0D9488]/5 to-transparent">
        <div className="container max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-5xl md:text-6xl font-extrabold mb-4">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0D9488] to-[#FF6B06]">Perguntas frequentes</span>
            </h2>
            <p className="text-xl text-muted-foreground">
              Tire suas dúvidas sobre a operação
            </p>
          </motion.div>

          <Accordion type="single" collapsible className="w-full">
            {[
              {
                q: "Em quanto tempo posso lançar?",
                a: "Com nossa estrutura white-label plug-and-play, você pode lançar seu cartão benefício em até 45 dias, incluindo integração, homologação e treinamento da equipe."
              },
              {
                q: "Posso usar meu próprio FIDC?",
                a: "Sim! Oferecemos o modelo de Funding Próprio onde você utiliza seu FIDC e nossa operação. Requer lastro auditável e registros adequados."
              },
              {
                q: "Como funciona a cobrança se a prefeitura atrasa o repasse?",
                a: "Nosso sistema de cobrança inteligente monitora os repasses e aciona automaticamente os mecanismos de garantia e conciliação para minimizar impactos."
              },
              {
                q: "Como ficam as comissões entre minha rede e vocês?",
                a: "As comissões são parametrizáveis e definidas no onboarding de acordo com o modelo escolhido (SaaS, Co-Funding ou Funding Próprio)."
              },
              {
                q: "Quais evidências jurídicas guardamos para auditoria?",
                a: "Mantemos registros completos de assinatura digital, biometria, IP, device, logs de transação e toda documentação digitalizada com validade jurídica."
              },
              {
                q: "Posso personalizar taxas por convênio?",
                a: "Sim, nosso painel administrativo permite controle granular de taxas, CET e IOF por convênio e canal de distribuição."
              },
              {
                q: "O que acontece em casos de exoneração do servidor?",
                a: "Nosso sistema monitora automaticamente mudanças de status junto às averbadoras e aciona os procedimentos de cobrança alternativa conforme política de crédito."
              },
              {
                q: "Vocês dão suporte técnico e treinamento?",
                a: "Sim, oferecemos suporte técnico completo, treinamento da equipe e documentação detalhada durante todo o processo de onboarding e operação."
              },
            ].map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left text-lg">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-base">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-32 bg-gradient-to-br from-[#0D9488]/10 via-[#0E0E11] to-[#FF6B06]/10">
        <div className="container max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center space-y-8"
          >
            <h2 className="text-5xl md:text-7xl font-extrabold">
              Você tem a marca.{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0D9488] via-[#14B8A6] to-[#FF6B06]">
                Nós temos o motor.
              </span>
            </h2>
            <p className="text-xl text-muted-foreground">
              Comece agora a operar seu próprio cartão benefício.
            </p>
            
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button 
                size="lg" 
                className="text-xl px-14 py-8 bg-gradient-to-r from-[#0D9488] to-[#14B8A6] hover:from-[#0B7A70] hover:to-[#0D9488] transition-all shadow-2xl shadow-[#0D9488]/50 border-2 border-[#14B8A6]/30 font-bold"
                onClick={() => setShowForm(true)}
              >
                Solicitar acesso e proposta
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </motion.div>

            <p className="text-sm text-muted-foreground">
              Respondemos em até 1 dia útil com trilha de implantação.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border">
        <div className="container max-w-6xl">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="font-semibold mb-4">LeadEngine</h3>
              <p className="text-sm text-muted-foreground">
                Cartão benefício white-label com tecnologia, compliance e funding opcional.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Legal</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Termos de Uso</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Política de Privacidade</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">LGPD</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Contato</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>contato@leadengine.com.br</li>
                <li>(11) 99999-9999</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Responsabilidade</h3>
              <p className="text-sm text-muted-foreground">
                Simulações ilustrativas. Condições sob aprovação. Disponibilidade por convênio.
              </p>
            </div>
          </div>
          <div className="text-center text-sm text-muted-foreground pt-8 border-t border-border">
            © {new Date().getFullYear()} LeadEngine. Todos os direitos reservados.
          </div>
        </div>
      </footer>

      {/* Lead Form Modal */}
      {showForm && <LeadForm onClose={() => setShowForm(false)} />}
    </div>
  );
}
