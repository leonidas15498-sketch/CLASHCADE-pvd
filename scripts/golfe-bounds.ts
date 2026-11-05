// Imprime os limites (bounds) de cada buraco do minigolfe em JSON (usado por qa/golfe-tamanho.cjs).
import { LEVELS } from '../src/games/minigolf/levels/levels';
console.log(JSON.stringify(LEVELS.map((l) => ({ id: l.id, b: l.bounds }))));
