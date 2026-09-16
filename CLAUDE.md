# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

- `npm start` — start the Expo dev server
- `npm run android` / `npm run ios` / `npm run web` — start the dev server targeting a specific platform
- `npm run lint` — run `expo lint` (ESLint via `eslint-config-expo/flat`)
- `npm run reset-project` — moves the starter code to `app-example/` and resets `app/` to a blank slate (see `scripts/reset-project.js`); do not run this against the current app without explicit user confirmation, since it discards the working app

There is no test suite configured in this repo.

## Architecture

This is an Expo Router (file-based routing) app for a hair salon ("Frizerski Salon") booking system, backed by Supabase.

**Routing / screens**
- `app/index.tsx` redirects to `/login`.
- `app/login.tsx` — Supabase email/password sign-in and sign-up.
- `app/_layout.tsx` — root `Stack` wiring `(tabs)`, `login`, and `index`.
- `app/(tabs)/_layout.tsx` — bottom tab bar: Home (`index`), Usluge/Treatments (`treatments`), Calendar (`calendar`), Account (`account`).
- `app/(tabs)/index.tsx` and `app/(tabs)/treatments.tsx` both list services (`usluge`) from Supabase; `treatments.tsx` is the one that links into the booking flow via `router.push('/booking?uslugaId=...&naziv=...&trajanje=...')`.
- `app/booking.tsx` — the booking form (pick a stylist → pick a date → pick a free time slot → confirm), pushed to as a stacked (non-tab) screen.
- `app/(tabs)/calendar.tsx` — "Moji termini" (my appointments): calendar view of the signed-in user's own upcoming, active appointments, with per-day cancel action.

**Supabase client**: `lib/supabase.js` creates the single shared client (URL/anon key are inlined there, using `AsyncStorage` for session persistence). Import `supabase` from `../lib/supabase` (or `../../lib/supabase` from within `(tabs)`).

**Domain model / DB terminology** (Serbian names are used throughout the schema, variables, and UI copy — keep this vocabulary when touching this code):
- `usluge` — services (`naziv` = name, `cena` = price, `trajanje_min` = duration in minutes)
- `frizeri` — stylists (`ime`/`prezime` = first/last name); `frizer_usluge` is the join table between stylists and the services they perform
- `termini` — appointments/bookings, with `korisnik_id`, `frizer_id`, `usluga_id`, `datum_vreme` (start, UTC ISO), `kraj_vreme` (end), and `status` (`'aktivan'` = active, `'otkazan'` = cancelled)

**Booking-availability logic** (`app/booking.tsx`): working hours are fixed at 09:00–17:00 in 20-minute increments (`RADNO_OD`/`RADNO_DO`/`KORAK`), looking 30 days ahead (`BROJ_DANA_UNAPRED`). Free slots are computed client-side in `slobodneSatniceZaDan` by diffing the working-hours grid against the selected stylist's already-booked appointments.

**RLS-safe reads/writes via RPC**: once Row Level Security is enabled, a signed-in user cannot read other users' rows directly from `termini`. Availability and double-booking checks instead go through two `SECURITY DEFINER` Postgres RPCs called via `supabase.rpc(...)`:
- `get_zauzeta_vremena(p_frizer_id, p_od, p_do)` — returns only the busy time ranges for a stylist (no `korisnik_id`), used to render free/busy dots on the calendar and compute free slots.
- `postoji_preklapanje(p_frizer_id, p_pocetak, p_kraj)` — boolean check for a conflicting appointment, run immediately before insert in `handleBooking` to guard against a race where a slot was booked after the calendar was last refreshed.

When adding new appointment-related queries, follow this pattern (RPC for cross-user reads, direct `.from('termini')` only for the current user's own rows, as in `app/(tabs)/calendar.tsx`) rather than relaxing RLS.

**Dates/times**: local date strings for the calendar UI are built manually via a `lokalniDatumString(d)` helper (`YYYY-MM-DD` from `Date#getFullYear/getMonth/getDate`) rather than `toISOString()`, to avoid UTC-shifting the displayed day. This helper is duplicated per-file (`app/booking.tsx`, `app/(tabs)/calendar.tsx`) rather than shared — keep that in mind if fixing a date-handling bug in one and not the other.
