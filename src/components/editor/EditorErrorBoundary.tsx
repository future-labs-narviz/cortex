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
        <div style={{ padding: 32, color: 'var(--text-primary)' }}>
          <h3 style={{ color: 'var(--red)', marginBottom: 12, fontSize: 14, fontWeight: 600 }}>
            Editor Error
          </h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: 16, fontSize: 13 }}>
            {this.state.error}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: '' })}
            className="btn-primary"
            style={{
              padding: '8px 16px',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
