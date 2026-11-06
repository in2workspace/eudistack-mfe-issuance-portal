import { hasSupportDetails } from './support-details';

describe('hasSupportDetails', () => {
  it.each([{ email: 'soporte@tenant.example' }, { phone: '911 000 000' }, { schedule: 'L-V 8:00-15:00' }])(
    'is true with any contact detail (%o)',
    (support) => {
      expect(hasSupportDetails(support)).toBe(true);
    },
  );

  it.each([null, undefined, {}, { response_time: '48 horas' }, { email: '', phone: '', schedule: '' }])(
    'is false without a contact detail (%o)',
    (support) => {
      expect(hasSupportDetails(support)).toBe(false);
    },
  );
});
