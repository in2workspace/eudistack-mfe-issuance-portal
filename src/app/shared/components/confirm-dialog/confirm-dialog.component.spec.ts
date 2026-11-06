import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ConfirmDialogComponent } from './confirm-dialog.component';

expect.extend(toHaveNoViolations);

@Component({
  imports: [ConfirmDialogComponent],
  template: `
    <a href="#" id="opener" (click)="$event.preventDefault(); open.set(true)">¿Prefieres usar el wallet en este ordenador?</a>
    <app-confirm-dialog
      [open]="open()"
      title="¿Usar el wallet en este ordenador?"
      [description]="['Usa el wallet solo en un ordenador personal.', 'Si sigues, cierra la sesión del wallet al terminar.']"
      dismissLabel="Usar el móvil"
      confirmLabel="Continuar en este ordenador"
      (dismissed)="dismissals = dismissals + 1; open.set(false)"
      (confirmed)="confirmations = confirmations + 1; open.set(false)"
    />
  `,
})
class HostComponent {
  readonly open = signal(false);
  dismissals = 0;
  confirmations = 0;
}

describe('ConfirmDialogComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  beforeEach(() => {
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
  });

  afterEach(() => fixture.nativeElement.remove());

  const query = <T extends Element>(selector: string): T | null => fixture.nativeElement.querySelector(selector) as T | null;
  const buttons = (): HTMLButtonElement[] => Array.from(fixture.nativeElement.querySelectorAll('[role="dialog"] button'));

  function openFromLink(): void {
    const opener = query<HTMLAnchorElement>('#opener')!;
    opener.focus();
    opener.click();
    fixture.detectChanges();
  }

  function press(key: string, shiftKey = false): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true });
    (document.activeElement ?? query('[role="dialog"]'))!.dispatchEvent(event);
    fixture.detectChanges();
    return event;
  }

  it('is not rendered while closed', () => {
    expect(query('[role="dialog"]')).toBeNull();
  });

  it('EC-09: announces itself as a modal dialog with its title and text', () => {
    openFromLink();

    const dialog = query<HTMLElement>('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent).toContain(
      '¿Usar el wallet en este ordenador?',
    );
    expect(document.getElementById(dialog.getAttribute('aria-describedby')!)?.textContent).toContain(
      'Usa el wallet solo en un ordenador personal.',
    );
  });

  it('EC-09: the focus starts on the default option', () => {
    openFromLink();

    expect(document.activeElement?.textContent?.trim()).toBe('Usar el móvil');
  });

  it('EC-09: Tab from the last option goes back to the first', () => {
    openFromLink();
    buttons()[1].focus();

    const event = press('Tab');

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(buttons()[0]);
  });

  it('EC-09: Shift+Tab from the first option goes to the last', () => {
    openFromLink();

    const event = press('Tab', true);

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(buttons()[1]);
  });

  it('EC-09: Tab between the options is left to the browser', () => {
    openFromLink();

    expect(press('Tab').defaultPrevented).toBe(false);
  });

  it('AC-14: Escape is the default option and gives the focus back to the opener', () => {
    openFromLink();

    press('Escape');

    expect(host.dismissals).toBe(1);
    expect(host.confirmations).toBe(0);
    expect(query('[role="dialog"]')).toBeNull();
    expect(document.activeElement?.id).toBe('opener');
  });

  it('AC-14: the default option closes without confirming and gives the focus back', () => {
    openFromLink();

    buttons()[0].click();
    fixture.detectChanges();

    expect(host.dismissals).toBe(1);
    expect(host.confirmations).toBe(0);
    expect(document.activeElement?.id).toBe('opener');
  });

  it('AC-14: the confirm option confirms', () => {
    openFromLink();

    buttons()[1].click();
    fixture.detectChanges();

    expect(host.confirmations).toBe(1);
    expect(host.dismissals).toBe(0);
  });

  it('NFR-3: has no accessibility violations while open', async () => {
    openFromLink();

    expect(await axe(fixture.nativeElement)).toHaveNoViolations();
  });
});
