export interface Player {
  id: string
  name: string
  vote: string | null
  hasVoted: boolean
  lastSeen: number
}

export interface GameState {
  players: Player[]
  revealed: boolean
  roomId: string
  createdAt: number
  lastActivity: number
}

