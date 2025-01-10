export interface User {
  id: string
  name: string | null
  image: string | null
  isOnline?: boolean
}

export interface Reaction {
  id: string
  emoji: string
  userId: string
  messageId: string
  user: User
}

export interface ReactionEvent extends Reaction {
  channelId?: string
  conversationId?: string
  directMessageId?: string
}

export interface FileAttachment {
  id: string
  name: string
  size: number
  type: string
  url: string
  createdAt?: string
  messageId?: string
}

export interface BaseMessage {
  id: string
  content: string
  createdAt: string
  updatedAt: string
  userId: string
  isEdited: boolean
  replyToId: string | null
  files: FileAttachment[]
  user: User
  replyCount?: number
  reactions: Reaction[]
}

export interface ChannelMessage extends BaseMessage {
  channelId: string
}

export interface DirectMessage extends BaseMessage {
  conversationId: string
}

export interface Channel {
  id: string
  name: string
  description: string | null
} 