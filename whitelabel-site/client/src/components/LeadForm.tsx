import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { X, Loader2, CheckCircle2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import InputMask from "react-input-mask";

interface LeadFormProps {
  onClose: () => void;
}

export default function LeadForm({ onClose }: LeadFormProps) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    role: "",
    baseSize: "",
    interestedInFunding: "false",
    message: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const createLeadMutation = trpc.leads.create.useMutation({
    onSuccess: (data) => {
      setSubmitted(true);
      toast.success(`Lead enviado com sucesso! Tier: ${data.tier}`, {
        description: "Entraremos em contato em até 1 dia útil.",
      });
      
      // Track conversion event
      if (typeof window !== "undefined" && (window as any).dataLayer) {
        (window as any).dataLayer.push({
          event: "form_submit",
          lead_tier: data.tier,
          lead_score: data.score,
        });
      }
    },
    onError: (error) => {
      toast.error("Erro ao enviar formulário", {
        description: error.message,
      });
    },
  });

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (formData.name.length < 2) {
      newErrors.name = "Nome deve ter pelo menos 2 caracteres";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      newErrors.email = "E-mail inválido";
    }

    // Block generic email domains
    const genericDomains = ["gmail.com", "hotmail.com", "yahoo.com", "outlook.com"];
    const emailDomain = formData.email.split("@")[1]?.toLowerCase();
    if (genericDomains.includes(emailDomain)) {
      newErrors.email = "Por favor, use um e-mail corporativo";
    }

    const phoneDigits = formData.phone.replace(/\D/g, "");
    if (phoneDigits.length < 10) {
      newErrors.phone = "Telefone inválido";
    }

    if (formData.company.length < 2) {
      newErrors.company = "Nome da empresa é obrigatório";
    }

    if (formData.role.length < 2) {
      newErrors.role = "Cargo é obrigatório";
    }

    if (!formData.baseSize) {
      newErrors.baseSize = "Selecione o tamanho da base";
    }

    if (formData.message.length < 10) {
      newErrors.message = "Mensagem deve ter pelo menos 10 caracteres";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Por favor, corrija os erros no formulário");
      return;
    }

    // Collect hidden fields
    const utmParams = new URLSearchParams(window.location.search);
    const hiddenFields = {
      utmSource: utmParams.get("utm_source") || undefined,
      utmMedium: utmParams.get("utm_medium") || undefined,
      utmCampaign: utmParams.get("utm_campaign") || undefined,
      referrer: document.referrer || undefined,
      pageVariant: "default",
      device: /Mobile|Android|iPhone/i.test(navigator.userAgent) ? "mobile" : "desktop",
    };

    createLeadMutation.mutate({
      ...formData,
      baseSize: formData.baseSize as "< 10k" | "10k-50k" | "50k-100k" | "> 100k",
      interestedInFunding: formData.interestedInFunding === "true",
      ...hiddenFields,
    });
  };

  if (submitted) {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-card border border-border rounded-lg p-8 max-w-md w-full text-center space-y-6"
        >
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h3 className="text-2xl font-bold mb-2">Obrigado!</h3>
            <p className="text-muted-foreground">
              Recebemos sua solicitação e entraremos em contato em até 1 dia útil com a trilha de implantação.
            </p>
          </div>
          <Button onClick={onClose} className="w-full">
            Fechar
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-lg p-8 max-w-2xl w-full my-8 relative"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-6 w-6" />
        </button>

        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Solicitar acesso e proposta</h2>
          <p className="text-muted-foreground">
            Preencha os dados abaixo e nossa equipe entrará em contato
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="name">Nome completo *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={errors.name ? "border-destructive" : ""}
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail corporativo *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={errors.email ? "border-destructive" : ""}
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefone *</Label>
              <InputMask
                mask="(99) 99999-9999"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              >
                {/* @ts-ignore */}
                {(inputProps: any) => (
                  <Input
                    {...inputProps}
                    id="phone"
                    type="tel"
                    className={errors.phone ? "border-destructive" : ""}
                  />
                )}
              </InputMask>
              {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="company">Empresa *</Label>
              <Input
                id="company"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                className={errors.company ? "border-destructive" : ""}
              />
              {errors.company && <p className="text-sm text-destructive">{errors.company}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Cargo *</Label>
              <Input
                id="role"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className={errors.role ? "border-destructive" : ""}
              />
              {errors.role && <p className="text-sm text-destructive">{errors.role}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="baseSize">Tamanho da base *</Label>
              <Select
                value={formData.baseSize}
                onValueChange={(value) => setFormData({ ...formData, baseSize: value })}
              >
                <SelectTrigger className={errors.baseSize ? "border-destructive" : ""}>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="< 10k">Menos de 10 mil</SelectItem>
                  <SelectItem value="10k-50k">10 mil a 50 mil</SelectItem>
                  <SelectItem value="50k-100k">50 mil a 100 mil</SelectItem>
                  <SelectItem value="> 100k">Mais de 100 mil</SelectItem>
                </SelectContent>
              </Select>
              {errors.baseSize && <p className="text-sm text-destructive">{errors.baseSize}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Interessa funding próprio? *</Label>
            <RadioGroup
              value={formData.interestedInFunding}
              onValueChange={(value) => setFormData({ ...formData, interestedInFunding: value })}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="true" id="funding-yes" />
                <Label htmlFor="funding-yes" className="cursor-pointer">Sim</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="false" id="funding-no" />
                <Label htmlFor="funding-no" className="cursor-pointer">Não</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Mensagem *</Label>
            <Textarea
              id="message"
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              rows={4}
              placeholder="Conte-nos mais sobre seu interesse..."
              className={errors.message ? "border-destructive" : ""}
            />
            {errors.message && <p className="text-sm text-destructive">{errors.message}</p>}
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={createLeadMutation.isPending}
          >
            {createLeadMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Enviando...
              </>
            ) : (
              "Enviar solicitação"
            )}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
