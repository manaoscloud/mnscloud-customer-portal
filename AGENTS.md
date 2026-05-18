# AGENTS.md

This repository is a public MNSCloud API client for the customer portal.

- Keep all examples public-safe and placeholder-based.
- Do not add secrets, production domains, customer data or internal business rules.
- Runtime API base URL is configured through `public/env.js`.
- Authenticated calls use customer portal JWTs from `/api/v1/customer-portal/auth/signin`.
- Authorization in the frontend is advisory UX only; API-side checks are mandatory.
- New modules should live under `src/app/pages/<module>` and call `/customer-portal/<module>/*`
  endpoints.
