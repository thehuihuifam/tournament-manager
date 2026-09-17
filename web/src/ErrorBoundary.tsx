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
          <h2>화면을 그리는 중 문제가 발생했어요</h2>
          <p>입력하신 대회 데이터는 이 브라우저에 그대로 저장되어 있으니 안심하세요. 아래 버튼으로 페이지를 새로고침해 주세요.</p>
          <p style={{ color: '#666', fontSize: '0.9em' }}>같은 문제가 반복되면 📂 가져오기로 백업을 저장한 뒤 관리자에게 문의해 주세요.</p>
          <button type="button" onClick={this.handleReload}>
            새로고침
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
