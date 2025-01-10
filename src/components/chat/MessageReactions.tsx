import { useSession } from 'next-auth/react'
import { useSocket } from '@/hooks/useSocket'
import { EmojiPicker } from './EmojiPicker'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Reaction } from '@/types/chat'
import { useState } from 'react'

interface EmojiData {
  native: string
  [key: string]: any
}

interface MessageReactionsProps {
  messageId: string
  channelId?: string
  conversationId?: string
  reactions?: Reaction[]
  onReactionAdd: (reaction: Reaction) => void
  onReactionRemove: (reactionId: string) => void
}

export function MessageReactions({
  messageId,
  channelId,
  conversationId,
  reactions = [],
  onReactionAdd,
  onReactionRemove,
}: MessageReactionsProps) {
  const { data: session } = useSession()
  const { socket, sendMessage } = useSocket()
  const [showPicker, setShowPicker] = useState(false)

  const handleEmojiSelect = async (emoji: EmojiData) => {
    if (!session?.user) {
      toast.error('You must be logged in to react to messages')
      return
    }

    // Check if user already reacted with this emoji
    const existingReaction = reactions.find(
      r => r.userId === session.user.id && r.emoji === emoji.native
    )
    
    if (existingReaction) {
      // If user already reacted with this emoji, remove it
      await handleReactionClick(existingReaction.id)
      return
    }

    try {
      const response = await fetch('/api/reactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emoji: emoji.native,
          messageId,
          channelId,
          conversationId,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to add reaction')
      }

      const newReaction: Reaction = await response.json()

      // Emit via socket for real-time updates
      if (socket) {
        await sendMessage('new_reaction', {
          ...newReaction,
          channelId,
          conversationId,
        })
      }

      onReactionAdd(newReaction)
      setShowPicker(false)
      
    } catch (error) {
      console.error('Error adding reaction:', error)
      toast.error('Failed to add reaction. Please try again.')
    }
  }

  const handleReactionClick = async (reactionId: string) => {
    if (!session?.user) {
      toast.error('You must be logged in to remove reactions')
      return
    }

    try {
      const response = await fetch(`/api/reactions?reactionId=${reactionId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to remove reaction')
      }

      // Emit via socket for real-time updates
      if (socket) {
        await sendMessage('reaction_removed', {
          reactionId,
          messageId,
          channelId,
          conversationId,
        })
      }

      // Call onReactionRemove before emitting socket event to ensure local state is updated first
      onReactionRemove(reactionId)
      
    } catch (error) {
      console.error('Error removing reaction:', error)
      toast.error('Failed to remove reaction. Please try again.')
    }
  }

  // Group reactions by emoji
  const groupedReactions = reactions.reduce((acc, reaction) => {
    const key = reaction.emoji
    if (!acc[key]) {
      acc[key] = []
    }
    acc[key].push(reaction)
    return acc
  }, {} as Record<string, Reaction[]>)

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {Object.entries(groupedReactions).map(([emoji, reactions]) => {
        const hasUserReacted = reactions.some(r => r.userId === session?.user?.id)
        const userReaction = reactions.find(r => r.userId === session?.user?.id)
        return (
          <button
            key={emoji}
            onClick={() => {
              if (userReaction) {
                handleReactionClick(userReaction.id)
              } else {
                handleEmojiSelect({ native: emoji })
              }
            }}
            className={cn(
              "flex items-center gap-1 rounded px-2 py-0.5 text-sm transition-colors",
              hasUserReacted 
                ? "bg-blue-600/40 hover:bg-blue-600/60" 
                : "bg-gray-800 hover:bg-gray-700"
            )}
            aria-label={`${emoji} reaction (${reactions.length} ${reactions.length === 1 ? 'user' : 'users'})`}
            tabIndex={0}
            role="button"
          >
            <span>{emoji}</span>
            <span className={cn(
              "text-xs",
              hasUserReacted ? "text-white" : "text-gray-400 group-hover:text-gray-300"
            )}>
              {reactions.length}
            </span>
          </button>
        )
      })}

      <div className="relative">
        <EmojiPicker 
          onEmojiSelect={handleEmojiSelect}
          isOpen={showPicker}
          onOpenChange={setShowPicker}
        />
      </div>
    </div>
  )
} 