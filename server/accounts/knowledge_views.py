from datetime import datetime, timezone

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from urllib.parse import urlparse

from core.firebase import db
from .firebase_service import get_user_by_id
from .permissions import IsApplicationUser, IsAdmin, is_active_user, WORKER_ROLES


COLLECTION = 'knowledge_entries'
MANAGER_ROLES = {'admin', 'extension_worker', 'lgu_personnel'}
VALIDATION_STATUSES = {'pending', 'validated', 'rejected'}
REVIEWERS_COLLECTION = 'knowledge_reviewers'


def can_validate(user):
    if not is_active_user(user):
        return False
    if user.role == 'admin':
        return True
    if user.role not in WORKER_ROLES:
        return False
    account = get_user_by_id(str(user.id)) or {}
    grant = db.collection(REVIEWERS_COLLECTION).document(str(user.id)).get()
    return (account.get('role') in WORKER_ROLES and account.get('isActive', True) and not account.get('isPending', False)
            and grant.exists and grant.to_dict().get('enabled') is True)


class KnowledgeReviewersView(APIView):
    permission_classes = [IsAuthenticated, IsApplicationUser]

    def get(self, request):
        result = {'canValidate': can_validate(request.user), 'reviewers': []}
        if request.user.role == 'admin':
            from .firebase_service import get_all_extension_workers
            grants = {doc.id: doc.to_dict() for doc in db.collection(REVIEWERS_COLLECTION).get()}
            result['reviewers'] = [{
                'id': worker['id'],
                'name': ' '.join(filter(None, [worker.get('firstName'), worker.get('lastName')])),
                'enabled': grants.get(worker['id'], {}).get('enabled') is True,
                'isActive': worker.get('isActive', True),
                'isPending': worker.get('isPending', False),
            } for worker in get_all_extension_workers()]
        return Response(result)

    def patch(self, request):
        if not IsAdmin().has_permission(request, self):
            return Response({'error': 'Only an Admin can designate reviewers.'}, status=403)
        user_id = str(request.data.get('userId') or '').strip()
        enabled = request.data.get('enabled')
        worker = get_user_by_id(user_id) if user_id else None
        if not worker or worker.get('role') not in WORKER_ROLES:
            return Response({'error': 'LGU personnel account not found.'}, status=404)
        if not isinstance(enabled, bool):
            return Response({'error': 'enabled must be true or false.'}, status=400)
        if enabled and (not worker.get('isActive', True) or worker.get('isPending', False)):
            return Response({'error': 'Approve and activate the account before designation.'}, status=400)
        db.collection(REVIEWERS_COLLECTION).document(user_id).set({
            'enabled': enabled, 'designatedBy': str(request.user.id),
            'updatedAt': datetime.now(timezone.utc).isoformat(),
        })
        return Response({'userId': user_id, 'enabled': enabled})

# Require an HTTPS reference on an official government, academic, FAO, or
# IRRI domain. The reviewer must check that the page supports the advice;
# checking the URL format does not verify the content or its availability.
TRUSTED_SOURCE_SUFFIXES = (
    'gov.ph', 'edu.ph', 'gov', 'edu', 'fao.org', 'irri.org',
)


def _entry(doc):
    # A reference link is not a substitute for an authorized review. Older
    # entries without an explicit review must enter the validation queue.
    entry = {'id': doc.id, **doc.to_dict()}
    # A previous seed version marked imported articles as validated merely
    # because they had a source link. Treat those records as submissions so
    # the Paniqui LGU still performs the required human review.
    if (not entry.get('validationStatus')
            or entry.get('validatedBy') == 'system:knowledge-seed'
            or entry.get('validatedByName') == 'Curated agricultural source'
            or (entry.get('validatedBy') and entry.get('validatedBy') in {
                entry.get('createdBy'), entry.get('lastEditedBy'), *(entry.get('contributorIds') or [])})):
        entry.update(validationStatus='pending', isPublished=False)
    return entry


def _source_error(source_name, source_url):
    source_name = str(source_name or '').strip()
    source_url = str(source_url or '').strip()
    if len(source_name) < 3:
        return 'A source or reference name is required.'
    try:
        parsed = urlparse(source_url)
    except ValueError:
        parsed = None
    hostname = (parsed.hostname or '').lower().rstrip('.') if parsed else ''
    trusted = any(hostname == suffix or hostname.endswith(f'.{suffix}')
                  for suffix in TRUSTED_SOURCE_SUFFIXES)
    if not parsed or parsed.scheme != 'https' or not parsed.netloc or not trusted:
        return 'Use a verifiable HTTPS source from an official government, academic, FAO, or IRRI domain.'
    return ''


def _is_public(entry):
    return (entry.get('isPublished') is True
            and entry.get('validationStatus') == 'validated'
            and not _source_error(entry.get('sourceName'), entry.get('sourceUrl')))


def _actor_name(user):
    data = get_user_by_id(str(user.id)) or {}
    name = ' '.join(part for part in (data.get('firstName'), data.get('lastName')) if part)
    return name or str(user.id)


from .knowledge_search import tokens as _tokens, rank_entries


class KnowledgeListView(APIView):
    permission_classes = [IsAuthenticated, IsApplicationUser]

    def get(self, request):
        query = (request.query_params.get('q') or '').strip().lower()
        category = (request.query_params.get('category') or '').strip()
        docs = db.collection(COLLECTION).get()
        entries = [_entry(doc) for doc in docs]
        if request.user.role not in MANAGER_ROLES:
            entries = [item for item in entries if _is_public(item)]
        if category:
            entries = [item for item in entries if item.get('category') == category]
        if query:
            entries = rank_entries(entries, query)
        else:
            entries.sort(key=lambda item: item.get('updatedAt', item.get('createdAt', '')), reverse=True)
        return Response(entries)

    def post(self, request):
        if request.user.role not in MANAGER_ROLES:
            return Response({'error': 'Only Admins and LGU personnel can manage knowledge.'}, status=status.HTTP_403_FORBIDDEN)
        title = (request.data.get('title') or '').strip()
        answer = (request.data.get('answer') or '').strip()
        source_name = (request.data.get('sourceName') or '').strip()
        source_url = (request.data.get('sourceUrl') or '').strip()
        if not title or not answer:
            return Response({'error': 'title and answer are required'}, status=status.HTTP_400_BAD_REQUEST)
        source_error = _source_error(source_name, source_url)
        if source_error:
            return Response({'error': source_error}, status=status.HTTP_400_BAD_REQUEST)
        now = datetime.now(timezone.utc).isoformat()
        data = {
            'title': title,
            'question': (request.data.get('question') or title).strip(),
            'answer': answer,
            'category': (request.data.get('category') or 'General').strip(),
            'keywords': request.data.get('keywords') or [],
            'sourceName': source_name,
            'sourceUrl': source_url,
            # A manager can submit content, but only an authorized validator
            # can approve it for farmer-facing search results.
            'isPublished': False,
            'validationStatus': 'pending',
            'createdBy': str(request.user.id),
            'createdAt': now,
            'updatedAt': now,
            'submittedAt': now,
        }
        ref = db.collection(COLLECTION).document()
        ref.set(data)
        return Response({'id': ref.id, **data}, status=status.HTTP_201_CREATED)


class KnowledgeDetailView(APIView):
    permission_classes = [IsAuthenticated, IsApplicationUser]

    def patch(self, request, entry_id):
        if request.user.role not in MANAGER_ROLES:
            return Response({'error': 'Only Admins and LGU personnel can manage knowledge.'}, status=status.HTTP_403_FORBIDDEN)
        ref = db.collection(COLLECTION).document(entry_id)
        doc = ref.get()
        if not doc.exists:
            return Response({'error': 'Knowledge entry not found'}, status=status.HTTP_404_NOT_FOUND)
        current = _entry(doc)
        allowed = ('title', 'question', 'answer', 'category', 'keywords', 'sourceName', 'sourceUrl')
        changes = {key: request.data[key] for key in allowed if key in request.data}
        if 'title' in changes: changes['title'] = str(changes['title']).strip()
        if 'answer' in changes: changes['answer'] = str(changes['answer']).strip()
        if 'sourceName' in changes: changes['sourceName'] = str(changes['sourceName']).strip()
        if 'sourceUrl' in changes: changes['sourceUrl'] = str(changes['sourceUrl']).strip()
        merged = {**current, **changes}
        if not str(merged.get('title') or '').strip() or not str(merged.get('answer') or '').strip():
            return Response({'error': 'title and answer are required'}, status=status.HTTP_400_BAD_REQUEST)
        source_error = _source_error(merged.get('sourceName'), merged.get('sourceUrl'))
        if source_error:
            return Response({'error': source_error}, status=status.HTTP_400_BAD_REQUEST)

        content_changed = bool(set(changes) & {'title', 'question', 'answer', 'category', 'keywords', 'sourceName', 'sourceUrl'})
        if content_changed:
            # Any edited recommendation must be reviewed again before it can
            # remain public.
            changes.update({
                'isPublished': False,
                'validationStatus': 'pending',
                'submittedAt': datetime.now(timezone.utc).isoformat(),
                'validatedBy': None,
                'validatedByName': None,
                'validatedByRole': None,
                'validatedAt': None,
                'validationNote': None,
                'lastEditedBy': str(request.user.id),
                'contributorIds': list(dict.fromkeys([*(current.get('contributorIds') or []), str(request.user.id)])),
            })
        if 'isPublished' in request.data:
            requested_public = bool(request.data.get('isPublished'))
            if requested_public and not can_validate(request.user):
                return Response({'error': 'Only authorized LGU personnel or an Admin can publish validated knowledge.'}, status=status.HTTP_403_FORBIDDEN)
            if requested_public and (content_changed or current.get('validationStatus') != 'validated'):
                return Response({'error': 'Validate the source and recommendation before publishing.'}, status=status.HTTP_400_BAD_REQUEST)
            if not requested_public:
                changes['isPublished'] = False
            else:
                changes['isPublished'] = True
        changes['updatedAt'] = datetime.now(timezone.utc).isoformat()
        ref.update(changes)
        return Response({'id': entry_id, **current, **changes})

    def delete(self, request, entry_id):
        if request.user.role not in MANAGER_ROLES:
            return Response({'error': 'Only Admins and LGU personnel can manage knowledge.'}, status=status.HTTP_403_FORBIDDEN)
        ref = db.collection(COLLECTION).document(entry_id)
        if not ref.get().exists:
            return Response({'error': 'Knowledge entry not found'}, status=status.HTTP_404_NOT_FOUND)
        ref.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class KnowledgeValidationView(APIView):
    permission_classes = [IsAuthenticated, IsApplicationUser]

    def post(self, request, entry_id):
        if not can_validate(request.user):
            return Response({'error': 'Only authorized LGU personnel or an Admin can validate knowledge.'}, status=status.HTTP_403_FORBIDDEN)
        action = str(request.data.get('action') or '').strip().lower()
        if action not in {'approve', 'reject'}:
            return Response({'error': 'action must be approve or reject'}, status=status.HTTP_400_BAD_REQUEST)

        ref = db.collection(COLLECTION).document(entry_id)
        doc = ref.get()
        if not doc.exists:
            return Response({'error': 'Knowledge entry not found'}, status=status.HTTP_404_NOT_FOUND)
        current = _entry(doc)
        if str(request.user.id) in {current.get('createdBy'), current.get('lastEditedBy'), *(current.get('contributorIds') or [])}:
            return Response({'error': 'The author or last editor cannot review this submission. Ask another designated reviewer.'}, status=403)
        if current.get('validationStatus', 'pending') != 'pending':
            return Response({'error': 'This submission is no longer pending review. Refresh the repository.'}, status=409)
        if request.data.get('reviewedUpdatedAt') != current.get('updatedAt'):
            return Response({'error': 'The article changed after you opened it. Refresh and review the latest version.'}, status=409)
        if action == 'approve' and (request.data.get('sourceVerified') is not True
                                    or request.data.get('localApplicabilityVerified') is not True
                                    or not str(request.data.get('note') or '').strip()):
            return Response({'error': 'Confirm the supporting source and local applicability, and record review findings before approval.'}, status=400)
        if not str(current.get('title') or '').strip() or not str(current.get('answer') or '').strip():
            if action == 'approve':
                return Response({'error': 'A title and recommended solution are required before approval.'}, status=status.HTTP_400_BAD_REQUEST)
        source_error = _source_error(current.get('sourceName'), current.get('sourceUrl'))
        if action == 'approve' and source_error:
            return Response({'error': source_error}, status=status.HTTP_400_BAD_REQUEST)

        now = datetime.now(timezone.utc).isoformat()
        reviewer = _actor_name(request.user)
        changes = {
            'validationStatus': 'validated' if action == 'approve' else 'rejected',
            'isPublished': action == 'approve',
            'validatedBy': str(request.user.id),
            'validatedByName': reviewer,
            'validatedByRole': request.user.role,
            'validatedAt': now,
            'sourceVerified': action == 'approve',
            'localApplicabilityVerified': action == 'approve',
            'validationNote': str(request.data.get('note') or '').strip() or (
                'Approved by an authorized LGU personnel or Admin.' if action == 'approve' else 'Returned for source or content review.'
            ),
            'updatedAt': now,
        }
        # Refuse to publish if the article changes between inspection and write.
        update_time = getattr(doc, 'update_time', None)
        if update_time is not None:
            from google.cloud.firestore_v1 import LastUpdateOption
            from google.api_core.exceptions import FailedPrecondition
            try:
                ref.update(changes, option=LastUpdateOption(update_time))
            except FailedPrecondition:
                return Response({'error': 'The article changed during review. Refresh and review it again.'}, status=409)
        else:
            ref.update(changes)
        return Response({'id': entry_id, **current, **changes})
