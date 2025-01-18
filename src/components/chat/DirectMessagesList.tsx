'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'
import { ChevronDown, Plus, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSocket } from '@/contexts/SocketContext'

interface User {
  id: string
  name: string | null
  image: string | null
  isOnline: boolean
}

interface Conversation {
  id: string
  participants: User[]
  lastMessage?: {
    id: string
    content: string
    createdAt: string
  } | null
}

export function DirectMessagesList() {
  const { data: session } = useSession()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<User[]>([])
  const { toast } = useToast()
  const router = useRouter()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const { socket, isConnected } = useSocket()

  const fetchConversations = useCallback(async () => {
    if (!session?.user) return

    try {
      const response = await fetch('/api/conversations')
      if (!response.ok) throw new Error('Failed to fetch conversations')
      const data = await response.json()
      setConversations(data || [])
      setLoading(false)
    } catch (error) {
      console.error('Error fetching conversations:', error)
      setConversations([])
      toast({
        title: 'Error',
        description: 'Failed to load conversations',
        variant: 'destructive',
      })
      setLoading(false)
    }
  }, [session?.user, toast])

  useEffect(() => {
    if (session?.user) {
      fetchConversations()
    } else {
      setConversations([])
      setLoading(false)
    }
  }, [session, fetchConversations])

  const handleSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value
    setSearchQuery(query)

    if (query.length < 3) {
      setSearchResults([])
      return
    }

    try {
      const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`)
      const data = await response.json()
      setSearchResults(data)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to search users',
        variant: 'destructive',
      })
    }
  }

  const startConversation = async (userId: string) => {
    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      })

      if (!response.ok) {
        throw new Error('Failed to create conversation')
      }

      const data = await response.json()
      const params = new URLSearchParams()
      params.set('conversation', data.id)
      params.delete('channel')
      router.push(`/?${params.toString()}`)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to start conversation',
        variant: 'destructive',
      })
    }
  }

  // Add socket event listener for user status updates
  useEffect(() => {
    if (!socket) return

    const handleUserStatus = (data: { userId: string; isOnline: boolean }) => {
      setConversations(prev =>
        prev.map(conv => ({
          ...conv,
          participants: conv.participants.map(p =>
            p.id === data.userId ? { ...p, isOnline: data.isOnline } : p
          ),
        }))
      )

      setSearchResults(prev =>
        prev.map(user => (user.id === data.userId ? { ...user, isOnline: data.isOnline } : user))
      )
    }

    socket.on('user-status', handleUserStatus)

    return () => {
      socket.off('user-status', handleUserStatus)
    }
  }, [socket])

  useEffect(() => {
    if (!socket || !isConnected) {
      return;
    }

    const handleConversationCreated = () => {
      fetchConversations();
    };

    const handleConversationUpdated = () => {
      fetchConversations();
    };

    socket.on('conversation-created', handleConversationCreated);
    socket.on('conversation-updated', handleConversationUpdated);

    return () => {
      socket.off('conversation-created', handleConversationCreated);
      socket.off('conversation-updated', handleConversationUpdated);
    };
  }, [socket, isConnected, fetchConversations]);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto bg-gray-800 p-2">
      {/* Direct Messages Section */}
      <div className="mb-2">
        <div className="flex items-center justify-between px-1 py-1.5">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center text-xs font-semibold uppercase text-gray-400 hover:text-gray-300"
          >
            <ChevronDown
              className={`mr-1 h-3 w-3 transform transition-transform duration-200 ${
                isCollapsed ? '-rotate-90' : ''
              }`}
            />
            Direct Messages
          </button>
          <Dialog>
            <DialogTrigger asChild>
              <button className="text-gray-400 hover:text-gray-300">
                <Plus className="h-4 w-4" />
              </button>
            </DialogTrigger>
            <DialogContent className="w-full max-w-md rounded-lg bg-gray-800 p-6">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-white">Find a User</DialogTitle>
              </DialogHeader>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300">SEARCH USERS</label>
                  <div className="relative mt-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search by username..."
                      value={searchQuery}
                      onChange={handleSearch}
                      className="w-full rounded-md bg-gray-700 pl-9 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <ScrollArea className="mt-4 max-h-[300px]">
                  {searchResults.length === 0 ? (
                    <p className="py-8 text-center text-sm text-gray-400">
                      {searchQuery ? 'No users found' : 'Type to search users'}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {searchResults.map(user => (
                        <button
                          key={user.id}
                          onClick={() => startConversation(user.id)}
                          className="flex w-full items-center space-x-3 rounded-lg p-3 text-left hover:bg-gray-700 focus:outline-none"
                        >
                          <div className="relative h-10 w-10">
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
                            <span
                              className={cn(
                                'absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-gray-900',
                                user.isOnline ? 'bg-green-500' : 'bg-gray-500'
                              )}
                            />
                          </div>
                          <div>
                            <p className="font-medium text-white">{user.name || 'Unknown User'}</p>
                            <p className="text-sm text-gray-400">
                              {user.isOnline ? 'Online' : 'Offline'}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {!isCollapsed && (
          <div className="mt-1 space-y-0.5">
            {loading ? (
              <div className="flex items-center justify-center py-2">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-500 border-t-transparent"></div>
              </div>
            ) : conversations.length === 0 ? (
              <div className="px-2 py-1 text-sm text-gray-400">No conversations yet</div>
            ) : (
              conversations.map(conversation => {
                const otherUser = conversation.participants.find(p => p.id !== session?.user?.id)
                if (!otherUser) return null

                return (
                  <button
                    key={conversation.id}
                    onClick={() => {
                      const params = new URLSearchParams()
                      params.set('conversation', conversation.id)
                      params.delete('channel')
                      router.push(`/?${params.toString()}`)
                    }}
                    className="flex w-full items-center rounded px-2 py-1 text-gray-300 hover:bg-gray-700"
                  >
                    <div className="relative mr-2">
                      {otherUser.image ? (
                        <img
                          src={otherUser.image}
                          alt={otherUser.name || 'User'}
                          className="h-6 w-6 rounded-full"
                        />
                      ) : (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-600">
                          {otherUser.name?.[0] || '?'}
                        </div>
                      )}
                      <span
                        className={`absolute bottom-0 right-0 h-2 w-2 rounded-full border border-gray-800 ${
                          otherUser.isOnline ? 'bg-green-500' : 'bg-gray-500'
                        }`}
                      />
                    </div>
                    <span className="truncate">{otherUser.name}</span>
                  </button>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}
