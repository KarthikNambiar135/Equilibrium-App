'use client'

import { ReactNode, useEffect } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative w-full max-w-[430px] max-h-[85dvh] bg-background rounded-t-2xl animate-slide-up overflow-auto">
        {/* Handle */}
        <div className="sticky top-0 bg-background pt-3 pb-2 px-5 flex items-center justify-between border-b border-border z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-1 rounded-full bg-border mx-auto absolute top-2 left-1/2 -translate-x-1/2" />
            {title && (
              <h2 className="text-lg font-semibold mt-2">{title}</h2>
            )}
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-muted flex items-center justify-center mt-2"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
