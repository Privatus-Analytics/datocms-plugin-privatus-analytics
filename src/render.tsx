import { StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'

let root: Root | null = null

export function render(component: React.ReactNode): void {
  if (!root) root = createRoot(document.getElementById('root') as HTMLElement)
  root.render(<StrictMode>{component}</StrictMode>)
}
