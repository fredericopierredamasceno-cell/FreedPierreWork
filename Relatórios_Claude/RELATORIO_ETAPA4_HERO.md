# Relatório Técnico — ETAPA 4: Correção do Hero

**Projeto:** Portfólio Freed Pierre (React + Vite + TypeScript, deploy Vercel)
**Escopo:** Somente o Hero (`src/app/App.tsx`, seção `<section id="hero">`). Serviços, Admin, Header e CMS não foram tocados.

---

## 1. Análise realizada antes de qualquer alteração

Auditados, sem alterar nada até a causa raiz ser confirmada:

- **Componente real do Hero**: confirmado que o app servido é `src/app/App.tsx` (importado por `src/main.tsx`); o `App.tsx` da raiz do projeto é um arquivo órfão, não usado no build, e **não foi tocado**.
- **Vídeo do Hero** (`src/imports/Portf_lio_Video_Final_Ver.mp4`), verificado com `ffprobe`/análise binária: H.264, profile Main, **Level 4.0**, 1430×1080, `moov atom` antes do `mdat` (**faststart** já correto). Ou seja, dentro do limite seguro para decoders de hardware mobile (o mesmo tipo de problema já havia sido corrigido em outro vídeo do CMS na etapa anterior — aqui já estava certo, confirmado por medição, não por suposição).
- **Lógica de autoplay mobile existente**: NÃO foi removida. Foi lida por completo — ela já implementa corretamente: `muted` forçado via propriedade JS antes do `play()`, tentativas em `loadedmetadata/loadeddata/canplay/canplaythrough`, retentativas por tempo, retomada em `visibilitychange`/`pageshow`, e fallback de gesto do usuário (`touchstart/click/scroll`). Os handlers inline (`onLoadedMetadata`/`onCanPlay`) duplicam parte desse trabalho, mas de forma **inofensiva** (mesma chamada `.play().catch(()=>{})`, idempotente) — não há conflito real entre as duas camadas, então nada foi removido ou reescrito aqui.
- **CSS, animações, z-index, overflow**: mapeado o empilhamento de camadas do Hero (vídeo → overlay → gradiente → textura de ruído → conteúdo `z-10`) e confirmado que não há conflito de `z-index` nem overflow horizontal indevido (`overflow-hidden` na seção + `overflow-x-hidden` na raiz).
- **CSS global** (`theme.css`, `tailwind.css`): confirmado que não há nenhuma regra global de reset (`img,video{max-width...}` etc.) conflitando com o `<video>` do Hero.

---

## 2. Problemas encontrados

### Bug 1 — Indicador de "scroll" (seta) mal posicionado, sobrepondo a barra de serviços
**Onde:** botão do `<ChevronDown>` no fim do Hero.

**Causa:** a seção `<section id="hero">` usa `min-h-screen` (altura **mínima**), mas o conteúdo real (título + subtítulo + botões + a barra "Design Gráfico / Motion Design / Vídeos / Produção Fonográfica") é, na prática, mais alto que uma tela em notebooks, tablets e na maioria dos celulares — a seção cresce para acomodar tudo. O botão da seta era `position: absolute; bottom: 4`, ou seja, ancorado ao fim de **toda a seção** (que agora é mais alta que 100vh), e não ao fim da primeira tela. Resultado: em qualquer viewport onde o conteúdo ultrapassa 100vh, a seta parava perto (ou sobreposta) da barra de serviços, em vez de funcionar como dica de "role para baixo" na primeira dobra — que é sua função.

**Solução:** criei uma âncora não-visual (`.hero-scroll-cue-anchor`), com exatamente a altura de uma tela (`100dvh`, com fallback `100vh`), posicionada `absolute top-0` dentro da seção e `pointer-events-none` (não participa do fluxo, não afeta a centralização nem o layout de nenhum outro elemento do Hero). O botão da seta foi movido para dentro dela, mantendo o mesmo `bottom-4`, mesmo estilo e mesmo `onClick` — agora ancorado ao fim real da primeira tela, não ao fim do bloco inteiro.

### Bug 2 — Altura do Hero incorreta em navegadores mobile com barra de endereço dinâmica
**Onde:** `<section id="hero" className="... min-h-screen ...">`.

**Causa:** `min-h-screen` do Tailwind equivale a `min-height: 100vh`. Em Safari iOS e na maioria dos navegadores Android, `100vh` é medido incluindo a área que fica atrás da barra de endereço/navegação — maior do que a tela realmente visível no primeiro carregamento. Isso é uma causa raiz clássica e verificável de: (a) o Hero nascer mais alto que a área visível, exigindo um scroll mínimo para ver o fim do primeiro bloco; (b) o layout "pular"/redimensionar quando a barra recolhe durante o scroll. É exatamente o tipo de inconsistência pedida para verificar em "viewport" e Safari/iPhone/Android.

**Solução:** adicionada uma regra `#hero { min-height: 100vh; min-height: 100dvh; }` dentro do `<style>` já existente no próprio Hero. Por causa das *CSS Cascade Layers* do Tailwind v4 (utilitários ficam em `@layer utilities`, e essa regra não está em nenhuma layer), ela sobrepõe corretamente a classe `min-h-screen` sem precisar remover a classe do Tailwind, sem tocar em nenhum outro componente e sem efeito nenhum em navegadores desktop (onde `dvh` ≈ `vh`). Em navegadores sem suporte a `dvh`, a declaração é ignorada e `100vh` permanece como estava — sem regressão.

### Verificado e descartado (não eram bugs)
- Vídeo (codec/level/faststart): já correto, confirmado por `ffprobe`.
- Lógica de autoplay mobile: correta, sem conflito real entre a camada de `useEffect` e os handlers inline.
- `z-index`/empilhamento de camadas do Hero: correto.
- Overflow horizontal: coberto por `overflow-hidden`/`overflow-x-hidden` já existentes.
- CSS global conflitando com o `<video>`: não encontrado.
- IDs/classes duplicados (`#hero-video`, `#hero-overlay`, `.hero-title-line`): únicos no projeto, sem colisão.

---

## 3. Arquivos modificados

| Arquivo | Alteração |
|---|---|
| `src/app/App.tsx` | Duas correções pontuais, só dentro de `<section id="hero">`: (1) `<style>` do Hero ganhou `#hero { min-height: 100vh; min-height:100dvh; }` e `.hero-scroll-cue-anchor { height:100vh; height:100dvh; }`; (2) o botão da seta de scroll foi movido para dentro do novo wrapper `.hero-scroll-cue-anchor` (mesmas classes visuais, mesmo `onClick`). |

Nenhum outro arquivo foi alterado. Header, Serviços, Admin e CMS permanecem exatamente como estavam.

---

## 4. Resultado do build

Não foi possível executar `npm run build` até o fim **neste ambiente de análise**: o sandbox não tem acesso à internet (`npm install` falha com `403 Forbidden` ao tentar baixar dependências do registry — nenhum `node_modules` estava incluído no `.zip` enviado), então `vite` não está disponível localmente para rodar o build real.

Como verificação alternativa disponível neste ambiente:
- **Checagem de sintaxe/transpile** do `src/app/App.tsx` inteiro via TypeScript (`ts.transpileModule`) após a edição: **0 diagnósticos** — nenhum erro de sintaxe introduzido.
- **Balanceamento de tags**: contagem de `<section>`/`</section>` no arquivo inteiro (6/6) e revisão visual completa do bloco do Hero após a edição — JSX íntegro.

**Recomendação:** rode `npm install && npm run build` localmente (ou no ambiente de deploy) para a validação final de build completa — o diff é pequeno e isolado ao Hero, então o risco é baixo, mas a confirmação do build real deve ser feita onde há acesso ao registry do npm.
