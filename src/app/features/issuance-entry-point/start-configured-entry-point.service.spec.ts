import { TestBed } from '@angular/core/testing';
import type {
  EntryPointHandler,
  EntryPointHandlerContext,
} from './entry-point-target';
import type { IssuanceEntryPoint } from './issuance-entry-point';
import { StartConfiguredEntryPointService } from './start-configured-entry-point.service';

function spyResolver(handlers: Record<IssuanceEntryPoint, EntryPointHandler>) {
  const withValidation = jest.fn(handlers.WITH_VALIDATION);
  const direct = jest.fn(handlers.DIRECT);
  const resolveTarget = (ep: IssuanceEntryPoint): EntryPointHandler =>
    ep === 'WITH_VALIDATION' ? withValidation : direct;
  return { withValidation, direct, resolveTarget };
}

const noop: EntryPointHandler = async () => {};

describe('StartConfiguredEntryPointService', () => {
  let service: StartConfiguredEntryPointService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [StartConfiguredEntryPointService],
    });
    service = TestBed.inject(StartConfiguredEntryPointService);
  });

  describe('camino feliz (AC-01, AC-02, EC-03)', () => {
    it('AC-01: WITH_VALIDATION invoca el handler de validación previa y no el directo', async () => {
      const { withValidation, direct, resolveTarget } = spyResolver({
        WITH_VALIDATION: noop,
        DIRECT: noop,
      });

      const result = await service.start('WITH_VALIDATION', { resolveTarget });

      expect(result).toEqual({ ok: true });
      expect(withValidation).toHaveBeenCalledTimes(1);
      expect(direct).not.toHaveBeenCalled();
    });

    it('AC-02: DIRECT invoca el handler directo y no el de validación previa', async () => {
      const { withValidation, direct, resolveTarget } = spyResolver({
        WITH_VALIDATION: noop,
        DIRECT: noop,
      });

      const result = await service.start('DIRECT', { resolveTarget });

      expect(result).toEqual({ ok: true });
      expect(direct).toHaveBeenCalledTimes(1);
      expect(withValidation).not.toHaveBeenCalled();
    });

    it('EC-03: si el destino de validación previa es un no-op, la selección se mantiene y no colapsa a directo', async () => {
      const { withValidation, direct, resolveTarget } = spyResolver({
        WITH_VALIDATION: noop,
        DIRECT: noop,
      });

      const result = await service.start('WITH_VALIDATION', { resolveTarget });

      expect(result).toEqual({ ok: true });
      expect(withValidation).toHaveBeenCalledTimes(1);
      expect(direct).not.toHaveBeenCalled();
    });
  });

  describe('enforcement FR-06 y fallos (AC-04, ES-04, ES-05)', () => {
    it('AC-04: solo se invoca el handler del entryPoint configurado, nunca el otro (ambos con spy)', async () => {
      const first = spyResolver({ WITH_VALIDATION: noop, DIRECT: noop });
      await service.start('WITH_VALIDATION', { resolveTarget: first.resolveTarget });
      expect(first.withValidation).toHaveBeenCalledTimes(1);
      expect(first.direct).not.toHaveBeenCalled();

      const second = spyResolver({ WITH_VALIDATION: noop, DIRECT: noop });
      await service.start('DIRECT', { resolveTarget: second.resolveTarget });
      expect(second.direct).toHaveBeenCalledTimes(1);
      expect(second.withValidation).not.toHaveBeenCalled();
    });

    it('ES-04: el proceso aguas abajo falla al iniciarse → handler_failed, sin arrancar la otra rama', async () => {
      const failing: EntryPointHandler = async () => {
        throw new Error('downstream down');
      };
      const { withValidation, direct, resolveTarget } = spyResolver({
        WITH_VALIDATION: failing,
        DIRECT: noop,
      });

      const result = await service.start('WITH_VALIDATION', { resolveTarget });

      expect(result).toEqual({ ok: false, reason: 'handler_failed' });
      expect(withValidation).toHaveBeenCalledTimes(1);
      expect(direct).not.toHaveBeenCalled();
    });

    it('ES-05: la invocación excede el presupuesto de tiempo → timeout (fail-closed controlado)', async () => {
      const hangs: EntryPointHandler = (ctx: EntryPointHandlerContext) =>
        new Promise((_resolve, reject) => {
          ctx.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        });
      const { direct, resolveTarget } = spyResolver({
        WITH_VALIDATION: noop,
        DIRECT: hangs,
      });

      const result = await service.start('DIRECT', {
        resolveTarget,
        timeoutMs: 20,
      });

      expect(result).toEqual({ ok: false, reason: 'timeout' });
      expect(direct).toHaveBeenCalledTimes(1);
    });
  });
});
