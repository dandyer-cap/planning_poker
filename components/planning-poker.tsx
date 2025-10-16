"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Eye, EyeOff, RotateCcw, Copy, Check } from "lucide-react"
import { JoinDialog } from "./join-dialog"
import type { Player, GameState } from "@/lib/types"

const POKER_VALUES = ["0", "1", "2", "3", "5", "8", "13", "21", "34", "55", "89", "?", "☕"]
const POLL_INTERVAL = 2000 // Poll every 2 seconds
const HEARTBEAT_INTERVAL = 10000 // Heartbeat every 10 seconds

export default function PlanningPoker() {
  const [playerId] = useState(() => `player-${Math.random().toString(36).substr(2, 9)}`)
  const [playerName, setPlayerName] = useState<string | null>(null)
  const [roomId, setRoomId] = useState<string | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [revealed, setRevealed] = useState(false)
  const [selectedCard, setSelectedCard] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Fetch room state
  const fetchRoomState = useCallback(async () => {
    if (!roomId) return
    
    try {
      const response = await fetch(`/api/rooms/${roomId}`)
      if (response.ok) {
        const room: GameState = await response.json()
        setPlayers(room.players)
        setRevealed(room.revealed)
        
        // Update selected card if changed
        const ourPlayer = room.players.find(p => p.id === playerId)
        if (ourPlayer && ourPlayer.vote !== selectedCard) {
          setSelectedCard(ourPlayer.vote)
        }
      }
    } catch (error) {
      console.error('Failed to fetch room state:', error)
    }
  }, [roomId, playerId, selectedCard])

  // Send heartbeat to keep player active
  const sendHeartbeat = useCallback(async () => {
    if (!roomId || !playerId) return
    
    try {
      await fetch(`/api/rooms/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'heartbeat', playerId }),
      })
    } catch (error) {
      console.error('Heartbeat failed:', error)
    }
  }, [roomId, playerId])

  // Polling effect
  useEffect(() => {
    if (!roomId) return

    // Initial fetch
    fetchRoomState()

    // Setup polling
    const pollInterval = setInterval(fetchRoomState, POLL_INTERVAL)
    
    // Setup heartbeat
    const heartbeatInterval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL)

    return () => {
      clearInterval(pollInterval)
      clearInterval(heartbeatInterval)
    }
  }, [roomId, fetchRoomState, sendHeartbeat])

  const handleJoin = async (name: string, room: string) => {
    setPlayerName(name)
    setRoomId(room)
    
    try {
      const response = await fetch(`/api/rooms/${room}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'join',
          playerId,
          playerName: name,
        }),
      })

      if (response.ok) {
        const roomState: GameState = await response.json()
        setPlayers(roomState.players)
        setRevealed(roomState.revealed)
      }
    } catch (error) {
      console.error('Failed to join room:', error)
    }
  }

  const handleCardSelect = async (value: string) => {
    setSelectedCard(value)
    
    try {
      await fetch(`/api/rooms/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'vote',
          playerId,
          vote: value,
        }),
      })
      // State will update via polling
    } catch (error) {
      console.error('Failed to vote:', error)
    }
  }

  const handleReveal = async () => {
    try {
      await fetch(`/api/rooms/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reveal', playerId }),
      })
      // State will update via polling
    } catch (error) {
      console.error('Failed to reveal:', error)
    }
  }

  const handleReset = async () => {
    setSelectedCard(null)
    
    try {
      await fetch(`/api/rooms/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset', playerId }),
      })
      // State will update via polling
    } catch (error) {
      console.error('Failed to reset:', error)
    }
  }

  const handleCopyRoomId = () => {
    if (roomId) {
      navigator.clipboard.writeText(roomId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

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
      <div className="mb-8 text-center">
        <Badge className="mb-4 bg-[hsl(var(--brand-blue))]/10 text-[hsl(var(--brand-blue))] border-[hsl(var(--brand-blue))]/20 hover:bg-[hsl(var(--brand-blue))]/20">
          Agile Estimation
        </Badge>
        <h1 className="text-4xl md:text-6xl font-bold mb-4 text-balance">Planning Poker</h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto text-balance">
          Collaborate with your team to estimate story points using the Fibonacci sequence
        </p>
      </div>

      {/* Room Info */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 bg-white dark:bg-muted px-4 py-3 rounded-lg shadow-sm border border-border">
          <span className="text-sm text-muted-foreground font-medium">Room ID:</span>
          <code className="font-mono font-semibold text-[hsl(var(--foreground))]">{roomId}</code>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyRoomId}
            className="h-6 w-6 p-0 hover:bg-[hsl(var(--brand-blue))]/10"
          >
            {copied ? (
              <Check className="h-3 w-3 text-[hsl(var(--brand-green))]" />
            ) : (
              <Copy className="h-3 w-3 text-[hsl(var(--brand-blue))]" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Share this Room ID with your team to collaborate
        </p>
      </div>

      {/* Players Section */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold mb-1">Team Members</h2>
            <p className="text-sm text-muted-foreground">
              {votedCount} of {players.length} voted
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleReveal}
              disabled={!allVoted}
              variant={revealed ? "secondary" : "default"}
              className="gap-2"
            >
              {revealed ? (
                <>
                  <EyeOff className="h-4 w-4" />
                  Hide Votes
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4" />
                  Reveal Votes
                </>
              )}
            </Button>
            <Button onClick={handleReset} variant="outline" className="gap-2 bg-transparent">
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {players.map((player) => (
            <Card
              key={player.id}
              className="p-6 flex flex-col items-center justify-center gap-4 bg-white dark:bg-card border border-border hover:border-[hsl(var(--brand-blue))]/50 transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <div className="text-center">
                <p className="font-medium mb-1">{player.name}</p>
                <p className="text-xs text-muted-foreground">{player.hasVoted ? "Voted" : "Waiting..."}</p>
              </div>
              <div className="w-16 h-24 rounded-lg border-2 border-border bg-white dark:bg-secondary flex items-center justify-center">
                {revealed && player.vote ? (
                  <span className="text-3xl font-bold">{player.vote}</span>
                ) : player.hasVoted ? (
                  <div className="w-12 h-16 rounded bg-[hsl(var(--brand-blue))]/20 border border-[hsl(var(--brand-blue))]/40" />
                ) : (
                  <span className="text-muted-foreground text-2xl">—</span>
                )}
              </div>
            </Card>
          ))}
        </div>

        {revealed && allVoted && (
          <Card className="mt-6 p-6 bg-[hsl(var(--brand-blue))]/5 border-[hsl(var(--brand-blue))]/20 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Average Estimate</p>
                <p className="text-3xl font-bold text-[hsl(var(--brand-blue))]">
                  {getAverage() || "N/A"} {getAverage() && "points"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground mb-1">Consensus</p>
                <p className="text-lg font-semibold">
                  {new Set(players.map((p) => p.vote)).size === 1 ? "✓ Unanimous" : "⚠ Discuss"}
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Card Selection */}
      <div>
        <h2 className="text-2xl font-semibold mb-6 text-center">Select Your Estimate</h2>
        <div className="grid grid-cols-4 md:grid-cols-7 lg:grid-cols-13 gap-3 max-w-7xl mx-auto">
          {POKER_VALUES.map((value) => (
            <button
              key={value}
              onClick={() => handleCardSelect(value)}
              disabled={revealed}
              className={`
                aspect-[2/3] rounded-xl border-2 transition-all duration-200
                flex items-center justify-center text-2xl md:text-3xl font-bold
                hover:scale-105 hover:shadow-lg active:scale-95
                disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
                ${
                  selectedCard === value
                    ? "bg-[hsl(var(--brand-blue))] text-white border-[hsl(var(--brand-blue))] shadow-xl shadow-[hsl(var(--brand-blue))]/30 scale-105"
                    : "bg-white dark:bg-card text-card-foreground border-border hover:border-[hsl(var(--brand-blue))]/50 shadow-sm"
                }
              `}
            >
              {value}
            </button>
          ))}
        </div>
        {selectedCard && !revealed && (
          <p className="text-center mt-6 text-muted-foreground">
            You selected <span className="text-[hsl(var(--brand-blue))] font-semibold">{selectedCard}</span>
          </p>
        )}
      </div>
    </div>
  )
}
