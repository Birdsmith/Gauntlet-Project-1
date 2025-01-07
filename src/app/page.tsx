'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { LogOut } from 'lucide-react'
import ChatArea from '@/components/chat/ChatArea'
import ChannelList from '@/components/chat/ChannelList'
import UserList from '@/components/chat/UserList'

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
  }, [status, router])

  const handleLogout = async () => {
    await signOut({ redirect: false })
    router.push('/auth/signin')
  }

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-900">
      {/* Left sidebar */}
      <div className="flex w-60 flex-col bg-gray-800">
        <div className="flex h-12 items-center justify-between border-b border-gray-700 px-4">
          <h1 className="text-lg font-bold text-white">Chat Genius</h1>
          <button
            onClick={handleLogout}
            className="rounded p-1 text-gray-400 hover:bg-gray-700 hover:text-white"
            aria-label="Logout"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
        <ChannelList 
          selectedChannel={selectedChannel} 
          onSelectChannel={setSelectedChannel} 
        />
      </div>

      {/* Main chat area */}
      <div className="flex flex-1 flex-col">
        {selectedChannel ? (
          <ChatArea channelId={selectedChannel} />
        ) : (
          <div className="flex flex-1 items-center justify-center text-gray-400">
            Select a channel to start chatting
          </div>
        )}
      </div>

      {/* Right sidebar - Online users */}
      <div className="w-60 bg-gray-800 p-4">
        <UserList />
      </div>
    </div>
  )
}
