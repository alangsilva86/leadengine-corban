import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import ConversationArea from './components/ConversationArea/ConversationArea.jsx';
import FilterToolbar from './components/FilterToolbar/FilterToolbar.jsx';
import ManualConversationDialog from './components/ManualConversationDialog.jsx';
import InboxAppShell from './components/layout/InboxAppShell.jsx';
import QueueList from './components/QueueList/QueueList.jsx';
export const ChatCommandCenter = ({ currentUser, manualConversation, queueList, filterToolbar, conversationArea, }) => {
    return (_jsxs("div", { className: "flex flex-1 min-h-0 w-full", children: [manualConversation?.isAvailable ? (_jsx(ManualConversationDialog, { open: manualConversation.isOpen, onOpenChange: manualConversation.onOpenChange, onSubmit: manualConversation.onSubmit, onSuccess: manualConversation.onSuccess, isSubmitting: manualConversation.isPending, error: manualConversation.error })) : null, _jsx(InboxAppShell, { currentUser: currentUser, sidebar: _jsx(QueueList, { ...queueList }), toolbar: _jsx(FilterToolbar, { ...filterToolbar }), children: _jsx(ConversationArea, { ...conversationArea, currentUser: currentUser }) })] }));
};
export default ChatCommandCenter;
