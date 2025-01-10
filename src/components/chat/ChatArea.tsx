'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { Hash, Plus, Smile, Send, MessageSquare } from 'lucide-react'
import { useSocket } from '@/hooks/useSocket'
import { toast } from '@/components/ui/use-toast'
import { EmojiPicker } from './EmojiPicker'
import { ThreadView } from './ThreadView'
import { cn } from '@/lib/utils'
import { MessageReactions } from './MessageReactions'
import type { ChannelMessage, Channel, FileAttachment, Reaction, ReactionEvent } from '@/types/chat'
import { SearchBar } from './SearchBar'

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

interface ChatAreaProps {
  channelId: string
}

export default function ChatArea({ channelId }: ChatAreaProps) {
  const { data: session } = useSession()
  const [messages, setMessages] = useState<ChannelMessage[]>([])
  const [channel, setChannel] = useState<Channel | null>(null)
  const [newMessage, setNewMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isFilePickerOpen, setIsFilePickerOpen] = useState(false)
  const [selectedThread, setSelectedThread] = useState<ChannelMessage | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { socket, isConnected, sendMessage } = useSocket()

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

  // Socket event handling
  useEffect(() => {
    if (!socket || !isConnected || !channelId) return

    console.log('Setting up socket handlers for channel:', channelId)

    // Join the channel immediately
    const joinChannel = () => {
      console.log('Joining channel:', channelId)
      socket.emit('join-channel', channelId)
    }

    // Join immediately and also handle reconnections
    joinChannel()
    socket.on('connect', joinChannel)

    // Handle incoming messages
    const handleMessageReceived = (message: ChannelMessage) => {
      console.log('Received message:', message)
      if (message.channelId !== channelId) {
        console.log('Message not for this channel, ignoring')
        return
      }

      setMessages(prev => {
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

    // Handle incoming reactions
    const handleReactionReceived = (data: ReactionEvent) => {
      console.log('Received reaction:', data)
      if (data.channelId !== channelId) {
        console.log('Reaction not for this channel, ignoring')
        return
      }

      // Skip if this is our own reaction (we've already added it locally)
      if (data.userId === session?.user?.id) {
        console.log('Skipping own reaction (already added locally)')
        return
      }

      const { channelId: _, conversationId: __, ...reactionData } = data
      setMessages(prev =>
        prev.map(m =>
          m.id === data.messageId
            ? { ...m, reactions: [...(m.reactions || []), { ...reactionData, messageId: data.messageId }] }
            : m
        )
      )
    }

    // Handle reaction removals
    const handleReactionRemoved = (data: { messageId: string, reactionId: string, channelId: string }) => {
      console.log('Reaction removed:', data)
      if (data.channelId !== channelId) {
        console.log('Reaction removal not for this channel, ignoring')
        return
      }

      setMessages(prev =>
        prev.map(m =>
          m.id === data.messageId
            ? {
                ...m,
                reactions: (m.reactions || []).filter(r => r.id !== data.reactionId),
              }
            : m
        )
      )
    }

    socket.on('message_received', handleMessageReceived)
    socket.on('reaction_received', handleReactionReceived)
    socket.on('reaction_removed', handleReactionRemoved)

    // Cleanup
    return () => {
      console.log('Cleaning up socket handlers')
      socket.off('connect', joinChannel)
      socket.off('message_received', handleMessageReceived)
      socket.off('reaction_received', handleReactionReceived)
      socket.off('reaction_removed', handleReactionRemoved)
    }
  }, [socket, isConnected, channelId])

  // Fetch initial messages
  useEffect(() => {
    async function fetchChannel() {
      try {
        const response = await fetch(`/api/channels/${channelId}`)
        if (!response.ok) throw new Error('Failed to fetch channel')
        const data = await response.json()
        setChannel(data)
      } catch (error) {
        console.error('Error fetching channel:', error)
        toast({
          title: 'Error',
          description: 'Failed to load channel',
          variant: 'destructive',
        })
      }
    }

    async function fetchMessages() {
      try {
        setIsLoading(true)
        const response = await fetch(`/api/channels/${channelId}/messages`)
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

    if (channelId) {
      fetchChannel()
      fetchMessages()
    }
  }, [channelId])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() && !selectedFile) return

    try {
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
      setMessages(prev => [...prev, sentMessage])

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
      scrollToBottom()
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
          onSearch={async (query) => {
            try {
              const response = await fetch(`/api/channels/${channelId}/search?query=${encodeURIComponent(query)}`)
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
                    <span className="font-medium text-white">
                      {message.user.name}
                    </span>
                    <span className="text-xs text-gray-400 mt-1">
                      {new Date(message.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-gray-300">{message.content}</p>
                  {message.files?.map((file) => (
                    <div key={file.id} className="mt-2">
                      {file.type.startsWith('image/') ? (
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
                      ) : (
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
                      )}
                    </div>
                  ))}
                  {/* Reactions and Reply button */}
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "transition-opacity",
                      message.reactions?.length ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    )}>
                      <MessageReactions
                        messageId={message.id}
                        channelId={channelId}
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