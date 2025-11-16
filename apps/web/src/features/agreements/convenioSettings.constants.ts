export const ROLE_OPTIONS = [
  { value: 'admin', label: 'Gestor / Admin' },
  { value: 'coordinator', label: 'Coordenador' },
  { value: 'seller', label: 'Vendedor (só leitura)' },
] as const;

export const STATUS_OPTIONS = [
  { value: 'EM_IMPLANTACAO', label: 'Em implantação' },
  { value: 'ATIVO', label: 'Ativo' },
  { value: 'PAUSADO', label: 'Pausado' },
  { value: 'ENCERRADO', label: 'Encerrado' },
] as const;

export const TYPE_OPTIONS = [
  { value: 'MUNICIPAL', label: 'Municipal' },
  { value: 'ESTADUAL', label: 'Estadual' },
  { value: 'FEDERAL', label: 'Federal' },
] as const;

export const PRODUCT_OPTIONS = [
  'Cartão benefício – Saque',
  'Cartão benefício – Compra',
  'Consignado tradicional',
  'Outros',
] as const;

export const MODALITIES = [
  { value: 'NORMAL', label: 'Normal' },
  { value: 'FLEX1', label: 'Flex 1' },
  { value: 'FLEX2', label: 'Flex 2' },
] as const;
