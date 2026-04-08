import React, { type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  filePath?: string;
}

interface State {
  hasError: boolean;
  error: string;
}

export class EditorErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error: error.message };
  }

  componentDidCatch(error: Error) {
    console.error('[Cortex] Editor crashed:', error);
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.filePath !== this.props.filePath && this.state.hasError) {
      this.setState({ hasError: false, error: '' });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          padding: 32,
        }}>
          <div style={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 24,
            maxWidth: 420,
            width: '100%',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              {/* AlertTriangle inline SVG */}
              <svg
                width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="var(--red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              >
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                <path d="M12 9v4"/><path d="M12 17h.01"/>
              </svg>
              <h3 style={{ color: 'var(--red)', fontSize: 14, fontWeight: 600 }}>
                Editor Error
              </h3>
            </div>
            <div style={{
              color: 'var(--text-muted)',
              fontSize: 12,
              fontFamily: '"JetBrains Mono", "SF Mono", monospace',
              lineHeight: 1.6,
              marginBottom: 16,
              maxHeight: 120,
              overflowY: 'auto',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: 12,
              wordBreak: 'break-word',
            }}>
              {this.state.error}
            </div>
            <button
              onClick={() => this.setState({ hasError: false, error: '' })}
              className="btn-primary"
              style={{
                paddingLeft: 24,
                paddingRight: 24,
                paddingTop: 8,
                paddingBottom: 8,
                color: 'white',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
