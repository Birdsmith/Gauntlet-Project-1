import { ToastActionElement, Toast, ToastOptions } from "@/components/ui/toast"

export interface ToastState {
  toasts: Toast[]
}

export interface UseToastResult extends ToastState {
  toast: (options: ToastOptions) => {
    id: string
    dismiss: () => void
    update: (props: Toast) => void
  }
  dismiss: (toastId?: string) => void
}

export declare function useToast(): UseToastResult
export declare function toast(options: ToastOptions): {
  id: string
  dismiss: () => void
  update: (props: Toast) => void
} 