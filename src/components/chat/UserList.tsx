import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { useSocket } from '@/hooks/useSocket'
import { Pencil } from 'lucide-react'

interface User {
  id: string
  name: string | null
  image: string | null
  isOnline: boolean
}

interface UserStatus {
  userId: string
  isOnline: boolean
}

export default function UserList() {
  const { data: session } = useSession()
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const { socket } = useSocket()

  useEffect(() => {
    async function fetchUsers() {
      try {
        const response = await fetch('/api/users')
        if (!response.ok) throw new Error('Failed to fetch users')
        const data = await response.json()
        setUsers(data)
      } catch (error) {
        console.error('Error fetching users:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchUsers()
  }, [])

  useEffect(() => {
    if (!socket) return

    const handleUserStatus = ({ userId, isOnline }: UserStatus) => {
      setUsers((prevUsers) =>
        prevUsers.map((user) =>
          user.id === userId ? { ...user, isOnline } : user
        )
      )
    }

    const handleProfileUpdate = (updatedUser: User) => {
      setUsers((prevUsers) =>
        prevUsers.map((user) =>
          user.id === updatedUser.id 
            ? { ...updatedUser, isOnline: user.isOnline } 
            : user
        )
      )
    }

    // Listen for user status updates
    socket.on('userStatus', handleUserStatus)
    socket.on('profile-update', handleProfileUpdate)

    return () => {
      socket.off('userStatus', handleUserStatus)
      socket.off('profile-update', handleProfileUpdate)
    }
  }, [socket])

  const handleEditProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!session?.user?.id) return

    if (!newName.trim()) {
      setError('Name is required')
      return
    }

    try {
      const formData = new FormData()
      formData.append('name', newName.trim())
      if (selectedFile) {
        formData.append('image', selectedFile)
      }

      const response = await fetch(`/api/users/${session.user.id}`, {
        method: 'PATCH',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update profile')
      }

      const updatedUser = await response.json()
      
      // Update users list while preserving online status
      setUsers((prev) =>
        prev.map((user) =>
          user.id === updatedUser.id 
            ? { ...updatedUser, isOnline: user.isOnline }
            : user
        )
      )

      // Emit profile update event through socket
      if (socket) {
        socket.emit('profile-update', updatedUser)
      }

      setIsEditProfileOpen(false)
      setNewName('')
      setSelectedFile(null)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update profile')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
      </div>
    )
  }

  const onlineUsers = users.filter((user) => user.isOnline)
  const offlineUsers = users.filter((user) => !user.isOnline)

  return (
    <div className="flex flex-col">
      <h3 className="mb-2 px-2 text-xs font-semibold uppercase text-gray-400">
        Online — {onlineUsers.length}
      </h3>

      <div className="space-y-1">
        {onlineUsers.map((user) => (
          <UserItem 
            key={user.id} 
            user={user} 
            isCurrentUser={user.id === session?.user?.id}
            onEditProfile={() => {
              if (user.id === session?.user?.id) {
                setNewName(user.name || '')
                setSelectedFile(null)
                setIsEditProfileOpen(true)
              }
            }}
          />
        ))}
      </div>

      {offlineUsers.length > 0 && (
        <>
          <h3 className="mb-2 mt-4 px-2 text-xs font-semibold uppercase text-gray-400">
            Offline — {offlineUsers.length}
          </h3>
          <div className="space-y-1">
            {offlineUsers.map((user) => (
              <UserItem 
                key={user.id} 
                user={user} 
                isCurrentUser={user.id === session?.user?.id}
                onEditProfile={() => {
                  if (user.id === session?.user?.id) {
                    setNewName(user.name || '')
                    setSelectedFile(null)
                    setIsEditProfileOpen(true)
                  }
                }}
              />
            ))}
          </div>
        </>
      )}

      {/* Edit Profile Modal */}
      {isEditProfileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-gray-800 p-6">
            <h2 className="mb-4 text-xl font-bold text-white">Edit Profile</h2>
            <form onSubmit={handleEditProfile} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300">
                  NAME <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="mt-1 w-full rounded-md bg-gray-700 px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Your name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">
                  PROFILE PICTURE <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="mt-1 w-full rounded-md bg-gray-700 px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {error && (
                <div className="text-sm text-red-500">{error}</div>
              )}

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditProfileOpen(false)
                    setNewName('')
                    setSelectedFile(null)
                    setError('')
                  }}
                  className="rounded-md bg-gray-700 px-4 py-2 text-white hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function UserItem({ 
  user, 
  isCurrentUser,
  onEditProfile 
}: { 
  user: User
  isCurrentUser: boolean
  onEditProfile: () => void
}) {
  return (
    <div className="group flex items-center gap-2 rounded px-2 py-1 hover:bg-gray-700">
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
        {user.isOnline && (
          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-gray-800 bg-green-500"></span>
        )}
      </div>

      <div className="flex flex-1 items-center justify-between">
        <span className="text-sm font-medium text-gray-300">
          {user.name}
          {isCurrentUser && (
            <span className="ml-1 text-xs text-gray-400">(you)</span>
          )}
        </span>
        {isCurrentUser && (
          <button
            onClick={onEditProfile}
            className="rounded p-1 text-gray-400 opacity-0 hover:bg-gray-600 hover:text-gray-300 group-hover:opacity-100"
            aria-label="Edit Profile"
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
} 