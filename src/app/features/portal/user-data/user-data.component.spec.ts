import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { UserDataComponent } from './user-data.component';

describe('UserDataComponent', () => {
  let fixture: ComponentFixture<UserDataComponent>;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [UserDataComponent],
      providers: [
        provideRouter([]),
      ],
    });
    fixture = TestBed.createComponent(UserDataComponent);
    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
  });

  function click(label: string): void {
    const buttons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));
    buttons.find((b) => b.textContent?.includes(label))?.click();
  }

  it('AC-06: shows no data of the holder kept in the browser', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).not.toMatch(/DNI|colegiado|Colegio Provincial|Especialidad|empleado/i);
  });

  it('Cancelar goes back to Inicio', () => {
    click('Cancelar');

    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('Continuar goes to the QR step', () => {
    click('Continuar');

    expect(router.navigate).toHaveBeenCalledWith(['/offer']);
  });
});
