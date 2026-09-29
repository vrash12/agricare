# AgriCare

Agricultural assistance platform with farmer concern tickets, category-based personnel assignment, a knowledge repository, and participant-capacity warnings.

## Project layout

- `client`: React and Vite frontend.
- `server`: Django REST API and Channels application using external Firebase/Supabase services.

## Local development

Configure local environment variables for each application. Never commit credentials or account exports.

Frontend: run `npm ci` and `npm run dev` inside `client`.

Backend: install the Python dependencies, configure Firebase and Supabase credentials, and run Django from `server`.

## Vercel

Deploy `client` as a Vite project. Supply `VITE_API_URL` (ending in `/api`), `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY` as build environment variables.

Deploy `server` separately as the Django backend. Backend secrets belong only in the backend project's environment settings. Configure CORS for the deployed frontend.

The frontend deployment alone does not provide authentication, email delivery, or ticket APIs. Those require a configured, reachable backend.
