import React from 'react'
import { RefreshCw, AlertTriangle } from 'lucide-react'

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Unhandled render error:', error, info.componentStack)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          gap: '12px',
          color: '#4E5969',
          textAlign: 'center',
          padding: '32px',
        }}>
          <AlertTriangle size={36} color="#F53F3F" />
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#1D2129' }}>
            Something went wrong
          </h2>
          <p style={{ margin: 0, fontSize: '14px', maxWidth: '420px', lineHeight: 1.6 }}>
            An unexpected error occurred while loading this page. Please try again or contact support if the problem persists.
          </p>
          {this.state.error && (
            <p style={{
              margin: 0,
              fontSize: '12px',
              color: '#86909C',
              background: '#F7F8FA',
              padding: '8px 12px',
              borderRadius: '6px',
              fontFamily: 'monospace',
              maxWidth: '480px',
              wordBreak: 'break-word',
            }}>
              {this.state.error.message}
            </p>
          )}
          <button
            onClick={this.handleRetry}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 18px',
              background: '#165DFF',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            <RefreshCw size={14} />
            Try Again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
