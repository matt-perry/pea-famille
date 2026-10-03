/**
 * Filet de sécurité : si l'app ne peut pas démarrer (stockage refusé, base abîmée…),
 * on affiche une explication plutôt qu'un écran blanc.
 */
import { Component, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    const storage = /indexeddb|database|quota|security/i.test(`${this.state.error.name} ${this.state.error.message}`);
    return (
      <div className="screen" style={{ paddingTop: 'calc(var(--safe-top) + 48px)' }}>
        <h1 className="large-title">Démarrage impossible</h1>
        <p className="secondary" style={{ lineHeight: 1.45 }}>
          {storage
            ? "Le stockage local de l'iPhone est indisponible (navigation privée, ou données de sites bloquées dans Réglages › Safari). L'app en a besoin pour garder tes mouvements."
            : "Une erreur inattendue s'est produite. Tes données ne sont pas effacées : ferme l'app et rouvre-la."}
        </p>
        <p className="secondary" style={{ fontSize: '0.8rem' }}>Détail technique : {this.state.error.message}</p>
        <button className="btn-primary" style={{ marginTop: 20 }} onClick={() => location.reload()}>
          Réessayer
        </button>
      </div>
    );
  }
}
