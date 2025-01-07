'use client'

import { useState, useEffect } from 'react'
import { Hash } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Channel {
  id: string
  name: string
  description: string | null
}

export function Sidebar() {
  const [channels, setChannels] = useState<Channel[]>([])

  useEffect(() => {
    const fetchChannels = async () => {
      try {
        const response = await fetch('/api/channels')
        if (!response.ok) throw new Error('Failed to fetch channels')
        const data = await response.json()
        setChannels(data)
      } catch (error) {
        console.error('Error fetching channels:', error)
      }
    }

    fetchChannels()
  }, [])

  return (
    <div className="w-64 bg-muted/50 border-r h-full">
      <div className="p-4">
        <h2 className="text-lg font-semibold mb-4">Channels</h2>
        <div className="space-y-1">
          {channels.map((channel) => (
            <Button
              key={channel.id}
              variant="ghost"
              className="w-full justify-start"
            >
              <Hash className="h-4 w-4 mr-2" />
              {channel.name}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
} 