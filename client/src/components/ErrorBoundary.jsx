import { Component } from 'react';

/**
 * App-wide safety net. Before this existed, a render error on any single page
 * (e.g. a hooks-order mistake) white-screened the whole app with nothing on
 * screen and no way back. Now the rest of the shell stays usable and the user
 * gets a reload.
 */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('Unhandled UI error:', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-warm-50 px-4">
        <div className="max-w-md w-full bg-white border border-warm-200 rounded-2xl p-8 text-center">
          <h1 className="text-xl font-bold text-warm-900 mb-2">Something broke on this page</h1>
          <p className="text-sm text-warm-500 mb-6">
            The rest of the app is fine. Reload to try again — if it keeps happening, let us know.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-xl bg-fox-500 text-white text-sm font-semibold hover:bg-fox-600"
            >
              Reload
            </button>
            <a
              href="/"
              className="px-4 py-2 rounded-xl border border-warm-200 text-warm-600 text-sm font-semibold hover:bg-warm-50"
            >
              Go home
            </a>
          </div>
        </div>
      </div>
    );
  }
}
