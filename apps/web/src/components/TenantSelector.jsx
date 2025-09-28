import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input.jsx';

export default function TenantSelector({ onChange }) {
  const [value, setValue] = useState('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('tenantId');
      if (saved) setValue(saved);
    } catch (error) {
      console.debug('Não foi possível ler tenant salvo', error);
    }
  }, []);

  const apply = (next) => {
    setValue(next);
    try {
      if (next) localStorage.setItem('tenantId', next);
      else localStorage.removeItem('tenantId');
    } catch (error) {
      console.debug('Não foi possível atualizar tenant salvo', error);
    }
    onChange?.(next || undefined);
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
