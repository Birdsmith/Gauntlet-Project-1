export interface IdleRequestOptions {
  timeout: number
}

export interface IdleRequestCallback {
  (deadline: { didTimeout: boolean; timeRemaining: () => number }): void
}

// Only declare if it doesn't exist in the global scope
interface Window {
  requestIdleCallback(callback: IdleRequestCallback, options?: IdleRequestOptions): number
  cancelIdleCallback(handle: number): void
}
