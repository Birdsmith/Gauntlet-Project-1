'use client'

import {
  useState,
  useEffect,
  useRef,
  memo,
  createContext,
  useContext,
  useCallback,
  useReducer,
  useMemo,
} from 'react'
import { useSession } from 'next-auth/react'
import { MessageSquare, Plus, Send } from 'lucide-react'
import { useSocket } from '@/contexts/SocketContext'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/components/ui/use-toast'
import { EmojiPicker } from './EmojiPicker'
import { ThreadView } from './ThreadView'
import { MessageReactions } from './MessageReactions'
import type { DirectMessage, User, FileAttachment, Reaction, ReactionEvent } from '@/types/chat'
import { SearchBar } from './SearchBar'
import { Virtuoso } from 'react-virtuoso'
import { Socket } from 'socket.io-client'

// Constants
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

interface DirectMessageChatProps {
  conversationId: string
  otherUser: User & { isOnline: boolean }
}

// Components
const UserAvatar = ({ user }: { user: User }) => (
  <div className="relative h-8 w-8 flex-shrink-0">
    {user.image ? (
      <img
        src={user.image}
        alt={user.name || 'User'}
        className="h-full w-full rounded-full object-cover"
      />
    ) : (
      <div className="flex h-full w-full items-center justify-center rounded-full bg-gray-700 text-sm font-medium text-gray-300">
        {user.name?.[0] || '?'}
      </div>
    )}
    {user.isOnline !== undefined && (
      <span
        className={cn(
          'absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-gray-900',
          user.isOnline ? 'bg-green-500' : 'bg-gray-500'
        )}
      />
    )}
  </div>
)

const FilePreview = ({ file, onRemove }: { file: File; onRemove: () => void }) => (
  <div className="mt-2">
    {file.type.startsWith('image/') ? (
      <div className="relative max-w-sm group">
        <img
          src={URL.createObjectURL(file)}
          alt={file.name}
          className="rounded-lg object-contain"
          style={{ maxHeight: '384px' }}
        />
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-2 right-2 p-1 rounded-full bg-gray-900/80 text-gray-400 hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
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
        <div className="mt-1 text-xs text-gray-400">
          {file.name} ({(file.size / 1024).toFixed(1)} KB)
        </div>
      </div>
    ) : (
      <div className="relative group">
        <div className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-300 hover:border-gray-600 hover:text-white"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
            />
          </svg>
          <span className="flex-1 truncate">{file.name}</span>
          <span className="text-xs text-gray-500">({(file.size / 1024).toFixed(1)} KB)</span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="absolute -top-2 -right-2 p-1 rounded-full bg-gray-900 text-gray-400 hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
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
  </div>
)

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

// Update MessageAttachment to use MessageImage
const MessageAttachment = memo(({ file }: { file: FileAttachment }) => (
  <div key={file.id} className="mt-2">
    {file.type.startsWith('image/') ? (
      <MessageImage file={file} />
    ) : (
      <div className="mt-2">
        <a
          href={file.url}
          download={file.name}
          className="group inline-flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-300 hover:border-gray-600 hover:text-white"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
            />
          </svg>
          <span>{file.name}</span>
          <span className="text-xs text-gray-500">({(file.size / 1024).toFixed(1)} KB)</span>
        </a>
      </div>
    )}
  </div>
))

MessageAttachment.displayName = 'MessageAttachment'

// Message reducer to batch updates
type MessageAction =
  | { type: 'SET_MESSAGES'; messages: DirectMessage[] }
  | { type: 'CHECK_AND_ADD_MESSAGE'; message: DirectMessage }
  | { type: 'UPDATE_REACTION'; messageId: string; reaction: Reaction }
  | { type: 'REMOVE_REACTION'; messageId: string; reactionId: string }
  | { type: 'UPDATE_REPLY_COUNT'; messageId: string; replyCount: number }

function messageReducer(state: DirectMessage[], action: MessageAction): DirectMessage[] {
  switch (action.type) {
    case 'SET_MESSAGES':
      return action.messages
    case 'CHECK_AND_ADD_MESSAGE':
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
                ? m.reactions.filter(r => r && r.id !== action.reactionId)
                : [],
            }
          : m
      )
    case 'UPDATE_REPLY_COUNT':
      return state.map(m =>
        m.id === action.messageId ? { ...m, replyCount: action.replyCount } : m
      )
    default:
      return state
  }
}

// Separate Message component to prevent full list re-renders
const Message = memo(
  ({
    message,
    conversationId,
    onThreadSelect,
  }: {
    message: DirectMessage & { isAvatarMessage?: boolean; avatarName?: string; avatarVideoUrl?: string }
    conversationId: string
    onThreadSelect: (message: DirectMessage) => void
  }) => {
    const { data: session } = useSession()
    const dispatch = useMessageDispatch()
    const isOwn = message.userId === session?.user?.id
    const hasThread = message.replyCount && message.replyCount > 0

    const handleReactionAdd = useCallback(
      (reaction: Reaction) => {
        dispatch({ type: 'UPDATE_REACTION', messageId: message.id, reaction })
      },
      [message.id, dispatch]
    )

    const handleReactionRemove = useCallback(
      (reactionId: string) => {
        dispatch({ type: 'REMOVE_REACTION', messageId: message.id, reactionId })
      },
      [message.id, dispatch]
    )

    return (
      <div
        className={cn(
          'group relative flex gap-3 px-4 py-2 hover:bg-gray-800/50',
          isOwn && 'flex-row-reverse'
        )}
      >
        <UserAvatar user={message.user} />
        <div className={cn('flex flex-col', isOwn && 'items-end')}>
          <div className="flex items-center gap-2">
            {message.isAvatarMessage ? (
              <span className="text-sm font-medium text-indigo-400">
                {message.avatarName || 'AI Avatar'}
              </span>
            ) : (
              <span className="text-sm font-medium text-gray-300">
                {message.user.name || 'Unknown User'}
              </span>
            )}
            <span className="text-xs text-gray-500">
              {new Date(message.createdAt).toLocaleTimeString()}
            </span>
          </div>
          {message.isAvatarMessage && message.avatarVideoUrl ? (
            <div className="mt-2 max-w-sm">
              <video
                src={message.avatarVideoUrl}
                controls
                className="rounded-lg w-full"
                style={{ maxHeight: '384px' }}
              >
                Your browser does not support the video tag.
              </video>
              <p className="mt-2 text-gray-100 whitespace-pre-wrap break-words">
                {message.content}
              </p>
            </div>
          ) : (
            <p className="text-gray-100 whitespace-pre-wrap break-words">
              {message.content}
            </p>
          )}
          {message.files?.map(file => <MessageAttachment key={file.id} file={file} />)}
          {/* Reactions and Reply button */}
          <div className="mt-1 flex items-center gap-2">
            <div
              className={cn(
                'transition-opacity',
                message.reactions?.length ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              )}
            >
              <MessageReactions
                messageId={message.id}
                conversationId={conversationId}
                reactions={message.reactions}
                onReactionAdd={handleReactionAdd}
                onReactionRemove={handleReactionRemove}
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

// Create a context for the message dispatch
const MessageDispatchContext = createContext<React.Dispatch<MessageAction> | null>(null)

const useMessageDispatch = () => {
  const dispatch = useContext(MessageDispatchContext)
  if (!dispatch) {
    throw new Error('useMessageDispatch must be used within a MessageDispatchProvider')
  }
  return dispatch
}

// Main component
export default function DirectMessageChat({
  conversationId,
  otherUser: initialOtherUser,
}: DirectMessageChatProps) {
  const { data: session } = useSession()
  const { socket, sendMessage } = useSocket()
  const { toast } = useToast()
  const [messages, dispatch] = useReducer(messageReducer, [])
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false)
  const [otherUser, setOtherUser] = useState(initialOtherUser)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [selectedMessage, setSelectedMessage] = useState<DirectMessage | null>(null)

  useEffect(() => {
    if (!socket || !conversationId) return

    // Join the conversation room
    sendMessage('join_conversation', conversationId)

    // Listen for new messages
    const handleDirectMessage = (message: DirectMessage) => {
      dispatch({ type: 'CHECK_AND_ADD_MESSAGE', message })
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    // Subscribe to direct message events
    socket.on('direct_message_received', handleDirectMessage)

    // Cleanup
    return () => {
      socket.off('direct_message_received', handleDirectMessage)
      sendMessage('leave_conversation', conversationId)
    }
  }, [socket, conversationId, sendMessage])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() && selectedFiles.length === 0) return
    if (!session?.user?.id) return

    setIsSending(true)
    try {
      const formData = new FormData()
      formData.append('content', newMessage)
      formData.append('conversationId', conversationId)
      
      // Handle file uploads
      for (const file of selectedFiles) {
        formData.append('files', file)
      }

      const response = await fetch('/api/messages', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) throw new Error('Failed to send message')

      const message = await response.json()

      // Emit the new message through socket
      await sendMessage('new_direct_message', message)

      // Clear input and files immediately after sending
      setNewMessage('')
      setSelectedFiles([])
      setIsEmojiPickerOpen(false)

      // Check if recipient is offline and has AI avatar enabled
      if (!otherUser.isOnline) {
        try {
          const avatarResponse = await fetch('/api/avatar-bot/respond', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              recipientId: otherUser.id,
              message: newMessage,
              conversationId,
            }),
          })

          if (avatarResponse.ok) {
            const avatarData = await avatarResponse.json()
            console.log('AI Avatar response:', avatarData)
            
            // Emit the avatar's response through socket
            if (avatarData) {
              const avatarMessage = {
                id: avatarData.id,
                content: avatarData.response,
                conversationId,
                userId: otherUser.id,
                isAvatarMessage: true,
                avatarName: avatarData.avatarName,
                avatarVideoUrl: avatarData.videoUrl,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                user: otherUser,
                files: [],
                reactions: []
              }
              await sendMessage('new_direct_message', avatarMessage)
            }
          }
        } catch (error) {
          console.error('Error getting AI avatar response:', error)
        }
      }

    } catch (error) {
      console.error('Error sending message:', error)
      toast({
        title: 'Error',
        description: 'Failed to send message. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsSending(false)
    }
  }

  // Fetch initial messages with AbortController for cleanup
  useEffect(() => {
    if (!conversationId) return

    const abortController = new AbortController()
    const signal = abortController.signal

    async function fetchMessages() {
      try {
        setIsLoading(true)
        const response = await fetch(`/api/conversations/${conversationId}/messages`, { signal })
        if (signal.aborted) return

        if (!response.ok) throw new Error('Failed to fetch messages')
        const data = await response.json()

        if (signal.aborted) return
        dispatch({ type: 'SET_MESSAGES', messages: data })
      } catch (error: any) {
        if (error.name === 'AbortError') return

        console.error('Error fetching messages:', error)
        toast({
          title: 'Error',
          description: 'Failed to load messages',
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
  }, [conversationId])

  // Memoize the message list
  const MessageList = useMemo(() => {
    if (messages.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center space-y-4 pt-16 text-center">
          <div className="rounded-full bg-gray-700 p-4">
            <MessageSquare className="h-12 w-12 text-gray-400" />
          </div>
          <h3 className="text-2xl font-bold text-white">No messages yet</h3>
          <p className="text-sm text-gray-400">Send a message to start the conversation</p>
        </div>
      )
    }

    return (
      <Virtuoso
        style={{ height: 'calc(100vh - 8rem)' }}
        data={messages}
        itemContent={(index: number, message: DirectMessage) => (
          <Message
            key={message.id}
            message={message}
            conversationId={conversationId}
            onThreadSelect={setSelectedMessage}
          />
        )}
        initialTopMostItemIndex={messages.length - 1}
        followOutput="smooth"
        alignToBottom
        atBottomThreshold={150}
        className="px-4 scrollbar-thin scrollbar-thumb-gray-500 scrollbar-track-transparent hover:scrollbar-thumb-gray-400"
      />
    )
  }, [messages, conversationId])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // File handling
  const handleFileSelect = (file: File) => {
    if (!file) return

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload an image, PDF, or document file.',
        variant: 'destructive',
      })
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: 'File too large',
        description: 'Please upload a file smaller than 5MB.',
        variant: 'destructive',
      })
      return
    }

    setSelectedFiles(prev => [...prev, file])
  }

  // Enhanced drag and drop handling
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (!isDragging) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileSelect(file)
  }

  // Auto-scroll
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleEmojiSelect = (emoji: any) => {
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
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
      </div>
    )
  }

  return (
    <MessageDispatchContext.Provider value={dispatch}>
      <div className="flex h-full flex-1 flex-col">
        {/* Chat header */}
        <div className="flex h-12 items-center justify-between border-b border-gray-700 px-4">
          <div className="flex items-center">
            <UserAvatar user={otherUser} />
            <div className="ml-3">
              <h2 className="font-medium text-white">{otherUser.name}</h2>
              <p className="text-xs text-gray-400">{otherUser.isOnline ? 'Online' : 'Offline'}</p>
            </div>
          </div>
          <SearchBar
            onSearch={async query => {
              try {
                const response = await fetch(
                  `/api/conversations/${conversationId}/search?query=${encodeURIComponent(query)}`
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
            placeholder={`Search messages with ${otherUser.name}...`}
          />
        </div>

        {/* Messages area */}
        <div
          className={cn(
            'flex-1 overflow-y-auto',
            isDragging && 'border-2 border-dashed border-blue-500 bg-gray-800/50'
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
            </div>
          ) : (
            MessageList
          )}
        </div>

        {/* Message input */}
        <div className="border-t border-gray-700 p-4">
          <form onSubmit={handleSubmit} className="flex flex-col space-y-2">
            {selectedFiles.map(file => (
              <div key={file.name} className="flex items-center gap-2 rounded-md bg-gray-700 p-2">
                <span className="text-sm text-gray-300">{file.name}</span>
                <button
                  type="button"
                  onClick={() => setSelectedFiles(prev => prev.filter(f => f !== file))}
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
            ))}
            <div
              className={cn(
                'relative flex items-center rounded-md bg-gray-700',
                isDragging && 'ring-2 ring-blue-500'
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 text-gray-400 hover:text-gray-300"
                title="Upload file"
              >
                <Plus className="h-5 w-5" />
              </button>
              <input
                type="text"
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                placeholder={`Message ${otherUser.name}`}
                className="flex-1 bg-transparent px-2 py-2 text-white placeholder-gray-400 focus:outline-none"
              />
              <EmojiPicker
                onEmojiSelect={handleEmojiSelect}
                isOpen={isEmojiPickerOpen}
                onOpenChange={setIsEmojiPickerOpen}
                variant="chat"
              />
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileInputChange}
                className="hidden"
                accept={ALLOWED_FILE_TYPES.join(',')}
              />
              <button
                type="submit"
                disabled={(!newMessage.trim() && selectedFiles.length === 0) || isSending}
                className={cn(
                  'px-4 text-gray-400 hover:text-gray-300',
                  isSending && 'opacity-50 cursor-not-allowed'
                )}
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
          </form>
        </div>

        {/* Thread panel */}
        {selectedMessage && (
          <ThreadView
            parentMessage={selectedMessage as DirectMessage}
            isOpen={true}
            onClose={() => setSelectedMessage(null)}
            isDirectMessage={true}
            conversationId={conversationId}
          />
        )}
      </div>
    </MessageDispatchContext.Provider>
  )
}
