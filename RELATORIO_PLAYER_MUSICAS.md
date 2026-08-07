# Relatório Técnico — Upgrade do Player de Músicas (comportamento, sem mudança visual)

**Projeto:** Portfólio Freed Pierre (React + Vite + TypeScript, deploy Vercel)
**Escopo:** Reprodução sequencial, playlist, navegação, seek interativo e correção de arquitetura para impedir duas faixas tocando ao mesmo tempo.
**Status:** Implementado. Sem alterações de layout, identidade visual, CMS ou estrutura da página — apenas comportamento do player.

---

## 1. Diagnóstico inicial

O player de áudio (`useAudioPlayer`) era um **hook local**, instanciado de forma independente em dois lugares:

- `AudioCarousel` (seção "Diferenciais", sempre montada na página)
- `AudioGalleryView` (dentro do `GalleryModal`, que abre por cima da página **sem desmontar** o conteúdo de trás)

Cada instância criava seu próprio `<audio>` e seu próprio estado. Isso significava que, se o usuário tocasse uma faixa no carrossel e depois abrisse a galeria e tocasse outra, **as duas tocariam ao mesmo tempo** — violando diretamente o requisito #3. Também não havia reprodução sequencial, botões de próxima/anterior, nem seek por arraste.

## 2. Solução

Centralizei todo o estado de reprodução em um **Context React único** (`AudioPlayerProvider`), montado uma vez no topo do app, com **um único elemento `<audio>`** compartilhado por toda a árvore de componentes. Trocar de faixa sempre reaproveita essa mesma tag de mídia — então tocar uma música nova **estruturalmente** já para a anterior, não depende de nenhuma lógica extra de "parar o anterior".

O Context foi dividido em dois:
- `AudioPlayerStateContext` — faixa ativa, play/pause, loading, próxima/anterior, mute (muda pouco).
- `AudioPlayerProgressContext` — `currentTime`/`duration` (muda várias vezes por segundo).

Isso evita que os cards da grade/carrossel sejam re-renderizados a cada tick da barra de progresso — só o `MiniPlayer` assina o progresso.

## 3. Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/app/contexts/AudioPlayerContext.tsx` | **Novo.** Provider + hooks (`useAudioPlayerState`, `useAudioPlayerProgress`, `useSyncPlaylist`). Toda a lógica de playlist, sequência, seek e ciclo de vida do `<audio>`. |
| `src/app/hooks/useAudioPlayer.tsx` | **Removido.** Substituído pelo Context acima (era a causa raiz de duas faixas simultâneas). |
| `src/app/components/MiniPlayer.tsx` | Passa a consumir o Context (sem prop `player`). Adicionados botões de próxima/anterior faixa. Barra de progresso reescrita com Pointer Events (clique **e** arraste, funciona em mouse e touch). |
| `src/app/components/AudioCarousel.tsx` | Usa `useAudioPlayerState` + `useSyncPlaylist`; removida a renderização local do `<audio>`. |
| `src/app/components/AudioGalleryView.tsx` | Idem. |
| `src/app/lib/format.ts` | `fmtTime` agora sempre retorna `MM:SS` com dois dígitos (ex.: `00:35`), como pedido. |
| `src/app/App.tsx` | Adiciona `<AudioPlayerProvider>` envolvendo `<PortfolioApp />`. |
| `src/app/components/AudioCard.tsx` | **Sem alterações** — a API pública (`onToggle(id)`) não mudou. |

Nenhum arquivo de layout, tema, CMS (`useCMS`, `cms-data.json`, `cms-config.json`) ou estrutura de página foi tocado.

## 4. Funcionalidades implementadas

1. **Reprodução sequencial** — ao terminar (`onEnded`), avança automaticamente para a próxima faixa da playlist; na última, para sem repetir.
2. **Playlist inteligente** — a ordem da playlist é sempre a ordem do array `audios` vindo do CMS (mesma ordem exibida no carrossel/galeria).
3. **Apenas uma música tocando** — garantido pela arquitetura (um único `<audio>` compartilhado); trocar de faixa sempre substitui a fonte da mesma tag.
4. **Botões de navegação** — "próxima" e "anterior" no `MiniPlayer`, desabilitados nas bordas da playlist.
5. **Barra de progresso interativa** — clique em qualquer ponto ou arraste (Pointer Events, funciona com mouse e touch) para fazer seek; atualiza continuamente durante a reprodução.
6. **Controle de tempo** — exibido como `00:35 / 03:47`, atualizado em tempo real via `timeupdate`.
7. **Continuidade** — ao trocar de faixa: `el.load()` força o carregamento correto da nova fonte (importante para Safari/iOS), autoplay tenta iniciar assim que pronta, título/capa/duração vêm automaticamente do novo `activeAudio`.
8. **Compatibilidade** — Pointer Events cobrem Desktop, Android e iPhone com o mesmo código; `el.load()` evita o problema comum de iOS não recarregar a fonte só por mudança do atributo `src`.
9. **CMS** — a playlist é sincronizada via `useSyncPlaylist(audios)`, que roda a cada renderização com o array vindo do CMS; qualquer música nova adicionada já entra na playlist sem nenhuma configuração manual.
10. **Código** — estado único (sem duplicação entre carrossel/galeria), Context dividido para evitar renders desnecessários, `useCallback`/`useMemo` nos pontos certos, listener de `canplay` sempre limpo no `return` do `useEffect` (sem vazamento de memória).

## 5. Testes realizados (revisão de código/lógica)

> **Observação de transparência:** o ambiente de execução usado para este trabalho está sem acesso à internet, então não foi possível rodar `npm install` / `npm run build` / testar no navegador real. Os testes abaixo foram feitos por **inspeção detalhada do código e simulação manual do fluxo de estados**, verificando cada handler, dependência de hook e efeito colateral. Recomendo rodar `npm run dev` localmente e conferir a lista abaixo na prática antes de publicar.

| Teste | Resultado esperado | Verificação |
|---|---|---|
| Uma música | Toca ao clicar, pausa/retoma no botão do `MiniPlayer` | `toggle(id)` sem `list` só alterna play/pause do `<audio>` ativo |
| Duas músicas | Tocar a 2ª para a 1ª imediatamente | Mesmo `<audio>`; `playId` troca `activeId` → `src` muda → `el.load()` |
| Várias músicas | Ordem da playlist = ordem do CMS | `useSyncPlaylist` registra `audios` na ordem recebida |
| Próxima | Avança para o índice seguinte; desabilitado na última | `playNext` usa `hasNext` para habilitar o botão |
| Anterior | Volta para o índice anterior; desabilitado na primeira | `playPrev` usa `hasPrev` |
| Seek (clique) | Pula para o ponto clicado | `onPointerDown` calcula ratio pela posição X e chama `seekToRatio` |
| Seek (arraste) | Acompanha o dedo/mouse continuamente | `onPointerMove` com `dragging=true` recalcula a cada movimento; `setPointerCapture` garante que o arraste continue mesmo saindo da barra |
| Troca automática | Ao `ended`, avança sozinho; para sem repetir na última | `handleEnded` replica a lógica de `playNext`, com fallback de parar e zerar em vez de repetir |
| Pausa | `el.pause()` dispara `onPause` → `isPlaying=false` | Handlers nativos do elemento `<audio>` |
| Retomada | `el.play()` dispara `onPlay` → `isPlaying=true` | idem |
| Atualização da barra | Progresso e tempo atualizam continuamente | `onTimeUpdate` → `setCurrentTime`, refletido no `width%` da barra e no `fmtTime` |
| Duas telas ao mesmo tempo (carrossel + galeria aberta) | Nunca duas faixas simultâneas | Ambas consomem o mesmo Context/`<audio>`; tocar em uma para a outra automaticamente |

## 6. Próximo passo sugerido

Rodar localmente (`npm install && npm run dev`) e percorrer a tabela de testes acima manualmente em Desktop, Android e iPhone antes do deploy, já que este ambiente não teve acesso de rede para validar a build.
