'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { signOut } from 'next-auth/react'
import { LogOut } from 'lucide-react'
import ChannelList from '@/components/chat/ChannelList'
import { DirectMessagesList } from '@/components/chat/DirectMessagesList'
import ChatArea from '@/components/chat/ChatArea'
import DirectMessageChat from '@/components/chat/DirectMessageChat'
import UserList from '@/components/chat/UserList'
import { useSession } from 'next-auth/react'
import { SocketErrorBoundary } from '@/components/ErrorBoundary'

export default function Home() {
  const router = useRouter()
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const channelId = searchParams?.get('channel') || null
  const conversationId = searchParams?.get('conversation') || null
  const [showUserList, setShowUserList] = useState(true)
  const [currentConversation, setCurrentConversation] = useState<{
    id: string
    otherUser: {
      id: string
      name: string | null
      image: string | null
      isOnline: boolean
    }
  } | null>(null)

  useEffect(() => {
    async function fetchConversation() {
      if (!conversationId || !session?.user?.id) return

      try {
        const response = await fetch(`/api/conversations/${conversationId}`)
        if (!response.ok) throw new Error('Failed to fetch conversation')
        const data = await response.json()

        const otherUser = data.participants.find((p: any) => p.id !== session.user.id)
        if (otherUser) {
          setCurrentConversation({
            id: data.id,
            otherUser: {
              id: otherUser.id,
              name: otherUser.name,
              image: otherUser.image,
              isOnline: otherUser.isOnline,
            },
          })
        }
      } catch (error) {
        console.error('Failed to fetch conversation:', error)
      }
    }

    fetchConversation()
  }, [conversationId, session?.user?.id])

  useEffect(() => {
    // Reset conversation when channel changes
    if (searchParams?.get('channel')) {
      setCurrentConversation(null)
    }
  }, [searchParams])

  return (
    <main className="flex h-screen bg-gray-900">
      <SocketErrorBoundary>
        {/* Left Sidebar */}
        <div className="flex w-56 flex-col border-r border-gray-700 bg-gray-900">
          {/* Header with branding */}
          <div className="flex h-12 items-center justify-between px-4 border-b border-gray-700 bg-gray-800">
            <h1 className="text-xl font-bold text-white">ChatGenius</h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => signOut({ callbackUrl: '/auth/signin' })}
              className="text-gray-400 hover:text-white"
              title="Logout"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4">
              <ChannelList
                selectedChannel={channelId}
                onSelectChannel={id => {
                  const queryParams = searchParams ? Object.fromEntries(searchParams.entries()) : {}
                  const params = new URLSearchParams(queryParams)
                  params.set('channel', id)
                  params.delete('conversation')
                  router.push(`/?${params.toString()}`)
                }}
              />
              <div className="my-2 border-t border-gray-700" />
              <DirectMessagesList />
            </div>
          </ScrollArea>
        </div>

        {/* Chat Area */}
        <div className="flex flex-1 flex-col bg-gray-800">
          {conversationId && currentConversation ? (
            <DirectMessageChat
              conversationId={conversationId}
              otherUser={currentConversation.otherUser}
            />
          ) : channelId ? (
            <ChatArea channelId={channelId} />
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-gray-400">Select a channel or conversation to start chatting</p>
            </div>
          )}
        </div>

        {/* Right Sidebar - User List */}
        <div className="w-56 border-l border-gray-700 bg-gray-900">
          <div className="flex h-12 items-center px-4 border-b border-gray-700 bg-gray-800">
            <h2 className="text-lg font-semibold text-white">Online Users</h2>
          </div>
          <ScrollArea className="h-[calc(100vh-4rem)]">
            <div className="p-4">
              <UserList />
            </div>
          </ScrollArea>
        </div>
      </SocketErrorBoundary>
    </main>
  )
}
