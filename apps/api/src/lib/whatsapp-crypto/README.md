# `lib/whatsapp-crypto`

Implementação própria, sem dependências além de `node:crypto` e `undici`, das duas operações
criptográficas do protocolo WhatsApp que a API precisa. A conexão com o WhatsApp continua no
**broker HTTP externo** (baseado em Baileys); a API não depende mais do pacote
`@whiskeysockets/baileys` (removido junto com `libsignal`, `protobufjs`, `axios`, `music-metadata`…).

| Uso | Função | Chamadores |
| --- | --- | --- |
| Baixar e decifrar mídia inbound do CDN | `downloadAndDecryptMedia`, `downloadAndDecryptMessageMedia` | `features/whatsapp-inbound/services/media-downloader.ts` |
| Decifrar votos de enquete | `decryptPollVote` | `poll-choice-service.ts`, `poll-update-normalizer.ts` |

Funções puras auxiliares: `deriveMediaKeys`, `decryptMediaBuffer`, `decodePollVoteMessage`,
`resolveDownloadableMedia`, `resolveMediaDownloadUrl`, `isAllowedWhatsAppMediaUrl`, `tryToBuffer`.

## Protocolo

### Mídia

1. `mediaKey` (32 bytes, vem na mensagem) → HKDF-SHA256 com salt = 32 bytes zero,
   `info = "WhatsApp <Rótulo> Keys"` (tabela `MEDIA_HKDF_KEY_MAPPING`), 112 bytes.
2. `iv = [0,16)`, `cipherKey = [16,48)`, `macKey = [48,80)` (o resto não é usado).
3. Arquivo no CDN = `AES-256-CBC/PKCS#7(plaintext) ‖ mac10`, onde
   `mac10 = HMAC-SHA256(macKey, iv ‖ ciphertext)[0,10)`.
4. Hashes opcionais da mensagem: `fileEncSha256 = SHA-256(ciphertext ‖ mac10)`,
   `fileSha256 = SHA-256(plaintext)`.
5. URL: `url` da mensagem se for um host permitido; senão `https://mmg.whatsapp.net` + `directPath`.

Tipos e rótulos (iguais ao WhatsApp Web/Baileys): `image`, `sticker`, `product` → `Image`;
`video`, `gif`, `ptv` → `Video`; `audio`, `ptt` → `Audio`; `document` → `Document`;
`thumbnail-image|video|document|link` → `<X> Thumbnail`; `md-msg-hist` → `History`;
`md-app-state` → `App State`; `payment-bg-image` → `Payment Background`;
`ppic`, `product-catalog-image` → rótulo vazio (`"WhatsApp  Keys"`, dois espaços).

### Voto de enquete (`pollUpdateMessage.vote`)

```
sign   = pollMsgId ‖ pollCreatorJid ‖ voterJid ‖ "Poll Vote" ‖ 0x01      (UTF-8)
key0   = HMAC-SHA256(key = 32 bytes zero, data = pollEncKey)            (pollEncKey = messageSecret da enquete)
decKey = HMAC-SHA256(key = key0, data = sign)
aad    = pollMsgId ‖ 0x00 ‖ voterJid
plain  = AES-256-GCM-decrypt(decKey, iv = encIv (12 bytes), aad, encPayload[0..-16], tag = encPayload[-16..])
```

`plain` é o protobuf `PollVoteMessage { repeated bytes selectedOptions = 1; }`; cada item é o
SHA-256 do nome da opção. O leitor protobuf (`protobuf.ts`) é mínimo e com checagem de limites:
varints de até 10 bytes, campos desconhecidos de qualquer wire type (inclusive grupos, com limite
de aninhamento) são pulados, e qualquer entrada malformada vira `MALFORMED_PROTOBUF`.

## Escolhas de segurança (diferenças em relação ao Baileys)

- **MAC antes de decifrar**: o Baileys decifra em streaming e descarta os 10 bytes de MAC sem
  verificá-los. Aqui o HMAC é verificado com `timingSafeEqual` antes de qualquer decifragem
  (`INVALID_MAC`); `fileEncSha256`/`fileSha256` são conferidos quando vêm bem formados (`HASH_MISMATCH`).
- **Allow-list de hosts (anti-SSRF)**: só `https://*.whatsapp.net` (porta padrão, sem credenciais).
  `url`/`directPath` vêm do payload e nunca escolhem outro host; redirects são seguidos manualmente
  (máx. 3) e cada destino é revalidado (`HOST_NOT_ALLOWED`).
- **Limites**: timeout total (padrão 15 s, `TIMEOUT`) e tamanho máximo (padrão 64 MiB, `TOO_LARGE`),
  checado no `Content-Length` e durante o streaming. O serviço lê `WHATSAPP_MEDIA_MAX_BYTES`.
  O Baileys não tinha timeout no caminho `downloadMediaMessage` nem limite de tamanho.
- **Validação de entrada**: chave de mídia com exatamente 32 bytes, `encIv` com 12, `pollEncKey`
  com 32, tag GCM de 16 bytes (`authTagLength` fixo) — `INVALID_INPUT` antes de qualquer rede.
- **Sem vazamento de segredo**: mensagens e `details` de `WhatsAppCryptoError` só carregam nomes de
  campo, tamanhos, host e status HTTP; nada de chave, IV, plaintext ou ciphertext. O módulo não loga.

Códigos de `WhatsAppCryptoError`: `INVALID_INPUT`, `INVALID_MAC`, `DECRYPT_FAILED`,
`HASH_MISMATCH`, `MALFORMED_PROTOBUF`, `HOST_NOT_ALLOWED`, `TOO_LARGE`, `TIMEOUT`, `DOWNLOAD_FAILED`.

## Testes

- `__tests__/fixtures/whatsapp-crypto-vectors.json`: vetores fixos (54 derivações de chave, 33
  mídias cobrindo os 18 tipos, 40 votos — 10 com campos protobuf desconhecidos) gerados com
  `node:crypto` e verificados byte a byte contra o `@whiskeysockets/baileys@6.7.8` antes da remoção.
- `whatsapp-crypto.spec.ts`: vetores, adulteração byte a byte, ordem MAC→decifragem, hashes,
  leitor protobuf (casos malformados + fuzz).
- `media-download.spec.ts`: servidor HTTP local no lugar do CDN (allow-list injetável via
  `allowUrl`/`mediaOrigin`), redirects, timeout, cancelamento, limites de tamanho.
- `test-utils.ts`: cifradores de teste escritos direto da especificação (também usados pelos specs
  de `media-downloader`, `poll-choice-service` e `poll-update-normalizer`).

## Como adicionar um tipo de mídia

1. Adicione a entrada em `MEDIA_HKDF_KEY_MAPPING` (`media.ts`) com o rótulo exato usado pelo
   WhatsApp (`WhatsApp <Rótulo> Keys`); o tipo `WhatsAppMediaType` deriva dessa tabela.
2. Adicione o mesmo par em `MEDIA_INFO` de `__tests__/test-utils.ts` e um vetor em
   `fixtures/whatsapp-crypto-vectors.json` (`mediaKeys` e `media`) — o teste "covers every media
   type" falha enquanto o vetor não existir. Se possível, gere o vetor a partir de uma mídia real
   (chave + arquivo `.enc` do CDN) ou de outra implementação independente.
3. Se a mensagem usar uma chave `<tipo>Message` nova, `resolveDownloadableMedia` já a mapeia
   (`<tipo>Message` → `<tipo>`); para o caminho por `mediaType` normalizado (IMAGE, VIDEO…), ajuste
   `CDN_MEDIA_TYPE_BY_MESSAGE` em `media-downloader.ts`.
