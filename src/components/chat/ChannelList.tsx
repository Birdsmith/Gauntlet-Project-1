import { useState, useEffect } from 'react'
import { Hash, Volume2, ChevronDown, Settings, Plus } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { useSocket } from '@/contexts/SocketContext'
import { useSession } from 'next-auth/react'

interface Channel {
  id: string
  name: string
  description: string | null
}

interface ChannelListProps {
  selectedChannel: string | null
  onSelectChannel: (channelId: string) => void
}

export default function ChannelList({ selectedChannel, onSelectChannel }: ChannelListProps) {
  const { data: session } = useSession()
  const [channels, setChannels] = useState<Channel[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [selectedChannelForEdit, setSelectedChannelForEdit] = useState<Channel | null>(null)
  const [newChannelName, setNewChannelName] = useState('')
  const [newChannelDescription, setNewChannelDescription] = useState('')
  const [error, setError] = useState('')
  const [isChannelListCollapsed, setIsChannelListCollapsed] = useState(false)
  const [activeSettingsMenu, setActiveSettingsMenu] = useState<string | null>(null)
  const { toast } = useToast()
  const { socket } = useSocket()

  useEffect(() => {
    async function fetchChannels() {
      if (!session?.user) {
        setChannels([])
        setIsLoading(false)
        return
      }

      try {
        const response = await fetch('/api/channels')
        if (!response.ok) throw new Error('Failed to fetch channels')
        const data = await response.json()
        setChannels(data)
      } catch (error) {
        console.error('Failed to fetch channels:', error)
        setChannels([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchChannels()
  }, [session])

  useEffect(() => {
    if (!socket) return

    const handleChannelDeleted = (deletedChannelId: string) => {
      console.log('Channel deleted:', deletedChannelId)
      setChannels(prev => prev.filter(channel => channel.id !== deletedChannelId))

      // If the deleted channel was selected, select another channel
      if (selectedChannel === deletedChannelId) {
        const remainingChannels = channels.filter(channel => channel.id !== deletedChannelId)
        if (remainingChannels.length > 0) {
          onSelectChannel(remainingChannels[0].id)
        }
      }
    }

    const handleChannelCreated = (channel: Channel) => {
      console.log('Channel created:', channel)
      // Only add the channel if it doesn't already exist
      setChannels(prev => {
        if (prev.some(c => c.id === channel.id)) {
          return prev
        }
        return [...prev, channel]
      })
    }

    socket.on('channel-created', handleChannelCreated)
    socket.on('channel-deleted', handleChannelDeleted)

    return () => {
      socket.off('channel-created', handleChannelCreated)
      socket.off('channel-deleted', handleChannelDeleted)
    }
  }, [socket, channels, selectedChannel, onSelectChannel])

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!newChannelName.trim() || !socket) {
      setError('Channel name is required')
      return
    }

    try {
      const response = await fetch('/api/channels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newChannelName.trim(),
          description: newChannelDescription.trim() || null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create channel')
      }

      const newChannel = await response.json()

      // Update local state first
      setChannels(prev => [...prev, newChannel])

      // Then emit the socket event
      socket.emit('channel-created', newChannel)

      setIsCreateModalOpen(false)
      setNewChannelName('')
      setNewChannelDescription('')
      onSelectChannel(newChannel.id)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create channel')
    }
  }

  const handleEditChannel = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!selectedChannelForEdit) return
    if (!newChannelName.trim()) {
      setError('Channel name is required')
      return
    }

    try {
      const response = await fetch(`/api/channels/${selectedChannelForEdit.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newChannelName.trim(),
          description: newChannelDescription.trim() || null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update channel')
      }

      const updatedChannel = await response.json()
      setChannels(prev =>
        prev.map(channel => (channel.id === updatedChannel.id ? updatedChannel : channel))
      )
      setIsEditModalOpen(false)
      setSelectedChannelForEdit(null)
      setNewChannelName('')
      setNewChannelDescription('')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update channel')
    }
  }

  const handleDeleteChannel = async () => {
    if (!selectedChannelForEdit || !socket) return

    try {
      // Emit channel deletion event before making the API call
      socket.emit('channel-deleted', selectedChannelForEdit.id)

      const response = await fetch(`/api/channels/${selectedChannelForEdit.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete channel')
      }

      setChannels(prev => prev.filter(channel => channel.id !== selectedChannelForEdit.id))
      setIsDeleteModalOpen(false)
      setSelectedChannelForEdit(null)

      // If the deleted channel was selected, select another channel
      if (selectedChannel === selectedChannelForEdit.id) {
        const remainingChannels = channels.filter(
          channel => channel.id !== selectedChannelForEdit.id
        )
        if (remainingChannels.length > 0) {
          onSelectChannel(remainingChannels[0].id)
        }
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete channel',
        variant: 'destructive',
      })
    }
  }

  const toggleSettingsMenu = (channelId: string) => {
    setActiveSettingsMenu(activeSettingsMenu === channelId ? null : channelId)
  }

  const openEditModal = (channel: Channel) => {
    setSelectedChannelForEdit(channel)
    setNewChannelName(channel.name)
    setNewChannelDescription(channel.description || '')
    setIsEditModalOpen(true)
    setActiveSettingsMenu(null)
  }

  const openDeleteModal = (channel: Channel) => {
    setSelectedChannelForEdit(channel)
    setIsDeleteModalOpen(true)
    setActiveSettingsMenu(null)
  }

  const toggleChannelList = () => {
    setIsChannelListCollapsed(!isChannelListCollapsed)
  }

  // Filter channels to show either all or just the selected one when collapsed
  const visibleChannels = isChannelListCollapsed
    ? channels.filter(channel => !selectedChannel || channel.id === selectedChannel)
    : channels

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-500 border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto bg-gray-800 p-2">
      {/* Text Channels Section */}
      <div className="mb-2">
        <div className="flex items-center justify-between px-1 py-1.5">
          <button
            onClick={toggleChannelList}
            className="flex items-center text-xs font-semibold uppercase text-gray-400 hover:text-gray-300"
          >
            <ChevronDown
              className={`mr-1 h-3 w-3 transform transition-transform duration-200 ${
                isChannelListCollapsed ? '-rotate-90' : ''
              }`}
            />
            Text Channels
          </button>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="rounded p-1 text-gray-400 hover:bg-gray-700 hover:text-gray-300"
            aria-label="Create Channel"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>

        <div
          className={`mt-1 space-y-0.5 transition-all duration-200 ${
            isChannelListCollapsed ? 'opacity-90' : ''
          }`}
        >
          {visibleChannels.map(channel => (
            <div key={channel.id} className="group relative flex items-center">
              <button
                onClick={() => onSelectChannel(channel.id)}
                className={`flex w-full items-center rounded px-2 py-1 text-sm font-medium ${
                  selectedChannel === channel.id
                    ? 'bg-gray-550 text-white'
                    : 'text-gray-400 hover:bg-gray-700 hover:text-gray-300'
                }`}
              >
                <Hash className="mr-1.5 h-5 w-5" />
                {channel.name}
              </button>
              <div className="absolute right-0 px-2">
                <button
                  onClick={e => {
                    e.stopPropagation()
                    toggleSettingsMenu(channel.id)
                  }}
                  className="rounded p-1 text-gray-400 opacity-0 hover:bg-gray-700 hover:text-gray-300 group-hover:opacity-100"
                  aria-label="Channel Settings"
                >
                  <Settings className="h-4 w-4" />
                </button>
                {activeSettingsMenu === channel.id && (
                  <div className="absolute right-0 top-8 z-50 min-w-[180px] rounded-md bg-gray-800 py-1 shadow-lg ring-1 ring-black ring-opacity-5">
                    <button
                      onClick={() => openEditModal(channel)}
                      className="flex w-full items-center px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                    >
                      Edit Channel
                    </button>
                    <button
                      onClick={() => openDeleteModal(channel)}
                      className="flex w-full items-center px-4 py-2 text-sm text-red-400 hover:bg-gray-700"
                    >
                      Delete Channel
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create Channel Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-gray-800 p-6">
            <h2 className="mb-4 text-xl font-bold text-white">Create Text Channel</h2>
            <form onSubmit={handleCreateChannel} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300">
                  CHANNEL NAME <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newChannelName}
                  onChange={e => setNewChannelName(e.target.value)}
                  className="mt-1 w-full rounded-md bg-gray-700 px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="new-channel"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">
                  DESCRIPTION <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={newChannelDescription}
                  onChange={e => setNewChannelDescription(e.target.value)}
                  className="mt-1 w-full rounded-md bg-gray-700 px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter channel description"
                />
              </div>

              {error && <div className="text-sm text-red-500">{error}</div>}

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false)
                    setNewChannelName('')
                    setNewChannelDescription('')
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
                  Create Channel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Channel Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-gray-800 p-6">
            <h2 className="mb-4 text-xl font-bold text-white">Edit Channel</h2>
            <form onSubmit={handleEditChannel} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300">
                  CHANNEL NAME <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newChannelName}
                  onChange={e => setNewChannelName(e.target.value)}
                  className="mt-1 w-full rounded-md bg-gray-700 px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="channel-name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">
                  DESCRIPTION <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={newChannelDescription}
                  onChange={e => setNewChannelDescription(e.target.value)}
                  className="mt-1 w-full rounded-md bg-gray-700 px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter channel description"
                />
              </div>

              {error && <div className="text-sm text-red-500">{error}</div>}

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false)
                    setSelectedChannelForEdit(null)
                    setNewChannelName('')
                    setNewChannelDescription('')
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

      {/* Delete Channel Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-gray-800 p-6">
            <h2 className="mb-4 text-xl font-bold text-white">Delete Channel</h2>
            <p className="mb-6 text-gray-300">
              Are you sure you want to delete{' '}
              <span className="font-semibold">#{selectedChannelForEdit?.name}</span>? This action
              cannot be undone.
            </p>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false)
                  setSelectedChannelForEdit(null)
                }}
                className="rounded-md bg-gray-700 px-4 py-2 text-white hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteChannel}
                className="rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700"
              >
                Delete Channel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
