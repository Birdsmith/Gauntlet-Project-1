import { Search } from 'lucide-react'
import { useState, useRef } from 'react'
import { cn } from '@/lib/utils'

interface SearchBarProps {
  onSearch: (query: string, searchAllChannels?: boolean) => Promise<string | undefined>
  placeholder?: string
  showAllChannelsToggle?: boolean
}

export function SearchBar({ onSearch, placeholder = "Search messages...", showAllChannelsToggle = false }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [searchAllChannels, setSearchAllChannels] = useState(false)
  const [lastSearchQuery, setLastSearchQuery] = useState('')
  const [currentResultIndex, setCurrentResultIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const searchResults = useRef<string[]>([])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    // If searching for the same query, cycle through results
    if (query === lastSearchQuery && searchResults.current.length > 0) {
      const nextIndex = (currentResultIndex + 1) % searchResults.current.length
      setCurrentResultIndex(nextIndex)
      const messageId = searchResults.current[nextIndex]
      scrollToMessage(messageId)
      return
    }

    // New search query
    try {
      const results = await onSearch(query.trim(), searchAllChannels)
      if (results) {
        // Store results and reset index
        searchResults.current = Array.isArray(results) ? results : [results]
        setCurrentResultIndex(0)
        setLastSearchQuery(query)
        
        if (searchResults.current.length > 0) {
          scrollToMessage(searchResults.current[0])
        }
      }
    } catch (error) {
      console.error('Error performing search:', error)
    }
  }

  const scrollToMessage = (messageId: string) => {
    const messageElement = document.getElementById(`message-${messageId}`)
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // Add a temporary highlight effect
      messageElement.classList.add('bg-blue-500/20')
      setTimeout(() => {
        messageElement.classList.remove('bg-blue-500/20')
      }, 2000)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="h-8 w-80 rounded-md bg-gray-800 pl-8 pr-4 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {showAllChannelsToggle && (
        <label className="flex items-center gap-2 text-sm text-gray-300">
          <input
            type="checkbox"
            checked={searchAllChannels}
            onChange={(e) => setSearchAllChannels(e.target.checked)}
            className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-900"
          />
          Search all channels
        </label>
      )}
    </form>
  )
} 