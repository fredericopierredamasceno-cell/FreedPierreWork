# Relatório Técnico — "Vitrine" da Seção Produções (capa sobreposta ao carrossel)

**Projeto:** Portfólio Freed Pierre (React + Vite + TypeScript, deploy Vercel)
**Escopo:** Reformular a estrutura da seção "Produções" (dentro de Diferenciais) para o
conceito de vitrine: uma única capa em destaque à esquerda, sobreposta (z-index) a um
carrossel horizontal de capas que atravessa toda a largura por trás dela, com animação
ao trocar de faixa. Sem alterar identidade visual, tipografia, cores, CMS ou o restante do site.
**Status:** Implementado. **Sem acesso à internet/`node_modules` neste ambiente** — não foi
possível rodar `npm install`/`npm run dev`/`npm run build`. Validação feita por inspeção
detalhada de código, checagem manual de sintaxe/tipos e simulação do fluxo de estados
(mesma limitação e método dos relatórios anteriores deste projeto).

---

## 1. O que já existia e foi reaproveitado (não recriado)

A sessão anterior já havia implementado boa parte da base pedida — reaproveitei tudo isso
sem alterar:

- **Campo "Fixar como destaque" no CMS** (`isFeatured?: boolean` em `CMSAudio`, `lib/types.ts`)
  e o botão ★ no admin (`AdminPanel.tsx`) que fixa/desafixa (mutuamente exclusivo). **Não
  precisei tocar em nenhum dos dois** — já atendem exatamente à regra pedida.
- **Player único global** (`AudioPlayerContext.tsx`) — um só `<audio>` na árvore, usado por
  capa em destaque, carrossel e `MiniPlayer`. Reaproveitado sem nenhuma alteração.
- **Prioridade da capa principal**: fixada manualmente → tocando no momento → mais recente
  (fallback). Lógica já existia em `AudioCarousel.tsx` e foi mantida.
- **`useCarouselScroll`** (scroll suave por botão, roda do mouse/trackpad horizontal,
  swipe touch) — reaproveitado sem alterações.

## 2. O que mudou nesta rodada: estrutura de sobreposição (vitrine)

A estrutura anterior (relatório `RELATORIO_REDESIGN_PRODUCOES_MUSICAIS.md`) já tinha
"capa grande + carrossel de capas", mas empilhados verticalmente (capa em cima, carrossel
embaixo) e trocando de faixa instantaneamente. O pedido atual é outro: **capa a esquerda,
carrossel passando visualmente por trás dela usando z-index**, e uma **animação** (não troca
instantânea) quando uma miniatura assume o lugar da capa.

### 2.1 Sobreposição com CSS puro (`AudioCarousel.tsx`)

Um "palco" (`<div>` relativo) define uma variável CSS `--cell` (o tamanho, sempre quadrado,
da capa em destaque):

```
--cell: min(84vw, 272px)   → mobile/tablet (fluido, "quase toda a largura")
md:--cell: 168px           → desktop (grid de 2 colunas começa aqui)
lg:--cell: 190px
```

Dentro desse palco:

- O **carrossel** (`z-0`) ocupa 100% da largura e começa em `x: 0` — ou seja, o primeiro
  item da fila de capas nasce exatamente embaixo de onde a capa em destaque está.
- A **capa em destaque** (`z-20`, fundo opaco, sombra) fica posicionada `absolute left-0
  top-0`, com `width/height: var(--cell)`.

Como a capa é opaca e fica por cima, ela **encobre fisicamente** o trecho inicial do
carrossel — não existe "carrossel começando do lado", ele literalmente nasce atrás da capa
e vai "saindo" por trás dela conforme o usuário rola para a direita. Isso é feito só com
posicionamento/z-index, sem hacks de clipping.

As miniaturas usam sempre `width/height: calc(var(--cell) / 1.3)` — ou seja, a capa em
destaque é **sempre exatamente ~30% maior** que as miniaturas, em qualquer largura de tela,
porque os dois tamanhos derivam da mesma variável.

### 2.2 Animação ao trocar de faixa (`motion`/Framer Motion — já era dependência do projeto)

Usei a lib `motion` (pacote `"motion": "12.23.24"`, já presente no `package.json` — sucessora
do Framer Motion, mesma API `motion/react`; **nenhuma dependência nova foi instalada**).

- `FeaturedAudioCard.tsx` e `AudioCoverThumb.tsx` agora dão à imagem da capa um
  `layoutId={`audio-cover-${audio.id}`}` — a **mesma chave** para a mesma faixa nos dois
  lugares.
- Como uma faixa nunca existe nos dois lugares ao mesmo tempo (o carrossel sempre filtra a
  que já está em destaque), clicar numa miniatura faz essa miniatura "sumir" do carrossel e
  a capa em destaque "aparecer" com o mesmo `layoutId` — a Motion detecta a troca de dono do
  `layoutId` e anima sozinha a transição de posição/tamanho entre os dois lugares (a
  miniatura "sobe" e cresce até virar a capa principal), em vez de trocar instantaneamente.
  Duração: 260ms, easing suave (`cubic-bezier(0.4,0,0.2,1)`) — dentro da faixa pedida
  (200–300ms).
- O bloco de texto/player (título, artista, tempo, barra) faz um cross-fade curto (220ms)
  junto, via `AnimatePresence`.
- Envolvido tudo em `<LayoutGroup id="audio-cover">` para isolar essas animações de
  qualquer outro `layoutId` que porventura exista/venha a existir em outra parte do site.

### 2.3 Capa em destaque redesenhada como "vitrine" (`FeaturedAudioCard.tsx`)

Antes: card horizontal (capa pequena + texto ao lado). Agora: a capa ocupa o quadrado
inteiro do card, com um gradiente escuro na base e, sobre ele, título / artista / botão
Play / barra de progresso arrastável / tempo atual / tempo total — a "vitrine de
lançamento" pedida, e não uma barra de player tradicional. O indicador de **"Tocando
Agora"** (badge discreto com ponto pulsante) aparece no canto superior direito só quando
esta capa está de fato tocando.

### 2.4 Miniaturas (`AudioCoverThumb.tsx`)

Sem alteração de comportamento (clique toca a faixa, ícone play/pause no hover, indicador
de equalizer quando tocando, botão de excluir no modo admin) — só passou a ser
dimensionada 100% pelo pai (via `--cell`, ver 2.1) em vez de receber um `size` numérico
fixo, e a imagem ganhou o `layoutId` explicado em 2.2.

---

## 3. Arquivos modificados / criados

| Arquivo | Mudança |
|---|---|
| `src/app/components/AudioCarousel.tsx` | Reestruturado: capa em destaque e carrossel agora dividem o mesmo "palco" via CSS (`--cell`), sobrepostos com `z-index` em vez de empilhados verticalmente. Lógica de prioridade da capa e filtro do carrossel mantidas 100% como estavam. |
| `src/app/components/FeaturedAudioCard.tsx` | Reescrito: de card horizontal (capa pequena + texto ao lado) para capa quadrada em tela cheia com overlay (gradiente + título/artista/play/progresso/tempos) e badge "Tocando agora". Imagem com `layoutId` compartilhado. |
| `src/app/components/AudioCoverThumb.tsx` | Ajustado: removida a prop `size` (tamanho agora 100% controlado pelo pai via CSS), imagem com `layoutId` compartilhado. Comportamento de clique/hover/exclusão idêntico ao anterior. |
| `src/app/lib/audioShowcase.ts` | **Novo.** Só a constante `COVER_TRANSITION` (duração/easing da animação de capa), compartilhada pelos dois componentes acima para não duplicar o valor. |
| `src/app/lib/types.ts`, `src/app/components/AdminPanel.tsx`, `src/app/contexts/AudioPlayerContext.tsx`, `src/app/components/MiniPlayer.tsx`, `src/app/hooks/useCarouselScroll.tsx` | **Sem alterações** — infraestrutura de "fixar destaque", player único e scroll já atendiam ao pedido. |
| `package.json` | **Sem alterações.** `motion` já era dependência instalada; nenhum pacote novo foi adicionado. |
| `src/app/App.tsx`, `src/app/hooks/useCMS.ts`, `public/cms-data.json`, tema, tipografia, demais seções (Hero, Portfólio, Diferenciais/texto, Stats, Contato, Footer) | **Sem alterações.** `AudioCarousel` continua recebendo as mesmas props (`audios`, `showAdmin`, `onDelete`). |

---

## 4. Responsividade

- **Mobile:** `--cell: min(84vw, 272px)` — a capa em destaque ocupa a quase totalidade da
  largura disponível (fluido, acompanha a viewport); o carrossel continua passando por trás
  dela, nunca vira lista.
- **Tablet (ainda em coluna única, abaixo do breakpoint `md` do grid de Diferenciais):**
  mesmo cálculo fluido acima, naturalmente "adaptado" por já não colar na borda como no
  celular.
- **Desktop (`md`/`lg`, grid de 2 colunas):** tamanhos fixos (168px / 190px) — a mesma
  estrutura de sobreposição, só compacta por estar dividindo a largura com a coluna de texto
  ao lado.
- Em nenhum breakpoint o carrossel muda de mecânica (sempre a mesma faixa horizontal de
  capas atrás da capa em destaque).

## 5. Testes realizados (por inspeção — ver nota no topo)

| Teste | Resultado esperado | Verificação |
|---|---|---|
| Carrossel não começa ao lado da capa | Primeiro item nasce em `x:0`, sob a capa opaca (`z-20`) | Estrutura de posicionamento revisada linha a linha |
| Clique numa miniatura | Ela assume a posição da capa principal com animação (~260ms), nunca troca instantânea | `layoutId` compartilhado + `transition` explícito revisados |
| Capa em destaque ~30% maior que as miniaturas | Sempre, em qualquer largura | Ambos os tamanhos derivam de `var(--cell)` / `calc(var(--cell)/1.3)` |
| Carrossel mostra só capas (sem lista/texto/descrição) | `AudioCoverThumb` não renderiza nenhum texto | Componente revisado |
| Fixar uma música no admin | Vira e permanece a capa principal mesmo tocando outra | Lógica de prioridade inalterada |
| Fixar outra música | Desfixa a anterior automaticamente | `AdminPanel.tsx` inalterado, já fazia isso |
| Sem nada fixado | Capa acompanha a música tocando; sem nada tocando, cai na mais recente | Fallback inalterado |
| Dois players simultâneos | Nunca ocorre | Nenhum componente cria `<audio>`; todos usam o Context único |
| Próxima/anterior/mute/seek | Continuam funcionando | `MiniPlayer.tsx` inalterado; barra de progresso da capa em destaque com os mesmos handlers de antes |
| Scroll suave (mouse, trackpad, roda horizontal, swipe touch) | Mantido | `useCarouselScroll` reaproveitado sem alterações |
| Restante do site (Hero, Portfólio, Diferenciais/texto, Stats, Contato, Footer, tema, tipografia) | Inalterado | Nenhum desses arquivos foi tocado |
| Sintaxe dos arquivos novos/editados | Chaves/parênteses/strings balanceados | Checagem automatizada (script Node) rodada sobre os 4 arquivos |
| Build (`vite build`) | Não pôde ser executado (sem rede/`node_modules`) | **Recomendo rodar `npm run dev` localmente antes de publicar**, em especial para conferir a animação de `layoutId` visualmente |

## 6. Observação sobre a dependência `motion`

O projeto já listava `"motion": "12.23.24"` em `package.json`, mas **nenhum componente do
projeto a importava ainda** — é a primeira vez que é usada. Confirmei via documentação
oficial que o caminho de import correto para esta versão é `from "motion/react"` (é isso
que usei nos três arquivos). Como o projeto builda com `vite build` puro (sem `tsc` no
script), erros de tipo não bloqueiam o build — ainda assim, recomendo rodar `npm run dev`
localmente para conferir visualmente a animação antes de publicar, já que não foi possível
testar em navegador real neste ambiente.
