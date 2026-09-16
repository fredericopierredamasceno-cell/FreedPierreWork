# RELATÓRIO — ETAPA 2: SERVIÇOS DINÂMICOS VIA ADMIN

## 1. Arquivos alterados

**Novos**

| Arquivo | Papel |
|---|---|
| `src/app/lib/services.ts` | Camada de domínio dos serviços: IDs estáveis, normalização, ordem, vínculo projeto↔serviço, cores. |
| `src/app/lib/serviceIcons.tsx` | Único lugar que traduz chave de ícone → componente lucide. O CMS guarda só a chave. |
| `src/app/components/ServicesTab.tsx` | Aba "Serviços" do Admin: CRUD completo, ordem, ícone, ativar/desativar, exclusão segura. |

**Modificados**

| Arquivo | Mudança |
|---|---|
| `src/app/lib/types.ts` | `CMSServiceContent` ganhou `id`, `icon`, `order`, `active`, `aliases`. `CMSProject` ganhou `serviceId?`. |
| `src/app/lib/defaults.tsx` | `DEFAULT_SERVICES` no formato novo; removidos `CATEGORIES`, `SERVICE_NUMBERS`, `SERVICE_ICONS`, `SERVICE_CATEGORIES`, `CATEGORY_COLORS`, `DESIGN_SERVICE_TITLE`, `AUDIO_SERVICE_TITLE`; adicionados `DESIGN_SERVICE_ID` e `AUDIO_SERVICE_ID`; `makeCMSData` normaliza serviços e projetos. |
| `src/app/App.tsx` | Lista de serviços montada 100% do CMS; serviço ativo guardado por ID; faixas do portfólio por serviço; faixa "Outros projetos" para órfãos. |
| `src/app/components/AdminPanel.tsx` | Aba de serviços delegada ao `ServicesTab`; passa `services` ao `EditProjectModal`. |
| `src/app/components/UploadModal.tsx` | Seletor de "Categoria" virou seletor de **Serviço**, alimentado pelo CMS; grava `serviceId` + `category`. |
| `src/app/components/EditProjectModal.tsx` | Idem, e resolve o serviço de projetos antigos que só têm `category`. |
| `src/app/components/GalleryModal.tsx` | Recebe o serviço já com seus projetos; comportamentos especiais por **ID**, não por título. |
| `src/app/components/DashboardTab.tsx` | "Por categoria" virou "Por serviço", lido do CMS (+ linha "Sem serviço"). |
| `src/app/components/PublishReviewModal.tsx` | Resumo por serviço do CMS. |
| `src/app/components/CarouselRow.tsx` | Cor de destaque recebida via prop (`accent`) em vez de mapa fixo por nome. |
| `src/app/components/AudioCarousel.tsx` | Cor buscada pelo ID estável do serviço de áudio. |

## 2. Arquitetura implementada

- **ID estável**: `id` é slug do título na criação e **nunca** muda depois. Renomear "Video Making" → "Produção de Vídeo" mantém `video-making`.
- **Zero índice**: número (`01`, `02`…) é derivado da posição exibida; ícone, descrição, tags e projetos saem do próprio serviço. `SERVICE_ICONS[i]` e afins deixaram de existir.
- **Ícone como dado**: o CMS grava `"palette"`; `serviceIcons.tsx` mapeia para o componente. Nenhum JSX no CMS. O admin escolhe num grid de 41 ícones.
- **Ordem**: campo `order` no CMS, controlado por setas ↑/↓ no painel.
- **Ativo/inativo**: `active: false` some do site público, continua no Admin com seus projetos e pode ser reativado.
- **Vínculo projeto→serviço**: `serviceId` é o vínculo real; `category` continua gravado com o nome do serviço apenas para compatibilidade.
- **Sem lógica por nome**: os dois comportamentos especiais (subcategorias de design, galeria de áudio) usam `DESIGN_SERVICE_ID` / `AUDIO_SERVICE_ID`. Não existe nenhum `if (service.title === ...)` no projeto — "Vídeos criados com IA" é tratado como qualquer outro serviço.
- **Persistência**: mesmo CMS, mesmo `cms-data.json`, mesmo fluxo de salvar/auto-save/publicar/GitHub. Nenhum banco novo.

## 3. Problemas encontrados na auditoria

1. `SERVICE_ICONS[i]`, `SERVICE_NUMBERS[i]` e `SERVICE_CATEGORIES[i]` casavam serviço com ícone/número/galeria **por posição** — inserir ou reordenar um serviço embaralharia tudo.
2. `CATEGORIES` (array fixo) era a fonte real das faixas do portfólio e dos seletores de upload/edição, e estava **em ordem diferente** de `DEFAULT_SERVICES`.
3. Projetos referenciavam o serviço pelo **texto** de `category` — renomear um serviço órfanaria todos os projetos dele.
4. `CATEGORY_COLORS` era indexado por título.
5. `DESIGN_SERVICE_TITLE` / `AUDIO_SERVICE_TITLE` ligavam comportamento a strings de título.
6. `activeService` era um índice no state — reordenar/excluir trocaria o serviço aberto na tela.

## 4. Compatibilidade / migração

Nada é migrado de forma destrutiva; a normalização acontece em memória, na leitura, e é regravada naturalmente na próxima publicação.

- `normalizeService()` — serviço antigo (só `title`/`description`/`tags`) ganha `id` (slug do título), `icon` padrão, `order` pela posição e `active: true`.
- `normalizeProjectsServices()` — projeto antigo (só `category`) ganha `serviceId` resolvido por título/alias/ID. **`category` não é apagado.**
- `resolveProjectServiceId()` — ordem de resolução: `serviceId` → `category` → órfão.
- Projeto órfão nunca some: aparece na faixa "Outros projetos" e pode ser reatribuído na edição.
- Os IDs dos 5 serviços existentes são exatamente o slug dos títulos atuais, então os projetos já cadastrados casam sem nenhuma intervenção.

## 5. Exclusão de serviço

Nenhum projeto é apagado junto. Com projetos associados, o painel mostra "Este serviço possui N projetos associados" e oferece:
1. **Mover para outro serviço** (atualiza `serviceId` e `category`);
2. **Deixar sem serviço** (projetos vão para "Outros projetos");
3. **Cancelar**.

Sem projetos associados, é apenas uma confirmação simples.

## 6. Testes

**Suíte funcional do domínio (32 asserts, 32 passaram)** cobrindo: normalização de dados antigos, IDs por slug, default `active`, ordem sequencial, IA sem tratamento especial, `serviceId` inferido de `category`, preservação de `category`, órfãos, rename preservando ID, criação, ID duplicado, reordenação, desativar/reativar mantendo projetos, contagem de projetos na exclusão, exclusão com mover, exclusão com desvincular, independência de índice, numeração, cores, slug com acentos e serviço novo funcionando ponta a ponta.

**Typecheck** (`tsc`, com shims para os pacotes não instalados): conjunto de erros **idêntico** ao do projeto original — nenhum erro novo introduzido.

**`npm run build` não pôde ser executado** no ambiente onde a refatoração foi feita: não há acesso de rede e, portanto, não foi possível instalar as dependências (`node_modules` ausente, `npm` bloqueado). Rode localmente `npm install && npm run build`.

## 7. Não alterado

Hero, Header, identidade visual, paleta e layout geral permanecem como estavam. A única mudança visível de ordenação é que as faixas do portfólio agora seguem a ordem dos serviços definida no CMS (antes seguiam o array fixo `CATEGORIES`) — e essa ordem agora é ajustável pelo Admin.
