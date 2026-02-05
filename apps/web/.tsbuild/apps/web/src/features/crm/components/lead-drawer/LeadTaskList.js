import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils.js';
const statusConfig = {
    pending: { label: 'Pendente', icon: Clock, className: 'text-amber-500' },
    completed: { label: 'Concluída', icon: CheckCircle, className: 'text-emerald-500' },
    overdue: { label: 'Atrasada', icon: AlertTriangle, className: 'text-rose-500' },
};
const LeadTaskList = ({ tasks }) => {
    if (!tasks.length) {
        return _jsx("p", { className: "text-sm text-muted-foreground", children: "Nenhuma tarefa vinculada ao lead." });
    }
    return (_jsx("ul", { className: "space-y-2", children: tasks.map((task) => {
            const config = statusConfig[task.status];
            const Icon = config.icon;
            let dueLabel = 'Sem prazo';
            try {
                dueLabel = format(new Date(task.dueDate), "dd 'de' MMMM", { locale: ptBR });
            }
            catch {
                dueLabel = task.dueDate;
            }
            return (_jsxs("li", { className: "flex items-start justify-between gap-4 rounded-lg border border-border/50 bg-background/60 p-3", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold text-foreground", children: task.title }), _jsxs("p", { className: "text-xs text-muted-foreground", children: ["Respons\u00E1vel: ", task.ownerName ?? 'Não atribuído'] })] }), _jsxs("div", { className: "flex flex-col items-end gap-1 text-right", children: [_jsxs("span", { className: "text-xs text-muted-foreground", children: ["Prazo: ", dueLabel] }), _jsxs("span", { className: cn('inline-flex items-center gap-1 text-xs font-medium', config.className), children: [_jsx(Icon, { className: "h-3.5 w-3.5" }), " ", config.label] })] })] }, task.id));
        }) }));
};
export default LeadTaskList;
