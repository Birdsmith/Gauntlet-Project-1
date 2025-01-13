'use client'

import { useState, useEffect, useRef, useCallback, useMemo, useReducer, memo } from 'react'
import { useSession } from 'next-auth/react'
import { Hash, Plus, Smile, Send, MessageSquare } from 'lucide-react'
import { useSocket } from '@/contexts/SocketContext'
import { toast } from '@/components/ui/use-toast'
import { EmojiPicker } from './EmojiPicker'
import { ThreadView } from './ThreadView'
import { cn } from '@/lib/utils'
import { MessageReactions } from './MessageReactions'
import type { ChannelMessage, Channel, FileAttachment, Reaction, ReactionEvent } from '@/types/chat'
import { SearchBar } from './SearchBar'
import { Virtuoso } from 'react-virtuoso'

const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

interface ChatAreaProps {
  channelId: string
}

// Message reducer to batch updates
type MessageAction =
  | { type: 'SET_MESSAGES'; messages: ChannelMessage[] }
  | { type: 'ADD_MESSAGE'; message: ChannelMessage }
  | { type: 'UPDATE_REACTION'; messageId: string; reaction: Reaction }
  | { type: 'REMOVE_REACTION'; messageId: string; reactionId: string }
  | { type: 'UPDATE_REPLY_COUNT'; messageId: string; replyCount: number }

function messageReducer(state: ChannelMessage[], action: MessageAction): ChannelMessage[] {
  switch (action.type) {
    case 'SET_MESSAGES':
      return action.messages
    case 'ADD_MESSAGE':
      if (state.some(m => m.id === action.message.id)) return state
      return [...state, action.message]
    case 'UPDATE_REACTION':
      return state.map(m =>
        m.id === action.messageId
          ? {
              ...m,
              reactions: [...(Array.isArray(m.reactions) ? m.reactions : []), action.reaction],
            }
          : m
      )
    case 'REMOVE_REACTION':
      return state.map(m =>
        m.id === action.messageId
          ? {
              ...m,
              reactions: Array.isArray(m.reactions)
                ? m.reactions.filter(r => r.id !== action.reactionId)
                : [],
            }
          : m
      )
    case 'UPDATE_REPLY_COUNT':
      return state.map(m =>
        m.id === action.messageId
          ? {
              ...m,
              replyCount: action.replyCount,
            }
          : m
      )
    default:
      return state
  }
}

// Separate MessageImage component to handle image loading
const MessageImage = memo(({ file }: { file: FileAttachment }) => {
  const [isLoaded, setIsLoaded] = useState(false)

  return (
    <div className="mt-2 max-w-2xl">
      <div
        className={cn(
          'relative',
          !isLoaded && 'min-h-[200px] bg-gray-800 animate-pulse rounded-lg'
        )}
      >
        <img
          src={file.url}
          alt={file.name}
          className={cn(
            'rounded-lg object-contain max-h-96',
            !isLoaded && 'opacity-0',
            isLoaded && 'opacity-100'
          )}
          onLoad={() => setIsLoaded(true)}
          decoding="async"
          loading="lazy"
        />
      </div>
      <div className="mt-1 text-xs text-gray-400">
        {file.name} ({(file.size / 1024).toFixed(1)} KB)
      </div>
    </div>
  )
})

MessageImage.displayName = 'MessageImage'

// Separate Message component to prevent full list re-renders
const Message = memo(
  ({
    message,
    channelId,
    onThreadSelect,
    onReactionAdd,
    onReactionRemove,
  }: {
    message: ChannelMessage
    channelId: string
    onThreadSelect: (message: ChannelMessage) => void
    onReactionAdd: (messageId: string, reaction: Reaction) => void
    onReactionRemove: (messageId: string, reactionId: string) => void
  }) => {
    return (
      <div
        key={message.id}
        id={`message-${message.id}`}
        className="group relative flex items-start space-x-3 hover:bg-gray-800/50 px-2 py-1 rounded transition-colors duration-200"
      >
        <div className="relative h-10 w-10 flex-shrink-0">
          {message.user.image ? (
            <img
              src={message.user.image}
              alt={message.user.name || 'User'}
              className="h-full w-full rounded-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-full bg-gray-700 text-sm font-medium text-gray-300">
              {message.user.name?.[0] || '?'}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <span className="font-medium text-white">{message.user.name}</span>
            <span className="text-xs text-gray-400 mt-1">
              {new Date(message.createdAt).toLocaleString()}
            </span>
          </div>
          <p className="text-gray-300">{message.content}</p>
          {message.files?.map(file => (
            <div key={file.id} className="mt-2">
              {file.type.startsWith('image/') ? (
                <MessageImage file={file} />
              ) : (
                <a
                  href={file.url}
                  download={file.name}
                  className="group block rounded-lg border border-gray-700 bg-gray-800 p-4 hover:border-gray-600"
                >
                  <div className="flex items-center gap-2">
                    <svg
                      className="h-4 w-4 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
                      />
                    </svg>
                    <span className="text-sm text-gray-300 group-hover:text-white">
                      {file.name}
                    </span>
                    <span className="ml-auto text-xs text-gray-500">
                      {(file.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                </a>
              )}
            </div>
          ))}
          {/* Reactions and Reply button */}
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'transition-opacity',
                message.reactions?.length ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              )}
            >
              <MessageReactions
                messageId={message.id}
                channelId={channelId}
                reactions={message.reactions}
                onReactionAdd={reaction => onReactionAdd(message.id, reaction)}
                onReactionRemove={reactionId => onReactionRemove(message.id, reactionId)}
              />
            </div>
            <button
              onClick={() => onThreadSelect(message)}
              className={cn(
                'flex items-center gap-1 text-xs text-gray-400 hover:text-gray-300 transition-opacity',
                message.replyCount ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              )}
            >
              <MessageSquare className="h-4 w-4" />
              {message.replyCount ? (
                <span className="font-medium">
                  {message.replyCount} {message.replyCount === 1 ? 'reply' : 'replies'}
                </span>
              ) : (
                <span>Reply</span>
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }
)

Message.displayName = 'Message'

export default function ChatArea({ channelId }: ChatAreaProps) {
  const { socket, isConnected, connect, sendMessage } = useSocket()
  const { data: session } = useSession()
  const [messages, dispatch] = useReducer(messageReducer, [])
  const [channel, setChannel] = useState<Channel | null>(null)
  const [newMessage, setNewMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isFilePickerOpen, setIsFilePickerOpen] = useState(false)
  const [selectedThread, setSelectedThread] = useState<ChannelMessage | null>(null)
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // Memoize handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (!file) return

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a supported file type',
        variant: 'destructive',
      })
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: 'File too large',
        description: 'Please upload a file smaller than 5MB',
        variant: 'destructive',
      })
      return
    }

    setSelectedFile(file)
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a supported file type',
        variant: 'destructive',
      })
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: 'File too large',
        description: 'Please upload a file smaller than 5MB',
        variant: 'destructive',
      })
      return
    }

    setSelectedFile(file)
  }, [])

  const handleRemoveFile = useCallback(() => {
    setSelectedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  const handleEmojiSelect = useCallback((emoji: any) => {
    const input = document.querySelector('input[type="text"]') as HTMLInputElement
    if (!input) return

    const start = input.selectionStart || 0
    const end = input.selectionEnd || 0
    const updatedMessage = newMessage.slice(0, start) + emoji.native + newMessage.slice(end)
    setNewMessage(updatedMessage)

    // Set cursor position after emoji
    setTimeout(() => {
      input.setSelectionRange(start + emoji.native.length, start + emoji.native.length)
      input.focus()
    }, 0)
  }, [newMessage])

  // Memoize the input handler to prevent recreation on every render
  const handleMessageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value)
  }, [])

  // Memoize handlers for Message component
  const handleReactionAdd = useCallback((messageId: string, reaction: Reaction) => {
    dispatch({
      type: 'UPDATE_REACTION',
      messageId,
      reaction,
    })
  }, [])

  const handleReactionRemove = useCallback((messageId: string, reactionId: string) => {
    dispatch({
      type: 'REMOVE_REACTION',
      messageId,
      reactionId,
    })
  }, [])

  const handleThreadSelect = useCallback((message: ChannelMessage) => {
    setSelectedThread(message)
  }, [])

  // Virtualized message list
  const MessageList = useMemo(() => {
    if (messages.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center space-y-4 pt-16 text-center">
          <div className="rounded-full bg-gray-700 p-4">
            <Hash className="h-12 w-12 text-gray-400" />
          </div>
          <h3 className="text-2xl font-bold text-white">Welcome to #{channel?.name}!</h3>
          {channel?.description && <p className="text-gray-400">{channel.description}</p>}
          <p className="text-sm text-gray-400">
            This is the start of the #{channel?.name} channel.
          </p>
        </div>
      )
    }

    return (
      <Virtuoso
        style={{ height: 'calc(100vh - 8rem)' }}
        data={messages}
        itemContent={(index: number, message: ChannelMessage) => (
          <Message
            key={message.id}
            message={message}
            channelId={channelId}
            onThreadSelect={handleThreadSelect}
            onReactionAdd={handleReactionAdd}
            onReactionRemove={handleReactionRemove}
          />
        )}
        initialTopMostItemIndex={messages.length - 1}
        followOutput="smooth"
        alignToBottom
        atBottomThreshold={150}
        className="px-4 scrollbar-thin scrollbar-thumb-gray-500 scrollbar-track-transparent hover:scrollbar-thumb-gray-400"
      />
    )
  }, [messages, channel, channelId, handleThreadSelect, handleReactionAdd, handleReactionRemove])

  // Connect socket when component mounts and session is available
  useEffect(() => {
    console.log('Connection effect triggered:', {
      isConnected,
      hasSocket: !!socket,
      hasSession: !!session?.user,
    })

    if (session?.user) {
      console.log('Session available, attempting to connect')
      connect()
    } else {
      console.log('Waiting for session before connecting')
    }
  }, [connect, session, isConnected, socket])

  // Socket event handling
  useEffect(() => {
    console.log('Channel effect triggered:', {
      hasSocket: !!socket,
      isConnected,
      channelId,
      hasSession: !!session?.user?.id,
    })

    // Join channel function
    const joinChannel = () => {
      if (!channelId || !socket) {
        console.log('Cannot join channel:', { hasChannelId: !!channelId, hasSocket: !!socket })
        return
      }
      console.log('Joining channel:', channelId)
      socket.emit('join_channel', channelId)
    }

    // Join channel when socket is available or reconnects
    if (socket) {
      console.log('Socket available, attempting to join channel')
      if (socket.connected) {
        console.log('Socket is connected, joining channel immediately')
        joinChannel()
      }
      socket.on('connect', () => {
        console.log('Socket connected event, joining channel')
        joinChannel()
      })
    }

    // Event handlers setup
    if (!socket || !isConnected || !channelId || !session?.user?.id) {
      console.log('Skipping event handler setup:', {
        hasSocket: !!socket,
        isConnected,
        hasChannelId: !!channelId,
        hasSession: !!session?.user?.id,
      })
      return
    }

    const handlers = {
      handleMessageReceived: (message: ChannelMessage) => {
        if (message.channelId !== channelId) return
        if (message.userId === session.user.id) return

        // Use requestAnimationFrame for smoother updates
        requestAnimationFrame(() => {
          dispatch({ type: 'ADD_MESSAGE', message })
        })
      },

      handleThreadReplyCountUpdate: (update: {
        messageId: string
        replyCount: number
        channelId: string
      }) => {
        if (update.channelId !== channelId) return

        requestAnimationFrame(() => {
          dispatch({
            type: 'UPDATE_REPLY_COUNT',
            messageId: update.messageId,
            replyCount: update.replyCount,
          })
        })
      },

      handleReactionReceived: (data: ReactionEvent) => {
        if (data.channelId !== channelId) return
        if (data.userId === session.user.id) return

        const targetMessageId = data.messageId
        if (!targetMessageId) return

        const newReaction: Reaction = {
          id: data.id,
          emoji: data.emoji,
          userId: data.userId,
          user: data.user,
          messageId: targetMessageId,
        }

        requestAnimationFrame(() => {
          dispatch({
            type: 'UPDATE_REACTION',
            messageId: targetMessageId,
            reaction: newReaction,
          })
        })
      },

      handleReactionRemoved: (data: {
        reactionId: string
        messageId: string
        channelId: string
      }) => {
        if (data.channelId !== channelId) return

        requestAnimationFrame(() => {
          dispatch({
            type: 'REMOVE_REACTION',
            messageId: data.messageId,
            reactionId: data.reactionId,
          })
        })
      },
    }

    // Set up event listeners
    socket.on('message_received', handlers.handleMessageReceived)
    socket.on('reaction_received', handlers.handleReactionReceived)
    socket.on('reaction_removed', handlers.handleReactionRemoved)
    socket.on('thread-reply-count-update', handlers.handleThreadReplyCountUpdate)

    return () => {
      if (socket) {
        socket.off('connect', joinChannel)
        socket.off('message_received', handlers.handleMessageReceived)
        socket.off('reaction_received', handlers.handleReactionReceived)
        socket.off('reaction_removed', handlers.handleReactionRemoved)
        socket.off('thread-reply-count-update', handlers.handleThreadReplyCountUpdate)
      }
    }
  }, [socket, isConnected, channelId, session?.user?.id])

  // Fetch initial messages with AbortController for cleanup
  useEffect(() => {
    if (!session?.user || !channelId) return

    const abortController = new AbortController()
    const signal = abortController.signal

    async function fetchMessages() {
      try {
        setIsLoading(true)
        const [channelResponse, messagesResponse] = await Promise.all([
          fetch(`/api/channels/${channelId}`, { signal }),
          fetch(`/api/channels/${channelId}/messages`, { signal }),
        ])

        if (signal.aborted) return

        if (!channelResponse.ok) throw new Error('Failed to fetch channel')
        if (!messagesResponse.ok) throw new Error('Failed to fetch messages')

        const [channelData, messagesData] = await Promise.all([
          channelResponse.json(),
          messagesResponse.json(),
        ])

        if (signal.aborted) return

        setChannel(channelData)
        dispatch({ type: 'SET_MESSAGES', messages: messagesData })
      } catch (error: any) {
        if (error.name === 'AbortError') return

        console.error('Error fetching data:', error)
        toast({
          title: 'Error',
          description: 'Failed to load channel data',
          variant: 'destructive',
        })
      } finally {
        if (!signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    fetchMessages()

    return () => {
      abortController.abort()
    }
  }, [channelId, session])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() && !selectedFile) return

    try {
      // Ensure socket is connected before sending
      if (!isConnected) {
        connect()
      }

      let fileData: { name: string; url: string; size: number; type: string } | null = null
      if (selectedFile) {
        const formData = new FormData()
        formData.append('file', selectedFile)
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })
        fileData = await response.json()
      }

      // Send to server via API
      const response = await fetch(`/api/channels/${channelId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: newMessage.trim(),
          file: fileData,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to send message')
      }

      const sentMessage: ChannelMessage = await response.json()

      // Update local state
      dispatch({ type: 'ADD_MESSAGE', message: sentMessage })

      // Emit via socket for real-time
      await sendMessage('new_message', {
        ...sentMessage,
        channelId,
      })

      setNewMessage('')
      setSelectedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error) {
      console.error('Error sending message:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send message',
        variant: 'destructive',
      })
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-1 flex-col">
      {/* Channel header */}
      <div className="flex h-12 items-center justify-between border-b border-gray-700 px-4">
        <div className="flex items-center">
          <Hash className="mr-2 h-5 w-5 text-gray-400" />
          <h2 className="font-medium text-white">{channel?.name}</h2>
          {channel?.description && (
            <div className="ml-4 flex items-center border-l border-gray-700 pl-4">
              <p className="text-sm text-gray-300 line-clamp-1">{channel.description}</p>
            </div>
          )}
        </div>
        <SearchBar
          onSearch={async query => {
            try {
              const response = await fetch(
                `/api/channels/${channelId}/search?query=${encodeURIComponent(query)}`
              )
              if (!response.ok) throw new Error('Failed to search messages')

              const results = await response.json()

              // Find all messages that match the search query
              const matchingMessageIds = results
                .filter((msg: any) => msg.content.toLowerCase().includes(query.toLowerCase()))
                .map((msg: any) => msg.id)

              if (matchingMessageIds.length > 0) {
                return matchingMessageIds
              }

              toast({
                title: 'No results found',
                description: 'No messages match your search query.',
                variant: 'default',
              })

              return undefined
            } catch (error) {
              console.error('Error searching messages:', error)
              toast({
                title: 'Error',
                description: 'Failed to search messages',
                variant: 'destructive',
              })
              return undefined
            }
          }}
          placeholder={`Search messages in #${channel?.name}...`}
        />
      </div>

      {/* Messages area */}
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
        </div>
      ) : (
        MessageList
      )}

      {/* Message input */}
      <div className="border-t border-gray-700 p-4">
        <form onSubmit={handleSubmit} className="flex flex-col space-y-2">
          {selectedFile && (
            <div className="flex items-center gap-2 rounded-md bg-gray-700 p-2">
              <span className="text-sm text-gray-300">{selectedFile.name}</span>
              <button
                type="button"
                onClick={handleRemoveFile}
                className="ml-auto rounded-full p-1 text-gray-400 hover:bg-gray-600 hover:text-gray-300"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          )}
          <div
            className={`relative flex items-center rounded-md bg-gray-700 ${
              isDragging ? 'ring-2 ring-blue-500' : ''
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 text-gray-400 hover:text-gray-300"
            >
              <Plus className="h-5 w-5" />
            </button>
            <input
              type="text"
              value={newMessage}
              onChange={handleMessageChange}
              placeholder={`Message #${channel?.name}`}
              className="flex-1 bg-transparent px-2 py-2 text-white placeholder-gray-400 focus:outline-none"
            />
            <EmojiPicker
              onEmojiSelect={handleEmojiSelect}
              isOpen={isEmojiPickerOpen}
              onOpenChange={setIsEmojiPickerOpen}
              variant="chat"
            />
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="hidden"
              accept={ALLOWED_FILE_TYPES.join(',')}
            />
            <button
              type="submit"
              disabled={!newMessage.trim() && !selectedFile}
              className="px-4 text-gray-400 hover:text-gray-300 disabled:opacity-50"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </form>
      </div>

      {/* Thread panel */}
      {selectedThread && (
        <ThreadView
          parentMessage={selectedThread}
          isOpen={true}
          onClose={() => setSelectedThread(null)}
          channelId={channelId}
        />
      )}
    </div>
  )
}
