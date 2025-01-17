import { Prisma } from '@prisma/client';

export type UserSelect = Prisma.UserSelect & {
  avatarImage: boolean;
  videoEnabled: boolean;
  avatarEnabled: boolean;
};

export type UserWithAvatar = Prisma.UserGetPayload<{
  select: UserSelect;
}>; 