import { T } from '../../i18n/lang';
import { Connect4Room, Rooms } from '../../services/online/types';
import { RoomLobby } from '../../services/online/roomLobby';
import { C4State, lineAt } from './logic';

export function roomBoard(room: Connect4Room): C4State {
  const cells = Array.from({ length: 7 }, (_, c) => room.board.slice(c * 6, c * 6 + 6));
  const s: C4State = { cells, current: room.turn, winner: room.winner === 'draw' ? 'draw' : room.winner === null ? null : Number(room.winner) as 0 | 1, line: [], moves: Array(room.moves).fill(0) };
  if (s.winner === 0 || s.winner === 1) {
    for (let c = 0; c < 7; c++) for (let r = 0; r < 6; r++) {
      if (cells[c][r] === s.winner + 1) { const line = lineAt(s, c, r); if (line) s.line = line; }
    }
  }
  return s;
}

/** Sala do Quatro em Linha: a janela usa as classes do Shell. */
export class Connect4Online extends RoomLobby {
  constructor(root: HTMLElement, network: Rooms, change: (room: Connect4Room) => void, end: () => void) {
    super(root, network, change, end, {
      title: T('Quatro em Linha online', 'Online Four in a Row'),
      savedKey: 'clashcade.connect4.room.v1',
      overlayClass: 'gs-overlay', boxClass: 'gs-box', primaryClass: 'gs-primary',
      placeBar: bar => root.insertBefore(bar, root.querySelector('.gs-stage')),
    });
  }
}
