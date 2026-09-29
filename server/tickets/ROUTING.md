# Automatic concern assignment

Farmers submit `categoryId`, title, concern, and optional attachment to
`POST /api/tickets/submit/`. Personnel IDs/names supplied by the client are ignored.
The available category IDs and labels come from `GET /api/tickets/categories/`.

`routing.py` maps categories to the existing LGU position names:

| Category | Responsible position |
| --- | --- |
| Rice / Palay | Rice Report Officer |
| Corn / Mais | Corn Program |
| Vegetables, fruits and high-value crops | High Value Crops Development Program Coordinator |
| Livestock and poultry | Livestock Coordinator |
| Organic agriculture | Organic Program Coordinator |
| Farmer registration / RSBSA | RSBSA Focal Person |
| Seeds and planting materials | Seed Inspector |
| Crop insurance and damage claims | Crop Insurance Coordinator |
| Agribusiness and marketing | Agribusiness and Marketing Program Coordinator |
| Other agricultural concerns | Municipal Agriculturist |

Only active, approved LGU accounts with an active matching position are eligible.
If several qualify, a stable ordering by account ID selects the primary contact.
If the specialist is unavailable, an eligible Municipal Agriculturist receives
the ticket for triage. If neither exists, submission returns 409 without creating
a ticket; the form retains the farmer's entries. Availability is rechecked on
submission. Position names are matched without case or whitespace differences.
Keep this mapping synchronized when renaming positions or changing responsibilities.

New tickets store category ID/name, assigned personnel ID/name, assignment time,
`assignedBy: system`, and `assignmentMethod: category`. Existing tickets remain
readable without a category; no historical category is guessed. Admin reassignment
remains available and records `assignmentMethod: admin`.

Similar-ticket checks are limited to the farmer's tickets in the chosen category,
including tickets subsequently reassigned by an admin. Continuing a conversation
preserves its current assignee and requires existing ticket membership.

## Participant capacity

`capacity.py` defines a limit of **10 distinct farmers**, including the ticket
owner. Assigned personnel and administrators are not farmer participants.
An amber warning starts at **8/10**; a full notice appears at **10/10** (or above
for older records). The API includes count, limit, warning threshold, remaining
places, and capacity status on list, detail, and similar-ticket responses.
The interface uses these server values on all three modules.

The participant-addition service checks and writes membership in one Firestore
transaction so concurrent additions cannot exceed the limit. Existing members
may continue full tickets; duplicate joins are no-ops. Older oversized groups
remain accessible and are shown as full, without removing anyone.

Capacity does not grant access: farmers can only continue tickets they already
belong to. The public submission endpoint does not permit self-joining someone
else's private ticket. Any authorized future membership workflow must use
`join_ticket` after its own access checks.

Offline regression checks (from `server`):

```text
python -m unittest discover -s tests -p test_access_control.py -v
```
