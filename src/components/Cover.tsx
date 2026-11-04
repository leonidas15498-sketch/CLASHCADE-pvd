import { useEffect, useRef } from 'react';
import type { GameEntry } from '../games/registry';
import { pieceById } from '../games/stack/pieces';
import { T } from '../i18n/lang';

/** Capa da Torre desenhada com os MESMOS bichos do jogo (04/11: bichos redesenhados como animais de verdade). */
function StackCover() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    const c = cv?.getContext('2d');
    if (!cv || !c) return;
    const g = c.createLinearGradient(0, 0, 0, 360);
    g.addColorStop(0, '#2b1f6b');
    g.addColorStop(1, '#0a1433');
    c.fillStyle = g;
    c.fillRect(0, 0, 640, 360);
    // holofotes
    for (const [x, col] of [[180, 'rgba(255,59,77,0.18)'], [460, 'rgba(47,107,255,0.22)']] as const) {
      c.beginPath();
      c.moveTo(x - 30, 0);
      c.lineTo(x + 30, 0);
      c.lineTo(x + 120, 360);
      c.lineTo(x - 120, 360);
      c.fillStyle = col;
      c.fill();
    }
    c.fillStyle = '#2c3352';
    c.beginPath();
    c.roundRect(170, 300, 300, 26, 8);
    c.fill();
    c.fillStyle = '#ffc24a';
    c.fillRect(178, 304, 284, 4);
    const put = (id: string, x: number, y: number, a = 0, s = 62) => {
      c.setTransform(s * Math.cos(a), -s * Math.sin(a), -s * Math.sin(a), -s * Math.cos(a), x, y);
      pieceById(id).draw(c);
      c.setTransform(1, 0, 0, 1, 0, 0);
    };
    put('hipopotamo', 320, 262, 0, 80);
    put('tartaruga', 306, 203, 0, 80);
    put('capivara', 334, 147, 0, 80);
    put('coruja', 322, 81, 0, 80);
    put('raposa', 505, 96, -0.35, 64);
    put('caracol', 140, 272, 0, 60);
  }, []);
  return <canvas ref={ref} width={640} height={360} role="img" aria-label={T('Torre de bichos: hipopótamo, tartaruga, capivara e coruja empilhados', 'Critter tower: hippo, turtle, capybara and owl stacked')} style={{ width: '100%', height: '100%', display: 'block' }} />;
}

/** Capas desenhadas em SVG (sem imagens externas), uma por jogo. */
export function Cover({ kind }: { kind: GameEntry['cover'] }) {
  switch (kind) {
    case 'pool':
      return (
        <svg viewBox="0 0 320 180" role="img" aria-label="Mesa de sinuca com bolas arrumadas">
          <defs>
            <radialGradient id="pf" cx="50%" cy="50%" r="65%">
              <stop offset="0" stopColor="#23a35a" />
              <stop offset="1" stopColor="#0d5730" />
            </radialGradient>
            <linearGradient id="pw" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#9a5427" />
              <stop offset="1" stopColor="#4e240c" />
            </linearGradient>
          </defs>
          <rect width="320" height="180" fill="#2a160b" />
          <rect x="18" y="20" width="284" height="140" rx="16" fill="url(#pw)" />
          <rect x="34" y="36" width="252" height="108" rx="4" fill="url(#pf)" />
          {[
            [34, 36],
            [160, 32],
            [286, 36],
            [34, 144],
            [160, 148],
            [286, 144],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="8" fill="#050505" />
          ))}
          {(
            [
              [200, 90, '#f2b705'],
              [212, 83, '#1d4fb8'],
              [212, 97, '#d42a2a'],
              [224, 76, '#6b2d93'],
              [224, 90, '#141414'],
              [224, 104, '#f07400'],
              [236, 69, '#14824a'],
              [236, 83, '#7d1f22'],
              [236, 97, '#f2b705'],
              [236, 111, '#1d4fb8'],
            ] as const
          ).map(([x, y, c], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r="7" fill={c} />
              <circle cx={x - 2} cy={y - 2.5} r="2.2" fill="#fff" opacity=".5" />
            </g>
          ))}
          <circle cx="104" cy="90" r="7" fill="#f6f1e3" />
          <rect x="-40" y="88" width="134" height="4" rx="2" fill="#e2c48c" transform="rotate(0 104 90)" />
          <line x1="111" y1="90" x2="192" y2="90" stroke="#fff" strokeWidth="1.5" strokeDasharray="4 4" opacity=".8" />
        </svg>
      );
    case 'minigolf':
      return (
        <svg viewBox="0 0 320 180" role="img" aria-label="Buraco de minigolfe numa ilha ao pôr do sol">
          <defs>
            <linearGradient id="ms" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ff9a5a" />
              <stop offset=".55" stopColor="#ff6f61" />
              <stop offset="1" stopColor="#2b5f8f" />
            </linearGradient>
          </defs>
          <rect width="320" height="180" fill="url(#ms)" />
          <circle cx="250" cy="70" r="22" fill="#ffd36e" opacity=".9" />
          <ellipse cx="160" cy="150" rx="170" ry="48" fill="#e9c98a" />
          <path d="M40 140 Q60 96 120 104 L230 96 Q290 98 282 132 Q270 160 200 156 L90 160 Q36 162 40 140Z" fill="#8a4b22" />
          <path d="M50 138 Q66 104 120 111 L228 103 Q278 106 272 131 Q262 152 200 149 L92 153 Q46 154 50 138Z" fill="#3fae49" />
          <path d="M60 136 Q74 112 120 117 L226 110" stroke="#56c45d" strokeWidth="6" fill="none" opacity=".6" />
          <ellipse cx="236" cy="124" rx="7" ry="3.5" fill="#123" />
          <line x1="236" y1="124" x2="236" y2="84" stroke="#f4f4f4" strokeWidth="2" />
          <path d="M236 84 L258 90 L236 97Z" fill="#e8343a" />
          <circle cx="96" cy="136" r="5.5" fill="#fff" />
          <g stroke="#fff" strokeWidth="2" strokeDasharray="3 5" opacity=".85">
            <line x1="103" y1="134" x2="170" y2="126" />
          </g>
          <g fill="#2f7d32">
            <path d="M24 120 q10 -40 4 -70 q-14 10 -12 40z" />
            <path d="M28 52 q-26 -6 -34 10 q20 -2 34 -10z M28 52 q20 -16 36 -6 q-20 4 -36 6z" />
          </g>
        </svg>
      );
    case 'hockey':
      return (
        <svg viewBox="0 0 320 180" role="img" aria-label="Mesa de air hockey">
          <rect width="320" height="180" fill="#11233f" />
          <rect x="24" y="22" width="272" height="136" rx="40" fill="#dfe9f5" />
          <line x1="160" y1="22" x2="160" y2="158" stroke="#e8343a" strokeWidth="3" />
          <circle cx="160" cy="90" r="26" fill="none" stroke="#2f6fd6" strokeWidth="3" />
          <circle cx="92" cy="90" r="16" fill="#e8343a" />
          <circle cx="232" cy="90" r="16" fill="#2f6fd6" />
          <circle cx="170" cy="70" r="8" fill="#222" />
        </svg>
      );
    case 'trails':
      return (
        <svg viewBox="0 0 320 180" role="img" aria-label="Rastros coloridos num grid">
          <rect width="320" height="180" fill="#0d1022" />
          <path d="M20 150 H120 V60 H220 V120" stroke="#ff6b4a" strokeWidth="6" fill="none" />
          <path d="M300 30 H200 V90 H140 V150 H60" stroke="#3d8bff" strokeWidth="6" fill="none" />
        </svg>
      );
    case 'pong':
      return (
        <svg viewBox="0 0 320 180" role="img" aria-label="Quadra de Pong com raquetes coral e azul">
          <rect width="320" height="180" fill="#0c1a2e" />
          <rect x="14" y="14" width="292" height="152" fill="none" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="2" />
          <line x1="160" y1="16" x2="160" y2="164" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="3" strokeDasharray="8 7" />
          <rect x="30" y="58" width="8" height="40" rx="4" fill="#ff6b4a" />
          <rect x="282" y="88" width="8" height="40" rx="4" fill="#3d8bff" />
          <circle cx="196" cy="70" r="6" fill="#ffffff" />
          <circle cx="182" cy="76" r="4" fill="#ffffff" opacity="0.3" />
          <circle cx="170" cy="81" r="3" fill="#ffffff" opacity="0.15" />
        </svg>
      );
    case 'connect4':
      return (
        <svg viewBox="0 0 320 180" role="img" aria-label="Grade de Lig-4 com peças coral e azuis">
          <rect width="320" height="180" fill="#1a1640" />
          <rect x="68" y="18" width="184" height="152" rx="14" fill="#4a3f99" />
          {Array.from({ length: 42 }, (_, i) => {
            const c = i % 7;
            const r = Math.floor(i / 7);
            const filled: Record<string, string> = { '5-3': '#ff6b4a', '5-2': '#3d8bff', '4-3': '#ff6b4a', '5-4': '#3d8bff', '3-3': '#ff6b4a', '4-2': '#3d8bff', '5-1': '#ff6b4a', '2-3': '#ff6b4a' };
            return <circle key={i} cx={88 + c * 24} cy={38 + r * 24} r="9.5" fill={filled[`${r}-${c}`] ?? '#1a1640'} />;
          })}
        </svg>
      );
    case 'blocks':
      return (
        <svg viewBox="0 0 320 180" role="img" aria-label="Grade de blocos coloridos com uma peça sendo encaixada">
          <rect width="320" height="180" fill="#151a45" />
          <rect x="96" y="14" width="152" height="152" rx="12" fill="#0d1030" />
          {Array.from({ length: 64 }, (_, i) => {
            const c = i % 8;
            const r = Math.floor(i / 8);
            const pal = ['#ff5d73', '#ff9f43', '#ffd84d', '#4fe08a', '#35d0e0', '#5a8dff', '#b57cff'];
            const filled = r >= 5 ? c !== 6 : r === 4 ? c < 3 : false;
            return <rect key={i} x={101 + c * 18} y={19 + r * 18} width="16" height="16" rx="3.5" fill={filled ? pal[(r * 3 + c) % 7] : '#ffffff'} opacity={filled ? 1 : 0.06} />;
          })}
          <rect x="263" y="40" width="16" height="16" rx="3.5" fill="#ffd84d" />
          <rect x="263" y="58" width="16" height="16" rx="3.5" fill="#ffd84d" />
          <rect x="263" y="76" width="16" height="16" rx="3.5" fill="#ffd84d" />
          <rect x="20" y="110" width="16" height="16" rx="3.5" fill="#b57cff" />
          <rect x="38" y="110" width="16" height="16" rx="3.5" fill="#b57cff" />
          <rect x="38" y="92" width="16" height="16" rx="3.5" fill="#b57cff" />
        </svg>
      );
    case 'sumo':
      return (
        <svg viewBox="0 0 320 180" role="img" aria-label="Ringue neon com dois lutadores, coral e azul">
          <defs>
            <radialGradient id="sf" cx="50%" cy="50%" r="60%">
              <stop offset="0" stopColor="#1c2a5e" />
              <stop offset="1" stopColor="#070e26" />
            </radialGradient>
            <radialGradient id="sr" cx="35%" cy="35%" r="70%">
              <stop offset="0" stopColor="#fff" />
              <stop offset=".3" stopColor="#ff6b4a" />
              <stop offset="1" stopColor="#8c2a17" />
            </radialGradient>
            <radialGradient id="sb" cx="35%" cy="35%" r="70%">
              <stop offset="0" stopColor="#fff" />
              <stop offset=".3" stopColor="#3d8bff" />
              <stop offset="1" stopColor="#173f8c" />
            </radialGradient>
          </defs>
          <rect width="320" height="180" fill="url(#sf)" />
          <circle cx="160" cy="90" r="74" fill="#13204d" />
          <circle cx="160" cy="90" r="74" fill="none" stroke="#00e0ff" strokeWidth="10" opacity=".2" />
          <circle cx="160" cy="90" r="74" fill="none" stroke="#00e0ff" strokeWidth="3" />
          <path d="M100 80 l18 6" stroke="#ff6b4a" strokeWidth="3" strokeLinecap="round" opacity=".7" />
          <circle cx="135" cy="92" r="20" fill="url(#sr)" />
          <circle cx="190" cy="86" r="20" fill="url(#sb)" />
          <circle cx="143" cy="86" r="3.5" fill="#fff" />
          <circle cx="143" cy="97" r="3.5" fill="#fff" />
          <circle cx="182" cy="81" r="3.5" fill="#fff" />
          <circle cx="182" cy="92" r="3.5" fill="#fff" />
          <path d="M162 60 l-6 14 h8 l-6 14" stroke="#ffc24a" strokeWidth="3" fill="none" strokeLinejoin="round" />
        </svg>
      );
    case 'tug':
      return (
        <svg viewBox="0 0 320 180" role="img" aria-label="Corda esticada entre um time coral e um azul, com a fita no meio">
          <defs>
            <linearGradient id="tg" x1="0" x2="1">
              <stop offset="0" stopColor="#3a1a2c" />
              <stop offset=".5" stopColor="#0a1433" />
              <stop offset="1" stopColor="#13234d" />
            </linearGradient>
          </defs>
          <rect width="320" height="180" fill="url(#tg)" />
          <line x1="110" y1="50" x2="110" y2="130" stroke="#ff6b4a" strokeWidth="4" />
          <line x1="210" y1="50" x2="210" y2="130" stroke="#3d8bff" strokeWidth="4" />
          <line x1="160" y1="55" x2="160" y2="125" stroke="#fff" strokeWidth="2" strokeDasharray="6 6" opacity=".4" />
          <line x1="20" y1="90" x2="300" y2="90" stroke="#c9a26b" strokeWidth="8" strokeLinecap="round" />
          <rect x="146" y="76" width="12" height="28" rx="4" fill="#ffc24a" />
          <circle cx="45" cy="90" r="15" fill="#ff6b4a" />
          <circle cx="75" cy="90" r="15" fill="#ff6b4a" />
          <circle cx="245" cy="90" r="15" fill="#3d8bff" />
          <circle cx="275" cy="90" r="15" fill="#3d8bff" />
          <circle cx="160" cy="150" r="14" fill="none" stroke="#fff" strokeWidth="2" opacity=".7" />
          <circle cx="160" cy="150" r="8" fill="#ffc24a" />
          <path d="M120 30 q8 -10 16 0 M184 30 q8 -10 16 0" stroke="#ffc24a" strokeWidth="3" fill="none" />
        </svg>
      );
    case 'stack':
      return <StackCover />;
    case 'checkers': {
      const sq: JSX.Element[] = [];
      for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++) sq.push(<rect key={`${r}-${c}`} x={88 + c * 18} y={18 + r * 18} width="18" height="18" fill={(r + c) % 2 ? '#a8703f' : '#f0d9b5'} />);
      const pc = (r: number, c: number, col: string, king = false) => (
        <g key={`p${r}${c}`}>
          <circle cx={97 + c * 18} cy={29 + r * 18} r="7.5" fill="rgba(0,0,0,.35)" />
          <circle cx={97 + c * 18} cy={27 + r * 18} r="7.5" fill={col} stroke="rgba(0,0,0,.35)" />
          <circle cx={97 + c * 18} cy={27 + r * 18} r="4.8" fill="none" stroke="rgba(0,0,0,.25)" />
          {king && <path d={`M${92 + c * 18} ${30 + r * 18} l0 -6 l2.5 3 l2.5 -4 l2.5 4 l2.5 -3 l0 6 z`} fill="#ffd34d" />}
        </g>
      );
      return (
        <svg viewBox="0 0 320 180" role="img" aria-label={T('Tabuleiro de damas com peças coral e azuis', 'Checkers board with coral and blue pieces')}>
          <rect width="320" height="180" fill="#0d1530" />
          <rect x="80" y="10" width="160" height="160" rx="8" fill="#5a3518" />
          {sq}
          {[[0, 1], [0, 3], [1, 2], [2, 5], [3, 0]].map(([r, c]) => pc(r, c, '#3d8bff'))}
          {[[7, 0], [6, 1], [5, 4], [6, 5], [7, 6]].map(([r, c]) => pc(r, c, '#ff6b4a'))}
          {pc(3, 4, '#ff6b4a', true)}
          <path d="M187 75 L169 93" stroke="#28c7b7" strokeWidth="3" strokeDasharray="4 3" />
        </svg>
      );
    }
    case 'snake': {
      const tiles: JSX.Element[] = [];
      for (let r = 0; r < 9; r++) for (let c = 0; c < 16; c++) tiles.push(<rect key={`${r}-${c}`} x={c * 20} y={r * 20} width="20" height="20" fill={(r + c) % 2 ? '#1d4d3a' : '#215842'} />);
      return (
        <svg viewBox="0 0 320 180" role="img" aria-label={T('Duas cobrinhas, coral e azul, num gramado com frutas', 'Two snakes, coral and blue, on a lawn with fruit')}>
          {tiles}
          <path d="M30 150 H110 V90 H170" stroke="rgba(0,0,0,.3)" strokeWidth="18" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M30 150 H110 V90 H170" stroke="#ff6b4a" strokeWidth="15" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="170" cy="90" r="10" fill="#ff6b4a" />
          <circle cx="173" cy="85" r="3" fill="#fff" /><circle cx="173" cy="95" r="3" fill="#fff" />
          <circle cx="174" cy="85" r="1.5" fill="#111" /><circle cx="174" cy="95" r="1.5" fill="#111" />
          <path d="M300 30 H230 V70" stroke="#3d8bff" strokeWidth="15" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="230" cy="70" r="10" fill="#3d8bff" />
          <circle cx="225" cy="73" r="3" fill="#fff" /><circle cx="235" cy="73" r="3" fill="#fff" />
          <circle cx="225" cy="74" r="1.5" fill="#111" /><circle cx="235" cy="74" r="1.5" fill="#111" />
          {[[210, 90], [250, 130]].map(([x, y]) => (
            <g key={`${x}`}>
              <circle cx={x} cy={y} r="8" fill="#e02f3f" />
              <ellipse cx={x + 5} cy={y - 9} rx="5" ry="2.5" fill="#4fe08a" transform={`rotate(-30 ${x + 5} ${y - 9})`} />
            </g>
          ))}
        </svg>
      );
    }
    case 'chess': {
      const sq: JSX.Element[] = [];
      for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++) sq.push(<rect key={`${r}-${c}`} x={88 + c * 18} y={18 + r * 18} width="18" height="18" fill={(r + c) % 2 ? '#b58863' : '#f0d9b5'} />);
      // silhuetas simples (rei, dama, cavalo, torre, peões) nas cores dos jogadores
      const piece = (x: number, y: number, col: string, d: string, s = 0.22) => (
        <g key={`${x}-${y}`} transform={`translate(${x} ${y}) scale(${s})`}>
          <path d="M-28 30 H28 V44 H-28 Z" fill={col} stroke="rgba(0,0,0,.55)" strokeWidth="5" />
          <path d={d} fill={col} stroke="rgba(0,0,0,.55)" strokeWidth="5" strokeLinejoin="round" />
        </g>
      );
      const KING = 'M-22 30 L-18 0 Q-28 -14 -14 -20 L-4 -18 L-4 -26 L-11 -26 L-11 -32 L-4 -32 L-4 -40 L4 -40 L4 -32 L11 -32 L11 -26 L4 -26 L4 -18 L14 -20 Q28 -14 18 0 L22 30 Z';
      const QUEEN = 'M-22 30 L-17 2 L-28 -24 L-12 -6 L-8 -32 L0 -8 L8 -32 L12 -6 L28 -24 L17 2 L22 30 Z';
      const KNIGHT = 'M-20 30 L-16 6 Q-22 -2 -18 -10 L-2 -28 L0 -38 L6 -30 Q22 -24 24 -2 L26 30 Z';
      const ROOK = 'M-18 30 L-15 -14 L-22 -16 L-22 -36 L-13 -36 L-13 -28 L-4 -28 L-4 -36 L4 -36 L4 -28 L13 -28 L13 -36 L22 -36 L22 -16 L15 -14 L18 30 Z';
      const PAWN = 'M-14 30 L-9 4 Q-16 -2 -10 -10 A13 13 0 1 1 10 -10 Q16 -2 9 4 L14 30 Z';
      return (
        <svg viewBox="0 0 320 180" role="img" aria-label={T('Tabuleiro de xadrez com peças coral e azuis', 'Chess board with coral and blue pieces')}>
          <rect width="320" height="180" fill="#0d1530" />
          <rect x="80" y="10" width="160" height="160" rx="8" fill="#5a3518" />
          {sq}
          {piece(97 + 4 * 18, 27 + 0 * 18, '#3d8bff', KING)}
          {piece(97 + 6 * 18, 27 + 2 * 18, '#3d8bff', KNIGHT)}
          {piece(97 + 0 * 18, 27 + 0 * 18, '#3d8bff', ROOK)}
          {[1, 2, 5].map((c) => piece(97 + c * 18, 27 + 1 * 18, '#3d8bff', PAWN))}
          {piece(97 + 4 * 18, 27 + 7 * 18, '#ff6b4a', KING)}
          {piece(97 + 5 * 18, 27 + 3 * 18, '#ff6b4a', QUEEN)}
          {piece(97 + 7 * 18, 27 + 7 * 18, '#ff6b4a', ROOK)}
          {[3, 4, 6].map((c) => piece(97 + c * 18, 27 + (c === 4 ? 4 : 6) * 18, '#ff6b4a', PAWN))}
          <path d="M187 81 L205 63" stroke="#28c7b7" strokeWidth="3" strokeDasharray="4 3" />
        </svg>
      );
    }
    case 'ludo': {
      const cells: JSX.Element[] = [];
      const u = 10.6;
      const ox = 80.5;
      const oy = 10.5;
      for (let r = 0; r < 15; r++)
        for (let c = 0; c < 15; c++) {
          const arm = (r >= 6 && r <= 8) !== (c >= 6 && c <= 8);
          if (!arm) continue;
          let fill = '#f4f1e8';
          if (c === 7 && r >= 9 && r <= 13) fill = '#ff6b4a';
          if (c === 7 && r >= 1 && r <= 5) fill = '#3d8bff';
          cells.push(<rect key={`${r}-${c}`} x={ox + c * u} y={oy + r * u} width={u} height={u} fill={fill} stroke="rgba(20,25,45,.3)" strokeWidth=".6" />);
        }
      const base = (r: number, c: number, col: string) => (
        <g key={`b${r}${c}`}>
          <rect x={ox + c * u} y={oy + r * u} width={6 * u} height={6 * u} fill={col} />
          <rect x={ox + (c + 0.8) * u} y={oy + (r + 0.8) * u} width={4.4 * u} height={4.4 * u} rx="6" fill="#fff" opacity=".92" />
        </g>
      );
      const pawn = (x: number, y: number, col: string) => (
        <g key={`${x}-${y}`}>
          <ellipse cx={x} cy={y + 6} rx="5" ry="2" fill="rgba(0,0,0,.3)" />
          <path d={`M${x - 5} ${y + 5} q0 -3 3 -4 l1 -4 h2 l1 4 q3 1 3 4 z`} fill={col} stroke="rgba(15,10,30,.7)" />
          <circle cx={x} cy={y - 4} r="3" fill={col} stroke="rgba(15,10,30,.7)" />
        </g>
      );
      return (
        <svg viewBox="0 0 320 180" role="img" aria-label={T('Tabuleiro de Ludo com peões coral e azuis e um dado', 'Ludo board with coral and blue pawns and a die')}>
          <rect width="320" height="180" fill="#0d1530" />
          <rect x={ox - 3} y={oy - 3} width={15 * u + 6} height={15 * u + 6} rx="6" fill="#f4f1e8" />
          {base(9, 0, '#ff6b4a')}
          {base(0, 9, '#3d8bff')}
          {base(0, 0, '#9aa3b8')}
          {base(9, 9, '#9aa3b8')}
          {cells}
          <path d={`M${ox + 6 * u} ${oy + 9 * u} L${ox + 7.5 * u} ${oy + 7.5 * u} L${ox + 9 * u} ${oy + 9 * u} Z`} fill="#ff6b4a" />
          <path d={`M${ox + 6 * u} ${oy + 6 * u} L${ox + 7.5 * u} ${oy + 7.5 * u} L${ox + 9 * u} ${oy + 6 * u} Z`} fill="#3d8bff" />
          {pawn(ox + 2 * u, oy + 11 * u, '#ff6b4a')}
          {pawn(ox + 6.5 * u, oy + 10.5 * u, '#ff6b4a')}
          {pawn(ox + 12.5 * u, oy + 4 * u, '#3d8bff')}
          {pawn(ox + 8.5 * u, oy + 2.5 * u, '#3d8bff')}
          <g transform="translate(262 120) rotate(-14)">
            <rect x="-20" y="-20" width="40" height="40" rx="8" fill="#fff" stroke="#ff6b4a" strokeWidth="3" />
            {[[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]].map(([a, b]) => <circle key={`${a}${b}`} cx={a * 10} cy={b * 10} r="3.4" fill="#1b1426" />)}
          </g>
        </svg>
      );
    }
  }
}
