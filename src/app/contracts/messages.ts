import { ContractStatus } from './models';

export const STATUS_LABELS: Record<ContractStatus, string> = {
  DRAFT: 'Чернетка',
  ON_APPROVAL: 'На погодженні',
  APPROVED: 'Погоджено',
  REJECTED: 'Відхилено',
};
