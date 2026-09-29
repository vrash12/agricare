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

Import the repository root with the Services preset. The root `vercel.json` builds the React client and Django server together on one domain. Requests under `/api/` and `/ws/` reach Django; frontend routes reach Vite. No separate backend URL is required.

Configure Firebase, Supabase, Django and SMTP credentials in Vercel environment settings, never in Git. Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are included in the browser build. Production API requests use `/api`.

Set `DEBUG=False` and a strong `SECRET_KEY`. An external `REDIS_URL` is required for reliable live broadcasts across multiple backend instances; without it, broadcasts only reach connections on the same instance. Stored tickets and messages remain in Firestore.
