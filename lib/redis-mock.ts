// In-memory mock for local development without Vercel KV
// This is useful for testing locally before deploying
import type { GameState, Player } from './types';

const ROOM_EXPIRY = 60 * 60 * 24; // 24 hours
const PLAYER_TIMEOUT = 60 * 5; // 5 minutes

// Simple in-memory store
const rooms = new Map<string, GameState>();

export async function getRoom(roomId: string): Promise<GameState | null> {
  const room = rooms.get(`room:${roomId}`);
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
  
  rooms.set(`room:${roomId}`, room);
  return room;
}

export async function updateRoom(roomId: string, state: GameState): Promise<void> {
  state.lastActivity = Date.now();
  rooms.set(`room:${roomId}`, state);
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

