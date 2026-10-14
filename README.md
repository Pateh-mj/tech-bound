# TECH//UNBOUND — Team Discovery Network

A responsive HTML/CSS/vanilla JavaScript prototype for a distributed team of technologists. It includes interest selection, optional callsign/profile cards, a fictional cyber range, and shared aggregate analytics through Supabase.

## Files

- `index.html` — page structure and dialogs
- `styles.css` — responsive enterprise security operations UI
- `config.js` — Supabase project URL and public anon/publishable key
- `app.js` — interest UI, activity event tracking, sandbox logic, shared data
- `schema.sql` — tables, row-level security policies, and aggregate metrics function

## Run locally in about 10 minutes

1. Create a project at https://supabase.com/.
2. In the Supabase dashboard, open **SQL Editor**, paste all of `schema.sql`, and run it.
3. Open **Project Settings → API** (or **Connect**) and copy the Project URL and public anon/publishable key. Do not use a `service_role` or secret key.
4. Paste both values into `config.js`.
5. Serve this folder through a local web server. For example, in VS Code use the Live Server extension, or run `python -m http.server 8000` from this folder and open `http://localhost:8000`.
6. Open the page in a second browser/private window to test separate visitor IDs and shared metrics.

Opening `index.html` directly with `file://` may cause browser/module/network issues; use a local web server.

## First-run behaviour

- Without Supabase configuration, the site runs in local demo mode. A browser-local profile and interest selections work, but shared profiles and cross-device analytics are unavailable.
- A visitor ID is generated randomly and stored in that browser. It is a pseudonymous identifier, not authentication.
- Profiles are only shown publicly if the participant leaves **Show my profile** enabled.
- The activity event table is write-only for browser clients; aggregate metrics are returned by a database function.
- The sample public profile policy is appropriate only for a low-stakes prototype. The browser can claim arbitrary visitor IDs under this anonymous policy, so do not use it to protect sensitive information or to establish verified identity.

## Recommended production hardening

Before broad public deployment, add Supabase Auth (magic link or invite flow), tie profile ownership to `auth.uid()`, restrict profile insert/update policies to the authenticated owner, add rate limiting/abuse monitoring, and move administrator-only analytics to a protected server-side function or Edge Function. Consider a retention window for event logs and publish a short privacy notice. Never add a service-role key to frontend files.

## Safe cyber range

All challenges are simulated in `app.js`; they do not connect to a target host, scan networks, execute shell commands, or test real accounts. It is a learning game, not a real security boundary. The token/flag is deliberately discoverable from the client code because client-side secrets cannot be kept secret.

## Events collected

The app records a random pseudonymous visitor ID, event type, optional selected discipline/mission identifier, and timestamp. It does not collect keystrokes generally, passwords, IP addresses intentionally, or browsing outside this website. The terminal input is processed only for the active fictional challenge and is not sent as a raw event detail.

# tech-bound
A responsive HTML/CSS/vanilla JavaScript prototype for a distributed team of technologists. It includes interest selection, optional callsign/profile cards, a fictional cyber range, and shared aggregate analytics through Supabase.
