export interface User {
  id: string
  name: string | null
  image: string | null
  isOnline?: boolean
}

export interface FileAttachment {
  id: string
  name: string
  url: string
  size: number
  type: string
}

export interface Reaction {
  id: string
  emoji: string
  userId: string
  user: User
  messageId: string
}

export interface Message {
  id: string
  content: string
  createdAt: Date
  updatedAt: Date
  channelId: string
  userId: string
  isEdited: boolean
  replyToId: string | null
  replyCount?: number
  user: User
  files: FileAttachment[]
  reactions: Reaction[]
}

export interface DirectMessage extends Omit<Message, 'channelId'> {
  conversationId: string
  isAvatarMessage?: boolean
  avatarName?: string
  avatarVideoUrl?: string
}

export interface ReactionEvent {
  id: string
  emoji: string
  userId: string
  user: User
  messageId?: string
  directMessageId?: string
  conversationId?: string
  channelId?: string
}

export interface Channel {
  id: string
  name: string
  description: string | null
}
