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

  return (
    <div className="inline-flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Tenant</span>
      <Input
        value={value}
        onChange={(e) => apply(e.target.value.trim())}
        placeholder="ex.: demo-tenant"
        className="h-8 w-36 text-xs"
      />
    </div>
  );
}
