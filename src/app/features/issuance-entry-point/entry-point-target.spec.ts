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

  it('devuelve un handler que navega cuando el destino está configurado', async () => {
    environment.entryPointTargetWithValidation = 'https://validacion.example/start';
    const handler = resolveEntryPointTarget('WITH_VALIDATION');

    await handler({});

    expect(assignSpy).toHaveBeenCalledTimes(1);
    expect(assignSpy).toHaveBeenCalledWith('https://validacion.example/start');
  });

  it('devuelve un no-op determinista (sin lanzar, sin navegar) cuando el destino no está configurado', async () => {
    environment.entryPointTargetDirect = '';
    const handler = resolveEntryPointTarget('DIRECT');

    await expect(handler({})).resolves.toBeUndefined();
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it('el destino ausente de una rama no afecta a la otra (aislamiento por punto de entrada)', async () => {
    environment.entryPointTargetWithValidation = '';
    environment.entryPointTargetDirect = 'https://directo.example/start';

    await resolveEntryPointTarget('WITH_VALIDATION')({});
    expect(assignSpy).not.toHaveBeenCalled();

    await resolveEntryPointTarget('DIRECT')({});
    expect(assignSpy).toHaveBeenCalledTimes(1);
    expect(assignSpy).toHaveBeenCalledWith('https://directo.example/start');
  });
});
