# MNSCloud Customer Portal

White label customer portal for the customers of each tenant (Registry customers). This repository is a public API client and consumes
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

## Languages (i18n)

The portal follows the MNSCloud App translation contract:

- Runtime layer: Transloco only (`@jsverse/transloco`). No hardcoded visible text, local maps or DOM
  auto-translation.
- Languages: `pt-BR`, `en-US`, `es-ES`; `en-US` is the fallback for a missing key.
- Files: `public/i18n/<language>.json`, flat dotted keys (`nav.dashboard`, `financial.status.paid`),
  loaded relative to the base href, so the portal works under `/customer-portal/`.
- Language: the browser language (`pt*` → pt-BR, `es*` → es-ES, otherwise en-US) unless the customer
  picks one in the language menu (login page and top bar). The choice is stored in `localStorage`
  `mc_language` + `mc_language_mode=manual`, the same keys as the App, and `<html lang>` follows it.
  Money and dates use the active language.
- Terms follow the App glossary (`mnscloud-app/i18n-glossary.md`): one concept keeps one term.
- `npm run check:i18n` (part of `npm run check`) fails when a key is missing or extra in a language,
  a value is empty, or the source uses a literal key that does not exist.

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

A release that fixes a serious problem sets `minimumVersion` in `public/update-policy.json` (usually
to its own version, in the same PR). `mnscloud-webapps` copies it into `build.json`, and tabs
running below it get an `Important update` notice without `Later`. It still never reloads by
itself. Keep it `null` for regular releases.
