/**
 * Briques d'interface réutilisables, sans aucun calcul financier.
 */
import { useEffect, useId, type ReactNode } from 'react';
import { IconChevronLeft, IconChevronRight } from './icons';

export function NavBar(props: {
  title: string;
  subtitle?: ReactNode;
  back?: { label: string; onClick: () => void };
  actions?: ReactNode;
  large?: boolean;
}) {
  const large = props.large ?? true;
  return (
    <header className="navbar">
      <div className="navbar-top">
        {props.back ? (
          <button className="back-button" onClick={props.back.onClick}>
            <IconChevronLeft />
            <span>{props.back.label}</span>
          </button>
        ) : (
          <span />
        )}
        {!large && <strong style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>{props.title}</strong>}
        <div className="navbar-actions">{props.actions}</div>
      </div>
      {large && <h1 className="large-title">{props.title}</h1>}
      {props.subtitle && <p className="subtitle">{props.subtitle}</p>}
    </header>
  );
}

export function Section(props: { title?: ReactNode; footer?: ReactNode; children: ReactNode; plain?: boolean }) {
  return (
    <section className="section">
      {props.title && <h2 className="section-title">{props.title}</h2>}
      {props.plain ? props.children : <div className="card">{props.children}</div>}
      {props.footer && <p className="section-footer">{props.footer}</p>}
    </section>
  );
}

export function Row(props: {
  title: ReactNode;
  subtitle?: ReactNode;
  value?: ReactNode;
  valueSub?: ReactNode;
  onClick?: () => void;
  href?: string;
  chevron?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const content = (
    <>
      <div className="row-main">
        <div className="row-title">{props.title}</div>
        {props.subtitle && <div className="row-sub">{props.subtitle}</div>}
      </div>
      {(props.value !== undefined || props.valueSub !== undefined) && (
        <div className="row-value">
          <div>{props.value}</div>
          {props.valueSub && <div className="row-sub">{props.valueSub}</div>}
        </div>
      )}
      {(props.chevron ?? Boolean(props.onClick || props.href)) && (
        <span className="chevron">
          <IconChevronRight />
        </span>
      )}
    </>
  );
  if (props.href) {
    return (
      <a className={`row ${props.className ?? ''}`} href={props.href} target="_blank" rel="noreferrer" aria-label={props.ariaLabel}>
        {content}
      </a>
    );
  }
  if (props.onClick) {
    return (
      <button className={`row ${props.className ?? ''}`} onClick={props.onClick} aria-label={props.ariaLabel}>
        {content}
      </button>
    );
  }
  return <div className={`row ${props.className ?? ''}`}>{content}</div>;
}

export function Segmented<T extends string>(props: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={props.label}>
      {props.options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === props.value} onClick={() => props.onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chips<T extends string>(props: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div className="chips" role="group" aria-label={props.label}>
      {props.options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === props.value} onClick={() => props.onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Badge(props: { tone?: 'grey' | 'orange' | 'blue'; children: ReactNode }) {
  return <span className={`badge ${props.tone ?? ''}`}>{props.children}</span>;
}

/** Montant ou pourcentage coloré selon son signe (le signe + / − reste toujours écrit). */
export function Signed(props: { value: number | null; children: ReactNode }) {
  const cls = props.value === null || props.value === 0 ? '' : props.value > 0 ? 'pos' : 'neg';
  return <span className={cls}>{props.children}</span>;
}

export function Sheet(props: {
  title: string;
  onCancel: () => void;
  onConfirm?: () => void;
  confirmLabel?: string;
  confirmDisabled?: boolean;
  children: ReactNode;
}) {
  const titleId = useId();
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  return (
    <>
      <div className="sheet-backdrop" onClick={props.onCancel} />
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="sheet-header">
          <button className="left" onClick={props.onCancel}>
            {props.onConfirm ? 'Annuler' : 'Fermer'}
          </button>
          <h2 id={titleId}>{props.title}</h2>
          {props.onConfirm ? (
            <button className="right" onClick={props.onConfirm} disabled={props.confirmDisabled}>
              {props.confirmLabel ?? 'Enregistrer'}
            </button>
          ) : (
            <span />
          )}
        </div>
        <div className="sheet-body">{props.children}</div>
      </div>
    </>
  );
}

export function Field(props: { label: string; children: ReactNode; hint?: ReactNode; stacked?: boolean; htmlFor?: string }) {
  return (
    <div className={`field ${props.stacked ? 'stacked' : ''}`}>
      <label htmlFor={props.htmlFor} className="field-label">
        {props.label}
      </label>
      {props.children}
      {props.hint && <div className="field-hint">{props.hint}</div>}
    </div>
  );
}

export function Toggle(props: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <span className="toggle">
      <input type="checkbox" role="switch" aria-label={props.label} checked={props.checked} onChange={(e) => props.onChange(e.target.checked)} />
      <span />
    </span>
  );
}

export function Ring(props: { progress: number; size?: number; label: string }) {
  const size = props.size ?? 48;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, props.progress));
  return (
    <svg className="goal-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={props.label}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--fill)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${c * p} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

export function Messages(props: { errors?: string[]; warnings?: string[] }) {
  if (!props.errors?.length && !props.warnings?.length) return null;
  return (
    <div className="messages" role="status">
      {props.errors?.map((e) => (
        <div key={e} className="message error">
          {e}
        </div>
      ))}
      {props.warnings?.map((w) => (
        <div key={w} className="message warning">
          {w}
        </div>
      ))}
    </div>
  );
}
