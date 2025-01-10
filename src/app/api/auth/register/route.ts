import { NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import prisma from '@/lib/prisma'
import { getIO } from '@/lib/socket'

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json()

    // Validate input
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate username length
    if (name.trim().length < 2 || name.length > 32) {
      return NextResponse.json(
        { error: 'Username must be between 2 and 32 characters' },
        { status: 400 }
      )
    }

    // Validate username format (letters, numbers, spaces, and common name characters)
    if (!/^[a-zA-Z0-9\s\-.']+$/.test(name)) {
      return NextResponse.json(
        { error: 'Username can only contain letters, numbers, spaces, hyphens, apostrophes, and periods' },
        { status: 400 }
      )
    }

    // Check if username starts or ends with whitespace
    if (name !== name.trim()) {
      return NextResponse.json(
        { error: 'Username cannot start or end with spaces' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Validate password strength
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { name },
        ],
      },
    })

    if (existingUser) {
      if (existingUser.email === email) {
        return NextResponse.json(
          { error: 'Email already registered' },
          { status: 400 }
        )
      }
      if (existingUser.name === name) {
        return NextResponse.json(
          { error: 'Username already taken' },
          { status: 400 }
        )
      }
    }

    // Hash password
    const hashedPassword = await hash(password, 12)

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
      },
    })

    try {
      // Emit new user event through Socket.IO
      const io = getIO()
      io.emit('new-user', user)
    } catch (socketError) {
      console.warn('Socket.IO not initialized:', socketError)
    }

    return NextResponse.json(
      { message: 'User created successfully' },
      { status: 201 }
    )
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'An error occurred while creating your account' },
      { status: 500 }
    )
  }
} 