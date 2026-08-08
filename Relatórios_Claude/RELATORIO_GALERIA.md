# Relatório — Refatoração do módulo de Projetos (galeria de imagens)

## 1. Causa raiz do bug reportado

> "não mostra upload das demais imagens sendo feito e quando publica, só a principal é postada"

Duas causas no código anterior (`UploadModal.tsx`):

1. As imagens extras eram enviadas com `uploadFile(file, "image", () => {})` — callback de
   progresso vazio. Nada na tela indicava que o envio estava em andamento.
2. Se qualquer upload extra falhasse (rate-limit da API do GitHub ao mandar várias imagens em
   sequência rápida, instabilidade de rede etc.), o código descartava aquela imagem
   silenciosamente e seguia em frente. `images` só era salvo se `length > 1` sobrasse depois dos
   descartes — em uma falha generalizada, sobrava só a principal, sem qualquer aviso.

A opção "Projeto em Carrossel" (checkbox) também era um passo fácil de esquecer: sem marcá-la,
as imagens extras nem apareciam na interface para serem selecionadas.

## 2. Arquitetura adotada

Единica estrutura de galeria para **todo** projeto de imagem, mesmo com 1 foto só — como pedido:

```
CMSProject
├── id, title, description, category, subcategory
├── mediaType: "image" | "video" | "embed"
├── mediaUrl        // legado — sempre = à imagem marcada isMain (compatibilidade)
├── thumbUrl?
├── images: GalleryImage[]   // SEMPRE presente para mediaType "image"
│     ├── id
│     ├── url
│     ├── order
│     ├── caption?      // pronto para uso futuro
│     ├── alt?          // pronto para uso futuro
│     ├── isMain: boolean
│     └── uploadedAt
├── isFixed?, hidden?, createdAt
```

`isCarousel` foi descontinuado como campo gravado (mantido só como leitura de dados antigos,
marcado `@deprecated`). Carrossel = `images.length > 1`, decidido automaticamente pela
quantidade de fotos, sem precisar de nenhum toggle.

### Arquivos-chave

- **`src/app/lib/types.ts`** — novo tipo `GalleryImage`; `CMSProject.images` passa a ser
  `GalleryImage[]`.
- **`src/app/lib/gallery.ts`** (novo) — toda a lógica de domínio da galeria:
  - `normalizeProjectImages` / `normalizeProjects` — conversão automática de qualquer formato
    antigo para o novo, em memória, sem migração manual.
  - `reorderImages`, `setMainImage`, `removeImageFromGallery` — operações puras sobre o array.
  - `uploadGalleryItems` — orquestra o envio sequencial com progresso e status por imagem
    (detalhado na seção 4).
- **`src/app/components/GalleryManager.tsx`** (novo) — componente de UI único, usado tanto na
  criação (`UploadModal`) quanto na edição (`EditProjectModal`): miniaturas, status por imagem,
  reordenar por drag-and-drop, marcar capa, substituir, remover, adicionar mais.
- **`src/app/components/ImageCarousel.tsx`** — carrossel público: arraste ao vivo (mouse e
  toque), navegação por teclado (← →), setas (desktop), indicadores de página, zoom opcional,
  lazy loading, animação suave.

## 3. Fluxo de upload

1. Admin seleciona 1 a N imagens no `GalleryManager` (não há mais limite artificial de "com
   carrossel" vs "sem carrossel" — é só uma galeria).
2. Cada imagem entra como item `pending` com miniatura local (`URL.createObjectURL`).
3. Ao publicar, `uploadGalleryItems` percorre a lista **sequencialmente**:
   - marca o item como `uploading` e atualiza a % em tempo real via o callback de progresso
     (agora conectado de verdade, não mais um no-op);
   - em caso de sucesso, marca `done` e guarda a URL final;
   - em caso de falha, marca `error` com a mensagem e **não descarta** o item — ele fica visível
     com um botão "tentar novamente";
   - aguarda ~350ms entre uploads, para reduzir o risco de rate-limit secundário da API do
     GitHub em galerias grandes (10, 20 imagens).
4. Se restar algum item `error`, a publicação é bloqueada com uma mensagem clara — nunca mais
   publica "só a principal" por engano.

## 4. Fluxo de publicação

- `images` (já com `order` e `isMain` definidos pelo admin) é gravado no projeto.
- `mediaUrl` é sincronizado com a URL da imagem `isMain`, mantendo compatibilidade com qualquer
  trecho do app que ainda leia `mediaUrl` diretamente (ex.: thumbnail de fallback).
- O commit para o GitHub grava o `CMSData` inteiro (`useCMS.publish`), então todas as imagens da
  galeria — não só a primeira — são persistidas e recuperadas normalmente no próximo carregamento
  do site.

## 5. Compatibilidade

`normalizeProjectImages` roda em `makeCMSData` (chamado sempre que os dados são carregados do
GitHub, tanto no admin quanto no site público) e cobre 3 casos:

| Formato salvo | Resultado após normalização |
|---|---|
| Só `mediaUrl` (projetos bem antigos) | Galeria de 1 imagem, `isMain: true` |
| `images: string[]` (versão intermediária do carrossel) | Convertido para `GalleryImage[]`, 1ª como capa |
| `images: GalleryImage[]` (formato novo) | Mantido, com `order`/`isMain` validados |

Nenhuma migração manual do JSON no GitHub é necessária — a conversão acontece em memória a cada
carregamento, e a próxima publicação já grava no formato novo.

## 6. Arquivos modificados

- `src/app/lib/types.ts` — tipo `GalleryImage`, `CMSProject.images`.
- `src/app/lib/gallery.ts` — **novo**.
- `src/app/lib/defaults.tsx` — normalização plugada em `makeCMSData`.
- `src/app/components/GalleryManager.tsx` — **novo**.
- `src/app/components/UploadModal.tsx` — aba de imagem reescrita para usar a galeria unificada.
- `src/app/components/EditProjectModal.tsx` — edição de galeria unificada (mesma UI de criação).
- `src/app/components/ImageCarousel.tsx` — arraste ao vivo, teclado, setas desktop, zoom, lazy
  loading.
- `src/app/components/ProjectCard.tsx` / `GalleryModal.tsx` — sem mudança de lógica (já
  trabalhavam com `images` como array e `.length`); apenas passam a receber `GalleryImage[]`.
- `src/app/components/MediaLibraryTab.tsx`, `src/app/components/AdminPanel.tsx`,
  `src/app/App.tsx` — 4 pontos que ainda tratavam `images` como `string[]` (thumbnail da lista de
  mídia e a limpeza de arquivos ao excluir um projeto) corrigidos para `images[i].url`.

## 7. Testes realizados

Ambiente sandbox sem acesso à rede/GitHub real e sem `node_modules` instalado, então não foi
possível rodar `npm run build` nem testar upload real end-to-end. O que foi validado:

- Checagem de sintaxe/tipos (`tsc --noEmit`) de todos os arquivos novos e modificados —
  sem erros reais (o único ruído restante são falsos positivos do TypeScript ao checar arquivos
  isolados sem os `node_modules`/`@types/react` instalados, como o prop `key` do React, e
  aparecem igualmente em código pré-existente não tocado por esta mudança).
- Revisão manual do fluxo de dados ponta a ponta: seleção → upload sequencial com progresso →
  `images[]` salvo → `normalizeProjectImages` na leitura → `ProjectCard`/`GalleryModal` renderizando.
- Revisão dos 4 pontos que consumiam `images` como array de strings, agora corrigidos para o novo
  formato de objeto.

### Pendente de validação no ambiente real (recomendado antes de ir para produção)

- `npm install && npm run build` completo.
- Criar projetos com 1, 3, 10 e 20 imagens com GitHub configurado de verdade, observando:
  upload, status de erro/retry, reordenação por drag-and-drop, definição de capa, publicação,
  edição posterior, exclusão (checar se todas as imagens são removidas do repo).
- Testar em Desktop, tablet, Android e iPhone: setas só devem aparecer no desktop; swipe/arraste
  deve funcionar em touch; teclado (← →) no fullscreen do desktop.

## 8. Melhorias futuras já preparadas pela arquitetura

- `caption` e `alt` por imagem já existem no tipo `GalleryImage` — falta só expor os campos na UI
  do `GalleryManager` e exibi-los no `ImageCarousel`.
- Vídeos/GIFs dentro do carrossel: bastaria adicionar um campo `kind: "image" | "video" | "gif"`
  em `GalleryImage` e um branch de renderização no `ImageCarousel` — a estrutura de array já
  suporta itens heterogêneos.
- Comparação antes/depois: pode ser modelada como um `GalleryImage` com metadado extra
  (`compareWith?: string`), sem alterar o restante da arquitetura.
