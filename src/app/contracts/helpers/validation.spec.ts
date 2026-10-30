import { VALIDATION_MESSAGES, amountError, commentError } from './validation';

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
});
