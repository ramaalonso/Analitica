import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
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
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="bg-[#fcfbf7] rounded-3xl p-8 border-2 border-dashed border-amber-300 text-center my-6 max-w-2xl mx-auto shadow-sm">
          <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-black text-stone-900 font-display mb-2">
            {this.props.fallbackTitle || 'Hubo un inconveniente al cargar esta sección'}
          </h3>
          <p className="text-xs text-stone-600 mb-6 max-w-md mx-auto leading-relaxed">
            Se produjo un error visual inesperado. Hacé clic en el botón de abajo para reiniciar la vista con los datos más recientes.
          </p>
          <button
            onClick={this.handleReset}
            className="px-5 py-2.5 bg-[#0f4b25] hover:bg-[#165b30] text-[#ece7d7] text-xs font-black uppercase tracking-wider rounded-xl inline-flex items-center space-x-2 shadow-md cursor-pointer transition-all active:scale-95"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Recargar Sección</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
