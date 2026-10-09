# AgriCare

## Knowledge review and search

In Admin → Knowledge Base, designate active, approved LGU personnel using
**Designated knowledge reviewers**. Admins can review by default. Ordinary
personnel may submit articles but cannot approve them. Authors, last editors,
and recorded contributors cannot review their own submissions, including Admins.

Open each pending article's source and verify that it supports the advice and
applies to local conditions. Approval requires both confirmations and review
notes. Edited articles return to pending validation. A changed article must be
opened and reviewed again before approval. Seed imports never certify advice.

Run `py -3.12 scripts/audit_knowledge_sources.py --output ../artifacts/knowledge-source-audit.csv`
from `server` for a read-only reference availability report. Reachability is
not proof of content accuracy; the report remains pending authorized LGU review.

AgriXa matches English and Tagalog agricultural terms and common phrases.
Results are ordered by query relevance; article-topic hits receive more weight
than answer-only hits. Matching percentages do not measure answer correctness.

Regression checks: from `server`, run
`py -3.12 -m unittest discover -s tests -p "test_knowledge*.py" -v`.

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
