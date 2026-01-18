import json
from typing import Dict, Set
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.core import get_session, decode_token
from app.models import User, Appointment

router = APIRouter(tags=["WebRTC Signaling"])


class ConnectionManager:
    """Manages WebSocket connections for WebRTC signaling."""
    
    def __init__(self):
        # room_id -> set of websocket connections
        self.rooms: Dict[str, Set[WebSocket]] = {}
        # websocket -> user info
        self.connections: Dict[WebSocket, dict] = {}
    
    async def connect(self, websocket: WebSocket, room_id: str, user_id: str, user_role: str):
        await websocket.accept()
        
        if room_id not in self.rooms:
            self.rooms[room_id] = set()
        
        self.rooms[room_id].add(websocket)
        self.connections[websocket] = {
            "room_id": room_id,
            "user_id": user_id,
            "user_role": user_role
        }
        
        # Notify others in room
        await self.broadcast_to_room(room_id, {
            "type": "user-joined",
            "user_id": user_id,
            "user_role": user_role,
            "participants": len(self.rooms[room_id])
        }, exclude=websocket)
    
    def disconnect(self, websocket: WebSocket):
        if websocket in self.connections:
            info = self.connections[websocket]
            room_id = info["room_id"]
            
            if room_id in self.rooms:
                self.rooms[room_id].discard(websocket)
                if not self.rooms[room_id]:
                    del self.rooms[room_id]
            
            del self.connections[websocket]
            return info
        return None
    
    async def broadcast_to_room(self, room_id: str, message: dict, exclude: WebSocket = None):
        if room_id in self.rooms:
            # Create a copy to avoid 'Set changed size during iteration' error
            connections = list(self.rooms[room_id])
            for connection in connections:
                if connection != exclude:
                    try:
                        await connection.send_json(message)
                    except Exception:
                        pass
    
    async def send_to_user(self, room_id: str, target_user_id: str, message: dict):
        if room_id in self.rooms:
            # Create a copy to avoid 'Set changed size during iteration' error
            connections = list(self.rooms[room_id])
            for connection in connections:
                if connection in self.connections:
                    if self.connections[connection]["user_id"] == target_user_id:
                        try:
                            await connection.send_json(message)
                        except Exception:
                            pass
                        break
    
    def get_room_participants(self, room_id: str) -> list:
        participants = []
        if room_id in self.rooms:
            # Create a copy to avoid 'Set changed size during iteration' error
            connections = list(self.rooms[room_id])
            for connection in connections:
                if connection in self.connections:
                    participants.append(self.connections[connection])
        return participants


manager = ConnectionManager()


@router.websocket("/ws/signaling/{room_id}")
async def websocket_signaling(
    websocket: WebSocket,
    room_id: str,
    token: str = Query(...)
):
    """WebSocket endpoint for WebRTC signaling."""
    # Verify token
    token_data = decode_token(token)
    if not token_data or not token_data.user_id:
        await websocket.close(code=4001, reason="Invalid token")
        return
    
    user_id = token_data.user_id
    user_role = token_data.role.value if token_data.role else "unknown"
    
    # Connect to room
    await manager.connect(websocket, room_id, user_id, user_role)
    
    # Send current participants
    participants = manager.get_room_participants(room_id)
    await websocket.send_json({
        "type": "room-info",
        "room_id": room_id,
        "participants": participants,
        "your_id": user_id
    })
    
    try:
        while True:
            data = await websocket.receive_json()
            message_type = data.get("type")
            
            if message_type == "offer":
                # WebRTC offer - send to target user
                target_id = data.get("target_id")
                await manager.send_to_user(room_id, target_id, {
                    "type": "offer",
                    "offer": data.get("offer"),
                    "from_id": user_id,
                    "from_role": user_role
                })
            
            elif message_type == "answer":
                # WebRTC answer - send to target user
                target_id = data.get("target_id")
                await manager.send_to_user(room_id, target_id, {
                    "type": "answer",
                    "answer": data.get("answer"),
                    "from_id": user_id
                })
            
            elif message_type == "ice-candidate":
                # ICE candidate - send to target user
                target_id = data.get("target_id")
                await manager.send_to_user(room_id, target_id, {
                    "type": "ice-candidate",
                    "candidate": data.get("candidate"),
                    "from_id": user_id
                })
            
            elif message_type == "recording-started":
                # Notify room that recording has started
                await manager.broadcast_to_room(room_id, {
                    "type": "recording-started",
                    "started_by": user_id
                })
            
            elif message_type == "recording-stopped":
                # Notify room that recording has stopped
                await manager.broadcast_to_room(room_id, {
                    "type": "recording-stopped",
                    "stopped_by": user_id
                })
            
            elif message_type == "consent-requested":
                # Doctor requesting consent from patient
                await manager.broadcast_to_room(room_id, {
                    "type": "consent-requested",
                    "requested_by": user_id
                }, exclude=websocket)
            
            elif message_type == "consent-response":
                # Patient responding to consent request
                await manager.broadcast_to_room(room_id, {
                    "type": "consent-response",
                    "granted": data.get("granted"),
                    "from_id": user_id
                }, exclude=websocket)
            
            elif message_type == "chat":
                # In-call chat message
                await manager.broadcast_to_room(room_id, {
                    "type": "chat",
                    "message": data.get("message"),
                    "from_id": user_id,
                    "from_role": user_role
                })
            
            elif message_type == "ping":
                await websocket.send_json({"type": "pong"})
    
    except WebSocketDisconnect:
        info = manager.disconnect(websocket)
        if info:
            await manager.broadcast_to_room(room_id, {
                "type": "user-left",
                "user_id": info["user_id"],
                "user_role": info["user_role"]
            })
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(websocket)


@router.get("/ws/room/{room_id}/participants")
async def get_room_participants(room_id: str):
    """Get current participants in a room."""
    participants = manager.get_room_participants(room_id)
    return {
        "room_id": room_id,
        "participants": participants,
        "count": len(participants)
    }
