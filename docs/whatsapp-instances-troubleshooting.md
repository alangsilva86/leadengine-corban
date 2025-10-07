# WhatsApp instance troubleshooting & broker routes

This note summarises what we see in the platform logs when operators try to
list or create WhatsApp instances and provides the HTTP paths that the API and
the external Baileys broker expect.

## API error surface

- The dashboard triggers `GET /api/integrations/whatsapp/instances` whenever the
  modal is opened. The backend logs an entry similar to `🛰️ [WhatsApp] List
  instances requested` and echoes the tenant, agreement filter and whether a
  refresh was forced.
- When creation fails the UI reports `Internal server error`. In this code path
  the API first normalises the slug, appends a history entry and persists a
  `whatsapp_instances` row; any Prisma/storage failure is caught and translated
  into structured errors (503 with code `WHATSAPP_STORAGE_UNAVAILABLE`, 409 for
  duplicates, 400 for malformed payloads).
- If the broker itself is missing configuration (`WHATSAPP_MODE=http`,
  `BROKER_BASE_URL`, `BROKER_API_KEY`) the route short-circuits with
  `WHATSAPP_NOT_CONFIGURED`, so a raw 500 normally indicates an unhandled error
  earlier in the stack or a missing migration/logged Prisma failure. Check the
  Render service logs around the `WhatsApp instance creation failed due to
  storage error` message for the exact Prisma code.

## Broker helper routes

The Baileys proxy currently exposed at
`https://baileys-acessuswpp.onrender.com/instances` accepts simple JSON payloads
for manual validation:

```http
GET /instances               # Lists available sessions (status + counters)
POST /instances              # Creates a new session (id + name)
```

Typical responses observed during debugging:

```json
[
  {
    "id": "41acessusvox",
    "name": "41acessusvox",
    "connected": true,
    "user": {
      "id": "554123912160:18@s.whatsapp.net",
      "name": "Acessus Serviços Financeiros"
    }
  }
]
```

```json
{
  "id": "teste",
  "name": "teste",
  "dir": "sessions/teste",
  "metadata": {
    "createdAt": "2025-10-06T23:56:21.787Z"
  }
}
```

Remember to pass the `x-api-key` header that matches `WHATSAPP_BROKER_API_KEY`
when invoking the broker directly. The LeadEngine API reuses the same secret via
`WhatsAppBrokerClient`, so mismatched keys or disabled HTTP mode lead to the
configuration error mentioned above.
