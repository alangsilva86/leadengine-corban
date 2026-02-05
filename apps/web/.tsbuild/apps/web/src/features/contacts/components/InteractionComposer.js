import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
const InteractionComposer = ({ onSubmit, isSubmitting = false }) => {
    const [message, setMessage] = useState('');
    const handleSubmit = (event) => {
        event.preventDefault();
        if (!message.trim()) {
            return;
        }
        onSubmit?.({ message: message.trim() });
        setMessage('');
    };
    return (_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Registrar intera\u00E7\u00E3o" }) }), _jsx(CardContent, { children: _jsxs("form", { className: "space-y-3", onSubmit: handleSubmit, children: [_jsx(Textarea, { value: message, onChange: (event) => setMessage(event.target.value), rows: 4, placeholder: "Resuma a intera\u00E7\u00E3o realizada com o contato" }), _jsx("div", { className: "flex justify-end", children: _jsx(Button, { type: "submit", disabled: isSubmitting || !message.trim(), children: isSubmitting ? 'Registrando…' : 'Adicionar à timeline' }) })] }) })] }));
};
export default InteractionComposer;
