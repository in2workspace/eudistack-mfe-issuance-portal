import { Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { axe, toHaveNoViolations } from 'jest-axe';
import { CodeInputComponent } from './code-input.component';

expect.extend(toHaveNoViolations);

@Component({
  imports: [CodeInputComponent],
  template: `<app-code-input
    label="Código de verificación"
    [invalid]="invalid()"
    [autofocus]="autofocus()"
    (completed)="completed.push($event)"
  />`,
})
class HostComponent {
  readonly input = viewChild.required(CodeInputComponent);
  readonly invalid = signal(false);
  readonly autofocus = signal(false);
  readonly completed: string[] = [];
}

describe('CodeInputComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
  });

  afterEach(() => fixture?.nativeElement.remove());

  function create(autofocus = false): void {
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    host.autofocus.set(autofocus);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
  }

  const boxes = (): HTMLInputElement[] => Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('input'));
  const values = (): string => boxes().map((box) => box.value).join('');
  const focused = (): number => boxes().indexOf(document.activeElement as HTMLInputElement);

  function typeIn(index: number, text: string): void {
    boxes()[index].value = text;
    boxes()[index].dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function paste(index: number, text: string): Event {
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: { getData: () => text } });
    boxes()[index].dispatchEvent(event);
    fixture.detectChanges();
    return event;
  }

  function press(index: number, key: string): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    boxes()[index].dispatchEvent(event);
    fixture.detectChanges();
    return event;
  }

  describe('structure (AC-12)', () => {
    it('has 6 numeric boxes that share one label', () => {
      create();

      expect(boxes()).toHaveLength(6);
      boxes().forEach((box) => expect(box.getAttribute('inputmode')).toBe('numeric'));
      const labelIds = new Set(boxes().map((box) => box.getAttribute('aria-labelledby')));
      expect(labelIds.size).toBe(1);
      const label = fixture.nativeElement.querySelector(`#${[...labelIds][0]}`) as HTMLElement;
      expect(label.textContent).toBe('Código de verificación');
    });

    it('only the first box asks the system for the one-time code', () => {
      create();

      expect(boxes().map((box) => box.getAttribute('autocomplete'))).toEqual([
        'one-time-code',
        'off',
        'off',
        'off',
        'off',
        'off',
      ]);
    });

    it('two inputs on the same page do not share a label id', () => {
      create();
      const other = TestBed.createComponent(HostComponent);
      other.detectChanges();

      const ids = [fixture, other].map((f) => (f.nativeElement as HTMLElement).querySelector('input')!.getAttribute('aria-labelledby'));
      expect(ids[0]).not.toBe(ids[1]);
    });

    it('marks the boxes invalid when the code was not correct', () => {
      create();
      host.invalid.set(true);
      fixture.detectChanges();

      boxes().forEach((box) => expect(box.getAttribute('aria-invalid')).toBe('true'));
    });

    it('has no accessibility violations', async () => {
      create();

      expect(await axe(fixture.nativeElement)).toHaveNoViolations();
    });

    it('has no accessibility violations when invalid', async () => {
      create();
      host.invalid.set(true);
      fixture.detectChanges();

      expect(await axe(fixture.nativeElement)).toHaveNoViolations();
    });

    it('takes the focus to the first box on entering when asked to', () => {
      create(true);

      expect(focused()).toBe(0);
    });

    it('does not take the focus when not asked to', () => {
      create(false);

      expect(focused()).toBe(-1);
    });
  });

  describe('typing', () => {
    it('puts each digit in its box and moves to the next', () => {
      create();
      boxes()[0].focus();

      typeIn(0, '4');
      expect(focused()).toBe(1);
      typeIn(1, '8');

      expect(values()).toBe('48');
      expect(focused()).toBe(2);
      expect(host.completed).toEqual([]);
    });

    it('EC-02: emits the code once the 6th digit is typed', () => {
      create();

      ['4', '8', '2', '9', '1', '3'].forEach((digit, index) => typeIn(index, digit));

      expect(host.completed).toEqual(['482913']);
      expect(focused()).toBe(5);
    });

    it('ignores what is not a digit', () => {
      create();

      typeIn(0, 'a');

      expect(values()).toBe('');
      expect(boxes()[0].value).toBe('');
      expect(host.completed).toEqual([]);
    });

    it('EC-02: a system autocomplete that writes the whole code in the first box fills the 6 boxes', () => {
      create();

      typeIn(0, '482913');

      expect(boxes().map((box) => box.value)).toEqual(['4', '8', '2', '9', '1', '3']);
      expect(host.completed).toEqual(['482913']);
    });

    it('emptying a box leaves it empty and emits nothing', () => {
      create();
      typeIn(0, '4');

      typeIn(0, '');

      expect(values()).toBe('');
      expect(host.completed).toEqual([]);
    });

    it('emits again after the code is edited and completed again', () => {
      create();
      typeIn(0, '482913');

      press(5, 'Backspace');
      typeIn(5, '7');

      expect(host.completed).toEqual(['482913', '482917']);
    });
  });

  describe('pasting (EC-02)', () => {
    it('fills the 6 boxes and emits the code', () => {
      create();

      const event = paste(0, '482913');

      expect(event.defaultPrevented).toBe(true);
      expect(boxes().map((box) => box.value)).toEqual(['4', '8', '2', '9', '1', '3']);
      expect(host.completed).toEqual(['482913']);
    });

    it('fills from the first box whichever box has the focus', () => {
      create();

      paste(3, '482913');

      expect(values()).toBe('482913');
    });

    it('drops spaces and dashes and keeps only the first 6 digits', () => {
      create();

      paste(0, ' 482-913 77');

      expect(values()).toBe('482913');
      expect(host.completed).toEqual(['482913']);
    });

    it('a partial code fills what it has, leaves the focus on the next empty box and emits nothing', () => {
      create();

      paste(0, '482');

      expect(values()).toBe('482');
      expect(focused()).toBe(3);
      expect(host.completed).toEqual([]);
    });

    it('text with no digits changes nothing', () => {
      create();
      typeIn(0, '4');

      paste(1, 'abc');

      expect(values()).toBe('4');
    });
  });

  describe('keyboard', () => {
    it('Backspace on a filled box empties it and moves to the previous', () => {
      create();
      typeIn(0, '48');

      const event = press(1, 'Backspace');

      expect(event.defaultPrevented).toBe(true);
      expect(values()).toBe('4');
      expect(focused()).toBe(0);
    });

    it('Backspace on an empty box empties the previous one and moves there', () => {
      create();
      typeIn(0, '48');

      press(2, 'Backspace');

      expect(values()).toBe('4');
      expect(focused()).toBe(1);
    });

    it('Backspace on the first box empties it and stays', () => {
      create();
      typeIn(0, '4');

      press(0, 'Backspace');

      expect(values()).toBe('');
      expect(focused()).toBe(0);
    });

    it('the arrows move the focus and stop at the ends', () => {
      create();
      boxes()[2].focus();

      press(2, 'ArrowLeft');
      expect(focused()).toBe(1);
      press(1, 'ArrowRight');
      expect(focused()).toBe(2);

      boxes()[0].focus();
      expect(press(0, 'ArrowLeft').defaultPrevented).toBe(false);
      boxes()[5].focus();
      expect(press(5, 'ArrowRight').defaultPrevented).toBe(false);
    });

    it('selects the content of a box when it gets the focus, so typing replaces it', () => {
      create();
      typeIn(0, '4');
      const select = jest.spyOn(boxes()[0], 'select');

      boxes()[0].dispatchEvent(new Event('focus'));

      expect(select).toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    it('empties the boxes and takes the focus to the first', () => {
      create();
      typeIn(0, '482913');

      host.input().clear();

      expect(values()).toBe('');
      expect(focused()).toBe(0);
    });
  });
});
