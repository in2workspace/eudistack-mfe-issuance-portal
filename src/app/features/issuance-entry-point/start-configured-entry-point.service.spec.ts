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

  describe('happy path', () => {
    it('WITH_VALIDATION invokes the prior-validation handler and not the direct one', async () => {
      const { withValidation, direct, resolveTarget } = spyResolver({
        WITH_VALIDATION: noop,
        DIRECT: noop,
      });

      const result = await service.start('WITH_VALIDATION', { resolveTarget });

      expect(result).toEqual({ ok: true });
      expect(withValidation).toHaveBeenCalledTimes(1);
      expect(direct).not.toHaveBeenCalled();
    });

    it('DIRECT invokes the direct handler and not the prior-validation one', async () => {
      const { withValidation, direct, resolveTarget } = spyResolver({
        WITH_VALIDATION: noop,
        DIRECT: noop,
      });

      const result = await service.start('DIRECT', { resolveTarget });

      expect(result).toEqual({ ok: true });
      expect(direct).toHaveBeenCalledTimes(1);
      expect(withValidation).not.toHaveBeenCalled();
    });

    it('when the prior-validation target is a no-op, the selection is kept and does not collapse to direct', async () => {
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

  describe('enforcement and failures (AC-04, ES-04, ES-05)', () => {
    it('only the configured entryPoint handler is invoked, never the other one (both spied)', async () => {
      const first = spyResolver({ WITH_VALIDATION: noop, DIRECT: noop });
      await service.start('WITH_VALIDATION', { resolveTarget: first.resolveTarget });
      expect(first.withValidation).toHaveBeenCalledTimes(1);
      expect(first.direct).not.toHaveBeenCalled();

      const second = spyResolver({ WITH_VALIDATION: noop, DIRECT: noop });
      await service.start('DIRECT', { resolveTarget: second.resolveTarget });
      expect(second.direct).toHaveBeenCalledTimes(1);
      expect(second.withValidation).not.toHaveBeenCalled();
    });

    it('the downstream process fails to start → handler_failed, without starting the other branch', async () => {
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

    it('the invocation exceeds the time budget → timeout (controlled fail-closed)', async () => {
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
