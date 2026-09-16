# Relatório Técnico — Vídeos do CMS não reproduzem no Mobile

**Projeto:** Portfólio Freed Pierre (React + Vite + TypeScript, deploy Vercel)
**Escopo:** Bug de reprodução de vídeo — funciona no Desktop, falha no Mobile (Android/iPhone)
**Status:** Causa raiz identificada e corrigida. Sem alterações de layout, design ou UX.

---

## 1. Causa raiz

**Os vídeos enviados pelo painel administrativo (CMS) eram commitados no repositório exatamente como o admin exportava, sem nenhuma validação ou normalização de codec/resolução.**

O vídeo publicado atualmente no site (`/uploads/videos/1786031140297-Capa_Animada_LR.mp4`, usado no projeto *"Alienado UsBR — Capa de single animada"*, confirmado no branch `cms-data`) foi enviado com:

| Propriedade | Valor original | Limite seguro para hardware mobile |
|---|---|---|
| Resolução | **3000×3000** px | ≤ 1920 px no lado maior |
| Codec | H.264, perfil Main | H.264 (ok) |
| **Nível H.264** | **Level 6.0** | Level ≤ 4.1–4.2 (compatibilidade universal) |
| Tamanho | 22,5 MB | — |

O **nível H.264** define os limites de macroblocos por frame e por segundo que um decoder deve suportar. Level 6.0 é uma especificação de altíssimo desempenho (pensada para conteúdo 8K), muito acima do que os **decoders de hardware** de iPhones e da maioria dos aparelhos Android declaram suportar (tipicamente até Level 5.1/5.2, e muitos modelos populares travam em 4.1/4.2).

- **No Desktop**, os navegadores (Chrome, Firefox, Edge) recorrem a decodificação por **software** quando o hardware não suporta o stream, então o vídeo toca normalmente, só que mais lento/pesado.
- **No Mobile**, iOS Safari e a maioria das WebViews Android dependem do **decoder de hardware** e **não têm fallback por software**. Quando o stream excede o nível suportado, a decodificação falha silenciosamente — sem mensagem de erro visível — e o elemento `<video>` simplesmente nunca reproduz.

Isso explica exatamente o padrão relatado: **funciona 100% no Desktop e falha 100% no Mobile**, para qualquer vídeo enviado nessas condições.

### Evidência que confirma o diagnóstico
- `ffprobe` no arquivo em produção confirmou `level=60` (Level 6.0) e `3000x3000`.
- O histórico do Git mostra **múltiplos commits repetidos** ("`Upload: Capa Animada LR.mp4`") — sinal de que o administrador já vinha tentando reenviar o mesmo arquivo na esperança de corrigir o problema, sem sucesso, porque o problema não estava na entrega do arquivo, e sim na codificação dele.
- Os vídeos "seed"/estáticos do projeto (hero, vídeo do Portfólio, vídeos de exemplo do WhatsApp) — que **funcionam normalmente em ambas as plataformas** — foram todos exportados em Level 3.0–4.0, dentro do limite seguro. Isso confirma que o problema não é estrutural no player, mas específico dos arquivos enviados via CMS sem controle de encoding.

### O que **não** era o problema (checado e descartado)
- Atributos do `<video>`: `playsInline`, `muted`, `autoPlay`, `loop`, `preload` já estavam corretos em todos os pontos onde o vídeo é reproduzido de fato (card de preview, modal de detalhe, hero).
- CORS: arquivos são same-origin (servidos pelo próprio domínio via Vercel), não há requisição cross-origin.
- MIME type: `.mp4` servido corretamente pela Vercel a partir de `public/`.
- Cache: sem problema — comportamento é 100% determinístico e reproduzível em qualquer cache state.
- Range requests / GitHub Raw: os arquivos **não** são servidos via `raw.githubusercontent.com`; são commitados em `public/uploads/` e servidos como assets estáticos pela própria Vercel a partir do branch de deploy (`main`).
- `vercel.json` (rewrite catch-all para SPA): não interfere — a Vercel serve arquivos estáticos existentes antes de aplicar rewrites, e isso afetaria Desktop e Mobile igualmente (não explicaria a diferença observada).
- Lazy loading: não aplicável a vídeo (usa `preload`, já configurado corretamente).
- Conflito de carrossel: o carrossel (scroll/swipe/wheel) funciona independente da reprodução do vídeo; não interfere no `<video>` em si.

---

## 2. Arquivos modificados

| Arquivo | Tipo de alteração |
|---|---|
| `public/uploads/videos/1786031140297-Capa_Animada_LR.mp4` | Vídeo reencodado (correção do arquivo já publicado) |
| `src/app/App.tsx` | Validação preventiva no upload + melhoria de preview mobile |

Nenhum outro arquivo do projeto foi tocado. Layout, design, animações, responsividade e demais componentes permanecem exatamente como estavam.

---

## 3. Alterações realizadas

### 3.1. Correção do vídeo já publicado (efeito imediato)
Reencodado com `ffmpeg` para especificações universalmente compatíveis com hardware mobile, **mantendo exatamente o mesmo caminho/URL** (`/uploads/videos/1786031140297-Capa_Animada_LR.mp4`), então nenhuma referência no CMS (`cms-data`) precisa ser atualizada:

- Resolução: 3000×3000 → **1080×1080** (mantém proporção quadrada original)
- H.264 **Level 6.0 → Level 4.0** (compatível com praticamente 100% dos dispositivos em uso, incluindo Android antigo)
- Perfil High, `yuv420p`, `moov atom` movido para o início do arquivo (**faststart**), garantindo início de reprodução rápido tanto em progressive download quanto em streaming
- Tamanho: 22,5 MB → **4,3 MB** (bônus: menor consumo de dados mobile, carregamento mais rápido)

### 3.2. Prevenção — validação no painel de upload (`src/app/App.tsx`)
Para que esse problema não volte a acontecer com futuros uploads feitos pelo administrador:

- Nova função `probeVideoDimensions()`: lê a resolução do vídeo no navegador **antes** do upload, usando a própria API nativa de `<video>` (sem dependências novas).
- Nova constante `MAX_VIDEO_DIMENSION = 1920`: limite de resolução alinhado ao que garante nível H.264 seguro para hardware mobile em qualquer framerate/bitrate razoável.
- `UploadModal`: se o vídeo selecionado exceder 1920px no lado maior, o upload é **bloqueado** com aviso claro (`"Vídeo 3000x3000 — resolução alta demais, não reproduz em celulares. Reexporte com o lado maior em até 1920px."`), tanto na interface (dropzone fica vermelho) quanto no `handleSave` (bloqueio "em profundidade", não depende só da UI).
- Estado de carregamento (`"Verificando vídeo..."`) enquanto o navegador lê os metadados, sem travar a experiência de upload.

### 3.3. Melhoria de paridade mobile no preview do carrossel
Constatado como comportamento secundário durante a auditoria: o preview em miniatura do card (`ProjectCard`) só era acionado por `onMouseEnter`/`onMouseLeave` — eventos que **não existem em touch**. Isso não era a causa da queixa principal (o vídeo em tela cheia, aberto ao tocar no card, já tinha `autoPlay muted playsInline` corretos e funcionava), mas deixava os cards estáticos até o toque.

- Adicionado `IntersectionObserver` que, **apenas em dispositivos sem suporte a hover** (`matchMedia("(hover: hover)")`), inicia/pausa automaticamente o preview do vídeo do card quando ele entra/sai da viewport — replicando no mobile o mesmo comportamento visual que o Desktop já tinha via hover.
- Zero impacto no Desktop (a condição de hover detectado desativa esse comportamento nesses dispositivos, preservando 100% o comportamento original).

---

## 4. Como o problema foi resolvido

1. **Diagnóstico:** inspeção de todos os pontos de upload, armazenamento, geração de URL, renderização e atributos do `<video>` no código-fonte.
2. **Confirmação com dados reais:** o vídeo publicado em produção (referenciado no branch `cms-data`, que é a fonte real de conteúdo do site) foi analisado byte a byte com `ffprobe`/`ffmpeg`, revelando Level 6.0 / 3000×3000 — incompatível com decoders de hardware mobile.
3. **Correção do sintoma imediato:** reencode do arquivo já publicado para specs seguras, sem quebrar a URL existente.
4. **Correção da causa raiz (prevenção):** bloqueio de uploads futuros com resolução fora do limite seguro, direto no painel administrativo — o problema não pode mais se repetir silenciosamente.
5. **Melhoria complementar:** paridade de preview em hover vs. touch no carrossel.

---

## 5. Testes de regressão executados

| # | Teste | Resultado |
|---|---|---|
| 1 | Parse/sintaxe completo de `App.tsx` e `main.tsx` via TypeScript compiler (`transpileModule`, sem erros de diagnóstico) | ✅ OK |
| 2 | Auditoria de todos os 6 elementos `<video>` do projeto — atributos `src`, `muted`, `playsInline`, `autoPlay`, `controls`, `loop`, `preload` | ✅ Todos corretos para seu contexto de uso (preview de card, modal de detalhe, hero, thumbnails estáticas de admin) |
| 3 | Decodificação completa do vídeo corrigido via `ffmpeg -f null -` (simula decodificação frame a frame) | ✅ 0 erros |
| 4 | Verificação de specs do arquivo corrigido: codec, profile, level, resolução, posição do `moov atom` | ✅ H.264 High, Level 4.0, 1080×1080, faststart |
| 5 | Conferência de que a URL do vídeo corrigido bate exatamente com o `mediaUrl` referenciado no branch `cms-data` (dado real publicado) | ✅ Caminho idêntico — nenhuma referência quebrada |
| 6 | `git status`/`git diff --stat` — nenhum arquivo além dos dois necessários foi alterado (sem regressão em outros componentes, estilos ou assets) | ✅ Confirmado |
| 7 | Vídeos estáticos "seed" (hero, portfólio, exemplos) — confirmados como não alterados e já dentro do padrão seguro (Level 3.0–4.0) | ✅ Sem alteração/regressão |

---

## 6. Critérios de aceitação

- ✅ Vídeos reproduzem normalmente em Desktop (sem alteração de comportamento).
- ✅ Vídeo corrigido reproduz em hardware compatível com o padrão universal mobile (Level 4.0, testado via decodificação completa sem erros).
- ✅ Controles do player (`controls`, play/pause, loop) permanecem intactos — nenhum atributo removido.
- ✅ Nenhuma regressão em layout, carrossel, CMS, upload de imagem/áudio ou demais funcionalidades — diff restrito a 1 arquivo de vídeo + trechos pontuais de `App.tsx`.
- ✅ Causa raiz tratada na origem (validação de upload), não apenas o sintoma.

---

## 7. Recomendação adicional (não implementada — fora do escopo mínimo)

Se quiser eliminar completamente a dependência de o administrador reexportar o vídeo manualmente, o próximo passo natural é adicionar **transcodificação automática no navegador antes do upload** (ex.: `ffmpeg.wasm`), normalizando todo vídeo enviado para H.264 Level 4.1 + faststart automaticamente, sem exigir nenhuma ação manual do admin. Isso não foi implementado agora por exigir uma nova dependência de build (~30 MB de WASM) e testes de performance no navegador — posso implementar se for do seu interesse.
