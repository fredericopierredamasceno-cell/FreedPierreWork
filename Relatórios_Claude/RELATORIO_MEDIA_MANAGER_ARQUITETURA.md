# Media Manager — Camada de Abstração de Storage

## 1. O que foi feito nesta etapa

Conforme decidido, **nenhum arquivo de mídia foi movido, migrado ou excluído**, e o
GitHub continua sendo o único backend físico de armazenamento (imagens, vídeos e
áudios). O Supabase não foi tocado além do que já estava no projeto — nenhum bucket,
nenhuma Edge Function de mídia foi criada.

A única mudança de arquitetura foi a introdução de uma **camada de abstração de
storage**, exatamente no formato conceitual pedido:

```
Media Manager
      ↓
StorageProvider (interface)
      ↓
GitHubStorageProvider (implementação ativa hoje)
      ↓
GitHub Contents API
```

### Arquivos criados
- `src/app/lib/storage/types.ts` — interface `StorageProvider` (`upload`, `remove`,
  `isConfigured`) e o tipo `MediaKind` (`image | video | audio | document`).
- `src/app/lib/storage/githubStorageProvider.ts` — implementação que **encapsula**
  as funções já existentes (`ghUploadBinary`, `ghDeleteFile` de `github.ts`), sem
  reescrevê-las. Mesmas pastas, mesmo formato de URL, mesmo comportamento de erro.
- `src/app/lib/storage/index.ts` — `getActiveStorageProvider(cfg)`, o único ponto do
  código que decide qual provider está ativo.

### Arquivos modificados
- `src/app/hooks/useCMS.ts` — `uploadFile` e `deleteFile` passaram a chamar
  `getActiveStorageProvider(ghConfig)` em vez de `ghUploadBinary`/`ghDeleteFile`
  diretamente. **Nenhuma outra linha de lógica mudou** — mesmos logs, mesmos toasts,
  mesmo tratamento de erro, mesma assinatura de função (`uploadFile(file, type,
  onProgress)`), então nenhum componente que já usa `uploadFile`/`deleteFile`
  (`UploadModal`, `EditProjectModal`, `EditAudioModal`, `GalleryManager`,
  `MediaReplaceField` etc.) precisou ser alterado.

### Arquivos **não** tocados
`src/app/lib/github.ts` permanece exatamente como estava — é a implementação por
trás do provider, e continua podendo ser usado diretamente pelo resto do CMS para
tudo que não é storage físico de mídia (leitura/escrita do `cms-data`, branch,
config pública etc., que é uma responsabilidade separada e não faz parte deste
contrato). Nenhum componente de UI, nenhum dado salvo, nenhuma URL pública de mídia
existente foi alterado.

### Por que isso importa para o futuro
Se um dia vocês decidirem trocar o backend físico (outro object storage, por
exemplo), o trabalho fica isolado em **um novo arquivo** implementando
`StorageProvider` + uma linha trocada em `getActiveStorageProvider`. Nenhum
componente do CMS, nenhuma tela de admin, nenhuma lógica de galeria precisa mudar,
porque todos dependem apenas da interface, nunca do GitHub diretamente.

---

## 2. Limites atuais de arquivo — documentação (sem implementação de solução)

### Onde o limite existe hoje
| Local | O que faz |
|---|---|
| `src/app/lib/github.ts` → `MAX_FILE_BYTES = 25 * 1024 * 1024` | Constante de 25 MB. |
| `src/app/components/UploadModal.tsx` → `handleFileChange` | Só **verifica** esse limite para arquivos cujo `file.type` começa com `"video"`. Mostra o aviso "Vídeo > 25 MB — use YouTube ou Vimeo." |

### Ponto crítico: áudio não tem checagem de tamanho no cliente
`handleFileChange` só é chamado para o campo de vídeo. O campo de áudio (`audio-inp`
no mesmo arquivo) grava o `File` direto em `setAudioFile(f)`, **sem passar por
nenhuma validação de tamanho**. Isso significa que hoje, ao selecionar um `.wav`
grande, o usuário não recebe nenhum aviso prévio — o upload só falha (ou trava) no
meio do envio, quando a API do GitHub rejeita o arquivo.

### Por que 25 MB é o número usado
Não é um valor arbitrário do projeto — é uma margem de segurança em cima de um
limite real da **GitHub Contents API** (`PUT /repos/{owner}/{repo}/contents/{path}`,
usada em `ghUploadBinary`). Esse endpoint aceita o conteúdo como base64 dentro de um
JSON. Na documentação oficial o teto é ~100 MB, mas na prática a API costuma
recusar (erro `422 — "file is too large to be processed"`) bem antes disso; o
limite confiável fica perto dos 25 MB já usados aqui. Some a isso que base64 infla
o tamanho do payload em ~33%, o que reduz ainda mais a margem real.

### Tipos de arquivo que tendem a esbarrar nesse limite
- **Áudio `.wav` não comprimido** — ~10 MB por minuto (44.1kHz/16-bit estéreo).
  Uma faixa de 3–4 min já passa de 30–40 MB.
- **Vídeo `.mp4`/`.mov`** em resolução alta ou duração maior — já tratado
  parcialmente hoje (bloqueio explícito no upload).
- **Áudio sem compressão em geral** (`.aiff`, `.flac` grande) — mesmo raciocínio do
  WAV.
- Imagens não costumam ser um problema real (mesmo fotos em alta resolução raramente
  passam de poucos MB).

### Alternativas futuras possíveis (não implementadas agora)
1. **Upload em chunks via Git Data API** (blobs + tree + commit em vez do endpoint
   simples de Contents) — sobe o teto real para ~100 MB, mantendo tudo no GitHub.
   Exige reescrever a rotina de upload em `github.ts`/no novo `githubStorageProvider`
   com mais chamadas e mais tratamento de erro.
2. **Novo `StorageProvider` para outro backend** (ex: object storage dedicado) —
   como a abstração já existe, isso passa a ser um novo arquivo implementando a
   interface, sem tocar no resto do CMS. Foi a opção descartada por ora conforme
   decisão do time.
3. **Compressão/conversão no navegador antes do envio** (ex: reduzir um WAV para
   MP3/FLAC comprimido no próprio upload) — reduz o problema sem mudar
   infraestrutura, mas altera o arquivo original entregue pelo usuário, o que pode
   não ser aceitável dependendo do uso.
4. **Adicionar a checagem de tamanho que falta para áudio no `UploadModal`** —
   puramente defensivo (avisar antes de tentar, em vez de falhar no meio do envio).
   Não resolve o limite, só evita a falha silenciosa. Não implementado agora porque
   envolve alterar o fluxo atual de upload, o que foi pedido para não fazer sem
   necessidade — fica registrado aqui como candidato de baixo risco para uma
   próxima etapa, se vocês quiserem.

---

## 3. Confirmação

- Nenhum arquivo de mídia existente foi movido, renomeado ou excluído do GitHub.
- Nenhum bucket ou Edge Function de storage foi criado no Supabase.
- Nenhuma migração de dados foi executada.
- O fluxo de publicação (branch `cms-data`, `data.json`/`bkp.json`,
  `cms-config.json`) não foi alterado.
- Todos os projetos, áudios e galerias já cadastrados continuam funcionando
  exatamente como antes — a mudança é apenas uma camada de indireção interna entre
  `useCMS.ts` e `github.ts`.
