# MNSCloud Customer Portal

White label customer portal for ERP customers. This repository is a public API client and consumes
only documented MNSCloud API contracts under `/api/v1/customer-portal`.

## Contract

- Product/runtime: `mnscloud-customer-portal`
- Project directory: `/opt/mnscloud/mnscloud-customer-portal`
- Framework: Angular 22 (zoneless, standalone components, signals)
- UI: Angular Material 3 (`mat.theme` in `src/styles.scss`), self-hosted Inter and Material Icons fonts
- Local development command: `npm run start`
- Build command: `npm run build`
- Unit tests: `npm test` (Angular `unit-test` builder with Vitest and jsdom; no browser needed)
- Check command: `npm run check`
- Runtime config source: `public/env.js`
- Runtime config object: `window.MNSCLOUD_CUSTOMER_PORTAL_CONFIG`
- Default API fallback: same-origin `/api/v1`
- API contract prefix: `/api/v1/customer-portal`
- Local development port: `4300`
- CI workflow: `.github/workflows/ci.yml`

## Development

```bash
npm install
npm run start
```

Set `public/env.js` for standalone development:

```js
window.MNSCLOUD_CUSTOMER_PORTAL_CONFIG = {
  apiBaseUrl: "https://api.example.com/api/v1",
};
```

If `apiBaseUrl` is empty, the app falls back to same-origin `/api/v1`.

## Theme

- Light and dark schemes come from one Material 3 theme with `theme-type: color-scheme`;
  `ThemeService` (`src/app/core/theme/theme.service.ts`) sets `color-scheme` on `<html>` and stores
  the viewer's choice locally.
- Style components with Material system tokens (`--mat-sys-*`) or the portal tokens defined on
  `html` in `src/styles.scss` (`--surface`, `--border`, `--muted`, `--success`, ...), never fixed
  colors, so both schemes and white-label branding keep working. `--tenant-primary-color` is the
  brand accent hook.
- Fonts are bundled from npm (`@fontsource-variable/inter`, `material-icons`); do not add third-party
  font or icon CDNs.

## Security Boundary

- Do not commit tokens, passwords, private keys, provider credentials, customer data, production
  domains, production IPs, or private infrastructure topology.
- Browser-side permission checks are UX only.
- The MNSCloud API remains the source of truth for tenant scope, customer scope, billing, routing,
  service ownership, policy decisions and secret resolution.

## New version notice

An open tab detects a newer release without a refresh: `src/app/core/update/app-update.service.ts`
reads `build.json` (written by `mnscloud-webapps` next to `index.html` of the active release) on
start, every ~5 min while visible and on focus/online/route change, and compares it with the
`package.json` version compiled into the bundle (synced from `VERSION` by the release script). A
different version is shown only after two reads 45 s apart, as a calm notice with `Update now`
(asks first if the customer typed on the page) and `Later` (4 h per version). With an update
pending, the next route change becomes a full page load; a missing lazy chunk reloads once.
