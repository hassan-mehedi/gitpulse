import { Component, type ErrorInfo, type ReactNode } from "react";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  error: Error | null;
}

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    error: null
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("GitPulse render error", error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="fatal-screen">
          <div className="fatal-screen__card">
            <div className="fatal-screen__eyebrow">Render Error</div>
            <div className="fatal-screen__title">GitPulse crashed while rendering.</div>
            <pre className="fatal-screen__body">{this.state.error.stack ?? this.state.error.message}</pre>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
