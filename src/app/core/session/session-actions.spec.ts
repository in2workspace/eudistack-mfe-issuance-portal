import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { SESSION_ACTIONS } from './session-actions';

describe('SESSION_ACTIONS (default, until EUD-314)', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  it('starts the login again from Inicio', async () => {
    const navigate = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    await TestBed.inject(SESSION_ACTIONS).restartLogin();

    expect(navigate).toHaveBeenCalledWith(['/']);
  });

  it('has no tokens to discard', () => {
    expect(() => TestBed.inject(SESSION_ACTIONS).discardTokens()).not.toThrow();
  });
});
