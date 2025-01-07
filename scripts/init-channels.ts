import { PrismaClient } from '@prisma/client'
import { exit } from 'process'

const prisma = new PrismaClient({
  log: ['error', 'warn']
})

const main = async (): Promise<void> => {
  try {
    // Create default channels if they don't exist
    const defaultChannels = [
      {
        name: 'general',
        description: 'General discussion channel',
      },
      {
        name: 'random',
        description: 'Random discussions and fun stuff',
      },
    ]

    for (const channel of defaultChannels) {
      const existingChannel = await prisma.channel.findFirst({
        where: { name: channel.name },
      })

      if (!existingChannel) {
        await prisma.channel.create({
          data: {
            name: channel.name,
            description: channel.description,
            updatedAt: new Date(),
          },
        })
        console.log(`Created channel: ${channel.name}`)
      } else {
        console.log(`Channel already exists: ${channel.name}`)
      }
    }

    console.log('Default channels initialized successfully')
  } catch (error) {
    console.error('Error initializing channels:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main() 