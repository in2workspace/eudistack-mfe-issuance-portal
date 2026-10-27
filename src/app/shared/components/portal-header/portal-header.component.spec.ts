import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { axe, toHaveNoViolations } from 'jest-axe';
import { PortalHeaderComponent } from './portal-header.component';
import { BrandingService } from '../../../core/branding/branding.service';
import { TenantLanguageService } from '../../../core/branding/tenant-language.service';

expect.extend(toHaveNoViolations);

@Component({ template: '' })
class BlankComponent {}

describe('PortalHeaderComponent', () => {
  let fixture: ComponentFixture<PortalHeaderComponent>;
  let router: Router;
  let language: { current: ReturnType<typeof signal<string>>; supported: ReturnType<typeof signal<string[]>>; use: jest.Mock };

  beforeEach(async () => {
    language = { current: signal('en'), supported: signal(['es', 'en']), use: jest.fn() };
    TestBed.configureTestingModule({
      imports: [PortalHeaderComponent, TranslateModule.forRoot()],
      providers: [
        provideRouter([
          { path: '', component: BlankComponent },
          { path: 'identify', component: BlankComponent, data: { back: '' } },
          { path: 'offer', component: BlankComponent },
        ]),
        { provide: BrandingService, useValue: { logoUrl: signal('/assets/tenants/cgcom/logo.png') } },
        { provide: TenantLanguageService, useValue: language },
      ],
    });
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(PortalHeaderComponent);
    fixture.detectChanges();
  });

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  async function navigate(url: string): Promise<void> {
    await router.navigateByUrl(url);
    fixture.detectChanges();
  }

  it('AC-01, AC-08: shows the tenant logo and the portal name', () => {
    expect(element().querySelector('img')?.getAttribute('src')).toBe('/assets/tenants/cgcom/logo.png');
    expect(element().textContent).toContain('portal.app_name');
  });

  it('AC-02: the language selector offers only the tenant languages, with the current one selected', () => {
    const options = Array.from(element().querySelectorAll('option'));

    expect(options.map((o) => o.value)).toEqual(['es', 'en']);
    expect(options.find((o) => o.selected)?.value).toBe('en');
  });

  it('AC-02: choosing a language switches to it', () => {
    const select = element().querySelector('select') as HTMLSelectElement;
    select.value = 'es';
    select.dispatchEvent(new Event('change'));

    expect(language.use).toHaveBeenCalledWith('es');
  });

  it('AC-08: shows the back button only on routes that have one', async () => {
    await navigate('/');
    expect(element().querySelector('button')).toBeNull();

    await navigate('/identify');
    expect(element().querySelector('button')).not.toBeNull();

    await navigate('/offer');
    expect(element().querySelector('button')).toBeNull();
  });

  it('the back button goes to the route destination', async () => {
    await navigate('/identify');

    (element().querySelector('button') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(router.url).toBe('/');
  });

  it('sets the tab title to the portal name in the active language', () => {
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('es', { portal: { app_name: 'Portal de emisión' } });
    translate.use('es');

    expect(TestBed.inject(Title).getTitle()).toBe('Portal de emisión');
  });

  it('NFR-1: has no accessibility violations', async () => {
    await navigate('/identify');

    expect(await axe(element())).toHaveNoViolations();
  });

});
