import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_error: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Uncaught rendering error:', error, info);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '32px', maxWidth: '540px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
          <h2>문제가 발생했습니다</h2>
          <p>페이지를 새로고침해 주세요. 저장 데이터는 삭제되지 않았습니다.</p>
          <button type="button" onClick={this.handleReload}>
            새로고침
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
