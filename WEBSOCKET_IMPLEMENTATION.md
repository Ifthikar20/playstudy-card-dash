# WebSocket Real-Time Implementation Guide

Complete guide to adding real-time WebSocket functionality to PlayStudy Card Dashboard.

---

## 📊 Architecture Overview

### Current Stack
- **Frontend:** React/Vite (AWS Amplify)
- **Backend:** FastAPI (Python) on ECS/EC2
- **Database:** PostgreSQL
- **Cache:** Redis

### WebSocket Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   AWS Amplify (Frontend)                     │
│                   React + WebSocket Client                   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ WSS:// (Secure WebSocket)
                         │
         ┌───────────────▼────────────────┐
         │   Application Load Balancer    │
         │   (Sticky Sessions Enabled)    │
         └───────────────┬────────────────┘
                         │
         ┌───────────────┴────────────────┐
         │                                │
┌────────▼────────┐          ┌───────────▼────────┐
│ ECS Task 1      │          │ ECS Task 2         │
│ FastAPI + WS    │◄────────►│ FastAPI + WS       │
│ Handler         │  Redis   │ Handler            │
└────────┬────────┘  Pub/Sub └───────────┬────────┘
         │                               │
         └───────────────┬───────────────┘
                         │
         ┌───────────────▼────────────────┐
         │          Redis Pub/Sub         │
         │    (Cross-instance messaging)  │
         └───────────────┬────────────────┘
                         │
         ┌───────────────▼────────────────┐
         │      PostgreSQL Database       │
         │     (Persistent storage)       │
         └────────────────────────────────┘
```

---

## 🎯 Implementation Options

### Option 1: FastAPI WebSockets (Recommended)
- ✅ Native WebSocket support in FastAPI
- ✅ Easy to integrate with existing backend
- ✅ Full control over implementation
- ✅ Works with your current stack
- ⚠️ Requires Redis Pub/Sub for multi-instance support

### Option 2: AWS API Gateway WebSocket API
- ✅ Serverless, auto-scaling
- ✅ AWS-managed infrastructure
- ✅ Integrates with Lambda
- ⚠️ More complex setup
- ⚠️ Different backend architecture

### Option 3: Third-Party Services
- **Pusher:** $49/month, easy integration
- **Ably:** $29/month, powerful features
- **Supabase Realtime:** Free tier available
- ⚠️ External dependency
- ⚠️ Additional costs

**Recommendation:** Use **Option 1 (FastAPI WebSockets)** for full control and seamless integration.

---

## 🚀 Implementation Guide - FastAPI WebSockets

### Backend Implementation

#### 1. Install Dependencies

```bash
cd backend

# Add to requirements.txt
cat >> requirements.txt <<EOF
websockets>=12.0
redis>=5.0.0
aioredis>=2.0.1
EOF

pip install -r requirements.txt
```

#### 2. Create WebSocket Manager

Create `backend/app/websocket/manager.py`:

```python
from typing import Dict, List
from fastapi import WebSocket
import json
import redis.asyncio as redis
import logging

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        # Store active connections per user
        self.active_connections: Dict[str, List[WebSocket]] = {}
        self.redis_client = None

    async def initialize_redis(self, redis_url: str):
        """Initialize Redis for pub/sub across multiple instances"""
        self.redis_client = await redis.from_url(redis_url)

    async def connect(self, websocket: WebSocket, user_id: str):
        """Accept and store WebSocket connection"""
        await websocket.accept()

        if user_id not in self.active_connections:
            self.active_connections[user_id] = []

        self.active_connections[user_id].append(websocket)
        logger.info(f"User {user_id} connected. Total connections: {len(self.active_connections[user_id])}")

    def disconnect(self, websocket: WebSocket, user_id: str):
        """Remove WebSocket connection"""
        if user_id in self.active_connections:
            self.active_connections[user_id].remove(websocket)

            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

        logger.info(f"User {user_id} disconnected")

    async def send_personal_message(self, message: dict, user_id: str):
        """Send message to specific user (all their connections)"""
        if user_id in self.active_connections:
            message_str = json.dumps(message)

            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_text(message_str)
                except Exception as e:
                    logger.error(f"Error sending to {user_id}: {e}")

    async def broadcast(self, message: dict, exclude_user: str = None):
        """Broadcast message to all connected users"""
        message_str = json.dumps(message)

        for user_id, connections in self.active_connections.items():
            if exclude_user and user_id == exclude_user:
                continue

            for connection in connections:
                try:
                    await connection.send_text(message_str)
                except Exception as e:
                    logger.error(f"Error broadcasting to {user_id}: {e}")

    async def publish_to_redis(self, channel: str, message: dict):
        """Publish message to Redis for cross-instance communication"""
        if self.redis_client:
            await self.redis_client.publish(
                channel,
                json.dumps(message)
            )

    async def subscribe_to_redis(self, channel: str):
        """Subscribe to Redis channel for cross-instance messages"""
        if not self.redis_client:
            return

        pubsub = self.redis_client.pubsub()
        await pubsub.subscribe(channel)

        async for message in pubsub.listen():
            if message['type'] == 'message':
                data = json.loads(message['data'])

                # Broadcast to all local connections
                user_id = data.get('user_id')
                if user_id:
                    await self.send_personal_message(data, user_id)
                else:
                    await self.broadcast(data)

# Global manager instance
manager = ConnectionManager()
```

#### 3. Create WebSocket Endpoints

Create `backend/app/api/websocket.py`:

```python
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.websocket.manager import manager
from app.core.auth import verify_token
import logging

logger = logging.getLogger(__name__)
router = APIRouter()
security = HTTPBearer()

@router.websocket("/ws/{user_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    user_id: str,
    token: str = None  # Pass token as query param: /ws/{user_id}?token=xxx
):
    """
    WebSocket endpoint for real-time communication

    Connect via: wss://your-domain.com/api/ws/USER_ID?token=JWT_TOKEN
    """

    # Authenticate user
    try:
        if not token:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        # Verify JWT token
        payload = verify_token(token)
        authenticated_user_id = payload.get("user_id")

        if authenticated_user_id != user_id:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

    except Exception as e:
        logger.error(f"Authentication failed: {e}")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # Connect user
    await manager.connect(websocket, user_id)

    # Send welcome message
    await manager.send_personal_message({
        "type": "connection",
        "message": "Connected successfully",
        "user_id": user_id
    }, user_id)

    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()

            # Parse message
            import json
            message = json.loads(data)

            # Handle different message types
            message_type = message.get("type")

            if message_type == "chat":
                # Chat message - broadcast to all users
                await manager.broadcast({
                    "type": "chat",
                    "user_id": user_id,
                    "message": message.get("message"),
                    "timestamp": message.get("timestamp")
                })

                # Also publish to Redis for other instances
                await manager.publish_to_redis("chat", {
                    "type": "chat",
                    "user_id": user_id,
                    "message": message.get("message"),
                    "timestamp": message.get("timestamp")
                })

            elif message_type == "study_update":
                # Study progress update - send to specific users or broadcast
                await manager.send_personal_message({
                    "type": "study_update",
                    "data": message.get("data")
                }, user_id)

            elif message_type == "game_state":
                # Real-time game state update
                await manager.broadcast({
                    "type": "game_state",
                    "user_id": user_id,
                    "state": message.get("state")
                }, exclude_user=user_id)

            elif message_type == "ping":
                # Heartbeat
                await manager.send_personal_message({
                    "type": "pong",
                    "timestamp": message.get("timestamp")
                }, user_id)

            else:
                # Unknown message type
                await manager.send_personal_message({
                    "type": "error",
                    "message": f"Unknown message type: {message_type}"
                }, user_id)

    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)

        # Notify others
        await manager.broadcast({
            "type": "user_disconnected",
            "user_id": user_id
        })

    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket, user_id)


@router.get("/ws/health")
async def websocket_health():
    """Check WebSocket service health"""
    return {
        "status": "healthy",
        "active_connections": len(manager.active_connections),
        "total_sockets": sum(len(conns) for conns in manager.active_connections.values())
    }
```

#### 4. Update Main Application

Update `backend/app/main.py`:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import websocket
from app.websocket.manager import manager
import os

app = FastAPI(title="PlayStudy API")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://main.xxxxx.amplifyapp.com",  # Your Amplify URL
        "http://localhost:5173",  # Local development
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include WebSocket router
app.include_router(websocket.router, prefix="/api", tags=["websocket"])

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    await manager.initialize_redis(redis_url)

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    if manager.redis_client:
        await manager.redis_client.close()
```

---

## 💻 Frontend Implementation

### 1. Create WebSocket Hook

Create `src/hooks/useWebSocket.ts`:

```typescript
import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth'; // Your auth hook

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

interface UseWebSocketOptions {
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export const useWebSocket = (options: UseWebSocketOptions = {}) => {
  const {
    onMessage,
    onConnect,
    onDisconnect,
    onError,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const { user, token } = useAuth(); // Get user and JWT token

  const connect = useCallback(() => {
    if (!user || !token) {
      console.log('No user or token, skipping WebSocket connection');
      return;
    }

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    setConnectionStatus('connecting');

    // WebSocket URL
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';
    const url = `${wsUrl}/api/ws/${user.id}?token=${token}`;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setConnectionStatus('connected');
        reconnectAttemptsRef.current = 0;
        onConnect?.();
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          onMessage?.(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        onError?.(error);
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        setConnectionStatus('disconnected');
        wsRef.current = null;
        onDisconnect?.();

        // Attempt reconnection
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          console.log(`Reconnecting... Attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts}`);

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        } else {
          console.log('Max reconnection attempts reached');
        }
      };
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      setConnectionStatus('disconnected');
    }
  }, [user, token, onMessage, onConnect, onDisconnect, onError, reconnectInterval, maxReconnectAttempts]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    setConnectionStatus('disconnected');
  }, []);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected');
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    connectionStatus,
    sendMessage,
    connect,
    disconnect,
  };
};
```

### 2. Create WebSocket Context

Create `src/contexts/WebSocketContext.tsx`:

```typescript
import React, { createContext, useContext, useState, useCallback } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { toast } from 'sonner';

interface WebSocketContextValue {
  isConnected: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected';
  sendMessage: (message: any) => void;
  messages: any[];
}

const WebSocketContext = createContext<WebSocketContextValue | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [messages, setMessages] = useState<any[]>([]);

  const handleMessage = useCallback((message: any) => {
    console.log('Received message:', message);

    setMessages((prev) => [...prev, message]);

    // Handle different message types
    switch (message.type) {
      case 'connection':
        toast.success('Connected to real-time updates');
        break;

      case 'chat':
        // Handle chat message
        break;

      case 'study_update':
        // Handle study progress update
        toast.info('Study progress updated');
        break;

      case 'game_state':
        // Handle game state update
        break;

      case 'error':
        toast.error(message.message);
        break;

      default:
        console.log('Unknown message type:', message.type);
    }
  }, []);

  const handleConnect = useCallback(() => {
    console.log('WebSocket connected');
  }, []);

  const handleDisconnect = useCallback(() => {
    console.log('WebSocket disconnected');
    toast.error('Real-time connection lost. Reconnecting...');
  }, []);

  const handleError = useCallback((error: Event) => {
    console.error('WebSocket error:', error);
  }, []);

  const { isConnected, connectionStatus, sendMessage } = useWebSocket({
    onMessage: handleMessage,
    onConnect: handleConnect,
    onDisconnect: handleDisconnect,
    onError: handleError,
  });

  return (
    <WebSocketContext.Provider
      value={{
        isConnected,
        connectionStatus,
        sendMessage,
        messages,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocketContext = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within WebSocketProvider');
  }
  return context;
};
```

### 3. Update App Entry Point

Update `src/App.tsx`:

```typescript
import { WebSocketProvider } from '@/contexts/WebSocketContext';

function App() {
  return (
    <AuthProvider>
      <WebSocketProvider>
        {/* Your app components */}
      </WebSocketProvider>
    </AuthProvider>
  );
}

export default App;
```

### 4. Use WebSocket in Components

Example: `src/components/RealTimeChat.tsx`:

```typescript
import { useState } from 'react';
import { useWebSocketContext } from '@/contexts/WebSocketContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export const RealTimeChat = () => {
  const { isConnected, sendMessage, messages } = useWebSocketContext();
  const [inputMessage, setInputMessage] = useState('');

  const handleSend = () => {
    if (!inputMessage.trim()) return;

    sendMessage({
      type: 'chat',
      message: inputMessage,
      timestamp: new Date().toISOString(),
    });

    setInputMessage('');
  };

  const chatMessages = messages.filter((m) => m.type === 'chat');

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-xl font-bold">Real-Time Chat</h2>
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          <span className="text-sm">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {chatMessages.map((msg, index) => (
          <div key={index} className="p-2 bg-gray-100 rounded">
            <span className="font-semibold">{msg.user_id}: </span>
            <span>{msg.message}</span>
            <span className="text-xs text-gray-500 ml-2">
              {new Date(msg.timestamp).toLocaleTimeString()}
            </span>
          </div>
        ))}
      </div>

      <div className="p-4 border-t flex gap-2">
        <Input
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type a message..."
          disabled={!isConnected}
        />
        <Button onClick={handleSend} disabled={!isConnected}>
          Send
        </Button>
      </div>
    </div>
  );
};
```

---

## 🔧 Environment Configuration

### Frontend (.env.production)

```bash
# WebSocket URL
VITE_WS_URL=wss://api.yourdomain.com

# Or for ALB:
VITE_WS_URL=wss://your-alb-xxxxx.us-east-1.elb.amazonaws.com
```

### Backend (.env)

```bash
# Redis URL for pub/sub
REDIS_URL=redis://your-redis-endpoint:6379

# For ElastiCache:
REDIS_URL=redis://playstudy-redis.xxxxx.cache.amazonaws.com:6379
```

---

## 🚀 Deployment Configuration

### ALB Configuration for WebSockets

Update your Application Load Balancer to support WebSockets:

```bash
# Enable sticky sessions (required for WebSockets)
aws elbv2 modify-target-group-attributes \
  --target-group-arn $TG_ARN \
  --attributes \
    Key=stickiness.enabled,Value=true \
    Key=stickiness.type,Value=lb_cookie \
    Key=stickiness.lb_cookie.duration_seconds,Value=86400
```

### ECS Task Definition Update

Add to `deploy/ecs-task-definition.json`:

```json
{
  "environment": [
    {
      "name": "REDIS_URL",
      "value": "redis://your-redis-endpoint:6379"
    }
  ],
  "portMappings": [
    {
      "containerPort": 8000,
      "protocol": "tcp"
    }
  ]
}
```

### Security Group Rules

Ensure WebSocket traffic is allowed:

```bash
# Allow WebSocket connections (uses same port as HTTP/HTTPS)
# ALB Security Group should already allow 443 (HTTPS)
# ECS Security Group should allow traffic from ALB
```

---

## 📊 Use Cases for WebSockets

### 1. Real-Time Study Sessions
```typescript
// Sync study progress across devices
sendMessage({
  type: 'study_update',
  data: {
    card_id: '123',
    status: 'completed',
    score: 95
  }
});
```

### 2. Multiplayer Games
```typescript
// Real-time game state
sendMessage({
  type: 'game_state',
  state: {
    players: [...],
    score: {...},
    current_turn: 'user123'
  }
});
```

### 3. Live Notifications
```typescript
// Push notifications
sendMessage({
  type: 'notification',
  data: {
    title: 'New Achievement!',
    message: 'You completed 10 lessons'
  }
});
```

### 4. Collaborative Learning
```typescript
// Multiple users studying together
sendMessage({
  type: 'collaboration',
  data: {
    action: 'cursor_move',
    position: { x: 100, y: 200 }
  }
});
```

---

## 🔍 Testing

### Test WebSocket Connection

```bash
# Install wscat
npm install -g wscat

# Test connection (replace with your URL and token)
wscat -c "ws://localhost:8000/api/ws/user123?token=YOUR_JWT_TOKEN"

# Send test message
> {"type": "ping", "timestamp": "2025-01-01T00:00:00Z"}

# Should receive:
< {"type": "pong", "timestamp": "2025-01-01T00:00:00Z"}
```

### Frontend Testing

```typescript
// In browser console
const ws = new WebSocket('ws://localhost:8000/api/ws/user123?token=YOUR_TOKEN');

ws.onopen = () => console.log('Connected');
ws.onmessage = (event) => console.log('Message:', JSON.parse(event.data));

ws.send(JSON.stringify({
  type: 'chat',
  message: 'Hello World!',
  timestamp: new Date().toISOString()
}));
```

---

## 📈 Performance Considerations

### 1. Connection Limits
- **ALB:** 50,000 concurrent connections
- **ECS:** Scale tasks based on connection count
- **Redis:** Use cluster mode for high traffic

### 2. Auto-Scaling

```bash
# Scale ECS based on WebSocket connections
aws application-autoscaling put-scaling-policy \
  --policy-name websocket-scale-policy \
  --service-namespace ecs \
  --resource-id service/playstudy-cluster/playstudy-backend-service \
  --scalable-dimension ecs:service:DesiredCount \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration \
    'PredefinedMetricSpecification={PredefinedMetricType=ECSServiceAverageCPUUtilization},TargetValue=70.0'
```

### 3. Message Rate Limiting

```python
# In backend/app/websocket/manager.py
from slowapi import Limiter, _rate_limit_exceeded_handler

limiter = Limiter(key_func=lambda: user_id)

@limiter.limit("100/minute")
async def send_message(message: dict):
    # Send message with rate limiting
    pass
```

---

## 💰 Cost Implications

### Additional Costs for WebSockets

| Resource | Before | With WebSockets | Increase |
|----------|--------|-----------------|----------|
| **ECS Fargate** | $30-40/mo | $40-60/mo | +$10-20/mo |
| **Redis** | $15-20/mo | $15-20/mo | $0 (same) |
| **Data Transfer** | $5-10/mo | $10-20/mo | +$5-10/mo |
| **ALB** | $16-20/mo | $16-20/mo | $0 (same) |
| **Total** | $66-90/mo | $81-120/mo | **+$15-30/mo** |

**Why the increase?**
- More CPU/memory for WebSocket connections
- Increased data transfer for real-time updates

---

## 🚨 Troubleshooting

### WebSocket Connection Fails

**Issue:** Cannot connect to WebSocket

**Solutions:**
1. Check CORS settings allow WebSocket upgrade
2. Verify ALB has sticky sessions enabled
3. Check security groups allow traffic
4. Ensure token is valid and not expired

### Messages Not Received Across Instances

**Issue:** Messages sent from one ECS task not received by users on another task

**Solution:** Ensure Redis pub/sub is configured:
```python
# Subscribe to Redis channel on startup
await manager.subscribe_to_redis("chat")
```

### High Connection Drops

**Issue:** Users frequently disconnected

**Solutions:**
1. Implement heartbeat/ping-pong
2. Increase ALB idle timeout
3. Add automatic reconnection logic (already in useWebSocket hook)

---

## 📚 Additional Resources

- [FastAPI WebSockets Docs](https://fastapi.tiangolo.com/advanced/websockets/)
- [AWS ALB WebSocket Support](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-target-groups.html#websockets)
- [Redis Pub/Sub Guide](https://redis.io/docs/manual/pubsub/)
- [WebSocket API MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)

---

## ✅ Implementation Checklist

### Backend
- [ ] Install websockets and redis dependencies
- [ ] Create ConnectionManager class
- [ ] Add WebSocket endpoint with authentication
- [ ] Configure Redis pub/sub
- [ ] Update CORS to allow WebSocket connections
- [ ] Add health check endpoint

### Frontend
- [ ] Create useWebSocket hook
- [ ] Create WebSocketContext
- [ ] Add WebSocketProvider to App
- [ ] Set VITE_WS_URL environment variable
- [ ] Implement reconnection logic
- [ ] Add UI indicators for connection status

### Infrastructure
- [ ] Enable ALB sticky sessions
- [ ] Update ECS task definition with Redis URL
- [ ] Configure security groups
- [ ] Set up auto-scaling for WebSocket load
- [ ] Add CloudWatch metrics for connections

### Testing
- [ ] Test WebSocket connection locally
- [ ] Test message sending/receiving
- [ ] Test reconnection logic
- [ ] Test across multiple ECS instances
- [ ] Load test with multiple concurrent connections

---

**Ready to implement?** Start with the backend WebSocket manager, then add the frontend hook, and finally deploy to your infrastructure!
