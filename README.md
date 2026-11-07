# Carevanta Patient App

The public, mobile-first web app patients use to find doctors, book tests, order medicines, keep records and call an ambulance. It is an installable PWA (add to home screen, offline shell, Web Push) and talks only to the Carevanta API.

Stack: Next 16 (App Router, React 19, React Compiler), Tailwind 4, TanStack Query, lucide-react, Vitest + Testing Library.

## Run it

```bash
npm install
npm run dev        # http://localhost:3002
npm run build && npm start
npm test           # unit tests
npm run lint
```

`.env.local`:

| Variable | Meaning |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | The API origin, default `http://localhost:4000` |
| `NEXT_PUBLIC_PORTAL_URL` | Provider portal link shown in the footer and Account page (default `http://localhost:3001`) |
| `PORT` | Dev port (3002 so it runs beside the dashboard on 3000 and the portal on 3001) |

The API must allow this origin in `CORS_ORIGINS`.

## Demo Logins

All demo accounts (Super Admin, one per provider type, patient) with passwords and what data each one sees: see [Carevanta_Backedn_Api/docs/demo-logins.md](../Carevanta_Backedn_Api/docs/demo-logins.md). Development only.

## What is configurable from the Super Admin

Settings → Patient App in the dashboard edits one setting, `patient.ui`, served at `GET /public/patient-ui`:

- Hero badge, title, subtitle, both call-to-action buttons and the hero image.
- Highlights (why trust us), category tiles (which ones, order, colour, icon).
- Landing headline, points, stats, footer note.
- Announcement banner with expiry, support contacts, theme colours (primary and accent).

Nothing in this app hard-codes a place name, a phone number or a colour; the defaults live in the API (`src/modules/patient/patient-ui.ts`).

## Screens

| Route | Purpose |
| --- | --- |
| `/` | Landing (signed out) or Home (signed in) |
| `/login`, `/signup`, `/verify`, `/forgot-password`, `/reset-password` | Account |
| `/search` | Doctors, hospitals and clinics, labs, pharmacies; condition search; filters |
| `/doctors/[id]`, `/book/[doctorId]` | Doctor profile and the 4-step booking |
| `/providers/[id]` | Hospital, lab, pharmacy or ambulance operator profile |
| `/tests`, `/tests/[code]` | Lab and imaging catalogue and booking (centre or home collection) |
| `/pharmacy`, `/cart` | Medicine search, basket, prescription attach, pickup or delivery |
| `/care` | Upcoming and past appointments, recent orders |
| `/appointments/[id]` | Detail, pay online (Razorpay), reschedule, cancel, review |
| `/orders`, `/orders/lab/[id]`, `/orders/medicine/[id]` | Order tracking, report download, cancel |
| `/records` | Reports and prescriptions, upload |
| `/family` | Profiles for the people you book for |
| `/emergency`, `/emergency/[id]` | Call the public number first, then request and follow an ambulance |
| `/notifications`, `/account` | Inbox, push toggle, install card, password, sign out |

## Design

Deliberately not the admin look. Azure to cyan gradients, white cards floating on a pale blue canvas, 20 to 36 px radii, soft 3D shadows, a floating pill bottom nav with a raised SOS button. Tokens are in `src/app/globals.css`; the brand colours are CSS variables set at runtime from the configured theme.

Rules kept throughout: mobile first, 44 px tap targets, safe-area padding, reduced-motion respected, every list has loading, empty and error states, and every write goes through `useAction` so errors always surface as toasts.

## Tests and checks

- `src/lib/cart.test.tsx` basket rules (one pharmacy at a time, merge, cap, persistence).
- `src/components/ui/primitives.test.tsx` status labels and order timeline.
- `src/components/marketing/landing.test.tsx` landing renders configured copy and survives an API outage.
- The API repo's `tests/integration/patient-app.test.ts` covers every patient endpoint this app calls.
