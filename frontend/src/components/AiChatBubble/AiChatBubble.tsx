import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import { MessageCircle, X, Send, Bot, User, Sparkles, RefreshCw, Minimize2 } from 'lucide-react'
import { apiClient } from '@/lib/apiClient'
import styles from './AiChatBubble.module.scss'
import clsx from 'clsx'
import { useAuthStore } from '@/stores/authStore'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const QUICK_PROMPTS_BY_ROLE: Record<string, string[]> = {
  student: [
    'What is my current fee?',
    'Course registration deadline?',
    'How to apply for leave?',
    'My CGPA status',
  ],
  lecturer: [
    'Show me attendance stats for my courses',
    'Which students have not submitted the latest assignment?',
    'What is the average grade for my course?',
    'How many students are at risk of failing?',
  ],
  admin: [
    'How many students are currently enrolled?',
    'What is the total outstanding fee balance?',
    'Show me pending purchase requests',
    'How many staff are on leave today?',
  ],
  finance: [
    'How many purchase requests are pending approval?',
    'Which GL code has the least available budget?',
    'What is the total outstanding tuition fee balance?',
    'Which departments have the highest procurement spend?',
  ],
  manager: [
    'How many staff are on leave this week?',
    'Which purchase requests require my approval?',
    'What is the total budget utilization across my department?',
    'Show me headcount by department under my oversight',
  ],
}

const DEFAULT_QUICK_PROMPTS = QUICK_PROMPTS_BY_ROLE.student

const WELCOME_BY_ROLE: Record<string, string> = {
  student: "Hello! I'm UNIBOT, your UNISSA AI assistant. I can help you with course registration, fee enquiries, assignments, CGPA, and more. How can I help you today?",
  lecturer: "Hello! I'm UNIBOT, your UNISSA AI assistant. I have access to your course enrolments, student submissions, attendance records, and academic analytics. What would you like to know?",
  admin: "Hello! I'm UNIBOT, your UNISSA AI assistant. I have system-wide access to financial records, procurement data, student risk profiles, and institutional analytics. What insights can I surface for you?",
  finance: "Hello! I'm UNIBOT, your UNISSA AI assistant. I can query live procurement records, GL budgets, tuition invoices, and payroll data. How can I assist you?",
  manager: "Hello! I'm UNIBOT, your UNISSA AI assistant. I can help you with departmental analytics, staff management, procurement approvals, and research fund oversight. What do you need?",
}

function parseMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|\n)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*'))   return <em key={i}>{part.slice(1, -1)}</em>
    if (part === '\n') return <br key={i} />
    return part
  })
}

const AiChatBubble: React.FC = () => {
  const { user } = useAuthStore()
  const userRole = user?.role ?? 'student'
  const quickPrompts = QUICK_PROMPTS_BY_ROLE[userRole] ?? DEFAULT_QUICK_PROMPTS
  const welcomeMessage = WELCOME_BY_ROLE[userRole] ?? WELCOME_BY_ROLE.student
  
  const [open, setOpen]               = useState(false)
  const [minimized, setMinimized]     = useState(false)
  const [messages, setMessages]       = useState<Message[]>([{
    id: 'welcome',
    role: 'assistant',
    content: welcomeMessage,
    timestamp: new Date(),
  }])
  const [input, setInput]             = useState('')
  const [conversationId, setConversationId] = useState<string | undefined>()
  const [unread, setUnread]           = useState(0)

  // Drag state – null means use CSS default (bottom-right)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)

  const wrapperRef     = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef       = useRef<HTMLTextAreaElement>(null)
  const wasDragged     = useRef(false)

  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      setUnread(0)
    }
  }, [messages, open])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const { data } = await apiClient.post('/ai/chat', { message, conversationId })
      return data.data as { answer: string; conversationId: string }
    },
    onSuccess: (data) => {
      setConversationId(data.conversationId)
      setMessages(prev => [...prev, {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: data.answer,
        timestamp: new Date(),
      }])
      if (!open) setUnread(u => u + 1)
    },
    onError: () => {
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: "I'm having trouble connecting. Please try again shortly.",
        timestamp: new Date(),
      }])
    },
  })

  const sendMessage = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    setMessages(prev => [...prev, {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    }])
    setInput('')
    chatMutation.mutate(trimmed)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
  }

  const resetConversation = () => {
    setConversationId(undefined)
    setMessages([{
      id: 'welcome-new',
      role: 'assistant',
      content: 'New conversation started. How can I help you?',
      timestamp: new Date(),
    }])
  }

  // ── Drag logic ─────────────────────────────────────────────
  const startDrag = useCallback((startX: number, startY: number, isTouch: boolean) => {
    wasDragged.current = false

    const rect = wrapperRef.current!.getBoundingClientRect()
    const initTop  = rect.top
    const initLeft = rect.left

    const onMove = (ev: MouseEvent | TouchEvent) => {
      const clientX = isTouch ? (ev as TouchEvent).touches[0].clientX : (ev as MouseEvent).clientX
      const clientY = isTouch ? (ev as TouchEvent).touches[0].clientY : (ev as MouseEvent).clientY
      const dx = clientX - startX
      const dy = clientY - startY
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        wasDragged.current = true
      }
      if (wasDragged.current) {
        ev.preventDefault()
        // Clamp within viewport
        const newTop  = Math.max(0, Math.min(window.innerHeight - 60, initTop  + dy))
        const newLeft = Math.max(0, Math.min(window.innerWidth  - 60, initLeft + dx))
        setPosition({ top: newTop, left: newLeft })
      }
    }

    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onUp)
      if (!wasDragged.current) {
        setOpen(o => !o)
        setUnread(0)
      }
    }

    if (isTouch) {
      document.addEventListener('touchmove', onMove, { passive: false })
      document.addEventListener('touchend', onUp)
    } else {
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    }
  }, [])

  const handleFabMouseDown = useCallback((e: React.MouseEvent) => {
    startDrag(e.clientX, e.clientY, false)
    e.preventDefault()
  }, [startDrag])

  const handleFabTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    startDrag(touch.clientX, touch.clientY, true)
  }, [startDrag])

  const wrapperStyle: React.CSSProperties = position
    ? { top: position.top, left: position.left, bottom: 'auto', right: 'auto' }
    : {}

  return (
    <div ref={wrapperRef} className={styles.wrapper} style={wrapperStyle}>
      {/* Chat panel */}
      {open && (
        <div className={clsx(styles.panel, { [styles.minimized]: minimized })}>
          {/* Header */}
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              <div className={styles.avatar}><Bot size={16} /></div>
              <div>
                <div className={styles.botName}>UNIBOT</div>
                {!minimized && <div className={styles.botStatus}><span className={styles.dot} />AI Assistant</div>}
              </div>
            </div>
            <div className={styles.headerActions}>
              <button className={styles.iconBtn} onClick={resetConversation} title="New conversation">
                <RefreshCw size={13} />
              </button>
              <button className={styles.iconBtn} onClick={() => setMinimized(m => !m)} title={minimized ? 'Expand' : 'Minimise'}>
                <Minimize2 size={13} />
              </button>
              <button className={styles.iconBtn} onClick={() => setOpen(false)} title="Close">
                <X size={14} />
              </button>
            </div>
          </div>

          {!minimized && (
            <>
              {/* Messages */}
              <div className={styles.messages}>
                {messages.map(msg => (
                  <div key={msg.id} className={clsx(styles.msg, msg.role === 'user' ? styles.userMsg : styles.botMsg)}>
                    <div className={styles.msgAvatar}>
                      {msg.role === 'user' ? <User size={12} /> : <Sparkles size={12} />}
                    </div>
                    <div className={styles.msgBubble}>
                      <div className={styles.msgContent}>{parseMarkdown(msg.content)}</div>
                      <div className={styles.msgTime}>
                        {msg.timestamp.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}
                {chatMutation.isPending && (
                  <div className={clsx(styles.msg, styles.botMsg)}>
                    <div className={styles.msgAvatar}><Sparkles size={12} /></div>
                    <div className={styles.msgBubble}>
                      <div className={styles.typing}><span /><span /><span /></div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick prompts */}
              <div className={styles.quickPrompts}>
                {quickPrompts.map((p, i) => (
                  <button
                    key={i}
                    className={styles.quickBtn}
                    onClick={() => sendMessage(p)}
                    disabled={chatMutation.isPending}
                  >
                    {p}
                  </button>
                ))}
              </div>

              {/* Input */}
              <div className={styles.inputRow}>
                <textarea
                  ref={inputRef}
                  className={styles.input}
                  rows={1}
                  placeholder="Ask anything…"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={chatMutation.isPending}
                />
                <button
                  className={styles.sendBtn}
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || chatMutation.isPending}
                >
                  <Send size={14} />
                </button>
              </div>
              <div className={styles.hint}>Enter to send · Shift+Enter for new line</div>
            </>
          )}
        </div>
      )}

      {/* FAB trigger button – drag to move, click to open/close */}
      <button
        className={clsx(styles.fab, { [styles.fabOpen]: open })}
        onMouseDown={handleFabMouseDown}
        onTouchStart={handleFabTouchStart}
        title="AI Assistant"
        aria-label="Open AI Assistant"
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
        {!open && unread > 0 && <span className={styles.badge}>{unread}</span>}
      </button>
    </div>
  )
}

export default AiChatBubble
