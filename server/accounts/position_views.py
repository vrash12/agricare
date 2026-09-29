from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework import status
from .permissions import IsAdmin
from .firebase_service import get_all_positions, get_position_by_id, create_position, update_position, delete_position

class PositionListView(APIView):
    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAuthenticated(), IsAdmin()]

    def get(self, request):
        positions = get_all_positions()
        return Response(positions)

    def post(self, request):
        name = request.data.get('name')
        if not name:
            return Response({'error': 'Name is required'}, status=status.HTTP_400_BAD_REQUEST)
        position_id = create_position({'name': name})
        return Response({'id': position_id, 'message': 'Position created'}, status=status.HTTP_201_CREATED)

class PositionDetailView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def patch(self, request, position_id):
        position = get_position_by_id(position_id)
        if not position:
            return Response({'error': 'Position not found'}, status=status.HTTP_404_NOT_FOUND)
        data = {}
        if 'name' in request.data:
            data['name'] = request.data['name']
        if 'isActive' in request.data:
            data['isActive'] = request.data['isActive']
        update_position(position_id, data)
        return Response({'message': 'Position updated'})

    def delete(self, request, position_id):
        position = get_position_by_id(position_id)
        if not position:
            return Response({'error': 'Position not found'}, status=status.HTTP_404_NOT_FOUND)
        delete_position(position_id)
        return Response({'message': 'Position deleted'})
