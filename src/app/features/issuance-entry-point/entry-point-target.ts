import { environment } from '../../../environments/environment';
import type { IssuanceEntryPoint } from './issuance-entry-point';

export type EntryPointHandlerContext = {
  signal?: AbortSignal;
};

export type EntryPointHandler = (ctx: EntryPointHandlerContext) => Promise<void>;

const NO_OP_TARGETS = new Set(['', '#']);

export const entryPointNavigation = {
  assign(url: string): void {
    window.location.assign(url);
  },
};

function buildNavigateHandler(targetUrl: string | undefined): EntryPointHandler {
  const url = targetUrl?.trim() ?? '';
  return async () => {
    if (NO_OP_TARGETS.has(url)) {
      return;
    }
    entryPointNavigation.assign(url);
  };
}

export function resolveEntryPointTarget(
  entryPoint: IssuanceEntryPoint,
): EntryPointHandler {
  if (entryPoint === 'WITH_VALIDATION') {
    return buildNavigateHandler(environment.entryPointTargetWithValidation);
  }
  if (entryPoint === 'DIRECT') {
    return buildNavigateHandler(environment.entryPointTargetDirect);
  }
  const _exhaustive: never = entryPoint;
  return _exhaustive;
}
