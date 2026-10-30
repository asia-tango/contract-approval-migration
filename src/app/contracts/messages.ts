import { ContractStatus } from './models';

export const STATUS_LABELS: Record<ContractStatus, string> = {
  DRAFT: 'Чернетка',
  ON_APPROVAL: 'На погодженні',
  APPROVED: 'Погоджено',
  REJECTED: 'Відхилено',
};

export const LIST_MESSAGES = {
  loadError: 'Не вдалося оновити список. Показано попередні дані',
};

export const CARD_MESSAGES = {
  loadError: 'Не вдалося завантажити договір',
  meError: 'Не вдалося завантажити дані користувача. Поки що договір відкрито лише для перегляду',
  noRights: 'У вас немає права редагувати договори. Договір відкрито лише для перегляду',
  ratesUnavailable:
    'Не вдалося отримати курс НБУ на дату підписання. Еквівалент і маршрут погодження не розраховано, надсилання недоступне',
  committee: 'Потрібне погодження тендерного комітету',
};
