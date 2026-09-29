from datetime import datetime, timezone

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status

from core.firebase import db


COLLECTION = 'knowledge_entries'
MANAGER_ROLES = {'admin', 'extension_worker', 'lgu_personnel'}


def _entry(doc):
    return {'id': doc.id, **doc.to_dict()}


def _tokens(value):
    return {word.strip('.,!?;:()[]{}').lower() for word in (value or '').split() if len(word.strip('.,!?;:()[]{}')) > 2}


class KnowledgeListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        query = (request.query_params.get('q') or '').strip().lower()
        category = (request.query_params.get('category') or '').strip()
        docs = db.collection(COLLECTION).get()
        entries = [_entry(doc) for doc in docs]
        if request.user.role not in MANAGER_ROLES:
            entries = [item for item in entries if item.get('isPublished', True)]
        if category:
            entries = [item for item in entries if item.get('category') == category]
        if query:
            incoming = _tokens(query)
            ranked = []
            for item in entries:
                haystack = ' '.join([item.get('title', ''), item.get('question', ''), item.get('answer', ''), ' '.join(item.get('keywords', []))])
                score = len(incoming & _tokens(haystack))
                if score:
                    ranked.append((score, item))
            entries = [item for _, item in sorted(ranked, key=lambda row: row[0], reverse=True)]
        else:
            entries.sort(key=lambda item: item.get('updatedAt', item.get('createdAt', '')), reverse=True)
        return Response(entries)

    def post(self, request):
        if request.user.role not in MANAGER_ROLES:
            return Response({'error': 'Only Admins and LGU personnel can manage knowledge.'}, status=status.HTTP_403_FORBIDDEN)
        title = (request.data.get('title') or '').strip()
        answer = (request.data.get('answer') or '').strip()
        if not title or not answer:
            return Response({'error': 'title and answer are required'}, status=status.HTTP_400_BAD_REQUEST)
        now = datetime.now(timezone.utc).isoformat()
        data = {
            'title': title,
            'question': (request.data.get('question') or title).strip(),
            'answer': answer,
            'category': (request.data.get('category') or 'General').strip(),
            'keywords': request.data.get('keywords') or [],
            'isPublished': bool(request.data.get('isPublished', True)),
            'createdBy': str(request.user.id),
            'createdAt': now,
            'updatedAt': now,
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
        allowed = ('title', 'question', 'answer', 'category', 'keywords', 'isPublished')
        changes = {key: request.data[key] for key in allowed if key in request.data}
        if 'title' in changes: changes['title'] = str(changes['title']).strip()
        if 'answer' in changes: changes['answer'] = str(changes['answer']).strip()
        changes['updatedAt'] = datetime.now(timezone.utc).isoformat()
        ref.update(changes)
        return Response({'id': entry_id, **doc.to_dict(), **changes})

    def delete(self, request, entry_id):
        if request.user.role not in MANAGER_ROLES:
            return Response({'error': 'Only Admins and LGU personnel can manage knowledge.'}, status=status.HTTP_403_FORBIDDEN)
        ref = db.collection(COLLECTION).document(entry_id)
        if not ref.get().exists:
            return Response({'error': 'Knowledge entry not found'}, status=status.HTTP_404_NOT_FOUND)
        ref.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
