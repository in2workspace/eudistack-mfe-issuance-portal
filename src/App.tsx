import { useState, useEffect } from 'react';
import { LandingPage } from './components/portal/LandingPage';
import type { LandingPageProps } from './components/portal/LandingPage';
import { DoctorDataPage } from './components/portal/DoctorDataPage';
import { CredentialQRPage } from './components/portal/CredentialQRPage';
import { IssuancePortal } from './components/portal/IssuancePortal';
import { CredentialSuccessPage } from './components/portal/CredentialSuccessPage';
import { IncidentsPage } from './components/portal/IncidentsPage';
import type { Page, AuthenticatedUser } from './types';
import * as issuerService from './services/issuerService';

/**
 * Portal de Emisión (standalone).
 *
 * Extraído del flujo monolítico `demo-cgcom/src/portal.tsx`. La pantalla de
 * autenticación (`auth` / `ClaveAuthPage`) se ha separado al repo
 * `eudistack-cgcom-mfe-cert-identifier` (Portal de Identificación con certificado FNMT).
 *
 * ── FRONTERA / HANDOFF (DEUDA: pendiente de diseño formal en EUDISTACK-621/622) ──
 * Antes, "Obtener mi DoctorID" navegaba a la pantalla `auth` interna. Ahora redirige
 * al Portal de Identificación, que tras el consentimiento devuelve el usuario.
 * Placeholder de paridad con la demo: el usuario identificado llega vía sessionStorage
 * + `?identified=1`. Inseguro para producción — NO es el diseño final.
 */

const CERT_IDENTIFIER_URL =
  import.meta.env.VITE_CERT_IDENTIFIER_URL ?? 'http://localhost:3000';

// TEMPORAL: lee el usuario desde el param ?u= (Base64) cuando sessionStorage no está
// disponible por diferencia de origen (localhost:3000 ≠ localhost:3001).
// Sustituir por el contrato definitivo de EUDISTACK-622.
function readIdentifiedUser(urlParams: URLSearchParams): AuthenticatedUser | null {
  try {
    const encoded = urlParams.get('u');
    if (encoded) return JSON.parse(decodeURIComponent(atob(encoded))) as AuthenticatedUser;
    const raw = sessionStorage.getItem('cgcom_identified_user');
    if (raw) {
      sessionStorage.removeItem('cgcom_identified_user');
      return JSON.parse(raw) as AuthenticatedUser;
    }
  } catch { /* fall through */ }
  return null;
}

function PortalApp({ LandingComponent = LandingPage }: { LandingComponent?: React.ComponentType<LandingPageProps> }) {
  const urlParams = new URLSearchParams(window.location.search);
  const isPortalRoute = window.location.pathname.startsWith('/portal');
  const hasOidcCode = isPortalRoute && !!urlParams.get('code');
  // Retorno desde el Portal de Identificación (handoff).
  const justIdentified = urlParams.get('identified') === '1';

  const identifiedUser = justIdentified ? readIdentifiedUser(urlParams) : null;

  const [currentPage, setCurrentPage] = useState<Page>(
    hasOidcCode ? 'portal' : identifiedUser ? 'doctor-data' : 'landing',
  );
  const [authenticatedUser, setAuthenticatedUser] = useState<AuthenticatedUser | null>(() => {
    if (identifiedUser) {
      window.history.replaceState(null, '', window.location.pathname);
      return identifiedUser;
    }
    if (hasOidcCode) {
      window.history.replaceState(null, '', window.location.pathname);
      return {
        id: 'DR-OIDC',
        name: 'Dra. María García López',
        collegiateNumber: '282912345',
        dni: '12345678A',
        email: 'maria.garcia@ejemplo.com',
        phone: '+34 600 123 456',
        college: 'Colegio Oficial de Médicos de Madrid',
        specialty: 'Medicina Familiar y Comunitaria',
        authMethod: 'claveMobile',
      };
    }
    return null;
  });
  const [credentialOfferUrl, setCredentialOfferUrl] = useState<string | null>(null);
  const [bootstrapLoading, setBootstrapLoading] = useState<boolean>(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  useEffect(() => {
    if (currentPage === 'portal') {
      window.history.replaceState(null, '', '/portal/home');
    } else if (window.location.pathname === '/portal/home') {
      window.history.replaceState(null, '', '/portal');
    }
  }, [currentPage]);

  const handleNavigate = (page: Page) => setCurrentPage(page);

  const handleLogout = () => {
    setAuthenticatedUser(null);
    setCredentialOfferUrl(null);
    setBootstrapError(null);
    setCurrentPage('landing');
  };

  // Inicio de identificación → redirige al Portal de Identificación con certificado FNMT.
  const handleStartIdentification = () => {
    window.location.href = `${CERT_IDENTIFIER_URL}/`;
  };

  const handleQuickLogin = () => {
    const mockUser: AuthenticatedUser = {
      id: 'DR-12345',
      name: 'Dra. María García López',
      collegiateNumber: '282912345',
      dni: '12345678A',
      email: 'maria.garcia@ejemplo.com',
      phone: '+34 600 123 456',
      college: 'Colegio Oficial de Médicos de Madrid',
      specialty: 'Medicina Familiar y Comunitaria',
      authMethod: 'claveMobile',
    };
    setAuthenticatedUser(mockUser);
    setCurrentPage('portal');
  };

  const handleDoctorDataContinue = async () => {
    if (!authenticatedUser) return;
    setBootstrapLoading(true);
    setBootstrapError(null);
    const result = await issuerService.bootstrap(authenticatedUser);
    setBootstrapLoading(false);
    if (result.success) {
      setCredentialOfferUrl(result.credentialOfferUrl);
      setCurrentPage('qr-credential');
    } else {
      setBootstrapError(result.error);
    }
  };

  if (currentPage === 'landing') {
    // En la demo el botón principal abría `auth`; aquí arranca la identificación externa.
    return <LandingComponent onNavigate={handleNavigate} onLogin={handleStartIdentification} />;
  }

  if (currentPage === 'doctor-data' && authenticatedUser) {
    return (
      <DoctorDataPage
        user={authenticatedUser}
        onContinue={handleDoctorDataContinue}
        onCancel={handleLogout}
        isLoading={bootstrapLoading}
        error={bootstrapError}
      />
    );
  }

  if (currentPage === 'qr-credential' && authenticatedUser) {
    return (
      <CredentialQRPage
        user={authenticatedUser}
        credentialOfferUrl={credentialOfferUrl}
        onComplete={() => setCurrentPage('credential-success')}
        onCancel={handleLogout}
        onRetry={() => {
          setCredentialOfferUrl(null);
          setBootstrapError(null);
          setCurrentPage('doctor-data');
        }}
      />
    );
  }

  if (currentPage === 'credential-success' && authenticatedUser) {
    return (
      <CredentialSuccessPage
        user={authenticatedUser}
        onContinue={() => setCurrentPage('portal')}
      />
    );
  }

  if (currentPage === 'incidents') {
    return <IncidentsPage onBack={() => setCurrentPage('landing')} onNavigate={handleNavigate} onLogin={handleQuickLogin} />;
  }

  if (currentPage === 'portal' && authenticatedUser) {
    return <IssuancePortal user={authenticatedUser} onLogout={handleLogout} />;
  }

  return null;
}

export default PortalApp;
