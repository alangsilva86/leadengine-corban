import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';
const formatDueDate = (value) => {
    if (!value) {
        return 'Sem prazo definido';
    }
    try {
        return format(new Date(value), 'dd/MM/yyyy HH:mm');
    }
    catch {
        return 'Sem prazo definido';
    }
};
const ContactTasks = ({ tasks = [], onCreateTask, onCompleteTask, isCreating = false, isCompleting = false }) => {
    const [description, setDescription] = useState('');
    const [dueDate, setDueDate] = useState('');
    const handleCreate = (event) => {
        event.preventDefault();
        if (!description.trim()) {
            return;
        }
        onCreateTask?.({ description, dueDate: dueDate || null });
        setDescription('');
        setDueDate('');
    };
    return (_jsxs(Card, { className: "h-full", children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Tarefas" }) }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("form", { className: "flex flex-col gap-3 rounded-lg border border-dashed border-border/60 p-3", onSubmit: handleCreate, children: [_jsx(Input, { value: description, onChange: (event) => setDescription(event.target.value), placeholder: "Descreva a tarefa" }), _jsx(Input, { type: "datetime-local", value: dueDate, onChange: (event) => setDueDate(event.target.value), "aria-label": "Data de vencimento" }), _jsx(Button, { type: "submit", size: "sm", disabled: isCreating || !description.trim(), children: isCreating ? 'Criando…' : 'Adicionar tarefa' })] }), _jsxs("div", { className: "space-y-3", children: [tasks.length === 0 ? (_jsx("p", { className: "text-sm text-muted-foreground", children: "Nenhuma tarefa atribu\u00EDda para este contato." })) : null, tasks.map((task) => (_jsxs("div", { className: "flex items-start justify-between gap-3 rounded-lg border border-border/60 p-3 text-sm", children: [_jsxs("div", { className: "flex flex-1 items-start gap-3", children: [_jsx(Checkbox, { checked: task.status === 'done', onCheckedChange: () => onCompleteTask?.(task), disabled: task.status === 'done' || isCompleting, "aria-label": "Concluir tarefa", className: "mt-1" }), _jsxs("div", { className: "space-y-1", children: [_jsx("p", { className: "font-medium text-foreground", children: task.description }), _jsx("p", { className: "text-xs text-muted-foreground", children: formatDueDate(task.dueDate) })] })] }), _jsx("span", { className: "text-xs uppercase tracking-wide text-muted-foreground", children: task.status ?? 'pendente' })] }, task.id)))] })] })] }));
};
export default ContactTasks;
