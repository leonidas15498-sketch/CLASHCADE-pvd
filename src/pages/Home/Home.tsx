import { useCallback, useEffect, useState } from 'react';
import { BRAND_NAME } from '../../brand';
import { T } from '../../i18n/lang';
import { Cover } from '../../components/Cover';
import { GAMES } from '../../games/registry';
import { gameText, LANGS, setLang, useI18n } from '../../i18n';
import { challengesToday, claimDaily, DAILY_BONUS, dailyAvailable, EVENT, getWallet } from '../../services/economy';
import { getSession, newSession, SESSION_EVENT } from '../../services/session';
import { currentTournamentGame, endTournament, getTournament, startTournament, TOURNAMENT_EVENT, TOURNAMENT_GAMES, TOURNAMENT_WINS } from '../../services/tournament';

/** Loja saiu do portal (03/11): cada jogo tem a sua, no menu do próprio jogo. */
type Tab = 'games' | 'settings';

/** Re-render quando carteira, placar ou outra aba mudarem os dados. */
function useStoreTick() {
  const [, set] = useState(0);
  useEffect(() => {
    const on = () => set((x) => x + 1);
    window.addEventListener(EVENT, on);
    window.addEventListener(SESSION_EVENT, on);
    window.addEventListener(TOURNAMENT_EVENT, on);
    window.addEventListener('storage', on);
    window.addEventListener('focus', on);
    return () => {
      window.removeEventListener(EVENT, on);
      window.removeEventListener(SESSION_EVENT, on);
      window.removeEventListener(TOURNAMENT_EVENT, on);
      window.removeEventListener('storage', on);
      window.removeEventListener('focus', on);
    };
  }, []);
}

const Icon = {
  pad: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 7h10a5 5 0 0 1 4.9 6l-.9 4a2.6 2.6 0 0 1-4.5 1.1L14.6 16H9.4l-1.9 2.1A2.6 2.6 0 0 1 3 17l-.9-4A5 5 0 0 1 7 7zm0 3v1.5H5.5v2H7V15h2v-1.5h1.5v-2H9V10zm9.5.5a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4zm-2 2.2a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z" />
    </svg>
  ),
  hanger: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3a3 3 0 0 1 3 3c0 1.2-.7 2-1.7 2.6l-.3.2v.6l8.3 6.2A1.9 1.9 0 0 1 20.2 19H3.8a1.9 1.9 0 0 1-1.1-3.4L11 9.4V8a1 1 0 0 1 .6-.9l.6-.4c.5-.3.8-.5.8-.7a1 1 0 0 0-2 0H9a3 3 0 0 1 3-3zm0 8.3L4.6 17h14.8z" />
    </svg>
  ),
  gear: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m19.4 13 .1-1-.1-1 2.1-1.6-2-3.5-2.5 1a7 7 0 0 0-1.7-1L15 3h-4l-.4 2.7a7 7 0 0 0-1.7 1l-2.5-1-2 3.5L6.5 11l-.1 1 .1 1-2.1 1.6 2 3.5 2.5-1c.5.4 1.1.7 1.7 1L11 21h4l.4-2.7c.6-.3 1.2-.6 1.7-1l2.5 1 2-3.5zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" />
    </svg>
  ),
  user: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="4.2" />
      <path d="M3.5 21a8.5 8.5 0 0 1 17 0z" />
    </svg>
  ),
  crown: (
    <svg viewBox="0 0 32 22" aria-hidden="true">
      <path d="M2 6l7 6 7-10 7 10 7-6-3 15H5z" />
    </svg>
  ),
};

function Coin({ size = 18 }: { size?: number }) {
  return (
    <svg className="coin" width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="9" fill="#ffc24a" stroke="#b9801c" strokeWidth="1.6" />
      <circle cx="10" cy="10" r="5.6" fill="none" stroke="#b9801c" strokeWidth="1.3" />
      <path d="M8 8.2 10 6.5l2 1.7v3.6L10 13.5 8 11.8z" fill="#fff3c4" />
    </svg>
  );
}

/** Logotipo desenhado em SVG/CSS (texto real, traduzível e nítido): nome em ASCII + coroa + arcos ciano/vermelho. */
function Logo() {
  return (
    <div className="brand" aria-label={BRAND_NAME}>
      <svg className="brand-arcs" viewBox="0 0 400 120" aria-hidden="true">
        <path d="M60 92 C20 70 30 30 92 22" stroke="#00e0ff" strokeWidth="9" fill="none" strokeLinecap="round" />
        <path d="M335 30 C390 50 380 95 300 104" stroke="#ff3b4d" strokeWidth="9" fill="none" strokeLinecap="round" />
      </svg>
      <span className="brand-crown">{Icon.crown}</span>
      <span className="brand-name" aria-hidden="true">
        {BRAND_NAME}
      </span>
    </div>
  );
}

function Versus() {
  const { t } = useI18n();
  const s = getSession();
  const [ask, setAsk] = useState(false);
  return (
    <section className="panel vs-panel" aria-labelledby="h-vs">
      <h2 id="h-vs" className="panel-tab">
        {t('vs.title')}
      </h2>
      <div className="vs" role="group" aria-label={`${t('vs.red')} ${s.red} × ${s.blue} ${t('vs.blue')}`}>
        <div className="vs-side red">
          <span className="vs-ava">{Icon.user}</span>
          <span className="vs-name">{t('vs.red')}</span>
          <b className="vs-num" data-testid="vs-red">
            {s.red}
          </b>
        </div>
        <span className="vs-mid">VS</span>
        <div className="vs-side blue">
          <b className="vs-num" data-testid="vs-blue">
            {s.blue}
          </b>
          <span className="vs-name">{t('vs.blue')}</span>
          <span className="vs-ava">{Icon.user}</span>
        </div>
      </div>
      <p className="muted small">{t('vs.help')}</p>
      {ask ? (
        <div className="confirm" role="alertdialog" aria-label={t('vs.confirm')}>
          <p>{t('vs.confirm')}</p>
          <div className="row">
            <button className="btn ghost" onClick={() => setAsk(false)}>
              ✕
            </button>
            <button
              className="btn red"
              data-testid="vs-reset-yes"
              onClick={() => {
                newSession();
                setAsk(false);
              }}
            >
              {t('vs.reset')}
            </button>
          </div>
        </div>
      ) : (
        <button className="btn ghost small-btn" data-testid="vs-reset" onClick={() => setAsk(true)}>
          {t('vs.reset')}
        </button>
      )}
    </section>
  );
}

function Daily() {
  const { t } = useI18n();
  const can = dailyAvailable();
  const ch = challengesToday();
  return (
    <section className="panel daily-panel" aria-labelledby="h-daily">
      <h2 id="h-daily" className="panel-tab">
        {t('daily.title')}
      </h2>
      <button className="btn amber" data-testid="daily" disabled={!can} onClick={() => claimDaily()}>
        <Coin /> {can ? t('daily.claim', { n: DAILY_BONUS }) : t('daily.done')}
      </button>
      <ul className="challenges">
        {ch.map((c) => (
          <li key={c.id} className={c.done ? 'done' : ''}>
            <span className="ch-name">{t(`ch.${c.id}`)}</span>
            <span className="ch-val">
              {c.done ? '✓' : `${c.progress}/${c.goal}`} · +{c.reward}
            </span>
            <span className="ch-bar" aria-hidden="true">
              <i style={{ width: `${(100 * c.progress) / c.goal}%` }} />
            </span>
          </li>
        ))}
      </ul>
      <p className="muted small">{t('ch.note')}</p>
    </section>
  );
}

/** Rota de um jogo disponível sorteado (exceto `not`). */
export function randomRoute(not?: string): string {
  const list = GAMES.filter((g) => g.status === 'available' && g.route !== not);
  return list[Math.floor(Math.random() * list.length)].route;
}

/**
 * Modo Torneio (01/11): melhor de 7 entre jogos curtos sorteados, Vermelho × Azul. O jogo da vez abre já no 2P local
 * (src/games/shared/shell.ts); o resultado volta para cá pelo armazenamento (src/services/tournament.ts).
 */
function TournamentPanel({ onOpen }: { onOpen: (route: string) => void }) {
  const { t, lang } = useI18n();
  const [form, setForm] = useState(false);
  const [ask, setAsk] = useState(false);
  const [names, setNames] = useState<[string, string]>(['', '']);
  const tour = getTournament();
  const avail = TOURNAMENT_GAMES.filter((r) => GAMES.some((g) => g.route === r && g.status === 'available'));
  const nameOf = (route: string) => {
    const g = GAMES.find((x) => x.route === route);
    return g ? (gameText(lang, g.id)?.name ?? g.name) : route;
  };
  const red = tour.names[0] || t('vs.red');
  const blue = tour.names[1] || t('vs.blue');
  if (!tour.active) {
    if (!form)
      return (
        <button className="btn amber small-btn tour-open" data-testid="tour-open" onClick={() => setForm(true)}>
          🏆 {t('tour.btn')}
        </button>
      );
    return (
      <section className="panel tour-panel" aria-labelledby="h-tour" data-testid="tour-form">
        <h3 id="h-tour">🏆 {t('tour.title')}</h3>
        <p className="muted small">{t('tour.help', { games: avail.map(nameOf).join(', ') })}</p>
        <div className="tour-names">
          <label className="tour-red">
            {t('tour.red')}
            <input data-testid="tour-red" maxLength={14} value={names[0]} placeholder={t('vs.red')} onChange={(e) => setNames([e.target.value, names[1]])} />
          </label>
          <label className="tour-blue">
            {t('tour.blue')}
            <input data-testid="tour-blue" maxLength={14} value={names[1]} placeholder={t('vs.blue')} onChange={(e) => setNames([names[0], e.target.value])} />
          </label>
        </div>
        <div className="row">
          <button className="btn ghost" onClick={() => setForm(false)}>
            {t('tour.cancel')}
          </button>
          <button
            className="btn amber"
            data-testid="tour-start"
            onClick={() => {
              const nt = startTournament([names[0].trim(), names[1].trim()], avail);
              setForm(false);
              onOpen(nt.order[0]);
            }}
          >
            {t('tour.start')}
          </button>
        </div>
      </section>
    );
  }
  const next = currentTournamentGame(tour);
  return (
    <section className="panel tour-panel" aria-labelledby="h-tour" data-testid="tour-panel">
      <h3 id="h-tour">🏆 {t('tour.title')}</h3>
      <div className="vs tour-vs" role="group" aria-label={`${red} ${tour.wins[0]} × ${tour.wins[1]} ${blue}`}>
        <div className="vs-side red">
          <span className="vs-name">{red}</span>
          <b className="vs-num" data-testid="tour-red-wins">
            {tour.wins[0]}
          </b>
        </div>
        <span className="vs-mid">VS</span>
        <div className="vs-side blue">
          <b className="vs-num" data-testid="tour-blue-wins">
            {tour.wins[1]}
          </b>
          <span className="vs-name">{blue}</span>
        </div>
      </div>
      <ol className="tour-list" aria-label={t('tour.title')}>
        {tour.results.map((r, i) => (
          <li key={i} className={r.winner === 0 ? 'red' : 'blue'}>
            {nameOf(r.route)} · {r.winner === 0 ? red : blue}
          </li>
        ))}
      </ol>
      {tour.champion !== null ? (
        <>
          <p className="tour-champ" data-testid="tour-champ">
            🏆 {t('tour.champ', { name: tour.champion === 0 ? red : blue })}
          </p>
          <div className="row">
            <button className="btn ghost" onClick={() => endTournament()}>
              {t('tour.close')}
            </button>
            <button
              className="btn amber"
              onClick={() => {
                endTournament();
                setNames([tour.names[0], tour.names[1]]);
                setForm(true);
              }}
            >
              {t('tour.again')}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="muted small">
            {t('tour.game', { n: tour.results.length + 1 })} · {t('tour.first', { w: TOURNAMENT_WINS })}
          </p>
          {ask ? (
            <div className="confirm" role="alertdialog" aria-label={t('tour.endAsk')}>
              <p>{t('tour.endAsk')}</p>
              <div className="row">
                <button className="btn ghost" onClick={() => setAsk(false)}>
                  ✕
                </button>
                <button
                  className="btn red"
                  data-testid="tour-end-yes"
                  onClick={() => {
                    endTournament();
                    setAsk(false);
                  }}
                >
                  {t('tour.end')}
                </button>
              </div>
            </div>
          ) : (
            <div className="row">
              <button className="btn ghost" data-testid="tour-end" onClick={() => setAsk(true)}>
                {t('tour.end')}
              </button>
              {next && (
                <button className="btn amber" data-testid="tour-next" onClick={() => onOpen(next)}>
                  {t('tour.next', { game: nameOf(next) })} ▶
                </button>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Games({ onOpen }: { onOpen: (route: string) => void }) {
  const { t, lang } = useI18n();
  const [filter, setFilter] = useState<'all' | 'ai' | 'local' | 'solo'>('all');
  const visible = GAMES.filter((g) => g.status === 'available' && (
    filter === 'all' || filter === 'local' ||
    (filter === 'ai' ? !['minigolfe', 'blocos'].includes(g.id) : ['minigolfe', 'blocos', 'empilha'].includes(g.id))
  ));
  return (
    <section aria-labelledby="h-games">
      <div className="section-head">
        <h2 id="h-games" className="section-title">
          {t('games.title')}
        </h2>
        {/* "Surpreenda-me" (ideia vinda do comparativo com o 2 Player Games, 01/11): sorteia um jogo disponível */}
        <div className="row head-btns">
          <button className="btn ghost small-btn" data-testid="random-game" onClick={() => onOpen(randomRoute())}>
            🎲 {t('games.random')}
          </button>
          {!getTournament().active && <TournamentPanel onOpen={onOpen} />}
        </div>
      </div>
      {getTournament().active && <TournamentPanel onOpen={onOpen} />}
      <div className="game-filters" role="group" aria-label={T('Filtrar por modo', 'Filter by mode')}>
        {([['all', T('Todos', 'All')], ['ai', T('Contra IA', 'Vs AI')], ['local', T('2P no aparelho', '2P on device')], ['solo', 'Solo']] as const).map(([mode, label]) => (
          <button key={mode} className={`btn ${filter === mode ? 'cyan' : 'ghost'}`} aria-pressed={filter === mode} onClick={() => setFilter(mode)}>{label}</button>
        ))}
      </div>
      <div className="grid">
        {visible.map((g) => {
          const tx = gameText(lang, g.id) ?? { name: g.name, desc: g.description, modes: g.modes };
          return (
            <article key={g.id} className="card">
              <button className="cover" onClick={() => onOpen(g.route)} aria-label={t('open', { name: tx.name })}>
                <Cover kind={g.cover} /><span className="game-ready">✓ {T('Disponível', 'Available')}</span>
              </button>
              <div className="card-body">
                <h3>{tx.name}</h3>
                <p>{tx.desc}</p>
                <ul className="chips">
                  {tx.modes.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
                <button className="btn amber play" onClick={() => onOpen(g.route)}>
                  {t('play')} <span aria-hidden="true">▶</span>
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Settings() {
  const { t, lang } = useI18n();
  return (
    <section className="settings" aria-labelledby="h-set">
      <h2 id="h-set" className="section-title">
        {t('nav.settings')}
      </h2>
      <div className="panel">
        <h3>{t('set.lang')}</h3>
        <div className="seg" role="radiogroup" aria-label={t('set.lang')}>
          {LANGS.map((l) => (
            <button key={l.id} role="radio" aria-checked={lang === l.id} className={`btn ${lang === l.id ? 'cyan' : 'ghost'}`} onClick={() => setLang(l.id)}>
              {l.label}
            </button>
          ))}
        </div>
      </div>
      <div className="panel">
        <h3>{t('set.data')}</h3>
        <p className="muted">{t('set.dataNote')}</p>
        <p className="muted small">{t('set.brand', { brand: BRAND_NAME })}</p>
      </div>
    </section>
  );
}

export function Home({ onOpen }: { onOpen: (route: string) => void }) {
  useStoreTick();
  const { t } = useI18n();
  const [tab, setTabState] = useState<Tab>(() => {
    try {
      const v = sessionStorage.getItem('clashcade.tab');
      return v === 'settings' ? v : 'games';
    } catch {
      return 'games';
    }
  });
  const setTab = useCallback((x: Tab) => {
    setTabState(x);
    try {
      sessionStorage.setItem('clashcade.tab', x);
    } catch {
      /* ignora */
    }
  }, []);
  const bal = getWallet().balance;
  return (
    <div className="home">
      <div className="arena-bg" aria-hidden="true">
        <span className="banner b-red">{Icon.crown}</span>
        <span className="banner b-blue">{Icon.crown}</span>
      </div>
      <header className="home-head">
        <div className="head-brand">
          <Logo />
          <p className="subtitle">
            <span>{t('subtitle')}</span>
          </p>
        </div>
        <div className="head-side">
          <p className="tagline">
            <b>{t('tagline1')}</b>
            <b>{t('tagline2')}</b>
            <span>{t('tags')}</span>
          </p>
          <div className="wallet" title={`${t('coins', { n: bal })} · ${T('gaste na loja de cada jogo', 'spend them in each game\'s shop')}`} data-testid="wallet">
            <Coin size={22} /> <b>{new Intl.NumberFormat().format(bal)}</b>
          </div>
          {/* Ajustes num botão de engrenagem no topo (03/11: menus mais intuitivos; antes era uma aba ao lado do placar) */}
          <button className={`gear-btn${tab === 'settings' ? ' on' : ''}`} data-tab="settings" aria-pressed={tab === 'settings'} aria-label={t('nav.settings')} title={t('nav.settings')} onClick={() => setTab(tab === 'settings' ? 'games' : 'settings')}>
            {Icon.gear}
          </button>
        </div>
      </header>

      <div className="top-row">
        <Versus />
        <Daily />
      </div>

      {tab === 'games' && <Games onOpen={onOpen} />}
      {tab === 'settings' && (
        <>
          <button className="btn ghost small-btn back-games" data-tab="games" onClick={() => setTab('games')}>← {T('Jogos', 'Games')}</button>
          <Settings />
        </>
      )}

      <footer className="home-foot">{t('foot')}</footer>
    </div>
  );
}
