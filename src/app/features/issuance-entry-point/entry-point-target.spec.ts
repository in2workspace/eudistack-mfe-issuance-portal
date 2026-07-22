import { environment } from '../../../environments/environment';
import {
  entryPointNavigation,
  resolveEntryPointTarget,
} from './entry-point-target';

describe('resolveEntryPointTarget (EC-02)', () => {
  let assignSpy: jest.SpyInstance;
  const originalWithValidation = environment.entryPointTargetWithValidation;
  const originalDirect = environment.entryPointTargetDirect;

  beforeEach(() => {
    assignSpy = jest
      .spyOn(entryPointNavigation, 'assign')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    assignSpy.mockRestore();
    environment.entryPointTargetWithValidation = originalWithValidation;
    environment.entryPointTargetDirect = originalDirect;
  });

  it('returns a handler that navigates when the target is configured', async () => {
    environment.entryPointTargetWithValidation = 'https://validacion.example/start';
    const handler = resolveEntryPointTarget('WITH_VALIDATION');

    await handler({});

    expect(assignSpy).toHaveBeenCalledTimes(1);
    expect(assignSpy).toHaveBeenCalledWith('https://validacion.example/start');
  });

  it('returns a deterministic no-op (no throw, no navigation) when the target is not configured', async () => {
    environment.entryPointTargetDirect = '';
    const handler = resolveEntryPointTarget('DIRECT');

    await expect(handler({})).resolves.toBeUndefined();
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it('a missing target on one branch does not affect the other (per-entry-point isolation)', async () => {
    environment.entryPointTargetWithValidation = '';
    environment.entryPointTargetDirect = 'https://directo.example/start';

    await resolveEntryPointTarget('WITH_VALIDATION')({});
    expect(assignSpy).not.toHaveBeenCalled();

    await resolveEntryPointTarget('DIRECT')({});
    expect(assignSpy).toHaveBeenCalledTimes(1);
    expect(assignSpy).toHaveBeenCalledWith('https://directo.example/start');
  });
});
