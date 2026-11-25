import ConversationArea from './components/ConversationArea/ConversationArea.jsx';
import FilterToolbar from './components/FilterToolbar/FilterToolbar.jsx';
import ManualConversationDialog from './components/ManualConversationDialog.jsx';
import InboxAppShell from './components/layout/InboxAppShell.jsx';
import QueueList from './components/QueueList/QueueList.jsx';

export const ChatCommandCenter = ({
  currentUser,
  manualConversation,
  queueList,
  filterToolbar,
  conversationArea,
  hasSelection = false,
  onBackToList,
  connection = null,
}) => {
  return (
    <div className="flex min-h-0 w-full flex-1">
      {manualConversation?.isAvailable ? (
        <ManualConversationDialog
          open={manualConversation.isOpen}
          onOpenChange={manualConversation.onOpenChange}
          onSubmit={manualConversation.onSubmit}
          onSuccess={manualConversation.onSuccess}
          isSubmitting={manualConversation.isPending}
          error={manualConversation.error}
          defaultPhone={manualConversation.defaultPhone ?? ''}
        />
      ) : null}

      <InboxAppShell
        currentUser={currentUser}
        hasSelection={hasSelection}
        onBackToList={onBackToList}
        connection={connection}
        sidebar={<QueueList {...queueList} />}
        toolbar={<FilterToolbar {...filterToolbar} />}
      >
        <ConversationArea {...conversationArea} currentUser={currentUser} />
      </InboxAppShell>
    </div>
  );
};

export default ChatCommandCenter;
