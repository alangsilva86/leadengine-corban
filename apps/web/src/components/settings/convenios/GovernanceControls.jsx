import { UserCircle } from 'lucide-react';
import { CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Switch } from '@/components/ui/switch.jsx';
import { ROLE_OPTIONS } from '@/features/agreements/convenioSettings.constants.ts';

const GovernanceControls = ({ role, onRoleChange, requireApproval, onRequireApprovalChange }) => (
  <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
    <div className="space-y-2">
      <CardTitle>Convênios &amp; Tabelas</CardTitle>
      <CardDescription>
        Gestão comercial sem falar em coeficiente. Configure convênios, janelas e taxas e deixe o motor calcular.
      </CardDescription>
    </div>
    <div className="flex flex-col gap-3 md:flex-row md:items-center">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <UserCircle className="h-4 w-4" /> Perfil
      </div>
      <Select value={role} onValueChange={onRoleChange}>
        <SelectTrigger className="w-full min-w-[200px] md:w-[240px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ROLE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Switch checked={requireApproval} onCheckedChange={onRequireApprovalChange} />
        Exigir aprovação para publicar alterações
      </div>
    </div>
  </CardHeader>
);

export default GovernanceControls;
