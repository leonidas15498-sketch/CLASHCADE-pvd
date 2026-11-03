# ARCHITECTURE — Jogaço

## Visão geral
Uma única aplicação **React + TypeScript + Vite**. O portal (catálogo e página do jogo) é React; cada jogo é um
**módulo independente** que o portal monta num contêiner e desmonta ao sair.

```
src/
├── app/App.tsx              rota pelo hash (#sinuca, #minigolfe); sem recarregar a página
├── pages/Home/              catálogo (cartões, modalidades, "Em desenvolvimento")
├── pages/GamePage/          carrega o jogo sob demanda, monta/desmonta, isola erros
├── components/Cover.tsx     capas em SVG (sem imagens externas)
├── games/
│   ├── registry.ts          registro central: id, nome, descrição, capa, modalidades, status, rota, load()
│   ├── shared/              contrato GameModule, música (loop) e botão de música
│   ├── pool/                Sinuca 8-Ball (física, regras, IA, render, UI) — preservada da versão anterior
│   └── minigolf/            Minigolfe (physics, rules, levels, render, ui)
├── services/storage.ts      persistência versionada + interface RemoteSync (futuro Supabase, não implementado)
└── styles/portal.css        identidade do portal
tests/pool, tests/minigolf   Vitest sem DOM
```

## Contrato dos jogos
```ts
interface GameModule { mount(container, { onExit }): { destroy(): void } }
```
- `mount` injeta o CSS do jogo (importado com `?inline`), o HTML do jogo (`?raw`) e cria o controlador.
- `destroy` para o `requestAnimationFrame`, fecha os contextos de áudio, limpa timers, remove listeners globais
  (todos registrados com um `AbortController`) e remove o CSS e o DOM.
- `onExit` é chamado pelo botão "← Jogos" do menu do jogo. Abandonar uma partida em andamento pede confirmação
  dentro do jogo. **Limitação:** o botão "voltar" do navegador sai sem confirmação (o jogo é desmontado limpo).

## Carregamento sob demanda
`registry.ts` usa `import('./pool')` e `import('./minigolf')`. No build normal (`dist/`) cada jogo é um arquivo
separado (Sinuca ~90 KB, Minigolfe menor); o portal sozinho tem ~150 KB (React). O build de arquivo único
(`dist-single/`) junta tudo, por limitação do formato.

## Isolamento de falhas
`GamePage` tem um *error boundary* e trata falha de carregamento: o portal mostra "Não foi possível abrir o jogo"
com "Voltar aos jogos" em vez de quebrar.

## Áudio
Cada jogo tem a própria música (`games/shared/music.ts`, loop com fade cruzado) e um **botão de música** próprio
(`musicControl.ts`: liga/desliga + volume), separado do botão de efeitos sonoros. O Minigolfe ainda não tem faixa:
o botão aparece automaticamente quando `MINIGOLF_MUSIC` em `minigolf/ui/app.ts` apontar para um arquivo.

## Persistência
- Sinuca: preferências e estatísticas em `localStorage` (formato da versão anterior, preservado).
- Minigolfe: `createStore('jogaco.minigolf', versão 1, padrão, validação)` — dados inválidos voltam ao padrão.
- `RemoteSync<T>` define `pull/push` para uma sincronização futura. Nada é enviado para fora do aparelho.
- 2P local não alimenta recordes competitivos.

## Para adicionar um jogo
1. Criar `src/games/<id>/index.ts` exportando um `GameModule`.
2. Registrar em `registry.ts` com `status: 'available'` e `load: () => import('./<id>')`.
3. Física/regras em TS puro com testes em `tests/<id>/`.
