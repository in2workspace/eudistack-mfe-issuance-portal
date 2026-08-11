import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { CredentialOfferUrlBoxComponent } from './credential-offer-url-box.component';

describe('CredentialOfferUrlBoxComponent', () => {
  let fixture: ComponentFixture<CredentialOfferUrlBoxComponent>;
  const url = 'https://origin.example/wallet/protocol/callback?credential_offer_uri=ref';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CredentialOfferUrlBoxComponent, TranslateModule.forRoot()],
    });
    fixture = TestBed.createComponent(CredentialOfferUrlBoxComponent);
    fixture.componentRef.setInput('url', url);
    fixture.detectChanges();
  });

  it('el campo con la URL es de solo lectura pero seleccionable para copia manual', () => {
    const input = (fixture.nativeElement as HTMLElement).querySelector('input') as HTMLInputElement;

    expect(input.readOnly).toBe(true);
    expect(input.value).toBe(url);
    expect(input.className).toContain('select-all');
  });

  it('copiar con éxito anuncia la confirmación (role="status")', async () => {
    Object.assign(navigator, { clipboard: { writeText: jest.fn().mockResolvedValue(undefined) } });
    const button = (fixture.nativeElement as HTMLElement).querySelector('button') as HTMLButtonElement;

    button.click();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[role="status"]')).not.toBeNull();
  });

  it('EC-05: la copia falla en silencio si el portapapeles no está disponible, sin mensaje técnico', async () => {
    Object.assign(navigator, { clipboard: { writeText: jest.fn().mockRejectedValue(new Error('denied')) } });
    const button = (fixture.nativeElement as HTMLElement).querySelector('button') as HTMLButtonElement;

    await expect(fixture.componentInstance.handleCopy()).resolves.toBeUndefined();

    const input = (fixture.nativeElement as HTMLElement).querySelector('input') as HTMLInputElement;
    expect(input.readOnly).toBe(true); // sigue seleccionable para copia manual
    expect((fixture.nativeElement as HTMLElement).textContent).not.toMatch(/denied|Error/i);
    void button;
  });
});
