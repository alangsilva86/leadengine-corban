import { useState } from "react";
import { motion } from "framer-motion";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

export default function MarginSimulator() {
  const [convenios, setConvenios] = useState([10]);
  const [ticketMedio, setTicketMedio] = useState([2500]);
  const [conversao, setConversao] = useState([5]);

  // Cálculos
  const servidoresElegiveis = convenios[0] * 2500;
  const volumeMensal = (servidoresElegiveis * (conversao[0] / 100) * ticketMedio[0]) / 1000000;
  const margemLiquida = volumeMensal * 0.05 * 1000000;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value);
  };

  return (
    <div className="grid md:grid-cols-2 gap-8">
      {/* Controles */}
      <div className="space-y-8">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium">Convênios ativos</label>
            <span className="text-2xl font-bold text-primary">{convenios[0]}</span>
          </div>
          <Slider
            value={convenios}
            onValueChange={setConvenios}
            min={1}
            max={50}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>1</span>
            <span>50</span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium">Ticket médio</label>
            <span className="text-2xl font-bold text-primary">{formatCurrency(ticketMedio[0])}</span>
          </div>
          <Slider
            value={ticketMedio}
            onValueChange={setTicketMedio}
            min={500}
            max={10000}
            step={100}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>R$ 500</span>
            <span>R$ 10.000</span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium">Taxa de conversão</label>
            <span className="text-2xl font-bold text-primary">{conversao[0]}%</span>
          </div>
          <Slider
            value={conversao}
            onValueChange={setConversao}
            min={1}
            max={20}
            step={0.5}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>1%</span>
            <span>20%</span>
          </div>
        </div>
      </div>

      {/* Resultados */}
      <div className="space-y-4">
        <motion.div
          key={servidoresElegiveis}
          initial={{ scale: 0.95, opacity: 0.5 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-6">
              <div className="text-sm text-muted-foreground mb-2">Servidores elegíveis</div>
              <div className="text-3xl font-bold">{formatNumber(servidoresElegiveis)}</div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          key={volumeMensal}
          initial={{ scale: 0.95, opacity: 0.5 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="p-6">
              <div className="text-sm text-muted-foreground mb-2">Volume mensal</div>
              <div className="text-4xl font-bold text-primary">
                {volumeMensal < 1 
                  ? formatCurrency(volumeMensal * 1000) + ' mil'
                  : `R$ ${volumeMensal.toFixed(3)} mi`
                }
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          key={margemLiquida}
          initial={{ scale: 0.95, opacity: 0.5 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Card className="bg-gradient-to-br from-secondary/10 to-secondary/5 border-secondary/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-muted-foreground">Margem líquida (5%)</div>
                <TrendingUp className="h-5 w-5 text-secondary" />
              </div>
              <div className="text-4xl font-bold text-secondary">
                {formatCurrency(margemLiquida)}/mês
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <p className="text-xs text-muted-foreground text-center pt-4">
          *Simulação ilustrativa. Valores reais dependem de diversos fatores operacionais.
        </p>
      </div>
    </div>
  );
}
