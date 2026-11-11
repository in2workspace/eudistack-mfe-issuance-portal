import { Component, ElementRef, afterNextRender, input, output, viewChildren } from '@angular/core';

let nextId = 0;

/**
 * Código de un solo uso en casillas (EUD-358, design.md de la interfaz AD-7).
 * Copia el comportamiento del `otp-input` del wallet sin Ionic: una casilla por
 * dígito, pegar rellena todas, Retroceso vuelve a la anterior y las flechas
 * mueven el foco. Las casillas comparten una etiqueta, todas son numéricas y la
 * primera lleva `autocomplete="one-time-code"` para que el sistema ofrezca el
 * código recibido; si lo escribe entero en una casilla, se reparte.
 *
 * Emite `completed` con el código en cuanto las casillas están llenas por una
 * acción del titular.
 */
@Component({
  selector: 'app-code-input',
  template: `
    <div role="group" [attr.aria-labelledby]="labelId" class="flex justify-center gap-2">
      <span [id]="labelId" class="sr-only">{{ label() }}</span>
      @for (digit of digits; track $index) {
        <input
          #box
          type="text"
          inputmode="numeric"
          [attr.autocomplete]="$index === 0 ? 'one-time-code' : 'off'"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
          [attr.aria-labelledby]="labelId"
          [attr.aria-describedby]="describedBy()"
          [attr.aria-invalid]="invalid() ? 'true' : null"
          class="h-14 w-11 rounded-lg border-2 bg-white text-center text-xl font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-accent"
          [class.border-red-600]="invalid()"
          [class.border-gray-300]="!invalid()"
          (input)="onInput($event, $index)"
          (keydown)="onKeydown($event, $index)"
          (paste)="onPaste($event)"
          (focus)="onFocus($index)"
        />
      }
    </div>
  `,
})
export class CodeInputComponent {
  /** Etiqueta común de todas las casillas. */
  readonly label = input.required<string>();
  /** Identificador del texto que describe el código (mensajes de error). */
  readonly describedBy = input<string | null>(null);
  /** El código anterior no era correcto. */
  readonly invalid = input(false);
  /** Lleva el foco a la primera casilla al mostrarse. */
  readonly autofocus = input(false);
  /** Los 6 dígitos, cuando el titular termina de escribirlos o pegarlos. */
  readonly completed = output<string>();

  protected readonly labelId = `code-input-label-${nextId++}`;
  protected readonly digits: string[] = new Array<string>(6).fill('');
  private readonly boxes = viewChildren<ElementRef<HTMLInputElement>>('box');

  constructor() {
    afterNextRender(() => {
      if (this.autofocus()) {
        this.focusFirst();
      }
    });
  }

  /** Vacía las casillas y lleva el foco a la primera. */
  clear(): void {
    this.digits.fill('');
    this.boxes().forEach((box) => (box.nativeElement.value = ''));
    this.focusFirst();
  }

  focusFirst(): void {
    this.focusBox(0);
  }

  protected onInput(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const typed = input.value.replaceAll(/\D/g, '');
    if (typed.length === 0) {
      this.digits[index] = '';
      input.value = '';
      return;
    }
    this.fill(index, typed);
  }

  protected onKeydown(event: KeyboardEvent, index: number): void {
    if (event.key === 'Backspace') {
      event.preventDefault();
      if (this.digits[index] !== '') {
        this.setDigit(index, '');
      } else if (index > 0) {
        this.setDigit(index - 1, '');
      }
      this.focusBox(Math.max(index - 1, 0));
    } else if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      this.focusBox(index - 1);
    } else if (event.key === 'ArrowRight' && index < this.digits.length - 1) {
      event.preventDefault();
      this.focusBox(index + 1);
    }
  }

  protected onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pasted = (event.clipboardData?.getData('text') ?? '').replaceAll(/\D/g, '');
    if (pasted) {
      this.fill(0, pasted);
    }
  }

  protected onFocus(index: number): void {
    this.boxes()[index]?.nativeElement.select();
  }

  /** Reparte los dígitos desde la casilla `from`, pasa el foco a la siguiente y emite si queda completo. */
  private fill(from: number, typed: string): void {
    const chars = Array.from(typed.slice(0, this.digits.length - from));
    chars.forEach((char, offset) => this.setDigit(from + offset, char));
    const next = from + chars.length;
    if (this.digits.every((digit) => digit !== '')) {
      this.focusBox(this.digits.length - 1);
      this.completed.emit(this.digits.join(''));
    } else {
      this.focusBox(Math.min(next, this.digits.length - 1));
    }
  }

  private setDigit(index: number, digit: string): void {
    this.digits[index] = digit;
    const box = this.boxes()[index];
    if (box) {
      box.nativeElement.value = digit;
    }
  }

  private focusBox(index: number): void {
    this.boxes()[index]?.nativeElement.focus();
  }
}
