from datetime import datetime, timezone
import re
import unicodedata

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from urllib.parse import urlparse

from core.firebase import db
from .firebase_service import get_user_by_id


COLLECTION = 'knowledge_entries'
MANAGER_ROLES = {'admin', 'extension_worker', 'lgu_personnel'}
VALIDATOR_ROLES = {'admin', 'extension_worker', 'lgu_personnel'}
VALIDATION_STATUSES = {'pending', 'validated', 'rejected'}

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
            or entry.get('validatedByName') == 'Curated agricultural source'):
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


_STOP_WORDS = {
    'a', 'about', 'ang', 'and', 'ano', 'are', 'at', 'ba', 'bakit', 'can', 'do',
    'for', 'how', 'i', 'in', 'is', 'ito', 'ko', 'may', 'mga', 'me', 'my', 'na',
    'ng', 'of', 'on', 'or', 'our', 'sa', 'the', 'this', 'to', 'what', 'when',
    'where', 'which', 'who', 'why', 'with', 'we', 'you', 'your', 'does', 'did',
    'there', 'kung', 'paano', 'pwede', 'maaari', 'aking',
}

# Common Filipino agricultural terms are mapped to the English terms used in
# the repository. This keeps the search lightweight while allowing questions
# such as "Bakit naninilaw ang dahon ng palay?" to match English FAQs.
_BILINGUAL_TERMS = {
    'palay': 'rice', 'bigas': 'rice', 'butil': 'grain', 'mais': 'corn',
    'gulay': 'vegetable', 'gulayan': 'vegetable', 'prutas': 'fruit',
    'saka': 'farm', 'sakahan': 'farm', 'bukid': 'farm', 'magsasaka': 'farmer',
    'peste': 'pest', 'pestehan': 'pest', 'sakit': 'disease', 'karamdaman': 'disease',
    'halaman': 'plant', 'tanim': 'planting', 'magtanim': 'planting', 'pagtatanim': 'planting',
    'barayti': 'variety', 'punla': 'seedling', 'kuhol': 'snail', 'patubig': 'irrigation',
    'damo': 'weed', 'pagpapatuyo': 'drying', 'bodega': 'storage', 'gastos': 'cost',
    'panahon': 'weather', 'bagyo': 'typhoon', 'baha': 'flood', 'hayop': 'animal',
    'bakuna': 'vaccination', 'pakain': 'feed',
    'dahon': 'leaf', 'dilaw': 'yellow', 'naninilaw': 'yellow', 'lupa': 'soil',
    'pataba': 'fertilizer', 'abono': 'fertilizer', 'binhi': 'seed', 'buto': 'seed',
    'ulan': 'rain', 'tubig': 'water', 'ani': 'harvest', 'pagaani': 'harvest',
    'presyo': 'price', 'benta': 'market', 'pamilihan': 'market', 'rehistro': 'registration',
    'pagrehistro': 'registration', 'seguro': 'insurance', 'gamot': 'treatment',
    'lunas': 'treatment', 'alaga': 'care', 'alagaing': 'care', 'sungay': 'ear',
    'leaves': 'leaf', 'yellowing': 'yellow', 'seeds': 'seed', 'snails': 'snail',
    'weeds': 'weed', 'vegetables': 'vegetable', 'fruits': 'fruit', 'plants': 'plant',
}


def _canonical_word(word):
    word = ''.join(char for char in unicodedata.normalize('NFKD', word) if not unicodedata.combining(char))
    word = word.lower().strip(".,!?;:()[]{}\"'“”‘’")
    return _BILINGUAL_TERMS.get(word, word)


def _tokens(value):
    if isinstance(value, (list, tuple, set)):
        value = ' '.join(str(item) for item in value)
    words = (_canonical_word(word) for word in re.findall(r"[\w’'-]+", str(value or ''), flags=re.UNICODE))
    return {word for word in words if len(word) > 2 and word not in _STOP_WORDS}


class KnowledgeListView(APIView):
    permission_classes = [IsAuthenticated]

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
            incoming = _tokens(query)
            ranked = []
            for item in entries:
                title_question = _tokens(' '.join([item.get('title', ''), item.get('question', '')]))
                keywords = _tokens(item.get('keywords', []))
                answer = _tokens(item.get('answer', ''))
                matched = incoming & (title_question | keywords | answer)
                if matched:
                    # Percentage represents the share of meaningful query
                    # terms found anywhere in the article. The field score is
                    # used only to break ties in favor of title/question and
                    # keywords over a long answer body.
                    percentage = round(100 * len(matched) / max(len(incoming), 1))
                    field_score = len(matched & title_question) * 3 + len(matched & keywords) * 2 + len(matched & answer)
                    result = {**item, 'matchPercentage': percentage}
                    ranked.append((percentage, field_score, result))
            entries = [item for _, _, item in sorted(ranked, key=lambda row: (row[0], row[1]), reverse=True)]
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
    permission_classes = [IsAuthenticated]

    def patch(self, request, entry_id):
        if request.user.role not in MANAGER_ROLES:
            return Response({'error': 'Only Admins and LGU personnel can manage knowledge.'}, status=status.HTTP_403_FORBIDDEN)
        ref = db.collection(COLLECTION).document(entry_id)
        doc = ref.get()
        if not doc.exists:
            return Response({'error': 'Knowledge entry not found'}, status=status.HTTP_404_NOT_FOUND)
        current = doc.to_dict()
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
            })
        if 'isPublished' in request.data:
            requested_public = bool(request.data.get('isPublished'))
            if requested_public and request.user.role not in VALIDATOR_ROLES:
                return Response({'error': 'Only authorized LGU personnel or an Admin can publish validated knowledge.'}, status=status.HTTP_403_FORBIDDEN)
            if requested_public and current.get('validationStatus') != 'validated':
                return Response({'error': 'Validate the source and recommendation before publishing.'}, status=status.HTTP_400_BAD_REQUEST)
            if not requested_public:
                changes['isPublished'] = False
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
    permission_classes = [IsAuthenticated]

    def post(self, request, entry_id):
        if request.user.role not in VALIDATOR_ROLES:
            return Response({'error': 'Only authorized LGU personnel or an Admin can validate knowledge.'}, status=status.HTTP_403_FORBIDDEN)
        action = str(request.data.get('action') or '').strip().lower()
        if action not in {'approve', 'reject'}:
            return Response({'error': 'action must be approve or reject'}, status=status.HTTP_400_BAD_REQUEST)

        ref = db.collection(COLLECTION).document(entry_id)
        doc = ref.get()
        if not doc.exists:
            return Response({'error': 'Knowledge entry not found'}, status=status.HTTP_404_NOT_FOUND)
        current = doc.to_dict()
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
            'validationNote': str(request.data.get('note') or '').strip() or (
                'Approved by an authorized LGU personnel or Admin.' if action == 'approve' else 'Returned for source or content review.'
            ),
            'updatedAt': now,
        }
        ref.update(changes)
        return Response({'id': entry_id, **current, **changes})
