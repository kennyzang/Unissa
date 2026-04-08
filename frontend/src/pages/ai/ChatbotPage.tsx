import React, { useState, useRef, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Input } from 'antd'
import { Send, Bot, User, Sparkles, RefreshCw } from 'lucide-react'
import { apiClient } from '@/lib/apiClient'
import { useAuthStore } from '@/stores/authStore'
import styles from './ChatbotPage.module.scss'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const QUICK_PROMPTS_BY_ROLE: Record<string, string[]> = {
  student: [
    'When is the course registration deadline?',
    'What is my current fee invoice?',
    'Can I drop IFN102?',
    'What is my CGPA?',
    'Tell me about my campus card',
    'What assignments are due soon?',
  ],
  lecturer: [
    'How many students do I have across all my courses this semester?',
    'Which of my IFN101 students have not yet submitted Assignment 1?',
    'Show me the attendance rate for my courses this week',
    'Which students are at academic risk in my classes?',
    'What is the grade distribution for my latest assignment?',
    'How many students have incomplete submissions across all my courses?',
  ],
  admin: [
    'How many purchase requests are currently pending approval, and what is the total value?',
    'Which GL code has the least available budget remaining, and what percentage is utilized?',
    'Which students have a risk score above 0.6 and have also not paid their tuition fees?',
    'What is the total enrollment count across all active programmes this semester?',
    'Which departments have exceeded their procurement budget this quarter?',
    'Show me a summary of staff leave requests pending approval system-wide',
  ],
  finance: [
    'How many purchase requests are currently pending approval, and what is the total value?',
    'Which GL code has the least available budget remaining, and what percentage is utilized?',
    'What is the total outstanding tuition fee balance across all students?',
    'Which departments have the highest procurement spend this month?',
    'Show me all invoices that are overdue by more than 30 days',
    'What is the current payroll commitment versus budget for this semester?',
  ],
  manager: [
    'How many staff are currently on approved leave this week?',
    'Which purchase requests require my approval today?',
    'What is the total budget utilization across my department?',
    'Show me the headcount by department under my oversight',
    'Which research grants are approaching their expenditure deadline?',
    'What is the average attendance rate for courses in my faculty?',
  ],
}

const DEFAULT_QUICK_PROMPTS = QUICK_PROMPTS_BY_ROLE.student

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

const WELCOME_BY_ROLE: Record<string, string> = {
  student: "Hello! I'm UNIBOT, your UNISSA AI assistant. I can help you with course registration, fee enquiries, assignments, CGPA, and more. How can I help you today?",
  lecturer: "Hello! I'm UNIBOT, your UNISSA AI assistant. I have access to your course enrolments, student submissions, attendance records, and academic analytics. What would you like to know?",
  admin: "Hello! I'm UNIBOT, your UNISSA AI assistant. I have system-wide access to financial records, procurement data, student risk profiles, and institutional analytics. What insights can I surface for you?",
  finance: "Hello! I'm UNIBOT, your UNISSA AI assistant. I can query live procurement records, GL budgets, tuition invoices, and payroll data. How can I assist you?",
  manager: "Hello! I'm UNIBOT, your UNISSA AI assistant. I can help you with departmental analytics, staff management, procurement approvals, and research fund oversight. What do you need?",
}

const ChatbotPage: React.FC = () => {
  const { user } = useAuthStore()
  const userRole = user?.role ?? 'student'
  const quickPrompts = QUICK_PROMPTS_BY_ROLE[userRole] ?? DEFAULT_QUICK_PROMPTS
  const welcomeMessage = WELCOME_BY_ROLE[userRole] ?? WELCOME_BY_ROLE.student

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: welcomeMessage,
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
      content: welcomeMessage,
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
          <Input.TextArea
            ref={inputRef as any}
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
