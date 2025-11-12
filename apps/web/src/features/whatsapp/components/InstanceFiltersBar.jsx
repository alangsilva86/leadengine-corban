import { Input } from '@/components/ui/input.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Search } from 'lucide-react';

const InstanceFiltersBar = ({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  statusOptions,
  healthFilter,
  onHealthFilterChange,
  healthOptions,
  providerFilter,
  onProviderFilterChange,
  providerOptions,
  sortBy,
  onSortByChange,
  sortOptions,
  activeInstances,
  totalInstances,
}) => {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-1 flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Buscar instância por nome ou telefone"
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={healthFilter} onValueChange={onHealthFilterChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Saúde" />
          </SelectTrigger>
          <SelectContent>
            {healthOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={providerFilter} onValueChange={onProviderFilterChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Provedor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os provedores</SelectItem>
            {providerOptions.map((provider) => (
              <SelectItem key={provider} value={provider}>
                {provider}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-3">
        <Select value={sortBy} onValueChange={onSortByChange}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Ordenar por" />
          </SelectTrigger>
          <SelectContent>
            {sortOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="outline" className="px-3 py-1 text-[0.65rem] uppercase tracking-wide text-muted-foreground">
          {activeInstances} de {totalInstances} exibidas
        </Badge>
      </div>
    </div>
  );
};

export default InstanceFiltersBar;
