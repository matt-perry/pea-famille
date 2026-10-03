/**
 * Réglages : comptes, ETF, objectif, données de marché, sauvegarde, méthodes de calcul.
 */
import { useRef, useState } from 'react';
import { formatDateLong, formatEUR, formatDateShort, generateDataKey, isValidDataKey } from '../core';
import { Badge, Field, NavBar, Row, Section } from '../components/ui';
import { IconRefresh } from '../components/icons';
import { exportBackup, exportCSV, importBackup } from '../services/backup';
import { repoUrl, resolveDataBaseUrl, symbolsEditUrl } from '../services/prices';
import { setSetting } from '../repositories/settings';
import { useAppData } from '../viewmodels/AppData';
import { useNav } from './nav';

function ago(ms: number | null): string {
  if (!ms) return 'jamais';
  const minutes = Math.round((Date.now() - ms) / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return `il y a ${Math.round(hours / 24)} j`;
}

export function SettingsView() {
  const data = useAppData();
  const nav = useNav();
  const fileInput = useRef<HTMLInputElement>(null);
  const [confirmImport, setConfirmImport] = useState<File | null>(null);
  const goal = data.settings.goal;

  return (
    <div className="screen">
      <NavBar title="Réglages" back={{ label: 'Patrimoine', onClick: nav.pop }} />

      <Section title="Comptes">
        {data.accounts.map((a) => (
          <Row
            key={a.id}
            title={a.name}
            subtitle={[a.owner, a.broker].filter(Boolean).join(' · ') || undefined}
            onClick={() => nav.openSheet({ name: 'account', accountId: a.id })}
          />
        ))}
      </Section>

      <Section title="ETF suivis">
        {data.etfs.map((e) => (
          <Row
            key={e.id}
            title={e.shortName}
            subtitle={`${e.symbol}${e.isin ? ` · ${e.isin}` : ''}`}
            value={e.archived ? <Badge>archivé</Badge> : undefined}
            onClick={() => nav.openSheet({ name: 'etf', etfId: e.id })}
          />
        ))}
        <Row title={<span className="btn-plain">Ajouter un ETF</span>} chevron={false} onClick={() => nav.openSheet({ name: 'etf' })} />
      </Section>

      <Section title="Objectif">
        <Row
          title="Objectif de patrimoine"
          value={<span className="secondary">{goal ? formatEUR(Number(goal.target)) : 'aucun'}</span>}
          onClick={() => nav.openSheet({ name: 'goal' })}
        />
      </Section>

      <Section title="Données de marché">
        <Row
          title="Cours de bourse"
          subtitle={data.settings.dataKey ? `Synchronisés ${ago(data.settings.lastSyncAt)}` : 'À configurer'}
          value={data.settings.lastSyncError ? <Badge tone="orange">à vérifier</Badge> : undefined}
          onClick={() => nav.push({ name: 'market' })}
        />
      </Section>

      <Section
        title="Sauvegarde"
        footer={`Tes données ne sont que sur cet iPhone : sauvegarde au moins une fois par mois dans Fichiers ou iCloud Drive. Dernière sauvegarde : ${data.settings.lastExportAt ? formatDateLong(new Date(data.settings.lastExportAt).toISOString().slice(0, 10)) : 'jamais'}.`}
      >
        <Row
          title={<span className="btn-plain">Exporter une sauvegarde complète</span>}
          subtitle="Fichier .json, réimportable"
          chevron={false}
          onClick={async () => {
            const r = await exportBackup();
            if (r !== 'cancelled') nav.toast('Sauvegarde exportée');
          }}
        />
        <Row
          title={<span className="btn-plain">Exporter les mouvements (CSV)</span>}
          subtitle="Pour Excel ou Numbers"
          chevron={false}
          onClick={() => void exportCSV()}
        />
        <Row
          title={<span className="btn-plain">Restaurer une sauvegarde…</span>}
          subtitle="Remplace toutes les données de cet iPhone"
          chevron={false}
          onClick={() => fileInput.current?.click()}
        />
        {confirmImport && (
          <Row
            className="destructive"
            title={<strong>Remplacer tout par « {confirmImport.name} » ?</strong>}
            subtitle="Touche pour confirmer. Les données actuelles seront effacées."
            chevron={false}
            onClick={async () => {
              try {
                const r = await importBackup(confirmImport);
                nav.toast(`Sauvegarde restaurée : ${r.movements} mouvements`);
              } catch (error) {
                nav.toast(error instanceof Error ? error.message : 'Import impossible');
              }
              setConfirmImport(null);
            }}
          />
        )}
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="visually-hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) setConfirmImport(file);
            e.target.value = '';
          }}
        />
      </Section>

      <Section title="Sécurité et notifications" footer="Face ID au lancement et notification du soir arrivent dans la prochaine version.">
        <Row className="disabled" title="Verrouillage Face ID" value={<Badge>bientôt</Badge>} />
        <Row className="disabled" title="Résumé quotidien" value={<Badge>bientôt</Badge>} />
      </Section>

      <Section title="À propos">
        <Row title="Méthodes de calcul" onClick={() => nav.push({ name: 'methods' })} />
        <Row title="Version" value={<span className="secondary">1.0</span>} />
      </Section>
      <p className="section-footer">
        PEA Famille ne demande jamais tes identifiants bancaires ou de courtier. Tes mouvements restent uniquement sur cet iPhone.
      </p>
    </div>
  );
}

export function MarketView() {
  const data = useAppData();
  const nav = useNav();
  const s = data.settings;
  const [reveal, setReveal] = useState(false);
  const [pasted, setPasted] = useState('');
  const [baseOverride, setBaseOverride] = useState(s.dataBaseUrl ?? '');
  const base = resolveDataBaseUrl(s.dataBaseUrl);
  const repo = repoUrl(base);
  const editUrl = symbolsEditUrl(base);
  const activeSymbols = [...new Set(data.etfs.filter((e) => !e.archived).map((e) => e.symbol))];

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      nav.toast('Copié');
    } catch {
      nav.toast('Copie impossible : sélectionne le texte');
    }
  };

  return (
    <div className="screen">
      <NavBar title="Données de marché" back={{ label: 'Réglages', onClick: nav.pop }} />

      <Section
        title="État"
        footer="Le robot GitHub récupère les clôtures chez EODHD chaque soir de séance, vers 20 h–21 h. L'app les lit à chaque ouverture."
      >
        <Row
          title="Dernière synchronisation"
          value={<span className="secondary">{s.lastSyncAt ? ago(s.lastSyncAt) : 'jamais'}</span>}
        />
        {activeSymbols.map((symbol) => {
          const last = data.ctx.prices.latest(symbol);
          const robot = s.robotStatus?.symbols?.[symbol];
          return (
            <Row
              key={symbol}
              title={symbol}
              subtitle={robot?.error ? `Robot : ${robot.error}` : robot ? `Robot : ${robot.count} séances` : undefined}
              value={last ? <span>{formatDateShort(last.date)}</span> : <Badge tone="orange">aucun cours</Badge>}
            />
          );
        })}
        <button className="row" onClick={() => void nav.sync()} disabled={nav.syncing}>
          <span className="row-main btn-plain">{nav.syncing ? 'Actualisation…' : 'Actualiser maintenant'}</span>
          <span className="btn-plain">
            <IconRefresh />
          </span>
        </button>
      </Section>
      {s.lastSyncError && (
        <div className="messages">
          {s.lastSyncError.split('\n').map((e) => (
            <div key={e} className="message warning">
              {e}
            </div>
          ))}
        </div>
      )}

      <Section
        title="Clé de lecture des cours (DATA_KEY)"
        footer="Cette clé permet seulement de lire les cours chiffrés publiés par ton robot. Elle ne donne accès à aucun compte."
      >
        {s.dataKey ? (
          <>
            <div className="card-padded">
              <div className="code-box">{reveal ? s.dataKey : '•'.repeat(24)}</div>
            </div>
            <Row title={<span className="btn-plain">{reveal ? 'Masquer' : 'Afficher'}</span>} chevron={false} onClick={() => setReveal((r) => !r)} />
            <Row title={<span className="btn-plain">Copier la clé</span>} chevron={false} onClick={() => void copy(s.dataKey!)} />
          </>
        ) : (
          <Row
            title={<span className="btn-plain">Générer une clé</span>}
            subtitle="À faire une seule fois"
            chevron={false}
            onClick={async () => {
              await setSetting('dataKey', generateDataKey());
              setReveal(true);
            }}
          />
        )}
        <Field label="Coller une clé existante" htmlFor="paste-key" stacked hint="Après une réinstallation : colle la valeur du secret DATA_KEY.">
          <input id="paste-key" placeholder="44 caractères" value={pasted} onChange={(e) => setPasted(e.target.value)} autoCapitalize="off" autoCorrect="off" spellCheck={false} />
        </Field>
        {pasted && (
          <Row
            title={<span className={isValidDataKey(pasted) ? 'btn-plain' : 'destructive'}>{isValidDataKey(pasted) ? 'Utiliser cette clé' : 'Clé invalide'}</span>}
            chevron={false}
            onClick={async () => {
              if (!isValidDataKey(pasted)) return;
              await setSetting('dataKey', pasted.trim());
              setPasted('');
              nav.toast('Clé enregistrée');
              void nav.sync();
            }}
          />
        )}
      </Section>

      <Section title="À faire une fois sur GitHub" plain>
        <div className="card card-padded">
          <ol className="steps">
            <li>
              Ouvre {repo ? <a href={`${repo}/settings/secrets/actions`} target="_blank" rel="noreferrer">les secrets du dépôt</a> : 'ton dépôt › Settings › Secrets and variables › Actions'}.
            </li>
            <li>
              <strong>New repository secret</strong> : nom <code>DATA_KEY</code>, valeur = la clé ci-dessus.
            </li>
            <li>
              Nouveau secret <code>EODHD_API_KEY</code> : ta clé gratuite eodhd.com (elle ne va jamais sur l'iPhone).
            </li>
            <li>
              Onglet <strong>Actions › Robot du soir › Run workflow</strong> pour récupérer l'historique tout de suite.
            </li>
          </ol>
        </div>
      </Section>

      <Section
        title="Symboles suivis par le robot"
        footer={editUrl ? undefined : "Liste dans config/symbols.json sur GitHub."}
      >
        {(s.trackedSymbols ?? []).map((symbol) => (
          <Row key={symbol} title={symbol} value={activeSymbols.includes(symbol) ? <Badge>utilisé</Badge> : <Badge>non utilisé</Badge>} />
        ))}
        {activeSymbols
          .filter((symbol) => s.trackedSymbols && !s.trackedSymbols.includes(symbol))
          .map((symbol) => (
            <Row key={symbol} title={symbol} value={<Badge tone="orange">à ajouter</Badge>} />
          ))}
        {editUrl && <Row title={<span className="btn-plain">Modifier la liste sur GitHub</span>} href={editUrl} />}
      </Section>

      <Section title="Adresse des données" footer={`Utilisée : ${base ?? 'inconnue'}. Déduite automatiquement de l'adresse GitHub Pages ; à remplir seulement en cas de besoin.`}>
        <Field label="Adresse" htmlFor="base-url" stacked>
          <input
            id="base-url"
            type="url"
            placeholder="https://raw.githubusercontent.com/compte/depot/main/"
            value={baseOverride}
            onChange={(e) => setBaseOverride(e.target.value)}
            onBlur={() => void setSetting('dataBaseUrl', baseOverride.trim() || null)}
            autoCapitalize="off"
            autoCorrect="off"
          />
        </Field>
      </Section>
    </div>
  );
}

export function MethodsView() {
  const nav = useNav();
  return (
    <div className="screen">
      <NavBar title="Méthodes de calcul" back={{ label: 'Réglages', onClick: nav.pop }} />
      <div className="card card-padded prose" style={{ marginTop: 12 }}>
        <h3>Valeur</h3>
        <p>Parts détenues × dernier cours de clôture + liquidités du PEA. Un ETF sans cours n'est jamais estimé : la valeur est alors marquée « incomplète ».</p>
        <h3>PRU</h3>
        <p>Prix de revient unitaire, frais d'achat inclus : coût total des achats ÷ nombre de parts. Une vente ne le modifie pas ; une position vendue entièrement repart de zéro.</p>
        <h3>Versements</h3>
        <p>
          Tu n'as pas besoin de les saisir. Un PEA ne peut pas avoir de liquidités négatives : si un achat dépasse les liquidités connues, la différence est
          comptée comme un versement du même jour. Si tu saisis tes versements, ils sont utilisés en priorité.
        </p>
        <h3>Gain total</h3>
        <p>Valeur actuelle − versé net (versements − retraits). Le pourcentage affiché est ce gain rapporté au versé net.</p>
        <h3>Performance d'une période</h3>
        <p>
          On enchaîne les variations de chaque séance en retirant l'argent versé ce jour-là : un versement n'est jamais compté comme un gain (méthode dite
          « TWR »). C'est le chiffre comparable à la performance de l'ETF.
        </p>
        <h3>Rendement annualisé personnel</h3>
        <p>
          Le taux annuel qui, appliqué à chacun de tes versements depuis sa date, donne exactement la valeur actuelle (« TRI »). Affiché après un an d'historique ;
          c'est lui qu'il faut comparer aux 4, 6 ou 8 % de la projection.
        </p>
        <h3>Projection</h3>
        <p>
          Chaque mois, le versement s'ajoute puis le capital croît de (1 + taux annuel)^(1/12) − 1. Les versements d'un PEA s'arrêtent à 150 000 € versés si le
          plafond est appliqué. Hypothèses mathématiques, jamais des prévisions.
        </p>
        <h3>Sources</h3>
        <p>Cours de clôture : EODHD, via le robot GitHub. Euronext Paris ferme à 17 h 30 ; les cours arrivent en général vers 20 h–21 h.</p>
      </div>
    </div>
  );
}
