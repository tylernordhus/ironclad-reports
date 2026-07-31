# Ironclad Field Mobile App

This is the iPhone and iPad app for Ironclad Reports.

What works now:

- sign in with the same account used on the website
- synced project list
- project detail with daily reports, pour logs, contractor evaluations, and weekly summary
- in-app handoff for create, edit, PDF, and volume plot workflows
- mobile-only pour-log type picker without the paper-form tools
- per-membership mobile-access gate for the mobile app

Not included in mobile:

- blank printable form
- handwritten import/extract

## What You Need

- a Mac
- Xcode installed
- an iPhone or iPad
- Expo Go installed on the device
- Apple Developer account for native iOS/TestFlight

## First-Time Setup

1. Open Terminal.
2. Change into the mobile app folder:

```bash
cd mobile
```

3. Install dependencies if needed:

```bash
npm install
```

4. Make sure `mobile/.env` exists.

It should contain:

```env
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
EXPO_PUBLIC_API_BASE_URL=https://app.ironcladks.com
```

## Mobile Approval Gate

Primary gate:

- mobile access is now controlled from Supabase on `organization_memberships.mobile_access_enabled`
- if a user has at least one active membership with `mobile_access_enabled = true`, the mobile app is allowed

Legacy fallback:

- `MOBILE_APPROVED_EMAILS` is still supported as a transitional fallback only
- it is used only when org membership records are not present yet for that user or the org membership schema is missing

## Run It

1. In Terminal, stay in `mobile/`.
2. Start Expo:

```bash
npm start
```

3. A QR code will appear.
4. Open Expo Go on the iPhone or iPad.
5. Scan the QR code.
6. The app should open on the device.

## Native iOS / TestFlight Prep

This repo includes:

- `mobile/app.json`
- `mobile/eas.json`

Recommended commands once Apple account access is ready:

```bash
npm install -g eas-cli
cd mobile
eas login
eas build:configure
eas build --platform ios --profile preview
```

For a TestFlight/App Store build:

```bash
cd mobile
eas build --platform ios --profile production
```

## Current Architecture

- mobile app: Expo / React Native
- auth: Supabase auth in the device app
- synced data: website API routes under `/api/mobile/*`
- source of truth: same Supabase project as the website
- mobile approval gate: enforced on the mobile API and mobile web bridge using `organization_memberships.mobile_access_enabled`, with legacy env fallback
