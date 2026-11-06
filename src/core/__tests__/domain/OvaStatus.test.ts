import {
  DEFAULT_OVA_STATUS,
  isActiveStatus,
  isOvaStatus,
  OVA_STATUSES,
} from '../../domain/OvaStatus';

describe('OvaStatus', () => {
  it('define los tres estados del ciclo en orden', () => {
    expect(OVA_STATUSES).toEqual(['development', 'review', 'delivered']);
  });

  it('toda OVA nace en desarrollo', () => {
    expect(DEFAULT_OVA_STATUS).toBe('development');
  });

  it.each(OVA_STATUSES)('reconoce "%s" como estado válido', (status) => {
    expect(isOvaStatus(status)).toBe(true);
  });

  it.each(['', 'Development', 'done', 1, null, undefined])('rechaza %p', (value) => {
    expect(isOvaStatus(value)).toBe(false);
  });

  it('solo las entregadas dejan de requerir seguimiento', () => {
    expect(isActiveStatus('development')).toBe(true);
    expect(isActiveStatus('review')).toBe(true);
    expect(isActiveStatus('delivered')).toBe(false);
  });
});
