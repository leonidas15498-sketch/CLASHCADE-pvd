/**
 * Idiomas: pt-BR e en-US (es-ES com dicionário do portal pronto, fora do seletor). Outros = novo dicionário.
 * Detecção pelo navegador na 1ª visita (pt → português; outro → inglês); troca manual fica salva. Números com Intl; plurais com Intl.PluralRules.
 * Dentro dos jogos usa-se T(pt, en) de ./lang.
 */
import { useEffect, useState } from 'react';

import { getLang, Lang, LANG_EVENT } from './lang';
export { detectLang, getLang, LANGS, setLang } from './lang';
export type { Lang } from './lang';

type Dict = Record<string, string>;

const pt: Dict = {
  tagline1: 'Um universo.',
  tagline2: 'Muitos jogos.',
  tags: 'Competitivo · Casual · Arcade',
  subtitle: 'Coleção de minijogos arcade',
  'nav.play': 'Jogos',
  'nav.shop': 'Loja',
  'nav.settings': 'Ajustes',
  'vs.title': 'Placar da sessão',
  'vs.red': 'Vermelho',
  'vs.blue': 'Azul',
  'vs.help': 'Vitórias em partidas de 2 jogadores no mesmo aparelho, somando todos os jogos.',
  'vs.reset': 'Nova sessão',
  'vs.confirm': 'Zerar o placar Vermelho × Azul? Recordes, fichas e cosméticos não mudam.',
  'daily.title': 'Hoje',
  'daily.claim': 'Pegar bônus diário +{n}',
  'daily.done': 'Bônus de hoje recebido',
  'ch.two-matches': 'Termine 2 partidas',
  'ch.two-games': 'Jogue 2 jogos diferentes',
  'ch.beat-ai': 'Vença a IA no Médio ou Difícil',
  'ch.note': 'Partidas concluídas dão +5 fichas (até 60 por dia). Sem penalidade por perder ou faltar.',
  coins: '{n} fichas',
  'coins.one': '{n} ficha',
  'games.title': 'Escolha um jogo',
  'games.random': 'Surpreenda-me',
  'tour.btn': 'Torneio',
  'tour.first': 'vence quem fizer {w}',
  'tour.title': 'Torneio · melhor de 7',
  'tour.help': 'Jogos sorteados entre {games}. Vence quem ganhar 4. Empate repete o jogo.',
  'tour.red': 'Nome do Vermelho',
  'tour.blue': 'Nome do Azul',
  'tour.start': 'Começar torneio',
  'tour.next': 'Jogar: {game}',
  'tour.game': 'Jogo {n} de até 7',
  'tour.end': 'Encerrar torneio',
  'tour.endAsk': 'Encerrar o torneio? O placar dele será perdido (o placar da sessão continua).',
  'tour.champ': '{name} é campeão!',
  'tour.again': 'Novo torneio',
  'tour.close': 'Fechar',
  'tour.cancel': 'Cancelar',
  play: 'Jogar',
  open: 'Abrir {name}',
  'shop.title': 'Loja de cosméticos',
  'shop.note':
    'Só visual: nenhum item muda física, força, mira ou IA. Fichas se ganham jogando; não são vendidas. Itens Premium vêm com a compra do Premium (ainda não disponível).',
  'shop.default': 'Padrão',
  'shop.owned': 'Seu',
  'shop.buy': 'Comprar · {n}',
  'shop.confirm': 'Confirmar: {n}',
  'shop.funds': 'Faltam {n}',
  'shop.premium': 'Premium',
  'shop.premiumTest': 'Premium · liberado para teste',
  'shop.seasonal': 'Sazonal',
  'shop.where': 'Use em: {game} → Personalizar',
  'kind.taco': 'Tacos',
  'kind.mesa': 'Mesas',
  'kind.campo': 'Campos',
  'kind.rastro': 'Rastros',
  'game.sinuca': 'Sinuca',
  'game.minigolfe': 'Minigolfe',
  'game.efeitos': 'Sinuca e Minigolfe',
  'set.lang': 'Idioma',
  'set.data': 'Seus dados',
  'set.dataNote': 'Sem cadastro: recordes, fichas e cosméticos ficam só neste aparelho. Limpar os dados do navegador apaga tudo.',
  'set.brand': '"{brand}" é um nome provisório.',
  foot: 'Sem cadastro. Tudo fica salvo só neste aparelho.',
};

const en: Dict = {
  tagline1: 'One universe.',
  tagline2: 'Many games.',
  tags: 'Competitive · Casual · Arcade',
  subtitle: 'Arcade minigame collection',
  'nav.play': 'Games',
  'nav.shop': 'Shop',
  'nav.settings': 'Settings',
  'vs.title': 'Session score',
  'vs.red': 'Red',
  'vs.blue': 'Blue',
  'vs.help': 'Wins in 2-player matches on the same device, across all games.',
  'vs.reset': 'New session',
  'vs.confirm': 'Reset the Red × Blue score? Records, chips and cosmetics stay.',
  'daily.title': 'Today',
  'daily.claim': 'Claim daily bonus +{n}',
  'daily.done': "Today's bonus claimed",
  'ch.two-matches': 'Finish 2 matches',
  'ch.two-games': 'Play 2 different games',
  'ch.beat-ai': 'Beat the AI on Medium or Hard',
  'ch.note': 'Finished matches give +5 chips (up to 60 a day). No penalty for losing or skipping days.',
  coins: '{n} chips',
  'coins.one': '{n} chip',
  'games.title': 'Pick a game',
  'games.random': 'Surprise me',
  'tour.btn': 'Tournament',
  'tour.first': 'first to {w} wins',
  'tour.title': 'Tournament · best of 7',
  'tour.help': 'Random games from {games}. First to 4 wins. A draw replays the game.',
  'tour.red': 'Red player name',
  'tour.blue': 'Blue player name',
  'tour.start': 'Start tournament',
  'tour.next': 'Play: {game}',
  'tour.game': 'Game {n} of up to 7',
  'tour.end': 'End tournament',
  'tour.endAsk': 'End the tournament? Its score will be lost (the session score stays).',
  'tour.champ': '{name} is the champion!',
  'tour.again': 'New tournament',
  'tour.close': 'Close',
  'tour.cancel': 'Cancel',
  play: 'Play',
  open: 'Open {name}',
  'shop.title': 'Cosmetics shop',
  'shop.note':
    'Visual only: no item changes physics, power, aim or AI. Chips are earned by playing, never sold. Premium items come with the Premium purchase (not available yet).',
  'shop.default': 'Default',
  'shop.owned': 'Owned',
  'shop.buy': 'Buy · {n}',
  'shop.confirm': 'Confirm: {n}',
  'shop.funds': '{n} short',
  'shop.premium': 'Premium',
  'shop.premiumTest': 'Premium · unlocked for testing',
  'shop.seasonal': 'Seasonal',
  'shop.where': 'Use in: {game} → Customize',
  'kind.taco': 'Cues & putters',
  'kind.mesa': 'Tables',
  'kind.campo': 'Courses',
  'kind.rastro': 'Trails',
  'game.sinuca': 'Pool',
  'game.minigolfe': 'Mini golf',
  'game.efeitos': 'Pool and Mini golf',
  'set.lang': 'Language',
  'set.data': 'Your data',
  'set.dataNote': 'No sign-up: records, chips and cosmetics live only on this device. Clearing browser data erases them.',
  'set.brand': '"{brand}" is a working name.',
  foot: 'No sign-up. Everything is saved on this device only.',
};

const es: Dict = {
  tagline1: 'Un universo.',
  tagline2: 'Muchos juegos.',
  tags: 'Competitivo · Casual · Arcade',
  subtitle: 'Colección de minijuegos arcade',
  'nav.play': 'Juegos',
  'nav.shop': 'Tienda',
  'nav.settings': 'Ajustes',
  'vs.title': 'Marcador de la sesión',
  'vs.red': 'Rojo',
  'vs.blue': 'Azul',
  'vs.help': 'Victorias en partidas de 2 jugadores en el mismo dispositivo, sumando todos los juegos.',
  'vs.reset': 'Nueva sesión',
  'vs.confirm': '¿Reiniciar el marcador Rojo × Azul? Récords, fichas y cosméticos no cambian.',
  'daily.title': 'Hoy',
  'daily.claim': 'Recoger bono diario +{n}',
  'daily.done': 'Bono de hoy recibido',
  'ch.two-matches': 'Termina 2 partidas',
  'ch.two-games': 'Juega 2 juegos distintos',
  'ch.beat-ai': 'Vence a la IA en Medio o Difícil',
  'ch.note': 'Las partidas terminadas dan +5 fichas (hasta 60 al día). Sin penalización por perder o faltar.',
  coins: '{n} fichas',
  'coins.one': '{n} ficha',
  'games.title': 'Elige un juego',
  'games.random': 'Sorpréndeme',
  'tour.btn': 'Torneo',
  'tour.first': 'gana quien llegue a {w}',
  'tour.title': 'Torneo · al mejor de 7',
  'tour.help': 'Juegos sorteados entre {games}. Gana quien llegue a 4. El empate repite el juego.',
  'tour.red': 'Nombre del Rojo',
  'tour.blue': 'Nombre del Azul',
  'tour.start': 'Empezar torneo',
  'tour.next': 'Jugar: {game}',
  'tour.game': 'Juego {n} de hasta 7',
  'tour.end': 'Terminar torneo',
  'tour.endAsk': '¿Terminar el torneo? Se perderá su marcador (el de la sesión sigue).',
  'tour.champ': '¡{name} es campeón!',
  'tour.again': 'Nuevo torneo',
  'tour.close': 'Cerrar',
  'tour.cancel': 'Cancelar',
  play: 'Jugar',
  open: 'Abrir {name}',
  'shop.title': 'Tienda de cosméticos',
  'shop.note':
    'Solo visual: ningún objeto cambia la física, la fuerza, la puntería ni la IA. Las fichas se ganan jugando; no se venden. Los objetos Premium vienen con la compra Premium (aún no disponible).',
  'shop.default': 'Por defecto',
  'shop.owned': 'Tuyo',
  'shop.buy': 'Comprar · {n}',
  'shop.confirm': 'Confirmar: {n}',
  'shop.funds': 'Faltan {n}',
  'shop.premium': 'Premium',
  'shop.premiumTest': 'Premium · desbloqueado para pruebas',
  'shop.seasonal': 'De temporada',
  'shop.where': 'Úsalo en: {game} → Personalizar',
  'kind.taco': 'Tacos y palos',
  'kind.mesa': 'Mesas',
  'kind.campo': 'Campos',
  'kind.rastro': 'Estelas',
  'game.sinuca': 'Billar',
  'game.minigolfe': 'Minigolf',
  'game.efeitos': 'Billar y Minigolf',
  'set.lang': 'Idioma',
  'set.data': 'Tus datos',
  'set.dataNote': 'Sin registro: récords, fichas y cosméticos quedan solo en este dispositivo. Borrar los datos del navegador los elimina.',
  'set.brand': '"{brand}" es un nombre provisional.',
  foot: 'Sin registro. Todo se guarda solo en este dispositivo.',
};

/** Nome, descrição e modos de cada jogo (id do registro). */
type GameText = { name: string; desc: string; modes: string[] };
const GAMES: Record<Lang, Record<string, GameText>> = {
  'pt-BR': {
    sinuca: { name: 'Sinuca 8-Ball', desc: 'Física de verdade: efeito, tabelas, caçapas e regras de 8 bolas.', modes: ['1P × IA', '2P local'] },
    minigolfe: { name: 'Minigolfe', desc: 'Nove buracos numa ilha: curvas, rampas, moinho e água.', modes: ['1P', '1P × IA', '2P por turnos'] },
    'air-hockey': { name: 'Air Hockey', desc: 'Disco rápido: cada um numa ponta da tela.', modes: ['1P × IA', '2P local'] },
    'duelo-rastros': { name: 'Duelo de Rastros', desc: 'Feche o caminho do rival com o seu rastro e não bata.', modes: ['1P × IA', '2P local'] },
    empilha: { name: 'Torre de Bichinhos', desc: 'Cada um coloca uma peça na torre. Quem derrubar perde!', modes: ['Solo', '1P × IA', '2P por turnos'] },
    'lig-4': { name: 'Quatro em Linha', desc: 'Alinhe 4 da sua cor antes do adversário.', modes: ['1P × IA', '2P por turnos'] },
    pong: { name: 'Pong', desc: 'Rebata, incline a bola com a ponta da raquete e não deixe passar.', modes: ['1P × IA', '2P local'] },
    blocos: { name: 'Blocos Cromáticos', desc: 'Encaixe peças, limpe linhas e encadeie combos.', modes: ['1P recorde', '1P × IA', '2P um após o outro'] },
    'sumo-neon': { name: 'Sumô Neon', desc: 'Empurre o rival para fora do ringue. Melhor de 3, rounds de segundos.', modes: ['1P × IA', '2P local'] },
    'cabo-de-guerra': { name: 'Cabo de Guerra', desc: 'Toque no ritmo da batida para puxar a corda para o seu lado.', modes: ['1P × IA', '2P local'] },
    damas: { name: 'Damas', desc: 'Regras brasileiras: captura obrigatória e dama voadora.', modes: ['1P × IA', '2P por turnos'] },
    ludo: { name: 'Ludo', desc: 'Role o dado e leve os 4 peões ao centro antes do rival.', modes: ['1P × IA', '2P por turnos'] },
    xadrez: { name: 'Xadrez', desc: 'Regras oficiais: roque, en passant, promoção e xeque-mate.', modes: ['1P × IA', '2P por turnos'] },
    cobrinha: { name: 'Cobrinha', desc: 'Coma as frutas, cresça e não bata. Solo ou duelo.', modes: ['Solo', '1P × IA', '2P local'] },
  },
  'en-US': {
    sinuca: { name: '8-Ball Pool', desc: 'Real physics: spin, cushions, pockets and 8-ball rules.', modes: ['1P vs AI', '2P local'] },
    minigolfe: { name: 'Mini Golf', desc: 'Nine holes on an island: curves, ramps, a windmill and water.', modes: ['1P', '1P vs AI', '2P turns'] },
    'air-hockey': { name: 'Air Hockey', desc: 'Fast puck: one player at each end of the screen.', modes: ['1P vs AI', '2P local'] },
    'duelo-rastros': { name: 'Light Trail Duel', desc: 'Box your rival in with your trail and do not crash.', modes: ['1P vs AI', '2P local'] },
    empilha: { name: 'Critter Stack', desc: 'Take turns adding a piece to the tower. Topple it and you lose!', modes: ['Solo', '1P vs AI', '2P turns'] },
    'lig-4': { name: 'Four in a Row', desc: 'Line up 4 of your color before your opponent.', modes: ['1P vs AI', '2P turns'] },
    pong: { name: 'Pong', desc: 'Return the ball, angle it with the paddle edge, do not let it pass.', modes: ['1P vs AI', '2P local'] },
    blocos: { name: 'Chromatic Blocks', desc: 'Fit pieces, clear lines and chain combos.', modes: ['1P high score', '1P vs AI', '2P one after another'] },
    'sumo-neon': { name: 'Neon Sumo', desc: 'Push your rival out of the ring. Best of 3, rounds last seconds.', modes: ['1P vs AI', '2P local'] },
    'cabo-de-guerra': { name: 'Tug of War', desc: 'Tap on the beat to pull the rope to your side.', modes: ['1P vs AI', '2P local'] },
    damas: { name: 'Checkers', desc: 'Brazilian rules: mandatory captures and flying kings.', modes: ['1P vs AI', '2P turns'] },
    ludo: { name: 'Ludo', desc: 'Roll the die and bring all 4 pawns home before your rival.', modes: ['1P vs AI', '2P turns'] },
    xadrez: { name: 'Chess', desc: 'Official rules: castling, en passant, promotion and checkmate.', modes: ['1P vs AI', '2P turns'] },
    cobrinha: { name: 'Snake', desc: 'Eat fruit, grow and do not crash. Solo or duel.', modes: ['Solo', '1P vs AI', '2P local'] },
  },
  'es-ES': {
    sinuca: { name: 'Billar 8 Bolas', desc: 'Física real: efecto, bandas, troneras y reglas de 8 bolas.', modes: ['1J vs IA', '2J local'] },
    minigolfe: { name: 'Minigolf', desc: 'Nueve hoyos en una isla: curvas, rampas, molino y agua.', modes: ['1J', '1J vs IA', '2J por turnos'] },
    'air-hockey': { name: 'Air Hockey', desc: 'Disco rápido: cada uno en un extremo de la pantalla.', modes: ['1J vs IA', '2J local'] },
    'duelo-rastros': { name: 'Duelo de Estelas', desc: 'Encierra a tu rival con tu estela y no choques.', modes: ['1J vs IA', '2J local'] },
    empilha: { name: 'Torre de Bichitos', desc: 'Cada uno pone una pieza en la torre. ¡Quien la tire pierde!', modes: ['Solo', '1J vs IA', '2J por turnos'] },
    'lig-4': { name: 'Cuatro en Raya', desc: 'Alinea 4 de tu color antes que tu rival.', modes: ['1J vs IA', '2J por turnos'] },
    pong: { name: 'Pong', desc: 'Devuelve la bola, inclínala con el borde de la pala y no la dejes pasar.', modes: ['1J vs IA', '2J local'] },
    blocos: { name: 'Bloques Cromáticos', desc: 'Encaja piezas, limpia líneas y encadena combos.', modes: ['1J récord', '1J vs IA', '2J uno tras otro'] },
    'sumo-neon': { name: 'Sumo Neón', desc: 'Empuja al rival fuera del ring. Al mejor de 3, rondas de segundos.', modes: ['1J vs IA', '2J local'] },
    'cabo-de-guerra': { name: 'Tira y Afloja', desc: 'Toca al ritmo para tirar de la cuerda hacia tu lado.', modes: ['1J vs IA', '2J local'] },
    damas: { name: 'Damas', desc: 'Reglas brasileñas: captura obligatoria y dama voladora.', modes: ['1J vs IA', '2J por turnos'] },
    ludo: { name: 'Parchís', desc: 'Tira el dado y lleva tus 4 fichas al centro antes que tu rival.', modes: ['1J vs IA', '2J por turnos'] },
    xadrez: { name: 'Ajedrez', desc: 'Reglas oficiales: enroque, al paso, promoción y jaque mate.', modes: ['1J vs IA', '2J por turnos'] },
    cobrinha: { name: 'Serpiente', desc: 'Come la fruta, crece y no choques. Solo o duelo.', modes: ['Solo', '1J vs IA', '2J local'] },
  },
};

const DICTS: Record<Lang, Dict> = { 'pt-BR': pt, 'en-US': en, 'es-ES': es };

export function translate(lang: Lang, key: string, vars: Record<string, string | number> = {}): string {
  let s = DICTS[lang][key] ?? pt[key] ?? key;
  if (typeof vars.n === 'number') {
    const cat = new Intl.PluralRules(lang).select(vars.n);
    const alt = DICTS[lang][`${key}.${cat}`];
    if (alt) s = alt;
    vars = { ...vars, n: new Intl.NumberFormat(lang).format(vars.n) };
  }
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

export const gameText = (lang: Lang, id: string): GameText | undefined => GAMES[lang][id];
/** Para o teste de completude: todas as chaves do pt existem nos outros idiomas. */
export const _dicts = DICTS;
export const _games = GAMES;

/** Hook React: idioma atual + função t. */
export function useI18n() {
  const [lang, setL] = useState<Lang>(getLang);
  useEffect(() => {
    const on = () => setL(getLang());
    window.addEventListener(LANG_EVENT, on);
    document.documentElement.lang = lang;
    return () => window.removeEventListener(LANG_EVENT, on);
  }, [lang]);
  return { lang, t: (k: string, v?: Record<string, string | number>) => translate(lang, k, v) };
}
