import React, { useState, useRef, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Send, Bot, User, Sparkles, RefreshCw } from 'lucide-react'
import { apiClient } from '@/lib/apiClient'
import styles from './ChatbotPage.module.scss'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const QUICK_PROMPTS = [
  'When is the course registration deadline?',
  'What is my current fee invoice?',
  'Can I drop IFN102?',
  'What is my CGPA?',
  'Tell me about my campus card',
  'What assignments are due soon?',
]

function parseMarkdown(text: string): React.ReactNode {
  // Simple markdown: **bold**, *italic*, line breaks
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|\n)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i}>{part.slice(1, -1)}</em>
    }
    if (part === '\n') return <br key={i} />
    return part
  })
}

const ChatbotPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hello! I\'m UNIBOT, your UNISSA AI assistant. I can help you with course registration, fee enquiries, assignments, CGPA, and more. How can I help you today?',
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [conversationId, setConversationId] = useState<string | undefined>()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const { data } = await apiClient.post('/ai/chat', { message, conversationId })
      return data.data as { answer: string; conversationId: string; sources: string[] }
    },
    onSuccess: (data, message) => {
      setConversationId(data.conversationId)
      setMessages(prev => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: data.answer,
          timestamp: new Date(),
        },
      ])
    },
    onError: () => {
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: 'I\'m having trouble connecting. Please try again shortly.',
          timestamp: new Date(),
        },
      ])
    },
  })

  const sendMessage = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return

    setMessages(prev => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'user', content: trimmed, timestamp: new Date() },
    ])
    setInput('')
    chatMutation.mutate(trimmed)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
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

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.botInfo}>
          <div className={styles.botAvatar}><Bot size={22} /></div>
          <div>
            <div className={styles.botName}>UNIBOT</div>
            <div className={styles.botStatus}><span className={styles.onlineDot} /> Online · AI Assistant</div>
          </div>
        </div>
        <button className={styles.resetBtn} onClick={resetConversation} title="New conversation">
          <RefreshCw size={14} />
          New chat
        </button>
      </div>

      <div className={styles.chatContainer}>
        {/* Messages */}
        <div className={styles.messages}>
          {messages.map(msg => (
            <div key={msg.id} className={`${styles.message} ${msg.role === 'user' ? styles.userMessage : styles.botMessage}`}>
              <div className={styles.messageAvatar}>
                {msg.role === 'user' ? <User size={16} /> : <Sparkles size={16} />}
              </div>
              <div className={styles.messageBubble}>
                <div className={styles.messageContent}>{parseMarkdown(msg.content)}</div>
                <div className={styles.messageTime}>
                  {msg.timestamp.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}

          {chatMutation.isPending && (
            <div className={`${styles.message} ${styles.botMessage}`}>
              <div className={styles.messageAvatar}><Sparkles size={16} /></div>
              <div className={styles.messageBubble}>
                <div className={styles.typing}>
                  <span />
                  <span />
                  <span />
                </div>
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
            placeholder="Ask me anything about your studies…"
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
            <Send size={18} />
          </button>
        </div>
        <div className={styles.inputHint}>Press Enter to send · Shift+Enter for new line</div>
      </div>
    </div>
  )
}

export default ChatbotPage
