import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { X, Send, Plus } from 'lucide-react'
import { useSocket } from '@/contexts/SocketContext'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/use-toast'
import { EmojiPicker } from './EmojiPicker'
import { MessageReactions } from './MessageReactions'

interface User {
  id: string
  name: string | null
  image: string | null
}

interface FileAttachment {
  id: string
  name: string
  size: number
  type: string
  url: string
}

interface Message {
  id: string
  content: string
  createdAt: string
  updatedAt: string
  userId: string
  isEdited: boolean
  files: FileAttachment[]
  user: User
  replyCount?: number
  replyToId: string | null
  reactions: Reaction[]
}

interface Reaction {
  id: string
  emoji: string
  userId: string
  messageId: string
  user: {
    id: string
    name: string | null
    image: string | null
  }
}

interface ThreadViewProps {
  parentMessage: Message
  isOpen: boolean
  onClose: () => void
  isDirectMessage?: boolean
  conversationId?: string
  channelId?: string
  onParentUpdate?: (message: Message) => void
}

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

export function ThreadView({
  parentMessage,
  isOpen,
  onClose,
  isDirectMessage,
  conversationId,
  channelId,
  onParentUpdate,
}: ThreadViewProps) {
  const { data: session } = useSession()
  const [replies, setReplies] = useState<Message[]>([])
  const [newReply, setNewReply] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false)
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { socket, isConnected, connect, sendMessage } = useSocket()

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const handleEmojiSelect = (emoji: any) => {
    const input = document.querySelector('input[type="text"]') as HTMLInputElement
    if (!input) return

    const start = input.selectionStart || 0
    const end = input.selectionEnd || 0
    const updatedMessage = newReply.slice(0, start) + emoji.native + newReply.slice(end)
    setNewReply(updatedMessage)

    setTimeout(() => {
      input.setSelectionRange(start + emoji.native.length, start + emoji.native.length)
      input.focus()
    }, 0)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
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

    setSelectedFile(validFiles[0])
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
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
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!session?.user?.id) {
      toast({
        title: 'Error',
        description: 'You must be logged in to reply',
        variant: 'destructive',
      })
      return
    }

    if (!newReply.trim() && !selectedFile) {
      toast({
        title: 'Error',
        description: 'Please enter a message or select a file',
        variant: 'destructive',
      })
      return
    }

    try {
      const formData = new FormData()
      formData.append('content', newReply.trim())

      if (selectedFile) {
        formData.append('file', selectedFile)
      }

      const endpoint = isDirectMessage
        ? `/api/conversations/${conversationId}/messages/${parentMessage.id}/replies`
        : `/api/messages/${parentMessage.id}/replies`

      const response = await fetch(endpoint, {
        method: 'POST',
        ...(selectedFile
          ? { body: formData }
          : {
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                content: newReply.trim(),
              }),
            }),
      })

      if (!response.ok) {
        throw new Error('Failed to send reply')
      }

      const reply = await response.json()

      // Update local state
      setReplies(prev => [...prev, reply])
      setNewReply('')
      setSelectedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      // Update parent message reply count locally
      if (onParentUpdate) {
        onParentUpdate({
          ...parentMessage,
          replyCount: (parentMessage.replyCount || 0) + 1,
        })
      }

      // Emit through socket
      if (socket && isConnected) {
        if (isDirectMessage) {
          socket.emit('thread-reply', {
            ...reply,
            conversationId,
            replyToId: parentMessage.id,
          })
        } else {
          socket.emit('thread-reply', {
            ...reply,
            channelId,
            replyToId: parentMessage.id,
          })
        }
      }

      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    } catch (error) {
      console.error('Failed to send reply:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send reply',
        variant: 'destructive',
      })
    }
  }

  useEffect(() => {
    async function fetchReplies() {
      setIsLoading(true)
      try {
        const response = await fetch(
          `/api/${isDirectMessage ? 'conversations' : 'channels'}/${
            isDirectMessage ? conversationId : channelId
          }/messages/${parentMessage.id}/replies`
        )
        if (!response.ok) throw new Error('Failed to fetch replies')
        const data = await response.json()
        setReplies(data)
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to load replies',
          variant: 'destructive',
        })
      } finally {
        setIsLoading(false)
      }
    }

    if (isOpen && session?.user?.id) {
      fetchReplies()
    }
  }, [isOpen, parentMessage.id, session?.user?.id, conversationId, isDirectMessage, channelId, toast])

  // Socket event handlers for real-time updates
  useEffect(() => {
    if (!socket || !isConnected || !parentMessage.id) return

    // Join the thread room
    const joinThread = () => {
      socket.emit('join_thread', parentMessage.id)
    }

    joinThread()
    socket.on('connect', joinThread)

    // Handle new replies
    const handleReplyReceived = (reply: Message) => {
      if (reply.replyToId !== parentMessage.id) return
      if (reply.userId === session?.user?.id) return // Skip own replies

      setReplies(prev => {
        if (prev.some(r => r.id === reply.id)) return prev
        return [...prev, reply]
      })
      scrollToBottom()
    }

    socket.on('message_received', handleReplyReceived)

    return () => {
      socket.emit('leave_thread', parentMessage.id)
      socket.off('connect', joinThread)
      socket.off('message_received', handleReplyReceived)
    }
  }, [socket, isConnected, parentMessage.id, session?.user?.id, scrollToBottom])

  if (!isOpen) return null

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-96 flex-col border-l border-gray-700 bg-gray-900">
      {/* Thread header */}
      <div className="flex h-12 items-center justify-between border-b border-gray-700 px-4">
        <h3 className="text-lg font-medium text-white">Thread</h3>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-gray-400 hover:bg-gray-800 hover:text-gray-300"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Parent message */}
      <div className="border-b border-gray-700 p-4">
        <div className="flex items-start space-x-3">
          <div className="relative h-10 w-10 flex-shrink-0">
            {parentMessage.user.image ? (
              <img
                src={parentMessage.user.image}
                alt={parentMessage.user.name || 'User'}
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-full bg-gray-700 text-sm font-medium text-gray-300">
                {parentMessage.user.name?.[0] || '?'}
              </div>
            )}
          </div>
          <div>
            <div className="flex items-baseline space-x-2">
              <span className="font-medium text-white">{parentMessage.user.name}</span>
              <span className="text-xs text-gray-400">
                {new Date(parentMessage.createdAt).toLocaleString()}
              </span>
            </div>
            <p className="text-gray-300">{parentMessage.content}</p>
            {parentMessage.files?.map(file => (
              <div key={file.id} className="mt-2">
                {file.type.startsWith('image/') ? (
                  <div className="mt-2 max-w-sm">
                    <img
                      src={file.url}
                      alt={file.name}
                      className="rounded-lg object-contain"
                      style={{ maxHeight: '200px' }}
                    />
                    <div className="mt-1 text-xs text-gray-400">
                      {file.name} ({(file.size / 1024).toFixed(1)} KB)
                    </div>
                  </div>
                ) : (
                  <a
                    href={file.url}
                    download={file.name}
                    className="group flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 hover:border-gray-600"
                  >
                    <span className="text-sm text-gray-300 group-hover:text-white">
                      {file.name}
                    </span>
                    <span className="text-xs text-gray-500">
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  </a>
                )}
              </div>
            ))}
            {/* Reactions for parent message */}
            <MessageReactions
              messageId={parentMessage.id}
              channelId={channelId}
              conversationId={conversationId}
              reactions={parentMessage.reactions || []}
              onReactionAdd={reaction => {
                // Update parent message reactions in the parent component
                if (onParentUpdate) {
                  onParentUpdate({
                    ...parentMessage,
                    reactions: [...(parentMessage.reactions || []), reaction],
                  })
                }
              }}
              onReactionRemove={reactionId => {
                // Update parent message reactions in the parent component
                if (onParentUpdate) {
                  onParentUpdate({
                    ...parentMessage,
                    reactions: parentMessage.reactions.filter(r => r.id !== reactionId),
                  })
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Replies */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
          </div>
        ) : replies.length === 0 ? (
          <div className="flex flex-col items-center justify-center space-y-4 py-8 text-center">
            <p className="text-sm text-gray-400">No replies yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {replies.map(reply => (
              <div key={reply.id} className="flex items-start space-x-3">
                <div className="relative h-8 w-8 flex-shrink-0">
                  {reply.user.image ? (
                    <img
                      src={reply.user.image}
                      alt={reply.user.name || 'User'}
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center rounded-full bg-gray-700 text-sm font-medium text-gray-300">
                      {reply.user.name?.[0] || '?'}
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex items-baseline space-x-2">
                    <span className="font-medium text-white">{reply.user.name}</span>
                    <span className="text-xs text-gray-400">
                      {new Date(reply.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-gray-300">{reply.content}</p>
                  {reply.files?.map(file => (
                    <div key={file.id} className="mt-2">
                      {file.type.startsWith('image/') ? (
                        <div className="mt-2 max-w-sm">
                          <img
                            src={file.url}
                            alt={file.name}
                            className="rounded-lg object-contain"
                            style={{ maxHeight: '200px' }}
                          />
                          <div className="mt-1 text-xs text-gray-400">
                            {file.name} ({(file.size / 1024).toFixed(1)} KB)
                          </div>
                        </div>
                      ) : (
                        <a
                          href={file.url}
                          download={file.name}
                          className="group flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 hover:border-gray-600"
                        >
                          <span className="text-sm text-gray-300 group-hover:text-white">
                            {file.name}
                          </span>
                          <span className="text-xs text-gray-500">
                            ({(file.size / 1024).toFixed(1)} KB)
                          </span>
                        </a>
                      )}
                    </div>
                  ))}
                  {/* Reactions for replies */}
                  <MessageReactions
                    messageId={reply.id}
                    channelId={channelId}
                    conversationId={conversationId}
                    reactions={reply.reactions || []}
                    onReactionAdd={reaction =>
                      setReplies(prev =>
                        prev.map(m =>
                          m.id === reply.id
                            ? { ...m, reactions: [...(m.reactions || []), reaction] }
                            : m
                        )
                      )
                    }
                    onReactionRemove={reactionId =>
                      setReplies(prev =>
                        prev.map(m =>
                          m.id === reply.id
                            ? {
                                ...m,
                                reactions: m.reactions.filter(r => r.id !== reactionId),
                              }
                            : m
                        )
                      )
                    }
                  />
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Reply input */}
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
                <X className="h-4 w-4" />
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
              value={newReply}
              onChange={e => setNewReply(e.target.value)}
              placeholder="Reply to thread..."
              className="flex-1 bg-transparent px-2 py-2 text-white placeholder-gray-400 focus:outline-none"
            />
            <EmojiPicker
              onEmojiSelect={handleEmojiSelect}
              isOpen={isEmojiPickerOpen}
              onOpenChange={setIsEmojiPickerOpen}
              variant="thread"
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
              disabled={!newReply.trim() && !selectedFile}
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
