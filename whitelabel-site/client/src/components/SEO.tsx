import { useEffect } from "react";

export default function SEO() {
  useEffect(() => {
    // Add JSON-LD schema for Product
    const productSchema = {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": "Cartão Benefício White-Label",
      "description": "Tecnologia, compliance e funding opcional para lançar seu cartão benefício com sua marca em até 45 dias",
      "brand": {
        "@type": "Organization",
        "name": "LeadEngine"
      },
      "offers": {
        "@type": "AggregateOffer",
        "availability": "https://schema.org/InStock",
        "priceCurrency": "BRL"
      }
    };

    // Add JSON-LD schema for Organization
    const organizationSchema = {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "LeadEngine",
      "url": "https://leadengine.com.br",
      "logo": "https://leadengine.com.br/logo.png",
      "description": "Cartão benefício white-label com tecnologia, compliance e funding opcional",
      "contactPoint": {
        "@type": "ContactPoint",
        "telephone": "+55-11-99999-9999",
        "contactType": "Sales",
        "email": "contato@leadengine.com.br"
      }
    };

    // Add JSON-LD schema for FAQPage
    const faqSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Em quanto tempo posso lançar?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Com nossa estrutura white-label plug-and-play, você pode lançar seu cartão benefício em até 45 dias, incluindo integração, homologação e treinamento da equipe."
          }
        },
        {
          "@type": "Question",
          "name": "Posso usar meu próprio FIDC?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Sim! Oferecemos o modelo de Funding Próprio onde você utiliza seu FIDC e nossa operação. Requer lastro auditável e registros adequados."
          }
        },
        {
          "@type": "Question",
          "name": "Como funciona a cobrança se a prefeitura atrasa o repasse?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Nosso sistema de cobrança inteligente monitora os repasses e aciona automaticamente os mecanismos de garantia e conciliação para minimizar impactos."
          }
        },
        {
          "@type": "Question",
          "name": "Como ficam as comissões entre minha rede e vocês?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "As comissões são parametrizáveis e definidas no onboarding de acordo com o modelo escolhido (SaaS, Co-Funding ou Funding Próprio)."
          }
        },
        {
          "@type": "Question",
          "name": "Quais evidências jurídicas guardamos para auditoria?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Mantemos registros completos de assinatura digital, biometria, IP, device, logs de transação e toda documentação digitalizada com validade jurídica."
          }
        },
        {
          "@type": "Question",
          "name": "Posso personalizar taxas por convênio?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Sim, nosso painel administrativo permite controle granular de taxas, CET e IOF por convênio e canal de distribuição."
          }
        },
        {
          "@type": "Question",
          "name": "O que acontece em casos de exoneração do servidor?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Nosso sistema monitora automaticamente mudanças de status junto às averbadoras e aciona os procedimentos de cobrança alternativa conforme política de crédito."
          }
        },
        {
          "@type": "Question",
          "name": "Vocês dão suporte técnico e treinamento?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Sim, oferecemos suporte técnico completo, treinamento da equipe e documentação detalhada durante todo o processo de onboarding e operação."
          }
        }
      ]
    };

    // Create script elements and add to head
    const productScript = document.createElement("script");
    productScript.type = "application/ld+json";
    productScript.text = JSON.stringify(productSchema);
    document.head.appendChild(productScript);

    const orgScript = document.createElement("script");
    orgScript.type = "application/ld+json";
    orgScript.text = JSON.stringify(organizationSchema);
    document.head.appendChild(orgScript);

    const faqScript = document.createElement("script");
    faqScript.type = "application/ld+json";
    faqScript.text = JSON.stringify(faqSchema);
    document.head.appendChild(faqScript);

    // Cleanup
    return () => {
      document.head.removeChild(productScript);
      document.head.removeChild(orgScript);
      document.head.removeChild(faqScript);
    };
  }, []);

  return null;
}
