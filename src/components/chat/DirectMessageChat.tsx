'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { MessageSquare, Plus, Send } from 'lucide-react'
import { useSocket } from '@/hooks/useSocket'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/components/ui/use-toast'
import { EmojiPicker } from './EmojiPicker'
import { ThreadView } from './ThreadView'
import { MessageReactions } from './MessageReactions'
import type { DirectMessage, User, FileAttachment, Reaction, ReactionEvent } from '@/types/chat'
import { SearchBar } from './SearchBar'

// Constants
const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="mt-1 text-xs text-gray-400">
          {file.name} ({(file.size / 1024).toFixed(1)} KB)
        </div>
      </div>
    ) : (
      <div className="relative group">
        <div className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-300">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
          <span className="flex-1 truncate">{file.name}</span>
          <span className="text-xs text-gray-500">
            ({(file.size / 1024).toFixed(1)} KB)
          </span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="absolute -top-2 -right-2 p-1 rounded-full bg-gray-900 text-gray-400 hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    )}
  </div>
)

const MessageAttachment = ({ file }: { file: FileAttachment }) => (
  <div key={file.id} className="mt-2">
    {file.type.startsWith('image/') ? (
      <div className="mt-2 max-w-sm">
        <img
          src={file.url}
          alt={file.name}
          className="rounded-lg object-contain"
          style={{ maxHeight: '384px' }}
        />
        <div className="mt-1 text-xs text-gray-400">
          {file.name} ({(file.size / 1024).toFixed(1)} KB)
        </div>
      </div>
    ) : (
      <div className="mt-2">
        <a
          href={file.url}
          download={file.name}
          className="group inline-flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-300 hover:border-gray-600 hover:text-white"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
          <span>{file.name}</span>
          <span className="text-xs text-gray-500">
            ({(file.size / 1024).toFixed(1)} KB)
          </span>
        </a>
      </div>
    )}
  </div>
)

// Main component
export default function DirectMessageChat({ conversationId, otherUser }: DirectMessageChatProps) {
  const { data: session } = useSession()
  const [messages, setMessages] = useState<DirectMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [selectedThread, setSelectedThread] = useState<DirectMessage | null>(null)
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { socket, isConnected, sendMessage } = useSocket()

  const Message = ({ message }: { message: DirectMessage }) => (
    <div 
      id={`message-${message.id}`}
      className="group relative flex items-start space-x-3 hover:bg-gray-800/50 px-2 py-1 rounded transition-colors duration-200"
    >
      <UserAvatar user={message.user} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <span className="font-medium text-white">
            {message.user.name}
          </span>
          <span className="text-xs text-gray-400 mt-1">
            {new Date(message.createdAt).toLocaleString()}
          </span>
        </div>
        <p className="text-gray-100 whitespace-pre-wrap break-words">
          {message.content}
        </p>
        {message.files?.map((file) => (
          <MessageAttachment key={file.id} file={file} />
        ))}
        {/* Reactions and Reply button */}
        <div className="mt-1 flex items-center gap-2">
          <div className={cn(
            "transition-opacity",
            message.reactions?.length ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}>
            <MessageReactions
              messageId={message.id}
              conversationId={conversationId}
              reactions={message.reactions}
              onReactionAdd={(reaction) =>
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === message.id
                      ? { ...m, reactions: [...(m.reactions || []), reaction] }
                      : m
                  )
                )
              }
              onReactionRemove={(reactionId) =>
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === message.id
                      ? {
                          ...m,
                          reactions: m.reactions.filter((r) => r.id !== reactionId),
                        }
                      : m
                  )
                )
              }
            />
          </div>
          <button
            onClick={() => setSelectedThread(message)}
            className={cn(
              "flex items-center gap-1 text-xs text-gray-400 hover:text-gray-300 transition-opacity",
              message.replyCount ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}
          >
            <MessageSquare className="h-4 w-4" />
            {message.replyCount ? (
              <span className="font-medium">{message.replyCount} {message.replyCount === 1 ? 'reply' : 'replies'}</span>
            ) : (
              <span>Reply</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // File handling
  const handleFileSelect = (file: File) => {
    if (!file) {
      toast({
        title: 'Error',
        description: 'No file selected',
        variant: 'destructive',
      })
      return
    }

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      toast({
        title: 'Error',
        description: `File type not supported. Allowed types: ${ALLOWED_FILE_TYPES.map(type => type.split('/')[1]).join(', ')}`,
        variant: 'destructive',
      })
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: 'Error',
        description: `File size must be less than ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
        variant: 'destructive',
      })
      return
    }

    setSelectedFile(file)
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
    
    const files = Array.from(e.dataTransfer.files)
    const validFiles = files.filter(file => ALLOWED_FILE_TYPES.includes(file.type))
    
    if (validFiles.length === 0) {
      toast({
        title: 'Error',
        description: `File type not supported. Allowed types: ${ALLOWED_FILE_TYPES.map(type => type.split('/')[1]).join(', ')}`,
        variant: 'destructive',
      })
      return
    }

    if (validFiles[0].size > MAX_FILE_SIZE) {
      toast({
        title: 'Error',
        description: `File size must be less than ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
        variant: 'destructive',
      })
      return
    }

    handleFileSelect(validFiles[0])
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileSelect(file)
  }

  // Message handling
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() && !selectedFile) return

    try {
      setIsSending(true)
      let fileData: { name: string; url: string; size: number; type: string } | null = null
      
      if (selectedFile) {
        const formData = new FormData()
        formData.append('file', selectedFile)
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })
        
        if (!response.ok) {
          throw new Error('Failed to upload file')
        }
        
        fileData = await response.json()
      }

      // Send to server via API
      const response = await fetch(`/api/conversations/${conversationId}/messages`, {
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

      const sentMessage: DirectMessage = await response.json()

      // Update local state
      setMessages(prev => [...prev, sentMessage])

      // Emit via socket for real-time
      if (socket) {
        await sendMessage('new_direct_message', {
          ...sentMessage,
          conversationId,
        })
      }

      setNewMessage('')
      setSelectedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      scrollToBottom()
    } catch (error) {
      console.error('Error sending message:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send message',
        variant: 'destructive',
      })
    } finally {
      setIsSending(false)
    }
  }

  // Socket event handling
  useEffect(() => {
    if (!socket) return

    const joinConversation = () => {
      if (isConnected) {
        console.log('Joining conversation:', conversationId)
        socket.emit('join_conversation', conversationId)
      }
    }

    const handleDirectMessageReceived = (message: DirectMessage) => {
      console.log('Direct message received:', message)
      if (message.conversationId === conversationId) {
        setMessages(prev => [...prev, message])
        scrollToBottom()
      }
    }

    const handleReactionReceived = (data: { messageId?: string, directMessageId?: string, reaction: any, conversationId: string }) => {
      console.log('Reaction received:', data)
      if (data.conversationId !== conversationId) {
        console.log('Reaction not for this conversation, ignoring')
        return
      }

      const targetMessageId = data.directMessageId || data.messageId
      setMessages(prev =>
        prev.map(m =>
          m.id === targetMessageId
            ? {
                ...m,
                reactions: [...(m.reactions || []), data.reaction],
              }
            : m
        )
      )
    }

    const handleReactionRemoved = (data: { messageId?: string, directMessageId?: string, reactionId: string, conversationId: string }) => {
      console.log('Reaction removed:', data)
      if (data.conversationId !== conversationId) {
        console.log('Reaction removal not for this conversation, ignoring')
        return
      }

      const targetMessageId = data.directMessageId || data.messageId
      setMessages(prev =>
        prev.map(m =>
          m.id === targetMessageId
            ? {
                ...m,
                reactions: (m.reactions || []).filter(r => r.id !== data.reactionId),
              }
            : m
        )
      )
    }

    // Join conversation when socket connects
    if (isConnected) {
      joinConversation()
    }

    socket.on('connect', joinConversation)
    socket.on('direct_message_received', handleDirectMessageReceived)
    socket.on('reaction_received', handleReactionReceived)
    socket.on('reaction_removed', handleReactionRemoved)

    // Cleanup
    return () => {
      console.log('Cleaning up socket handlers')
      socket.off('connect', joinConversation)
      socket.off('direct_message_received', handleDirectMessageReceived)
      socket.off('reaction_received', handleReactionReceived)
      socket.off('reaction_removed', handleReactionRemoved)
    }
  }, [socket, isConnected, conversationId])

  // Fetch initial messages
  useEffect(() => {
    async function fetchMessages() {
      try {
        setIsLoading(true)
        const response = await fetch(`/api/conversations/${conversationId}/messages`)
        if (!response.ok) throw new Error('Failed to fetch messages')
        const data = await response.json()
        setMessages(data)
      } catch (error) {
        console.error('Error fetching messages:', error)
        toast({
          title: 'Error',
          description: 'Failed to load messages',
          variant: 'destructive',
        })
      } finally {
        setIsLoading(false)
      }
    }

    if (conversationId) {
      fetchMessages()
    }
  }, [conversationId])

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

  // Handle thread reply count updates
  const handleThreadReplyCountUpdate = (update: { messageId: string; replyCount: number; conversationId?: string }) => {
    console.log('Received thread reply count update:', update)
    if (update.conversationId !== conversationId) return

    setMessages((prev) => prev.map((message) => {
      if (message.id === update.messageId) {
        return {
          ...message,
          replyCount: (message.replyCount || 0) + update.replyCount
        }
      }
      return message
    }))
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
      {/* Chat header */}
      <div className="flex h-12 items-center justify-between border-b border-gray-700 px-4">
        <div className="flex items-center">
          <UserAvatar user={otherUser} />
          <div className="ml-3">
            <h2 className="font-medium text-white">{otherUser.name}</h2>
            <p className="text-xs text-gray-400">
              {otherUser.isOnline ? 'Online' : 'Offline'}
            </p>
          </div>
        </div>
        <SearchBar 
          onSearch={async (query) => {
            try {
              const response = await fetch(`/api/conversations/${conversationId}/search?query=${encodeURIComponent(query)}`)
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
          'flex-1 overflow-y-auto p-4',
          isDragging && 'border-2 border-dashed border-blue-500 bg-gray-800/50'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center space-y-4 pt-16 text-center">
            <div className="rounded-full bg-gray-700 p-4">
              <MessageSquare className="h-12 w-12 text-gray-400" />
            </div>
            <h3 className="text-2xl font-bold text-white">No messages yet</h3>
            <p className="text-sm text-gray-400">Send a message to start the conversation</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <Message key={message.id} message={message} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Message input */}
      <div className="border-t border-gray-700 p-4">
        <form onSubmit={handleSubmit} className="flex flex-col space-y-2">
          {selectedFile && (
            <div className="flex items-center gap-2 rounded-md bg-gray-700 p-2">
              <span className="text-sm text-gray-300">{selectedFile.name}</span>
              <button
                type="button"
                onClick={() => setSelectedFile(null)}
                className="ml-auto rounded-full p-1 text-gray-400 hover:bg-gray-600 hover:text-gray-300"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
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
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={`Message ${otherUser.name}`}
              className="flex-1 bg-transparent px-2 py-2 text-white placeholder-gray-400 focus:outline-none"
            />
            <EmojiPicker onEmojiSelect={handleEmojiSelect} />
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInputChange}
              className="hidden"
              accept={ALLOWED_FILE_TYPES.join(',')}
            />
            <button
              type="submit"
              disabled={(!newMessage.trim() && !selectedFile) || isSending}
              className={cn(
                "px-4 text-gray-400 hover:text-gray-300",
                isSending && "opacity-50 cursor-not-allowed"
              )}
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
          isDirectMessage={true}
          conversationId={conversationId}
        />
      )}
    </div>
  )
} 