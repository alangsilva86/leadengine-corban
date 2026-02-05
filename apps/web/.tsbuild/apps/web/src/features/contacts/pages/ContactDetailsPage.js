import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Share2, GitMerge } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import ContactSummary from '../components/ContactSummary.jsx';
import ContactTimeline from '../components/ContactTimeline.jsx';
import ContactTasks from '../components/ContactTasks.jsx';
import InteractionComposer from '../components/InteractionComposer.jsx';
import ContactQuickEditDrawer from '../components/ContactQuickEditDrawer.jsx';
import ContactDataView from '../components/ContactDataView.jsx';
import useContactsLiveUpdates from '../hooks/useContactsLiveUpdates.js';
import { useContactDeduplicateMutation, useContactDetailsQuery, useContactInteractionMutation, useContactTaskMutation, useContactTasksQuery, useContactTimelineQuery, useTriggerWhatsAppMutation, useUpdateContactMutation, } from '../hooks/useContactsApi.js';
const ContactDetailsPage = () => {
    const { contactId } = useParams();
    const navigate = useNavigate();
    const [isDrawerOpen, setDrawerOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('summary');
    const detailsQuery = useContactDetailsQuery(contactId);
    const timelineQuery = useContactTimelineQuery(contactId);
    const tasksQuery = useContactTasksQuery(contactId);
    const updateMutation = useUpdateContactMutation(contactId);
    const interactionMutation = useContactInteractionMutation(contactId);
    const { createTask, completeTask } = useContactTaskMutation(contactId);
    const whatsappMutation = useTriggerWhatsAppMutation(contactId);
    const dedupeMutation = useContactDeduplicateMutation(contactId);
    useContactsLiveUpdates({ contactId, enabled: Boolean(contactId) });
    const contact = detailsQuery.data;
    const timelineItems = timelineQuery.data ?? [];
    const tasks = tasksQuery.data ?? [];
    const handleUpdateContact = (payload) => {
        updateMutation.mutate(payload, {
            onSuccess: () => {
                toast.success('Contato atualizado com sucesso.');
                setDrawerOpen(false);
            },
            onError: (error) => {
                toast.error(error?.message ?? 'Não foi possível atualizar o contato.');
            },
        });
    };
    const handleRegisterInteraction = (payload) => {
        interactionMutation.mutate(payload, {
            onSuccess: () => {
                toast.success('Interação registrada na timeline.');
            },
            onError: (error) => {
                toast.error(error?.message ?? 'Falha ao registrar interação.');
            },
        });
    };
    const handleCreateTask = (payload) => {
        createTask.mutate(payload, {
            onSuccess: () => {
                toast.success('Tarefa criada.');
            },
            onError: (error) => {
                toast.error(error?.message ?? 'Não foi possível criar a tarefa.');
            },
        });
    };
    const handleCompleteTask = (task) => {
        if (!task?.id) {
            return;
        }
        completeTask.mutate({ taskId: task.id, payload: { status: 'done' } }, {
            onSuccess: () => {
                toast.success('Tarefa concluída.');
            },
            onError: (error) => {
                toast.error(error?.message ?? 'Falha ao concluir tarefa.');
            },
        });
    };
    const handleTriggerWhatsapp = () => {
        whatsappMutation.mutate({ template: 'default' }, {
            onSuccess: () => {
                toast.success('Disparo de WhatsApp iniciado.');
            },
            onError: (error) => {
                toast.error(error?.message ?? 'Não foi possível iniciar o disparo.');
            },
        });
    };
    const handleDeduplicate = () => {
        dedupeMutation.mutate({ targetContactId: contactId }, {
            onSuccess: () => {
                toast.success('Processo de deduplicação iniciado.');
            },
            onError: (error) => {
                toast.error(error?.message ?? 'Falha ao iniciar deduplicação.');
            },
        });
    };
    return (_jsxs("div", { className: "flex h-full min-h-0 flex-col gap-6", children: [_jsxs("div", { className: "flex flex-col gap-4", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx(Button, { type: "button", variant: "ghost", size: "icon", onClick: () => navigate(-1), "aria-label": "Voltar", children: _jsx(ArrowLeft, { className: "h-4 w-4" }) }), _jsxs("div", { className: "flex flex-1 flex-col", children: [_jsx("h1", { className: "text-2xl font-semibold", children: contact?.name ?? 'Contato' }), _jsx("span", { className: "text-sm text-muted-foreground", children: contact?.email ?? contact?.phone ?? 'sem dados adicionais' })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs(Button, { type: "button", variant: "outline", onClick: () => setDrawerOpen(true), children: [_jsx(Pencil, { className: "h-4 w-4" }), " Editar"] }), _jsxs(Button, { type: "button", variant: "outline", onClick: handleTriggerWhatsapp, disabled: whatsappMutation.isPending, children: [_jsx(Share2, { className: "h-4 w-4" }), " WhatsApp"] }), _jsxs(Button, { type: "button", variant: "secondary", onClick: handleDeduplicate, disabled: dedupeMutation.isPending, children: [_jsx(GitMerge, { className: "h-4 w-4" }), " Deduplicar"] })] })] }), _jsxs(Tabs, { value: activeTab, onValueChange: setActiveTab, className: "flex h-full flex-col", children: [_jsxs(TabsList, { children: [_jsx(TabsTrigger, { value: "summary", children: "Resumo" }), _jsx(TabsTrigger, { value: "timeline", children: "Timeline" }), _jsx(TabsTrigger, { value: "data", children: "Dados" }), _jsx(TabsTrigger, { value: "tasks", children: "Tarefas" })] }), _jsxs(TabsContent, { value: "summary", className: "flex flex-1 flex-col gap-4 pt-4", children: [_jsx(ContactSummary, { contact: contact }), _jsx(InteractionComposer, { onSubmit: handleRegisterInteraction, isSubmitting: interactionMutation.isPending })] }), _jsx(TabsContent, { value: "timeline", className: "flex-1 pt-4", children: _jsx(ContactTimeline, { items: timelineItems }) }), _jsx(TabsContent, { value: "data", className: "flex-1 pt-4", children: _jsx(ContactDataView, { contact: contact }) }), _jsx(TabsContent, { value: "tasks", className: "flex-1 pt-4", children: _jsx(ContactTasks, { tasks: tasks, onCreateTask: handleCreateTask, onCompleteTask: handleCompleteTask, isCreating: createTask.isPending, isCompleting: completeTask.isPending }) })] })] }), _jsx(ContactQuickEditDrawer, { open: isDrawerOpen, onOpenChange: setDrawerOpen, contact: contact, onSubmit: handleUpdateContact })] }));
};
export default ContactDetailsPage;
