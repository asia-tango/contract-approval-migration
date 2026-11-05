import { VALIDATION_MESSAGES, amountError, commentError, protocolNumberError } from './validation';

describe('validation', () => {
  it('amountError: кома або крапка, до 2 знаків, більше 0', () => {
    expect(amountError('12,5')).toBeNull();
    expect(amountError('12.50')).toBeNull();
    expect(amountError('10,123')).toBe(VALIDATION_MESSAGES.amountFormat);
    expect(amountError('0')).toBe(VALIDATION_MESSAGES.amountPositive);
  });

  it('commentError: для комітету — від 20 символів після trim', () => {
    expect(commentError('а'.repeat(19), 'COMMITTEE')).toBe(VALIDATION_MESSAGES.commentForCommittee);
    expect(commentError('а'.repeat(20), 'COMMITTEE')).toBeNull();
    expect(commentError(' '.repeat(20), 'COMMITTEE')).toBe(VALIDATION_MESSAGES.commentForCommittee);
    expect(commentError('', 'STANDARD')).toBeNull();
  });

  it('protocolNumberError: для комітету — обов\'язковий, формат ПЗ-РРРР/NNN', () => {
    expect(protocolNumberError('ПЗ-2026/014', 'COMMITTEE')).toBeNull();
    expect(protocolNumberError('  ПЗ-2026/014 ', 'COMMITTEE')).toBeNull();
    expect(protocolNumberError('', 'COMMITTEE')).toBe(VALIDATION_MESSAGES.protocolRequired);
    expect(protocolNumberError('   ', 'COMMITTEE')).toBe(VALIDATION_MESSAGES.protocolRequired);
    for (const wrong of ['ПЗ-26/014', 'ПЗ-2026/14', 'ПЗ-2026/0144', 'пз-2026/014', 'PZ-2026/014', 'ПЗ2026/014']) {
      expect(protocolNumberError(wrong, 'COMMITTEE')).toBe(VALIDATION_MESSAGES.protocolFormat);
    }
  });

  it('protocolNumberError: не для комітету або маршрут невідомий — правило не діє', () => {
    expect(protocolNumberError('', 'STANDARD')).toBeNull();
    expect(protocolNumberError('неправильний', 'STANDARD')).toBeNull();
    expect(protocolNumberError('', null)).toBeNull();
  });
});
