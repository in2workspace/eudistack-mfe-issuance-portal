import { BrandingService } from './branding.service';
import { TenantBranding } from './tenant-branding.model';

describe('BrandingService', () => {
  let service: BrandingService;

  const branding: TenantBranding = {
    tokens: { '--brand-primary': '#0F2B5B', '--brand-secondary': '#00BFA6' },
    logoUrl: 'https://assets.eudistack.net/cgcom/logo.svg',
    faviconUrl: 'https://assets.eudistack.net/cgcom/favicon.svg',
    defaultLanguage: 'es',
    supportedLanguages: ['es'],
  };

  beforeEach(() => {
    service = new BrandingService();
    document.documentElement.removeAttribute('style');
    document.querySelectorAll("link[rel~='icon']").forEach((el) => el.remove());
  });

  it('writes the tenant tokens as CSS custom properties on :root (AC-01)', () => {
    service.apply(branding);

    expect(document.documentElement.style.getPropertyValue('--brand-primary')).toBe('#0F2B5B');
    expect(document.documentElement.style.getPropertyValue('--brand-secondary')).toBe('#00BFA6');
  });

  it('sets the favicon link (AC-01)', () => {
    service.apply(branding);

    const link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    expect(link?.href).toContain('favicon.svg');
  });

  it('exposes the logo as a signal (AC-01)', () => {
    service.apply(branding);

    expect(service.logoUrl()).toBe(branding.logoUrl);
  });

  it('is idempotent: applying the same branding twice in the same bootstrap yields the same state (EC-05)', () => {
    service.apply(branding);
    service.apply(branding);

    expect(document.documentElement.style.getPropertyValue('--brand-primary')).toBe('#0F2B5B');
    expect(service.logoUrl()).toBe(branding.logoUrl);
    expect(document.querySelectorAll("link[rel~='icon']").length).toBe(1);
  });
});
