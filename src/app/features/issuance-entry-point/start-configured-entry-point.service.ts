import { Injectable } from '@angular/core';
import { TimeoutError, defer, firstValueFrom, timeout } from 'rxjs';
import type { IssuanceEntryPoint } from './issuance-entry-point';
import {
  resolveEntryPointTarget,
  type EntryPointHandler,
} from './entry-point-target';

export const REQUEST_TIMEOUT_MS = 10000;

export type StartEntryPointResult =
  | { ok: true }
  | { ok: false; reason: 'handler_failed' | 'timeout' };

export type StartEntryPointOptions = {
  timeoutMs?: number;
  resolveTarget?: (entryPoint: IssuanceEntryPoint) => EntryPointHandler;
};

@Injectable({ providedIn: 'root' })
export class StartConfiguredEntryPointService {
  async start(
    entryPoint: IssuanceEntryPoint,
    options?: StartEntryPointOptions,
  ): Promise<StartEntryPointResult> {
    const resolveTarget = options?.resolveTarget ?? resolveEntryPointTarget;
    const handler = resolveTarget(entryPoint);
    const timeoutMs = options?.timeoutMs ?? REQUEST_TIMEOUT_MS;

    const controller = new AbortController();

    try {
      await firstValueFrom(
        defer(() => handler({ signal: controller.signal })).pipe(
          timeout({ each: timeoutMs }),
        ),
      );
      return { ok: true };
    } catch (err) {
      controller.abort();
      if (err instanceof TimeoutError) {
        return { ok: false, reason: 'timeout' };
      }
      return { ok: false, reason: 'handler_failed' };
    }
  }
}
