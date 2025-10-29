# Web component inventory

This document captures the current surface of the web application under `apps/web/src` after pruning unused legacy inbox code.

## Entry points

- `apps/web/src/main.jsx` bootstraps React, configures the TanStack Query client, and renders the root `<App />` component inside the theme provider and toaster wrappers.
- `apps/web/src/App.jsx` wires the onboarding journey into the global layout and uses `React.Suspense` to load the active page lazily.
- The Vite application does not use Next.js style `pages/` or `app/` directories; navigation is handled by `useOnboardingJourney()`.

## Page components

The onboarding journey loads the following pages on demand:

1. `components/Dashboard.jsx`
2. `components/AgreementGrid.jsx`
3. `features/whatsapp/connect/index.tsx`
4. `features/chat/ChatCommandCenter.jsx`
5. `components/Reports.jsx`
6. `components/Settings.jsx`
7. `features/debug/BaileysLogs.jsx`
8. `features/debug/WhatsAppDebug.jsx`

## Shared UI widgets

The reusable UI building blocks live in `apps/web/src/components/ui/`:

- `accordion.jsx`
- `alert-dialog.jsx`
- `alert.jsx`
- `aspect-ratio.jsx`
- `avatar.jsx`
- `badge.jsx`
- `breadcrumb.jsx`
- `button-group.jsx`
- `button.jsx`
- `button.stories.jsx`
- `calendar.jsx`
- `card.jsx`
- `carousel.jsx`
- `chart.jsx`
- `checkbox.jsx`
- `collapsible.jsx`
- `command.jsx`
- `context-menu.jsx`
- `dialog.jsx`
- `drawer.jsx`
- `dropdown-menu.jsx`
- `form.jsx`
- `glass-panel.jsx`
- `glass-panel.stories.jsx`
- `hover-card.jsx`
- `input-otp.jsx`
- `input.jsx`
- `label.jsx`
- `menubar.jsx`
- `navigation-menu.jsx`
- `notice-banner.jsx`
- `pagination.jsx`
- `popover.jsx`
- `progress.jsx`
- `radio-group.jsx`
- `resizable.jsx`
- `scroll-area.jsx`
- `select.jsx`
- `separator.jsx`
- `sheet.jsx`
- `sidebar.jsx`
- `skeleton.jsx`
- `slider.jsx`
- `sonner.jsx`
- `status-pill.jsx`
- `status-pill.stories.jsx`
- `switch.jsx`
- `table.jsx`
- `tabs.jsx`
- `textarea.jsx`
- `toggle-group.jsx`
- `toggle.jsx`
- `tooltip.jsx`

## Hooks

Hooks shared across the application are grouped by feature. Tests and stories are excluded from the list.

### Global hooks (`apps/web/src/hooks`)

- `use-media-query.js`
- `use-mobile.js`
- `use-status-tone-classes.js`

### Feature hooks

- `components/dashboard/useDashboardData.ts`
- `features/agreements/useAgreements.js`
- `features/chat/api/useInboxLayoutPreferences.js`
- `features/chat/api/useMessagesQuery.js`
- `features/chat/api/useNotesMutation.js`
- `features/chat/api/useSendMessage.js`
- `features/chat/api/useTicketAssignMutation.js`
- `features/chat/api/useTicketStatusMutation.js`
- `features/chat/api/useTicketsQuery.js`
- `features/chat/api/useUpdateInboxLayoutPreferences.js`
- `features/chat/api/useWhatsAppLimits.js`
- `features/chat/hooks/useAiSuggestions.js`
- `features/chat/hooks/useChatAutoscroll.js`
- `features/chat/hooks/useChatController.js`
- `features/chat/hooks/useConversationState.js`
- `features/chat/hooks/useManualConversationLauncher.js`
- `features/chat/hooks/useRealtimeTickets.js`
- `features/chat/hooks/useTypingIndicator.js`
- `features/onboarding/useOnboardingJourney.js`
- `features/onboarding/useOnboardingStepLabel.js`
- `features/shared/usePlayfulLogger.js`
- `features/whatsapp/hooks/useInstanceLiveUpdates.js`
- `features/whatsapp/hooks/useQrImageSource.js`
- `features/whatsapp/hooks/useWhatsAppCampaigns.js`
- `features/whatsapp/hooks/useWhatsAppInstances.js`
