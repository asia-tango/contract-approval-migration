import { ProtocolNumberStorage } from './protocol-number-storage';

describe('ProtocolNumberStorage', () => {
  const storage = new ProtocolNumberStorage();

  beforeEach(() => sessionStorage.clear());

  it('повертає номер лише для тієї самої заявки', () => {
    storage.save(7, 900, 'ПЗ-2026/014');
    expect(storage.read(7, 900)).toBe('ПЗ-2026/014');
    expect(storage.read(7, 901)).toBeNull();
    expect(storage.read(7, null)).toBeNull();
  });

  it('записи договорів окремі; запису немає — null', () => {
    storage.save(7, 900, 'ПЗ-2026/014');
    expect(storage.read(8, 900)).toBeNull();
  });
});
