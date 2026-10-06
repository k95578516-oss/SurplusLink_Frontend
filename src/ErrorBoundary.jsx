import React from 'react';
import { AlertTriangle } from 'lucide-react';

/*
 * Safety net only: a render/effect error anywhere below this component shows a message instead of
 * unmounting the whole app (the "white screen"). The error is still logged to the console so the
 * underlying bug stays visible. Changing `resetKey` (e.g. the route path) clears the error state,
 * so navigating away from a broken page recovers without a manual refresh.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[SurplusLink] Render error:', error, info?.componentStack);
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return <div className="error-screen" role="alert">
      <AlertTriangle />
      <strong>Something went wrong</strong>
      <span>{error?.message || 'An unexpected error occurred while displaying this page.'}</span>
      <div className="row-actions">
        <button className="btn btn-primary" onClick={() => window.location.reload()}>Reload page</button>
        <button className="btn btn-secondary" onClick={() => { window.location.assign(this.props.homePath || '/app'); }}>Go to dashboard</button>
      </div>
    </div>;
  }
}