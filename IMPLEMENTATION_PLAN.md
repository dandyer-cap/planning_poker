# Planning Poker - Implementation Plan

> **🎯 Recommended Approach for Vercel Deployment:**  
> **Vercel KV + Polling** - Single platform, no external services, 3-4 hours to implement

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     VERCEL DEPLOYMENT                    │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  Next.js Frontend                                        │
│  ├─ planning-poker.tsx (Polling every 2s)               │
│  ├─ join-dialog.tsx                                      │
│  └─ UI Components (shadcn/ui)                            │
│                         ↕                                 │
│  API Routes (/app/api/rooms/[roomId]/route.ts)          │
│  ├─ GET: Fetch room state                               │
│  └─ POST: Join, Vote, Reveal, Reset, Heartbeat          │
│                         ↕                                 │
│  Redis Helper (lib/redis.ts)                            │
│  └─ Business logic & data management                    │
│                         ↕                                 │
│  Vercel KV (Redis)                                       │
│  └─ Room state storage (30K ops/day free)              │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

**How it works:**
1. User opens app → Name entry dialog
2. Create/join room → API creates room in Redis
3. Frontend polls `/api/rooms/[roomId]` every 2 seconds
4. User votes → POST to API → Updates Redis
5. All clients see updates within 2-3 seconds
6. Inactive players auto-removed after 5 minutes

---

## Current State Analysis

### ✅ What Already Exists
- **UI Components**: Complete planning poker interface with card selection, player display, reveal/hide functionality
- **Local State**: Single-player simulation with hardcoded players
- **Poker Values**: Fibonacci sequence cards (0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, ?, ☕)
- **Features**: Vote reveal, reset, average calculation, consensus detection
- **Design**: Modern, responsive UI using Tailwind CSS and shadcn/ui components

### ❌ What's Missing for Real Multiplayer
- User name entry system
- Room/session creation and joining
- Real-time synchronization between users
- Persistent state management
- Multi-user vote tracking
- Backend or real-time service

---

## Implementation Options (Ranked for Vercel Deployment)

### Option 1: Vercel KV + Polling (Recommended for Vercel) ⭐
**Pros:**
- ✅ Single deployment (everything on Vercel)
- ✅ Vercel KV free tier: 30,000 commands/day
- ✅ No external services or accounts needed
- ✅ Simple API routes (no WebSocket complexity)
- ✅ Vercel serverless functions work perfectly
- ✅ Perfect for planning poker use case

**Cons:**
- 2-3 second polling delay (not instant, but fine for voting)
- More Redis reads than WebSocket approach

**Estimated Time:** 3-4 hours

---

### Option 2: PartyKit (If you need real-time)
**Pros:**
- True real-time (<100ms updates)
- Built specifically for collaborative apps
- Free tier available

**Cons:**
- Requires separate PartyKit deployment
- External service account needed
- Two deployment targets to manage

**Estimated Time:** 3-4 hours

---

### Option 3: Pusher Channels
**Pros:**
- Simple real-time API
- Free tier (100 concurrent connections)

**Cons:**
- Requires Pusher account
- External service dependency

**Estimated Time:** 2-3 hours

---

### Option 4: In-Memory Polling (Development Only)
**Pros:**
- Absolutely free
- No database needed
- Good for testing

**Cons:**
- State resets on server restart
- Not suitable for production
- Data lost between deployments

**Estimated Time:** 2 hours

---

## Recommended Implementation: Vercel KV + Polling

### Phase 1: Setup Vercel KV (30 min)

#### 1.1 Install Vercel KV Package
```bash
npm install @vercel/kv
```

#### 1.2 Setup Vercel KV (Two Options)

**Option A: Using Vercel Dashboard (Recommended)**
1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Create a new KV database
3. Link it to your project
4. Environment variables auto-populate

**Option B: Using Vercel CLI**
```bash
# Install Vercel CLI if needed
npm i -g vercel

# Link project and create KV store
vercel link
vercel env pull .env.local  # This will pull KV credentials
```

#### 1.3 Create Types
Create `lib/types.ts`:
```typescript
export interface Player {
  id: string;
  name: string;
  vote: string | null;
  hasVoted: boolean;
  lastSeen: number;
}

export interface GameState {
  players: Player[];
  revealed: boolean;
  roomId: string;
  createdAt: number;
  lastActivity: number;
}
```

#### 1.4 Create Redis Helper
Create `lib/redis.ts`:
```typescript
import { kv } from '@vercel/kv';
import type { GameState, Player } from './types';

const ROOM_EXPIRY = 60 * 60 * 24; // 24 hours
const PLAYER_TIMEOUT = 60 * 5; // 5 minutes

export async function getRoom(roomId: string): Promise<GameState | null> {
  const room = await kv.get<GameState>(`room:${roomId}`);
  if (!room) return null;

  // Filter out inactive players
  const now = Date.now();
  const activePlayers = room.players.filter(
    p => now - p.lastSeen < PLAYER_TIMEOUT * 1000
  );

  if (activePlayers.length !== room.players.length) {
    room.players = activePlayers;
    await updateRoom(roomId, room);
  }

  return room;
}

export async function createRoom(roomId: string): Promise<GameState> {
  const room: GameState = {
    players: [],
    revealed: false,
    roomId,
    createdAt: Date.now(),
    lastActivity: Date.now(),
  };
  
  await kv.set(`room:${roomId}`, room, { ex: ROOM_EXPIRY });
  return room;
}

export async function updateRoom(roomId: string, state: GameState): Promise<void> {
  state.lastActivity = Date.now();
  await kv.set(`room:${roomId}`, state, { ex: ROOM_EXPIRY });
}

export async function addPlayer(roomId: string, player: Player): Promise<GameState> {
  let room = await getRoom(roomId);
  
  if (!room) {
    room = await createRoom(roomId);
  }

  // Update existing player or add new one
  const existingIndex = room.players.findIndex(p => p.id === player.id);
  if (existingIndex >= 0) {
    room.players[existingIndex] = player;
  } else {
    room.players.push(player);
  }

  await updateRoom(roomId, room);
  return room;
}

export async function updatePlayerVote(
  roomId: string, 
  playerId: string, 
  vote: string
): Promise<GameState | null> {
  const room = await getRoom(roomId);
  if (!room) return null;

  room.players = room.players.map(p =>
    p.id === playerId 
      ? { ...p, vote, hasVoted: true, lastSeen: Date.now() }
      : p
  );

  await updateRoom(roomId, room);
  return room;
}

export async function toggleReveal(roomId: string): Promise<GameState | null> {
  const room = await getRoom(roomId);
  if (!room) return null;

  room.revealed = !room.revealed;
  await updateRoom(roomId, room);
  return room;
}

export async function resetVotes(roomId: string): Promise<GameState | null> {
  const room = await getRoom(roomId);
  if (!room) return null;

  room.players = room.players.map(p => ({
    ...p,
    vote: null,
    hasVoted: false,
    lastSeen: Date.now(),
  }));
  room.revealed = false;

  await updateRoom(roomId, room);
  return room;
}

export async function updatePlayerHeartbeat(
  roomId: string, 
  playerId: string
): Promise<void> {
  const room = await getRoom(roomId);
  if (!room) return;

  room.players = room.players.map(p =>
    p.id === playerId ? { ...p, lastSeen: Date.now() } : p
  );

  await updateRoom(roomId, room);
}
```

---

### Phase 2: Add Name Entry Screen (30 min)

#### 2.1 Create Join Dialog Component
Create `components/join-dialog.tsx`:
```typescript
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface JoinDialogProps {
  open: boolean
  onJoin: (name: string, roomId: string) => void
}

export function JoinDialog({ open, onJoin }: JoinDialogProps) {
  const [name, setName] = useState("")
  const [roomId, setRoomId] = useState("")
  const [isCreatingRoom, setIsCreatingRoom] = useState(true)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim()) {
      const finalRoomId = isCreatingRoom 
        ? `room-${Math.random().toString(36).substring(2, 9)}`
        : roomId
      onJoin(name.trim(), finalRoomId)
    }
  }

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md" hideCloseButton>
        <DialogHeader>
          <DialogTitle>Join Planning Poker</DialogTitle>
          <DialogDescription>
            Enter your name to start or join a session
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Your Name</Label>
            <Input
              id="name"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant={isCreatingRoom ? "default" : "outline"}
              onClick={() => setIsCreatingRoom(true)}
              className="flex-1"
            >
              Create Room
            </Button>
            <Button
              type="button"
              variant={!isCreatingRoom ? "default" : "outline"}
              onClick={() => setIsCreatingRoom(false)}
              className="flex-1"
            >
              Join Room
            </Button>
          </div>

          {!isCreatingRoom && (
            <div className="space-y-2">
              <Label htmlFor="roomId">Room ID</Label>
              <Input
                id="roomId"
                placeholder="room-abc123"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                required
              />
            </div>
          )}

          <Button type="submit" className="w-full" disabled={!name.trim()}>
            {isCreatingRoom ? "Create & Join" : "Join Room"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

---

### Phase 3: Create API Routes (45 min)

Create `app/api/rooms/[roomId]/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { 
  getRoom, 
  addPlayer, 
  updatePlayerVote, 
  toggleReveal, 
  resetVotes,
  updatePlayerHeartbeat 
} from '@/lib/redis';
import type { Player } from '@/lib/types';

export async function GET(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  const roomId = params.roomId;
  const room = await getRoom(roomId);
  
  if (!room) {
    return NextResponse.json(
      { error: 'Room not found' },
      { status: 404 }
    );
  }

  return NextResponse.json(room);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  const roomId = params.roomId;
  const body = await request.json();
  const { action, playerId, playerName, vote } = body;

  try {
    switch (action) {
      case 'join': {
        const player: Player = {
          id: playerId,
          name: playerName,
          vote: null,
          hasVoted: false,
          lastSeen: Date.now(),
        };
        const room = await addPlayer(roomId, player);
        return NextResponse.json(room);
      }

      case 'vote': {
        const room = await updatePlayerVote(roomId, playerId, vote);
        if (!room) {
          return NextResponse.json(
            { error: 'Room not found' },
            { status: 404 }
          );
        }
        return NextResponse.json(room);
      }

      case 'reveal': {
        const room = await toggleReveal(roomId);
        if (!room) {
          return NextResponse.json(
            { error: 'Room not found' },
            { status: 404 }
          );
        }
        return NextResponse.json(room);
      }

      case 'reset': {
        const room = await resetVotes(roomId);
        if (!room) {
          return NextResponse.json(
            { error: 'Room not found' },
            { status: 404 }
          );
        }
        return NextResponse.json(room);
      }

      case 'heartbeat': {
        await updatePlayerHeartbeat(roomId, playerId);
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

---

### Phase 4: Update Planning Poker Component with Polling (1 hour)

Update `components/planning-poker.tsx`:

```typescript
"use client"

import { useState, useEffect, useCallback } from "react"
import { JoinDialog } from "./join-dialog"
import type { Player, GameState } from "@/lib/types"
// ... rest of imports

const POLL_INTERVAL = 2000; // Poll every 2 seconds
const HEARTBEAT_INTERVAL = 10000; // Heartbeat every 10 seconds

export default function PlanningPoker() {
  const [playerId] = useState(() => `player-${Math.random().toString(36).substr(2, 9)}`)
  const [playerName, setPlayerName] = useState<string | null>(null)
  const [roomId, setRoomId] = useState<string | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [revealed, setRevealed] = useState(false)
  const [selectedCard, setSelectedCard] = useState<string | null>(null)

  // Fetch room state
  const fetchRoomState = useCallback(async () => {
    if (!roomId) return;
    
    try {
      const response = await fetch(`/api/rooms/${roomId}`);
      if (response.ok) {
        const room: GameState = await response.json();
        setPlayers(room.players);
        setRevealed(room.revealed);
        
        // Update selected card if changed by us
        const ourPlayer = room.players.find(p => p.id === playerId);
        if (ourPlayer && ourPlayer.vote !== selectedCard) {
          setSelectedCard(ourPlayer.vote);
        }
      }
    } catch (error) {
      console.error('Failed to fetch room state:', error);
    }
  }, [roomId, playerId, selectedCard]);

  // Send heartbeat to keep player active
  const sendHeartbeat = useCallback(async () => {
    if (!roomId || !playerId) return;
    
    try {
      await fetch(`/api/rooms/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'heartbeat', playerId }),
      });
    } catch (error) {
      console.error('Heartbeat failed:', error);
    }
  }, [roomId, playerId]);

  // Polling effect
  useEffect(() => {
    if (!roomId) return;

    // Initial fetch
    fetchRoomState();

    // Setup polling
    const pollInterval = setInterval(fetchRoomState, POLL_INTERVAL);
    
    // Setup heartbeat
    const heartbeatInterval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    return () => {
      clearInterval(pollInterval);
      clearInterval(heartbeatInterval);
    };
  }, [roomId, fetchRoomState, sendHeartbeat]);

  const handleJoin = async (name: string, room: string) => {
    setPlayerName(name);
    setRoomId(room);
    
    try {
      const response = await fetch(`/api/rooms/${room}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'join',
          playerId,
          playerName: name,
        }),
      });

      if (response.ok) {
        const roomState: GameState = await response.json();
        setPlayers(roomState.players);
        setRevealed(roomState.revealed);
      }
    } catch (error) {
      console.error('Failed to join room:', error);
    }
  };

  const handleCardSelect = async (value: string) => {
    setSelectedCard(value);
    
    try {
      await fetch(`/api/rooms/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'vote',
          playerId,
          vote: value,
        }),
      });
      // State will update via polling
    } catch (error) {
      console.error('Failed to vote:', error);
    }
  };

  const handleReveal = async () => {
    try {
      await fetch(`/api/rooms/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reveal', playerId }),
      });
      // State will update via polling
    } catch (error) {
      console.error('Failed to reveal:', error);
    }
  };

  const handleReset = async () => {
    setSelectedCard(null);
    
    try {
      await fetch(`/api/rooms/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset', playerId }),
      });
      // State will update via polling
    } catch (error) {
      console.error('Failed to reset:', error);
    }
  };

  // Show join dialog if not connected
  if (!playerName || !roomId) {
    return <JoinDialog open={true} onJoin={handleJoin} />
  }

  const allVoted = players.every((p) => p.hasVoted)
  const votedCount = players.filter((p) => p.hasVoted).length

  const getAverage = () => {
    const numericVotes = players
      .map((p) => p.vote)
      .filter((v) => v && !isNaN(Number(v)))
      .map(Number)

    if (numericVotes.length === 0) return null
    const sum = numericVotes.reduce((a, b) => a + b, 0)
    return (sum / numericVotes.length).toFixed(1)
  }

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      {/* Header */}
      <div className="mb-12 text-center">
        <Badge className="mb-4 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">
          Agile Estimation
        </Badge>
        <h1 className="text-4xl md:text-6xl font-bold mb-4 text-balance">Planning Poker</h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto text-balance">
          Collaborate with your team to estimate story points using the Fibonacci sequence
        </p>
      </div>

      {/* Room Info */}
      <div className="mb-8 text-center">
        <p className="text-sm text-muted-foreground">
          Room ID: <code className="bg-muted px-2 py-1 rounded font-mono">{roomId}</code>
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Share this ID with your team
        </p>
      </div>

      {/* Rest of existing UI (Players Section, Card Selection, etc.) */}
      {/* ... keep all the existing JSX from lines 85-194 of original component ... */}
    </div>
  )
}
```

---

### Phase 5: Testing & Deployment (30 min)

#### 5.1 Local Testing (Without KV)

For local development without Vercel KV, you can use in-memory storage temporarily:

Create `lib/redis-mock.ts` for development:
```typescript
// Simple in-memory mock for local development
const rooms = new Map<string, any>();

export async function getRoom(roomId: string) {
  return rooms.get(`room:${roomId}`) || null;
}

export async function createRoom(roomId: string) {
  const room = {
    players: [],
    revealed: false,
    roomId,
    createdAt: Date.now(),
    lastActivity: Date.now(),
  };
  rooms.set(`room:${roomId}`, room);
  return room;
}

// ... implement other functions similarly
```

Then in your API route, use:
```typescript
import * as redis from '@/lib/redis-mock'; // for local
// import * as redis from '@/lib/redis'; // for production
```

#### 5.2 Test Locally
```bash
npm run dev
```

Open multiple browser windows/tabs:
1. Window 1: Create a room
2. Window 2: Join the same room with the Room ID
3. Test voting, reveal, reset
4. Close one window and verify player disappears after 5 minutes

#### 5.3 Deploy to Vercel

```bash
# Install Vercel CLI if needed
npm i -g vercel

# Deploy
vercel

# Follow prompts to:
# - Link to a project (or create new)
# - Add Vercel KV storage when prompted
```

**Or use Vercel Dashboard:**
1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Import your Git repository
3. In Settings → Storage → Create KV Database
4. Link it to your project
5. Deploy will happen automatically

#### 5.4 Post-Deployment Checklist
- ✅ Create a test room
- ✅ Share room link with team member
- ✅ Test all voting functionality
- ✅ Verify players can join/leave
- ✅ Check that inactive players disappear after 5 minutes
- ✅ Test on mobile devices

---

## Implementation Checklist

### Step-by-Step Guide:

- [ ] **Phase 1**: Install `@vercel/kv` and create types/helpers (30 min)
- [ ] **Phase 2**: Create join dialog component (30 min)
- [ ] **Phase 3**: Create API routes for room management (45 min)
- [ ] **Phase 4**: Update planning poker component with polling (1 hour)
- [ ] **Phase 5**: Test locally with mock Redis (30 min)
- [ ] **Deploy**: Push to Vercel and add KV database (15 min)

### Quick Start Commands:

```bash
# 1. Install dependencies
npm install @vercel/kv

# 2. Create files (see Phase 1-4 above)

# 3. Test locally
npm run dev

# 4. Deploy to Vercel
vercel
```

---

## Environment Variables

### For Production (Vercel)
Environment variables are automatically added when you create a Vercel KV database through the dashboard or CLI:
- `KV_URL`
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`
- `KV_REST_API_READ_ONLY_TOKEN`

**No manual configuration needed!** ✅

### For Local Development
```bash
# Option 1: Use Vercel CLI to pull production env vars
vercel env pull .env.local

# Option 2: Use in-memory mock (no env vars needed)
# Just import from '@/lib/redis-mock' instead of '@/lib/redis'
```

Create `.env.local` (if using real KV locally):
```bash
KV_REST_API_URL="your-kv-url"
KV_REST_API_TOKEN="your-token"
```

---

## Estimated Total Time

- **Vercel KV + Polling Solution**: 3-4 hours
- **Alternative PartyKit Solution**: 3-4 hours (but requires separate deployment)
- **Alternative Pusher Solution**: 2-3 hours (but requires external service)

---

## Key Features Included

✅ **Room Creation & Joining**
- Create rooms with unique IDs
- Join existing rooms with room ID
- Share room ID with team

✅ **Player Management**
- Name entry on join
- Automatic removal of inactive players (5 min timeout)
- Real player list display

✅ **Voting System**
- Full Fibonacci sequence cards
- Vote submission and tracking
- Vote reveal/hide functionality
- Reset votes for new rounds

✅ **Statistics**
- Average calculation
- Consensus detection
- Vote count tracking

✅ **User Experience**
- 2-3 second update latency (acceptable for planning poker)
- Responsive design (already implemented)
- Modern UI with shadcn/ui components

---

## Additional Features (Future Enhancements)

Once basic multiplayer is working, consider:
- [ ] Copy room link button with toast notification
- [ ] Direct room URL: `/room/[roomId]` (auto-join from link)
- [ ] Show individual player names who haven't voted yet
- [ ] Timer for voting rounds with sound
- [ ] Story/task description input field
- [ ] Vote history tracking (last 10 rounds)
- [ ] Export results to CSV/JSON
- [ ] Spectator mode (view-only access)
- [ ] Sound effects on reveal
- [ ] Confetti animation on unanimous votes
- [ ] Custom card values (beyond Fibonacci)
- [ ] Room password protection

---

## Why This Approach is Perfect for Vercel

✅ **Single Platform**: Everything hosted on Vercel  
✅ **Cost-Effective**: Free tier is generous (30K KV ops/day)  
✅ **Simple Deployment**: One command (`vercel`)  
✅ **Serverless-Friendly**: No WebSocket complications  
✅ **Good Enough**: 2-3 second delays are fine for planning poker  
✅ **Scalable**: Vercel KV scales automatically  
✅ **No External Accounts**: Everything within Vercel

---

## Ready to Implement?

The implementation plan is complete and ready to execute. Each phase has detailed code examples that you can copy and adapt. The total implementation time is 3-4 hours from start to deployed app.

**Next step**: Let me know if you'd like me to help implement this, or if you have any questions about the approach!

