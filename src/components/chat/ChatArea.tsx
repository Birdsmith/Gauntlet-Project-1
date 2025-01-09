'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { Hash, Plus, Smile, Send } from 'lucide-react'
import { useSocket } from '@/hooks/useSocket'
import { toast } from '@/components/ui/use-toast'
import { EmojiPicker } from './EmojiPicker'

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

interface FileAttachment {
  id: string
  name: string
  size: number
  type: string
  url: string
  createdAt: string
  messageId: string
}

interface Message {
  id: string
  content: string
  createdAt: string
  channelId: string
  files: FileAttachment[]
  user: {
    id: string
    name: string | null
    image: string | null
  }
}

interface Channel {
  id: string
  name: string
  description: string | null
}

interface ChatAreaProps {
  channelId: string
}

export default function ChatArea({ channelId }: ChatAreaProps) {
  const { data: session } = useSession()
  const [messages, setMessages] = useState<Message[]>([])
  const [channel, setChannel] = useState<Channel | null>(null)
  const [newMessage, setNewMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isFilePickerOpen, setIsFilePickerOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { socket, isConnected } = useSocket()

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const validateFile = (file: File): boolean => {
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload one of the following: Images (JPEG, PNG, GIF), PDF, Text, or Word documents.',
        variant: 'destructive',
      })
      return false
    }

    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: 'File too large',
        description: 'Maximum file size is 5MB.',
        variant: 'destructive',
      })
      return false
    }

    return true
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const file = e.dataTransfer.files[0]
    if (file && validateFile(file)) {
      setSelectedFile(file)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && validateFile(file)) {
      setSelectedFile(file)
    }
    setIsFilePickerOpen(false)
  }

  const handleRemoveFile = () => {
    setSelectedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

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

  useEffect(() => {
    async function fetchChannel() {
      try {
        const response = await fetch(`/api/channels/${channelId}`)
        const data = await response.json()
        setChannel(data)
      } catch (error) {
        console.error('Failed to fetch channel:', error)
      }
    }

    async function fetchMessages() {
      try {
        const response = await fetch(`/api/messages?channelId=${channelId}`)
        const data = await response.json()
        setMessages(data)
      } catch (error) {
        console.error('Failed to fetch messages:', error)
      } finally {
        setIsLoading(false)
      }
    }

    setIsLoading(true)
    fetchChannel()
    fetchMessages()
  }, [channelId])

  useEffect(() => {
    if (!socket || !session?.user) return

    // Debug socket connection
    console.log('Socket connected:', isConnected)
    console.log('Current channel:', channelId)

    // Listen for new messages
    const handleNewMessage = (message: Message) => {
      console.log('Received new message event:', message)
      if (message.channelId !== channelId) {
        console.log('Message not for this channel, ignoring')
        return
      }

      setMessages((prev) => {
        // Check if message already exists
        if (prev.some(m => m.id === message.id)) {
          console.log('Message already exists, skipping')
          return prev
        }
        console.log('Adding new message to state')
        return [...prev, message]
      })
      scrollToBottom()
    }

    // Listen for profile updates
    const handleProfileUpdate = (updatedUser: { id: string; name: string | null; image: string | null }) => {
      setMessages((prev) =>
        prev.map((message) =>
          message.user.id === updatedUser.id
            ? {
                ...message,
                user: {
                  ...message.user,
                  name: updatedUser.name,
                  image: updatedUser.image,
                },
              }
            : message
        )
      )
    }

    // Join channel when socket connects
    const joinChannel = () => {
      console.log('Joining channel:', channelId)
      socket.emit('join-channel', channelId)
    }

    if (socket.connected) joinChannel()
    socket.on('connect', joinChannel)
    socket.on('new-message', handleNewMessage)
    socket.on('profile-update', handleProfileUpdate)

    // Cleanup when leaving the channel
    return () => {
      console.log('Leaving channel:', channelId)
      socket.emit('leave-channel', channelId)
      socket.off('connect', joinChannel)
      socket.off('new-message', handleNewMessage)
      socket.off('profile-update', handleProfileUpdate)
    }
  }, [socket, channelId, session?.user, isConnected])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if ((!newMessage.trim() && !selectedFile) || !session?.user) return

    try {
      const formData = new FormData()
      formData.append('content', newMessage)
      formData.append('channelId', channelId)
      if (selectedFile) {
        formData.append('file', selectedFile)
      }

      const response = await fetch('/api/messages', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) throw new Error('Failed to send message')

      const message = await response.json()
      
      // Clear input and selected file before sending for better UX
      setNewMessage('')
      setSelectedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      // Debug socket state
      console.log('Socket connected before emit:', isConnected)
      
      // Emit the message through socket
      if (socket && isConnected) {
        console.log('Emitting message:', message)
        socket.emit('send-message', message)
      } else {
        console.warn('Socket not connected, message will not be real-time')
      }

      // Update local state
      setMessages(prev => [...prev, message])
      scrollToBottom()
    } catch (error) {
      console.error('Failed to send message:', error)
      toast({
        title: 'Error',
        description: 'Failed to send message. Please try again.',
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
      <div className="flex h-12 items-center border-b border-gray-700 px-4">
        <Hash className="mr-2 h-5 w-5 text-gray-400" />
        <h2 className="font-medium text-white">{channel?.name}</h2>
        {channel?.description && (
          <div className="ml-2 h-6 border-l border-gray-700 pl-2">
            <p className="text-sm text-gray-400">{channel.description}</p>
          </div>
        )}
      </div>

      {/* Messages area */}
      <div className="h-[calc(100vh-8rem)] flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-gray-500 scrollbar-track-transparent hover:scrollbar-thumb-gray-400">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center space-y-4 pt-16 text-center">
            <div className="rounded-full bg-gray-700 p-4">
              <Hash className="h-12 w-12 text-gray-400" />
            </div>
            <h3 className="text-2xl font-bold text-white">
              Welcome to #{channel?.name}!
            </h3>
            {channel?.description && (
              <p className="text-gray-400">{channel.description}</p>
            )}
            <p className="text-sm text-gray-400">
              This is the start of the #{channel?.name} channel.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div key={message.id} className="flex items-start space-x-3">
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
                <div>
                  <div className="flex items-baseline space-x-2">
                    <span className="font-medium text-white">
                      {message.user.name}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(message.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-gray-300">{message.content}</p>
                  {message.files?.map((file) => (
                    <div key={file.id} className="mt-2">
                      {file.type.startsWith('image/') ? (
                        // Image files
                        <div className="mt-2 max-w-2xl">
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
                      ) : file.type === 'text/plain' ? (
                        // Text files
                        <div className="mt-2 max-w-2xl">
                          <a
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group block rounded-lg border border-gray-700 bg-gray-800 p-4 hover:border-gray-600"
                          >
                            <div className="flex items-center gap-2">
                              <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <span className="text-sm text-gray-300 group-hover:text-white">
                                {file.name}
                              </span>
                              <span className="ml-auto text-xs text-gray-500">
                                {(file.size / 1024).toFixed(1)} KB
                              </span>
                            </div>
                          </a>
                        </div>
                      ) : (
                        // Other files
                        <div className="mt-2 max-w-2xl">
                          <a
                            href={file.url}
                            download={file.name}
                            className="group block rounded-lg border border-gray-700 bg-gray-800 p-4 hover:border-gray-600"
                          >
                            <div className="flex items-center gap-2">
                              <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                              </svg>
                              <span className="text-sm text-gray-300 group-hover:text-white">
                                {file.name}
                              </span>
                              <span className="ml-auto text-xs text-gray-500">
                                {(file.size / 1024).toFixed(1)} KB
                              </span>
                            </div>
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
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
                onClick={handleRemoveFile}
                className="ml-auto rounded-full p-1 text-gray-400 hover:bg-gray-600 hover:text-gray-300"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={`Message #${channel?.name}`}
              className="flex-1 bg-transparent px-2 py-2 text-white placeholder-gray-400 focus:outline-none"
            />
            <EmojiPicker onEmojiSelect={handleEmojiSelect} />
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
    </div>
  )
} 