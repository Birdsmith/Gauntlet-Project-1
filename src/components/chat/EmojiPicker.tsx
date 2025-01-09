import { useEffect, useRef, useState } from 'react'
import data from '@emoji-mart/data'
import Picker from '@emoji-mart/react'
import { Smile } from 'lucide-react'

interface EmojiPickerProps {
  onEmojiSelect: (emoji: any) => void
}

export function EmojiPicker({ onEmojiSelect }: EmojiPickerProps) {
  const [showPicker, setShowPicker] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowPicker(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={pickerRef}>
      <button
        type="button"
        onClick={() => setShowPicker(!showPicker)}
        className="px-2 text-gray-400 hover:text-gray-300"
        title="Add emoji"
      >
        <Smile className="h-5 w-5" />
      </button>
      {showPicker && (
        <div className="absolute bottom-12 right-0 z-50">
          <Picker
            data={data}
            onEmojiSelect={onEmojiSelect}
            theme="dark"
            previewPosition="none"
          />
        </div>
      )}
    </div>
  )
} 