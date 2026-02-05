import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input.jsx';
import { getTenantId, onTenantIdChange, setTenantId } from '@/lib/auth.js';
export default function TenantSelector({ onChange }) {
    const [value, setValue] = useState(() => getTenantId() || '');
    useEffect(() => {
        const unsubscribe = onTenantIdChange((nextTenant) => {
            setValue(nextTenant || '');
        });
        return () => unsubscribe();
    }, []);
    const apply = (next) => {
        setValue(next);
        const applied = next || undefined;
        setTenantId(applied);
        onChange?.(applied);
    };
    return (_jsxs("div", { className: "inline-flex items-center gap-2", children: [_jsx("span", { className: "text-xs text-muted-foreground", children: "Tenant" }), _jsx(Input, { value: value, onChange: (e) => apply(e.target.value.trim()), placeholder: "ex.: demo-tenant", className: "h-8 w-36 text-xs" })] }));
}
