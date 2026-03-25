import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import { MessageCircle, X, Send, Bot, User, Sparkles, RefreshCw, Minimize2 } from 'lucide-react'
import { apiClient } from '@/lib/apiClient'
import styles from './AiChatBubble.module.scss'
import clsx from 'clsx'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const QUICK_PROMPTS = [
  'What is my current fee?',
  'Course registration deadline?',
  'How to apply for leave?',
  'My CGPA status',
]

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
  const [open, setOpen]               = useState(false)
  const [minimized, setMinimized]     = useState(false)
  const [messages, setMessages]       = useState<Message[]>([{
    id: 'welcome',
    role: 'assistant',
    content: "Hello! I'm UNIBOT, your UNISSA AI assistant. How can I help you today?",
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
  const handleFabMouseDown = useCallback((e: React.MouseEvent) => {
    const startX = e.clientX
    const startY = e.clientY
    wasDragged.current = false

    const rect = wrapperRef.current!.getBoundingClientRect()
    const initTop  = rect.top
    const initLeft = rect.left

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        wasDragged.current = true
      }
      if (wasDragged.current) {
        // Clamp within viewport
        const newTop  = Math.max(0, Math.min(window.innerHeight - 60, initTop  + dy))
        const newLeft = Math.max(0, Math.min(window.innerWidth  - 60, initLeft + dx))
        setPosition({ top: newTop, left: newLeft })
      }
    }

    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      if (!wasDragged.current) {
        setOpen(o => !o)
        setUnread(0)
      }
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    e.preventDefault()
  }, [])

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
                {QUICK_PROMPTS.map((p, i) => (
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
