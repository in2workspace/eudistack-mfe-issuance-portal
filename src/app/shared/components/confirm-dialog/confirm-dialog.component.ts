import { Component, ElementRef, HostListener, effect, input, output, untracked, viewChild } from '@angular/core';

let nextId = 0;

/**
 * Aviso modal con dos opciones (EUD-286): la de por defecto, que cierra sin
 * hacer nada, y la que confirma. Lo usan «¿Seguro que quieres cancelar?» en
 * Datos y el aviso de ordenador personal en QR (wireframes).
 *
 * Accesible (ac.md EC-09, WCAG 2.1 AA): se anuncia como diálogo con su
 * título y su texto, el foco empieza en la opción por defecto y queda
 * atrapado dentro, Escape equivale a la opción por defecto y, al cerrarse, el
 * foco vuelve al elemento que lo abrió. Las teclas se escuchan en todo el
 * documento mientras está abierto y un clic en el fondo no saca el foco del
 * aviso (review W1). Es un componente propio y no el
 * `<dialog>` nativo para poder probar el foco atrapado en los tests unitarios.
 *
 * Quien lo usa decide cuándo se abre y se cierra con `open`.
 */
@Component({
  selector: 'app-confirm-dialog',
  template: `
    @if (open()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" (mousedown)="onBackdrop($event)">
        <div
          #panel
          role="dialog"
          aria-modal="true"
          [attr.aria-labelledby]="titleId"
          [attr.aria-describedby]="descriptionId"
          class="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        >
          <h2 [id]="titleId" class="text-lg font-semibold text-gray-900">{{ title() }}</h2>
          <div [id]="descriptionId" class="mt-3 space-y-2 text-gray-600">
            @for (paragraph of description(); track $index) {
              <p>{{ paragraph }}</p>
            }
          </div>
          <div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              #defaultButton
              type="button"
              (click)="dismissed.emit()"
              class="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-accent"
            >
              {{ dismissLabel() }}
            </button>
            <button
              type="button"
              (click)="confirmed.emit()"
              class="inline-flex items-center justify-center rounded-md bg-brand-secondary px-4 py-2 text-sm font-medium text-brand-secondary-contrast hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-brand-accent"
            >
              {{ confirmLabel() }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ConfirmDialogComponent {
  readonly open = input(false);
  readonly title = input.required<string>();
  /** Párrafos del texto del aviso. */
  readonly description = input.required<readonly string[]>();
  /** Opción por defecto: cierra sin hacer nada. */
  readonly dismissLabel = input.required<string>();
  readonly confirmLabel = input.required<string>();

  readonly dismissed = output<void>();
  readonly confirmed = output<void>();

  protected readonly titleId = `confirm-dialog-title-${nextId}`;
  protected readonly descriptionId = `confirm-dialog-description-${nextId++}`;

  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  private readonly defaultButton = viewChild<ElementRef<HTMLButtonElement>>('defaultButton');
  private opener: HTMLElement | null = null;

  constructor() {
    // Guarda quién lo abrió y, al cerrarse, le devuelve el foco.
    effect(() => {
      const open = this.open();
      untracked(() => {
        if (open) {
          this.opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        } else if (this.opener) {
          this.opener.focus();
          this.opener = null;
        }
      });
    });
    // El foco empieza en la opción por defecto en cuanto el aviso se pinta.
    effect(() => this.defaultButton()?.nativeElement.focus());
  }

  /** Mientras está abierto, Escape y Tab se tratan aunque el foco haya salido del aviso. */
  @HostListener('document:keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent): void {
    if (!this.open()) {
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      this.dismissed.emit();
    } else if (event.key === 'Tab') {
      this.keepFocusInside(event);
    }
  }

  /** Un clic fuera del panel no se lleva el foco: vuelve a la opción por defecto. */
  protected onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      event.preventDefault();
      this.defaultButton()?.nativeElement.focus();
    }
  }

  /** Tab desde la última opción vuelve a la primera, y Shift+Tab desde la primera, a la última. */
  private keepFocusInside(event: KeyboardEvent): void {
    const focusable = Array.from(this.panel()?.nativeElement.querySelectorAll<HTMLElement>('button') ?? []);
    if (focusable.length === 0) {
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !focusable.includes(active as HTMLElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !focusable.includes(active as HTMLElement))) {
      event.preventDefault();
      first.focus();
    }
  }
}
