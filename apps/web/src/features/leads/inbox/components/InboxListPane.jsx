import { forwardRef } from 'react';
import { AlertCircle } from 'lucide-react';

import GlobalFiltersBar from './GlobalFiltersBar.jsx';
import InboxList from './InboxList.jsx';
import NoticeBanner from '@/components/ui/notice-banner.jsx';

const InboxListPane = forwardRef(
  (
    {
      filters,
      onUpdateFilters,
      onResetFilters,
      queueOptions,
      windowOptions,
      savedViews,
      activeViewId,
      onSelectSavedView,
      onSaveCurrentView,
      onDeleteSavedView,
      canSaveView,
      viewLimit,
      listProps,
      registerScrollViewport,
      scrollParent,
      notices,
    },
    listRef
  ) => {
    const {
      showRealtimeConnecting,
      showRealtimeError,
      showErrorNotice,
      showWarningNotice,
      connectionError,
      error,
      warningMessage,
    } = notices;

    const hasNotices =
      showRealtimeConnecting || showRealtimeError || showErrorNotice || showWarningNotice;

    return (
      <>
        <div className="flex-shrink-0 border-b border-[color:var(--color-inbox-border)] px-5 py-5">
          <GlobalFiltersBar
            filters={filters}
            onUpdateFilters={onUpdateFilters}
            onResetFilters={onResetFilters}
            queueOptions={queueOptions}
            windowOptions={windowOptions}
            savedViews={savedViews}
            activeViewId={activeViewId}
            onSelectSavedView={onSelectSavedView}
            onSaveCurrentView={onSaveCurrentView}
            onDeleteSavedView={onDeleteSavedView}
            canSaveView={canSaveView}
            viewLimit={viewLimit}
          />
        </div>

        <div className="flex-1 min-h-0">
          <div
            ref={registerScrollViewport}
            className="h-full overflow-y-auto overscroll-contain [scrollbar-gutter:stable]"
            style={{ WebkitOverflowScrolling: 'touch', contain: 'content' }}
          >
            <div className="space-y-5 px-5 pb-6 pr-6 pt-5">
              <InboxList
                ref={listRef}
                scrollParent={scrollParent}
                {...listProps}
              />

              {hasNotices ? (
                <div className="space-y-3 text-sm">
                  {showRealtimeConnecting ? (
                    <NoticeBanner tone="info" className="rounded-2xl">
                      Conectando ao tempo real para receber novos leads automaticamente…
                    </NoticeBanner>
                  ) : null}

                  {showRealtimeError ? (
                    <NoticeBanner
                      tone="warning"
                      icon={<AlertCircle className="h-4 w-4" />}
                      className="rounded-2xl"
                    >
                      Tempo real indisponível: {connectionError}. Continuamos monitorando via atualização automática.
                    </NoticeBanner>
                  ) : null}

                  {showErrorNotice ? (
                    <NoticeBanner
                      tone="error"
                      icon={<AlertCircle className="h-4 w-4" />}
                      className="rounded-2xl"
                    >
                      {error}
                    </NoticeBanner>
                  ) : null}

                  {showWarningNotice ? (
                    <NoticeBanner
                      tone="warning"
                      icon={<AlertCircle className="h-4 w-4" />}
                      className="rounded-2xl"
                    >
                      {warningMessage}
                    </NoticeBanner>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </>
    );
  }
);

InboxListPane.displayName = 'InboxListPane';

export default InboxListPane;
