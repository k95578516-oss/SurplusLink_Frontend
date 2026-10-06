# SurplusLink Frontend

A React + Vite frontend designed against the uploaded Spring Boot Surplus Management System backend.

## Run locally

1. Start the Spring Boot backend on `http://localhost:8080`.
2. Make sure MySQL is running and the backend database is configured.
3. From this folder:

```bash
npm install
npm run dev
```

4. Open `http://localhost:5173`.

The Vite dev server proxies `/api` to `http://localhost:8080`, so the browser does not need direct CORS access.

## Main flows

- Login / registration using `/api/auth`
- Organization onboarding using `/api/organizations`
- Provider surplus listing and status updates
- Recipient needs and urgency
- Active smart matches and backend match scores
- Resource requests
- Delivery tracking/status progression
- Impact dashboard
- Emergency radar
- Notifications

## Backend alignment

The UI uses the actual enums and DTO fields found in the supplied backend, including:
`ResourceCategory`, `ConditionType`, `UrgencyLevel`, `SurplusStatus`, `NeedStatus`,
`MatchStatus`, `RequestStatus`, `DeliveryStatus`, and `DeliveryMethod`.

No mock backend is required. Empty database states are presented gracefully.
