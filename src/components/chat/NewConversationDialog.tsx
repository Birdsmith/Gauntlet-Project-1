'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'

interface User {
  id: string
  name: string | null
  image: string | null
  isOnline: boolean
}

interface NewConversationDialogProps {
  isOpen: boolean
  onClose: () => void
}

export default function NewConversationDialog({ isOpen, onClose }: NewConversationDialogProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const handleSearch = async (query: string) => {
    setSearchQuery(query)
    if (!query.trim()) {
      setUsers([])
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`)
      if (!response.ok) throw new Error('Failed to search users')
      const data = await response.json()
      setUsers(data)
    } catch (error) {
      console.error('Error searching users:', error)
      toast({
        title: 'Error',
        description: 'Failed to search users',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const startConversation = async (userId: string) => {
    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ otherUserId: userId }),
      })

      if (!response.ok) throw new Error('Failed to create conversation')
      const conversation = await response.json()

      // Close dialog and navigate to the new conversation
      onClose()
      router.push(`/conversations/${conversation.id}`)
    } catch (error) {
      console.error('Error creating conversation:', error)
      toast({
        title: 'Error',
        description: 'Failed to start conversation',
        variant: 'destructive',
      })
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>New Conversation</DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <ScrollArea className="mt-4 max-h-[300px] pr-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
              </div>
            ) : users.length === 0 ? (
              searchQuery ? (
                <p className="py-8 text-center text-sm text-gray-400">No users found</p>
              ) : (
                <p className="py-8 text-center text-sm text-gray-400">Type to search users</p>
              )
            ) : (
              <div className="space-y-2">
                {users.map(user => (
                  <button
                    key={user.id}
                    className={cn(
                      'w-full rounded-lg p-3 text-left hover:bg-gray-800',
                      'focus:bg-gray-800 focus:outline-none'
                    )}
                    onClick={() => startConversation(user.id)}
                  >
                    <div className="flex items-center space-x-3">
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
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}
