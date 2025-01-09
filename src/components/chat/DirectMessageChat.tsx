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

// Types
interface FileAttachment {
  id: string
  name: string
  size: number
  type: string
  url: string
}

interface User {
  id: string
  name: string | null
  image: string | null
  isOnline?: boolean
}

interface DirectMessage {
  id: string
  content: string
  createdAt: string
  conversationId: string
  files: FileAttachment[]
  user: User
}

interface DirectMessageChatProps {
  conversationId: string
  otherUser: User & { isOnline: boolean }
}

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

// Add max file size constant
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

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

const Message = ({ message }: { message: DirectMessage }) => (
  <div className="group relative flex items-start space-x-3 hover:bg-gray-800/50 px-2 py-1 rounded">
    <UserAvatar user={message.user} />
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-white">
          {message.user.name}
        </span>
        <span className="text-xs text-gray-400">
          {new Date(message.createdAt).toLocaleString()}
        </span>
      </div>
      <p className="text-sm text-gray-100 whitespace-pre-wrap break-words">
        {message.content}
      </p>
      {message.files?.map((file) => (
        <MessageAttachment key={file.id} file={file} />
      ))}
    </div>
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
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { socket, isConnected } = useSocket()

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

    // Session check
    if (!session?.user?.id) {
      toast({
        title: 'Error',
        description: 'You must be logged in to send messages',
        variant: 'destructive',
      })
      return
    }

    // Input validation
    if (!newMessage.trim() && !selectedFile) {
      toast({
        title: 'Error',
        description: 'Please enter a message or select a file',
        variant: 'destructive',
      })
      return
    }

    if (newMessage.length > 2000) {
      toast({
        title: 'Error',
        description: 'Message is too long. Maximum length is 2000 characters',
        variant: 'destructive',
      })
      return
    }

    try {
      setIsSending(true)

      // Check socket connection if we're going to need it
      if (!socket || !isConnected) {
        console.warn('Socket connection not established')
      }

      const formData = new FormData()
      if (newMessage.trim()) {
        formData.append('content', newMessage.trim())
      }
      if (selectedFile) {
        formData.append('file', selectedFile)
      }

      const response = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        ...(selectedFile
          ? { body: formData }
          : {
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content: newMessage.trim() }),
            }),
      })

      if (!response.ok) {
        let errorMessage = 'Failed to send message'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch (e) {
          console.error('Failed to parse error response:', e)
        }
        throw new Error(errorMessage)
      }

      let message
      try {
        message = await response.json()
      } catch (e) {
        console.error('Failed to parse message response:', e)
        throw new Error('Invalid response from server')
      }

      if (!message || !message.id) {
        throw new Error('Invalid message response from server')
      }

      // Update local state first
      setMessages(prev => [...prev, message])
      setNewMessage('')
      setSelectedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      // Then emit through socket
      if (socket && isConnected) {
        try {
          socket.emit('direct-message', {
            ...message,
            conversationId
          })
        } catch (e) {
          console.error('Failed to emit message through socket:', e)
          // Don't throw here as the message was already saved
        }
      }

      // Scroll to bottom after message is sent
      scrollToBottom()
    } catch (error) {
      console.error('Failed to send message:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send message',
        variant: 'destructive',
      })
    } finally {
      setIsSending(false)
    }
  }

  // Socket handling
  useEffect(() => {
    if (!socket || !session?.user?.id) return

    console.log('Setting up socket handlers for conversation:', conversationId)

    const handleNewMessage = (message: DirectMessage) => {
      console.log('Received direct message:', message)
      if (message.conversationId !== conversationId) {
        console.log('Message not for this conversation, ignoring')
        return
      }

      setMessages(prev => {
        if (prev.some(m => m.id === message.id)) {
          console.log('Message already exists, skipping')
          return prev
        }
        console.log('Adding new message to state')
        return [...prev, message]
      })
      scrollToBottom()
    }

    const handleProfileUpdate = (updatedUser: User) => {
      setMessages(prev =>
        prev.map(message =>
          message.user.id === updatedUser.id
            ? { ...message, user: { ...message.user, ...updatedUser } }
            : message
        )
      )
    }

    const joinRoom = () => {
      console.log('Joining conversation room:', conversationId)
      socket.emit('join-conversation', conversationId)
    }

    // Join room immediately if connected
    if (socket.connected) {
      console.log('Socket already connected, joining room')
      joinRoom()
    }

    // Set up event listeners
    socket.on('connect', () => {
      console.log('Socket connected, joining room')
      joinRoom()
    })
    socket.on('direct-message', handleNewMessage)
    socket.on('profile-update', handleProfileUpdate)

    // Cleanup
    return () => {
      console.log('Cleaning up socket handlers for conversation:', conversationId)
      socket.emit('leave-conversation', conversationId)
      socket.off('connect', joinRoom)
      socket.off('direct-message', handleNewMessage)
      socket.off('profile-update', handleProfileUpdate)
    }
  }, [socket, conversationId, session?.user?.id])

  // Initial messages fetch with error handling
  useEffect(() => {
    async function fetchMessages() {
      try {
        setIsLoading(true)
        const response = await fetch(`/api/conversations/${conversationId}/messages`)
        
        if (!response.ok) {
          let errorMessage = 'Failed to fetch messages'
          try {
            const errorData = await response.json()
            errorMessage = errorData.error || errorMessage
          } catch (e) {
            console.error('Failed to parse error response:', e)
          }
          throw new Error(errorMessage)
        }

        const data = await response.json()
        if (!Array.isArray(data)) {
          throw new Error('Invalid response format from server')
        }

        setMessages(data)
      } catch (error) {
        console.error('Failed to fetch messages:', error)
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to load messages',
          variant: 'destructive',
        })
      } finally {
        setIsLoading(false)
      }
    }

    if (session?.user?.id) {
      fetchMessages()
    }
  }, [conversationId, toast, session?.user?.id])

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
    <div className="flex h-full flex-1 flex-col">
      {/* Chat header */}
      <div className="flex h-12 items-center border-b border-gray-700 px-4">
        <div className="flex items-center">
          <UserAvatar user={otherUser} />
          <div className="ml-3">
            <h2 className="font-medium text-white">{otherUser.name}</h2>
            <p className="text-xs text-gray-400">
              {otherUser.isOnline ? 'Online' : 'Offline'}
            </p>
          </div>
        </div>
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
    </div>
  )
} 