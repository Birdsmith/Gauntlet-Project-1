import { useEffect, useRef, useState } from 'react'
import data from '@emoji-mart/data'
import Picker from '@emoji-mart/react'
import { Smile } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmojiPickerProps {
  onEmojiSelect: (emoji: any) => void
  isOpen?: boolean
  onOpenChange?: (isOpen: boolean) => void
  variant?: 'chat' | 'thread' | 'reaction'
}

export function EmojiPicker({
  onEmojiSelect,
  isOpen = false,
  onOpenChange,
  variant = 'chat',
}: EmojiPickerProps) {
  const pickerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [pickerPosition, setPickerPosition] = useState<'top' | 'center' | 'bottom'>('center')

  useEffect(() => {
    if (!isOpen || !buttonRef.current) return

    const updatePosition = () => {
      if (variant === 'thread') {
        setPickerPosition('center')
        return
      }

      const buttonRect = buttonRef.current?.getBoundingClientRect()
      if (!buttonRect) return

      const viewportHeight = window.innerHeight
      const buttonTop = buttonRect.top
      const THRESHOLD = 450 // Height of emoji picker + some padding

      if (variant === 'reaction') {
        // For reactions, check if there's enough space below
        if (buttonTop > viewportHeight - THRESHOLD) {
          setPickerPosition('top')
        } else {
          setPickerPosition('bottom')
        }
        return
      }

      // For chat input
      if (buttonTop > viewportHeight - THRESHOLD) {
        setPickerPosition('top')
      } else {
        setPickerPosition('bottom')
      }
    }

    updatePosition()
    window.addEventListener('scroll', updatePosition)
    window.addEventListener('resize', updatePosition)

    return () => {
      window.removeEventListener('scroll', updatePosition)
      window.removeEventListener('resize', updatePosition)
    }
  }, [isOpen, variant])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (buttonRef.current?.contains(event.target as Node)) return
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onOpenChange?.(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onOpenChange])

  const handleButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onOpenChange?.(!isOpen)
  }

  return (
    <div className="relative inline-block" ref={pickerRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleButtonClick}
        className={cn(
          'px-2 text-gray-400 transition-colors',
          isOpen ? 'text-blue-400 hover:text-blue-300' : 'hover:text-gray-300'
        )}
        title="Add emoji"
        aria-label="Open emoji picker"
        aria-expanded={isOpen}
      >
        <Smile className="h-5 w-5" />
      </button>
      {isOpen && (
        <div
          className={cn(
            'absolute z-50',
            variant === 'thread' && 'right-full mr-2', // Position to the left for thread view
            variant === 'reaction' && 'left-full ml-2', // Position to the right for reactions
            variant === 'chat' && 'left-1/2 -translate-x-1/2', // Center horizontally for chat view
            {
              // Chat input positioning
              'bottom-12': pickerPosition === 'top' && variant === 'chat',
              'top-12': pickerPosition === 'bottom' && variant === 'chat',
              // Thread view positioning
              'top-1/2 -translate-y-1/2': variant === 'thread',
              // Reaction positioning
              'bottom-0': pickerPosition === 'top' && variant === 'reaction',
              'top-0': pickerPosition === 'bottom' && variant === 'reaction',
            }
          )}
        >
          <Picker
            data={data}
            onEmojiSelect={(emoji: any) => {
              onEmojiSelect(emoji)
              onOpenChange?.(false)
            }}
            theme="dark"
            previewPosition="none"
          />
        </div>
      )}
    </div>
  )
}
