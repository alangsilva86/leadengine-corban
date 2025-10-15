# Feature toggles em produção

Este diretório centraliza variáveis de ambiente utilizadas pelos serviços de deploy. A flag `FEATURE_DEBUG_WHATSAPP` controla a
exposição das rotas `/api/debug/wa` na API e do menu "Debug WhatsApp" na aplicação web.

## Como habilitar sem rebuild (Railway)

1. Acesse o serviço correspondente (API ou Web) no painel do Railway.
2. Abra a aba **Variables** e localize `FEATURE_DEBUG_WHATSAPP`.
3. Ajuste o valor para `true` para habilitar ou `false` para ocultar as ferramentas de debug.
4. Clique em **Save** e, se necessário, force um restart suave do serviço (não é preciso rebuild; o container lê a variável no
   boot).

> 💡 A aplicação web lê as variáveis expostas via `window.process.env`, portanto basta reiniciar o serviço estático para que o
> novo valor seja disponibilizado aos navegadores após um refresh.

## Railway CLI

Caso prefira utilizar a CLI do Railway:

```bash
railway variables set FEATURE_DEBUG_WHATSAPP=true --service ticketzapi-production
railway variables set FEATURE_DEBUG_WHATSAPP=true --service leadengine-corban-web
```

Substitua `true` por `false` para desativar. Nenhum rebuild é disparado; apenas um restart rápido do container é recomendado para
propagar o novo valor.
