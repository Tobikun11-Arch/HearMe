import type {ReactNode} from 'react';
import {Component} from 'react';

type Props = {
  children: ReactNode;
};

type State = {
  error: Error | null;
};

export default class ErrorBoundary extends Component<Props, State> {
  state: State = {error: null};

  static getDerivedStateFromError(error: Error): State {
    return {error};
  }

  componentDidCatch(error: Error) {
    // Intentionally minimal: rely on visible UI + browser console for debugging.
    console.error(error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-background">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="text-lg font-semibold text-foreground">
                Page error
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                The app hit a runtime error while rendering this route.
              </div>
              <pre className="mt-4 whitespace-pre-wrap wrap-break-word rounded-lg bg-muted p-4 text-xs text-foreground">
                {this.state.error.message}
              </pre>
              <div className="mt-4 text-xs text-muted-foreground">
                Open DevTools Console to see the full stack trace.
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
