import * as React from "react"
import * as ToastPrimitives from "@radix-ui/react-toast"

export type ToastProps = React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> & {
  variant?: "default" | "destructive"
}

export type ToastActionElement = React.ReactElement<typeof ToastPrimitives.Action>

export interface ToastOptions {
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
  variant?: "default" | "destructive"
}

export interface Toast extends ToastOptions {
  id: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
} 