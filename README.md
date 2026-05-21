# MNSCloud Customer Portal

White label customer portal for ERP customers. This repository is a public API client and consumes
only documented MNSCloud API contracts under `/api/v1/customer-portal`.

## Contract

- Product/runtime: `mnscloud-customer-portal`
- Project directory: `/opt/mnscloud/mnscloud-customer-portal`
- Framework: Angular
- Local development command: `npm run start`
- Build command: `npm run build`
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

## Security Boundary

- Do not commit tokens, passwords, private keys, provider credentials, customer data, production
  domains, production IPs, or private infrastructure topology.
- Browser-side permission checks are UX only.
- The MNSCloud API remains the source of truth for tenant scope, customer scope, billing, routing,
  service ownership, policy decisions and secret resolution.
