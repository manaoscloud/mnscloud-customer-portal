# MNSCloud Customer Portal

White label customer portal for ERP customers. This repository is a public API client and consumes
only documented MNSCloud API contracts under `/api/v1/customer-portal`.

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
