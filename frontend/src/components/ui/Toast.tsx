import { AlertTriangle, CheckCircle2, Info, OctagonAlert, X, XCircle } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './Button'
import { ConfirmContext, ToastContext, type ConfirmOptions, type ToastTone } from './toastContext'

interface ToastItem {
  id: number
  message: string
  tone: ToastTone
}

interface Question {
  id: number
  options: ConfirmOptions
  resolve: (ok: boolean) => void
}

const ICONS = {
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  error: XCircle,
  danger: OctagonAlert,
}

const DURATION: Record<ToastTone, number> = {
  success: 3500,
  info: 4000,
  warning: 6000,
  error: 7000,
}

/** In-app notifications (corner toasts) and confirmations (a modal), instead of browser pop-ups. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const remove = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), [])

  const toast = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = Date.now() + Math.random()
    // newest last, at most four on screen
    setItems((xs) => [...xs.slice(-3), { id, message, tone }])
  }, [])

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setQuestions((qs) => [...qs, { id: Date.now() + Math.random(), options, resolve }])
      }),
    [],
  )

  const answer = (q: Question, ok: boolean) => {
    q.resolve(ok)
    setQuestions((qs) => qs.filter((x) => x.id !== q.id))
  }
  const current = questions[0]

  return (
    <ToastContext.Provider value={toast}>
      <ConfirmContext.Provider value={confirm}>
        {children}
        <div className="toasts" aria-live="polite">
          {items.map((t) => (
            <ToastCard key={t.id} item={t} onClose={() => remove(t.id)} />
          ))}
        </div>
        {/* one question at a time; any others wait behind it */}
        {current && (
          <ConfirmDialog
            key={current.id}
            question={current}
            onAnswer={(ok) => answer(current, ok)}
          />
        )}
      </ConfirmContext.Provider>
    </ToastContext.Provider>
  )
}

function ToastCard({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const Icon = ICONS[item.tone]
  const [paused, setPaused] = useState(false)
  const left = useRef(DURATION[item.tone])
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])
  // Count down only while the pointer is away, so a toast being read does not vanish.
  useEffect(() => {
    if (paused) return
    const start = Date.now()
    const timer = window.setTimeout(() => closeRef.current(), left.current)
    return () => {
      window.clearTimeout(timer)
      left.current -= Date.now() - start
    }
  }, [paused])
  const urgent = item.tone === 'error' || item.tone === 'warning'
  return (
    <div
      className={`toast toast--${item.tone} ${paused ? 'is-paused' : ''}`}
      role={urgent ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={{ '--toast-ms': `${DURATION[item.tone]}ms` } as React.CSSProperties}
    >
      <span className="toast__icon" aria-hidden>
        <Icon />
      </span>
      <div className="toast__body">{item.message}</div>
      <button type="button" className="toast__close" onClick={onClose} aria-label="Dismiss">
        <X aria-hidden />
      </button>
      <span className="toast__timer" aria-hidden />
    </div>
  )
}

function ConfirmDialog({
  question,
  onAnswer,
}: {
  question: Question
  onAnswer: (ok: boolean) => void
}) {
  const {
    title,
    message,
    tone = 'warning',
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
  } = question.options
  const Icon = ICONS[tone]
  const cancelRef = useRef<HTMLButtonElement>(null)
  const answerRef = useRef(onAnswer)
  useEffect(() => {
    answerRef.current = onAnswer
  }, [onAnswer])
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    // Safe default: focus Cancel so Enter never confirms a destructive action by accident.
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && answerRef.current(false)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      prev?.focus()
    }
  }, [])
  return createPortal(
    <div
      className="dialog-backdrop confirm-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onAnswer(false)}
    >
      <div
        className={`dialog confirm confirm--${tone}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`confirm-title-${question.id}`}
        aria-describedby={message ? `confirm-msg-${question.id}` : undefined}
      >
        <div className="confirm__main">
          <span className="confirm__icon" aria-hidden>
            <Icon />
          </span>
          <div>
            <h2 className="confirm__title" id={`confirm-title-${question.id}`}>
              {title}
            </h2>
            {message && (
              <p className="confirm__message" id={`confirm-msg-${question.id}`}>
                {message}
              </p>
            )}
          </div>
        </div>
        <div className="dialog__footer confirm__footer">
          <button
            ref={cancelRef}
            type="button"
            className="btn btn--secondary"
            onClick={() => onAnswer(false)}
          >
            {cancelLabel}
          </button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={() => onAnswer(true)}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
