import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { identificationReturnGuard } from './identification-return.guard';
import { IdentificationReturnService } from '../../features/identification/identification-return.service';
import { IdentificationReturnOutcome } from '../../features/identification/identification-return.model';

describe('identificationReturnGuard', () => {
  let identificationReturn: { outcome: jest.Mock<IdentificationReturnOutcome, []> };
  let router: Router;

  function configure(outcome: IdentificationReturnOutcome): void {
    identificationReturn = { outcome: jest.fn().mockReturnValue(outcome) };
    TestBed.configureTestingModule({
      providers: [{ provide: IdentificationReturnService, useValue: identificationReturn }],
    });
    router = TestBed.inject(Router);
  }

  function runGuard() {
    return TestBed.runInInjectionContext(() => identificationReturnGuard({} as never, {} as never));
  }

  it('permite continuar cuando el outcome es "correlated"', () => {
    configure('correlated');

    expect(runGuard()).toBe(true);
  });

  it('permite continuar cuando el outcome es "out_of_scope" — denegarlo rompería los 4 métodos fuera de alcance (AC-08)', () => {
    configure('out_of_scope');

    expect(runGuard()).toBe(true);
  });

  it('deniega y redirige a "/" cuando el outcome es "rejected" (ES-06)', () => {
    configure('rejected');

    const result = runGuard();

    expect(result).not.toBe(true);
    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/');
  });

  it('solo lee la signal ya calculada — nunca re-evalúa ni consume la referencia', () => {
    configure('rejected');

    runGuard();

    expect(identificationReturn.outcome).toHaveBeenCalledTimes(1);
  });
});
