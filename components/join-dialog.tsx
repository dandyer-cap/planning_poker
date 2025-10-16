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
      <DialogContent className="sm:max-w-md bg-white dark:bg-card">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-[hsl(var(--foreground))]">Join Planning Poker</DialogTitle>
          <DialogDescription className="text-[hsl(var(--muted-foreground))]">
            Enter your name to start or join a session
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="font-medium">Your Name</Label>
            <Input
              id="name"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
              className="border-[hsl(var(--border))]"
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
              <Label htmlFor="roomId" className="font-medium">Room ID</Label>
              <Input
                id="roomId"
                placeholder="room-abc123"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                required
                className="border-[hsl(var(--border))]"
              />
            </div>
          )}

          <Button 
            type="submit" 
            className="w-full bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white font-medium" 
            disabled={!name.trim() || (!isCreatingRoom && !roomId.trim())}
          >
            {isCreatingRoom ? "Create & Join" : "Join Room"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

