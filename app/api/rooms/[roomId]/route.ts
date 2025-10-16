import { NextRequest, NextResponse } from 'next/server';
import type { Player } from '@/lib/types';

// Use in-memory mock for local development, real Redis in production
const useRealRedis = process.env.KV_REST_API_URL ? true : false;

const redis = useRealRedis 
  ? require('@/lib/redis')
  : require('@/lib/redis-mock');

const { 
  getRoom, 
  addPlayer, 
  updatePlayerVote, 
  toggleReveal, 
  resetVotes,
  updatePlayerHeartbeat 
} = redis;

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

