import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900 p-4 text-center">
                    <h1 className="text-2xl font-bold text-red-600 mb-4">Oups, une erreur est survenue.</h1>
                    <p className="text-slate-700 dark:text-slate-200 dark:text-white mb-6 max-w-md">
                        L'application a rencontré un problème inattendu.
                        <br />
                        {this.state.error?.message && <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded mt-2 block font-mono">{this.state.error.message}</span>}
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-lg font-semibold"
                    >
                        Recharger la page
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
