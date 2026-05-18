# MNSCloud Customer Portal

Use this repository for the white label customer portal.

## Rules

- Build with Angular standalone components and Angular Material.
- Keep modules isolated under `src/app/pages/`.
- Use `ApiService` for all API calls.
- Never place API-side permissions, tenant scoping or billing decisions in the frontend as the only
  enforcement layer.
- Use public-safe placeholders in docs and examples.
