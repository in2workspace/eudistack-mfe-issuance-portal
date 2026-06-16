# eudistack-cgcom-mfe-issuance-portal

Frontal del **Portal de Emisión** de CGCOM.

> ⚠️ **Material de demo.** Separado de `eudistack-platform-dev/dev-tools/demo-cgcom`
> (vibecoding para demos, no producto). React 18 + Vite + Tailwind v4. Aún **no** migrado
> a Angular ni alineado con el SDD de EUDIStack. Relacionado con la Épica
> [EUDISTACK-621](https://eudistack.atlassian.net/browse/EUDISTACK-621).

## Qué hace

Flujo de emisión de credencial DoctorID (extraído de `demo-cgcom/src/portal.tsx`, sin la
pantalla de autenticación, que vive ahora en `eudistack-cgcom-mfe-cert-identifier`):

```
landing ──▶ [identificación externa] ──▶ doctor-data ──▶ qr-credential ──▶ credential-success ──▶ portal
```

La emisión llama a `issuerService.bootstrap()` → backend → Credential Offer (OID4VCI).

## Repos hermanos (separación de demo-cgcom)

| Repo | Rol |
|------|-----|
| **eudistack-cgcom-mfe-issuance-portal** (este) | Portal de Emisión (flujo de credencial) |
| `eudistack-cgcom-mfe-cert-identifier` | Frontal de identificación FNMT |
| `eudistack-cgcom-cert-identifier-service` | Backend mTLS (cert-server) + bootstrap |

## Ejecución local

```bash
npm install
npm run dev      # http://localhost:3001
```

Variables de entorno:

| Var | Default | Uso |
|-----|---------|-----|
| `VITE_CERT_IDENTIFIER_URL` | `http://localhost:3000` | Portal de Identificación (inicio del handoff) |
| `VITE_BOOTSTRAP_API_URL` | `https://localhost:3443/api/bootstrap` | Endpoint de bootstrap del backend |

## ⚠️ Deuda conocida (heredada de la demo)

- **Handoff de identidad = placeholder inseguro** (`src/App.tsx`): el usuario llega por
  `sessionStorage` + `?identified=1`. Contrato real pendiente de `/define-architecture` (EUDISTACK-621/622).
- **Tipos duplicados** con el repo de identificación (`src/types.ts`) — sin paquete de contrato.
- `IssuancePortal` aún incluye atajos de demo (`handleQuickLogin`).
- `ui/` (48 primitivas shadcn/Radix) y assets duplicados con el repo de identificación.
- Sin tests, sin CI. Fuera de `repository-map.md` y del SDD.
