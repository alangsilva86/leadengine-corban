import { memo, useCallback } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';

const AgreementImportButton = ({ onClick, disabled }) => {
  const handleClick = useCallback(() => {
    onClick?.();
  }, [onClick]);

  return (
    <Button type="button" variant="outline" onClick={handleClick} disabled={disabled}>
      <Upload className="mr-2 h-4 w-4" /> Importar planilha
    </Button>
  );
};

export default memo(AgreementImportButton);
