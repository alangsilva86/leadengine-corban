import { memo, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { cn } from '@/lib/utils.js';

const ProviderSyncButton = ({ onSync, disabled, isSyncing }) => {
  const handleClick = useCallback(() => {
    if (disabled) {
      return;
    }

    onSync?.();
  }, [disabled, onSync]);

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleClick} disabled={disabled}>
      <RefreshCw className={cn('mr-2 h-4 w-4', isSyncing ? 'animate-spin' : '')} />
      Sincronizar provedor
    </Button>
  );
};

export default memo(ProviderSyncButton);
