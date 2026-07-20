import { Injectable, computed, inject, signal } from '@angular/core';
import { TenantPortalConfigSource } from '../../core/config/tenant-portal-config.source';
import { CannotContinueReason } from '../issuance-start/cannot-continue-reason';
import type { IssuanceStartSession } from '../issuance-start/issuance-start-session.model';
import { IssuanceStartSessionStore } from '../issuance-start/issuance-start-session.store';
import { resolveTenantPortalConfig } from './resolve-tenant-portal-config';
import {
  StartConfiguredEntryPointService,
  type StartEntryPointResult,
} from './start-configured-entry-point.service';

export type IssuanceEntryPointStatus =
  | 'idle'
  | 'starting'
  | 'started'
  | 'cannot_continue';

export type StartOptions = {
  correlated?: boolean;
  session?: IssuanceStartSession | null;
};

@Injectable({ providedIn: 'root' })
export class IssuanceEntryPointService {
  private readonly source = inject(TenantPortalConfigSource);
  private readonly sessionStore = inject(IssuanceStartSessionStore);
  private readonly dispatcher = inject(StartConfiguredEntryPointService);

  private readonly _status = signal<IssuanceEntryPointStatus>('idle');
  private readonly _reason = signal<CannotContinueReason | null>(null);
  private readonly _resultBySession = signal<
    ReadonlyMap<string, StartEntryPointResult>
  >(new Map());

  readonly status = this._status.asReadonly();
  readonly cannotContinueReason = this._reason.asReadonly();
  readonly canContinue = computed(() => this._status() !== 'cannot_continue');

  private starting = false;

  async start(options?: StartOptions): Promise<void> {
    const correlated = options?.correlated ?? true;
    if (!correlated) {
      this.fail(CannotContinueReason.NotCorrelated);
      return;
    }

    const session =
      options?.session !== undefined ? options.session : this.sessionStore.read();
    const tenant = session?.tenant ?? this.source.currentTenant() ?? '';

    const configResult = resolveTenantPortalConfig(tenant, this.source);
    if (!configResult.ok) {
      this.fail(
        configResult.reason === 'config_absent'
          ? CannotContinueReason.ConfigAbsent
          : CannotContinueReason.EntryPointInvalid,
      );
      return;
    }

    const sessionKey = session?.id ?? `tenant:${tenant}`;

    const cached = this._resultBySession().get(sessionKey);
    if (cached) {
      this.applyResult(cached);
      return;
    }

    if (this.starting) return;
    this.starting = true;
    this._status.set('starting');

    const result = await this.dispatcher.start(configResult.config.entryPoint);

    this.rememberResult(sessionKey, result);
    this.starting = false;
    this.applyResult(result);
  }

  async retry(options?: StartOptions): Promise<void> {
    const session =
      options?.session !== undefined ? options.session : this.sessionStore.read();
    const tenant = session?.tenant ?? this.source.currentTenant() ?? '';
    const sessionKey = session?.id ?? `tenant:${tenant}`;
    const next = new Map(this._resultBySession());
    next.delete(sessionKey);
    this._resultBySession.set(next);
    this.starting = false;
    this._reason.set(null);
    this._status.set('idle');
    await this.start(options);
  }

  private rememberResult(key: string, result: StartEntryPointResult): void {
    const next = new Map(this._resultBySession());
    next.set(key, result);
    this._resultBySession.set(next);
  }

  private applyResult(result: StartEntryPointResult): void {
    if (result.ok) {
      this._reason.set(null);
      this._status.set('started');
      return;
    }
    this.fail(
      result.reason === 'timeout'
        ? CannotContinueReason.EntryPointTimeout
        : CannotContinueReason.EntryPointStartFailed,
    );
  }

  private fail(reason: CannotContinueReason): void {
    this._reason.set(reason);
    this._status.set('cannot_continue');
  }
}
