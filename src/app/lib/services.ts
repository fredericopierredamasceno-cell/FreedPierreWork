/* ═══════════════════════════════════════════════════════════════════
   Domínio "Serviço" — fonte de verdade é o CMS (cms.services).

   Regras desta camada:
   • todo serviço tem um ID estável, independente da posição no array;
   • renomear um serviço NUNCA muda o ID;
   • nada é resolvido por índice (ícone, número, categorias da galeria);
   • dado antigo (serviço só com title/description/tags, projeto só com
     `category`) é normalizado em memória, sem migração destrutiva.
═══════════════════════════════════════════════════════════════════ */
import type { CMSServiceContent, CMSProject, DisplayProject } from "./types";
import { serviceIconKeyOrDefault, DEFAULT_SERVICE_ICON } from "./serviceIcons";

/** Pseudo-serviço usado só em memória para agrupar projetos que ficaram
 *  sem serviço (ex: o admin excluiu o serviço e optou por não movê-los).
 *  Nunca é gravado no CMS. */
export const UNASSIGNED_SERVICE_ID = "__sem-servico__";
export const UNASSIGNED_SERVICE_TITLE = "Outros projetos";

/* ── IDs ─────────────────────────────────────────────────────────── */

/** "Produção Fonográfica" → "producao-fonografica" */
export function slugifyServiceId(title: string): string {
  return (title ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function uniqueServiceId(base: string, taken: Set<string>): string {
  const root = base || "servico";
  if (!taken.has(root)) return root;
  let n = 2;
  while (taken.has(`${root}-${n}`)) n++;
  return `${root}-${n}`;
}

/** Cria um serviço novo já com ID estável e ordem no fim da lista. */
export function createService(existing: CMSServiceContent[], partial: Partial<CMSServiceContent> = {}): CMSServiceContent {
  const taken = new Set(existing.map(s => s.id));
  const title = (partial.title ?? "Novo serviço").trim() || "Novo serviço";
  return {
    id: partial.id && !taken.has(partial.id) ? partial.id : uniqueServiceId(slugifyServiceId(title), taken),
    title,
    description: partial.description ?? "",
    tags: partial.tags ?? [],
    icon: serviceIconKeyOrDefault(partial.icon),
    // max+1, não `length`: depois de uma exclusão os `order` têm buracos
    // (0,1,3,4) e `length` colidiria com um valor já usado.
    order: partial.order ?? existing.reduce((m, s) => Math.max(m, s.order), -1) + 1,
    active: partial.active ?? true,
    aliases: partial.aliases ?? [],
  };
}

/* ── Normalização ────────────────────────────────────────────────── */

type RawService = Partial<CMSServiceContent> & Record<string, unknown>;

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0).map(v => v.trim());
}

/**
 * Converte QUALQUER formato de serviço já gravado (inclusive o formato
 * antigo, que só tinha title/description/tags) no formato completo.
 * Campos ausentes recebem padrão seguro; nada é descartado.
 */
export function normalizeService(raw: RawService, index: number, taken: Set<string>): CMSServiceContent {
  const title = typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : `Serviço ${index + 1}`;
  const rawId = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : slugifyServiceId(title);
  const id = uniqueServiceId(rawId || `servico-${index + 1}`, taken);
  taken.add(id);
  return {
    id,
    title,
    description: typeof raw.description === "string" ? raw.description : "",
    tags: asStringArray(raw.tags),
    icon: serviceIconKeyOrDefault(raw.icon),
    order: typeof raw.order === "number" && Number.isFinite(raw.order) ? raw.order : index,
    // `active` ausente = serviço antigo, que sempre aparecia no site.
    active: raw.active === false ? false : true,
    aliases: asStringArray(raw.aliases).filter(a => a !== title),
  };
}

/** Normaliza a lista inteira e devolve já ordenada pela ordem do CMS. */
export function normalizeServices(list: unknown): CMSServiceContent[] {
  const arr = Array.isArray(list) ? (list as RawService[]) : [];
  const taken = new Set<string>();
  return arr
    .filter(Boolean)
    .map((raw, i) => normalizeService(raw, i, taken))
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
    .map((s, i) => ({ ...s, order: i }));
}

/* ── Vínculo projeto ↔ serviço ───────────────────────────────────── */

function sameLabel(a: string, b: string): boolean {
  return slugifyServiceId(a) === slugifyServiceId(b);
}

/** O serviço "responde" por esse nome de categoria legada? */
export function serviceMatchesCategory(service: CMSServiceContent, category?: string): boolean {
  if (!category) return false;
  if (sameLabel(service.title, category)) return true;
  if (sameLabel(service.id, category)) return true;
  return (service.aliases ?? []).some(a => sameLabel(a, category));
}

/**
 * Descobre a qual serviço um projeto pertence:
 *  1. `serviceId` gravado (formato novo);
 *  2. `category` batendo com título/alias/ID do serviço (formato antigo);
 *  3. undefined → projeto órfão (continua existindo, agrupado em "Outros").
 */
export function resolveProjectServiceId(project: Pick<CMSProject, "serviceId" | "category">, services: CMSServiceContent[]): string | undefined {
  if (project.serviceId && services.some(s => s.id === project.serviceId)) return project.serviceId;
  const byCategory = services.find(s => serviceMatchesCategory(s, project.category));
  return byCategory?.id;
}

/** Grava `serviceId` sem apagar `category` — dado antigo continua legível
 *  por qualquer código/JSON que ainda leia `category` direto. */
export function normalizeProjectService<T extends CMSProject>(project: T, services: CMSServiceContent[]): T {
  const serviceId = resolveProjectServiceId(project, services);
  if (!serviceId || project.serviceId === serviceId) return project;
  return { ...project, serviceId };
}

export function normalizeProjectsServices<T extends CMSProject>(projects: T[], services: CMSServiceContent[]): T[] {
  return (projects ?? []).map(p => normalizeProjectService(p, services));
}

export function projectBelongsToService(project: Pick<CMSProject, "serviceId" | "category">, service: CMSServiceContent): boolean {
  if (project.serviceId) return project.serviceId === service.id;
  return serviceMatchesCategory(service, project.category);
}

export function projectsOfService<T extends DisplayProject>(projects: T[], service: CMSServiceContent): T[] {
  return projects.filter(p => projectBelongsToService(p, service));
}

/** Projetos que não pertencem a nenhum serviço existente. */
export function orphanProjects<T extends DisplayProject>(projects: T[], services: CMSServiceContent[]): T[] {
  return projects.filter(p => !resolveProjectServiceId(p, services));
}

export function countProjectsOfService(projects: DisplayProject[], service: CMSServiceContent): number {
  return projectsOfService(projects, service).length;
}

/* ── Ordem / apresentação ────────────────────────────────────────── */

/** Serviço já pronto para a tela: número calculado, ícone como chave e
 *  os projetos dele resolvidos. Construído no App a cada render a partir
 *  de cms.services — nunca persistido. */
export interface DisplayService {
  id: string;
  number: string;
  title: string;
  description: string;
  tags: string[];
  icon: string;
  active: boolean;
  items: DisplayProject[];
}

export function serviceNumber(index: number): string {
  return String(index + 1).padStart(2, "0");
}

export function activeServices(services: CMSServiceContent[]): CMSServiceContent[] {
  return services.filter(s => s.active);
}

/** Reescreve `order` como 0..n-1 mantendo a sequência atual — usado depois
 *  de excluir um serviço, para não deixar buracos na ordenação. */
export function reindexServices(services: CMSServiceContent[]): CMSServiceContent[] {
  return [...services].sort((a, b) => a.order - b.order).map((s, i) => ({ ...s, order: i }));
}

/** Move um serviço uma posição para cima/baixo e reescreve `order`. */
export function moveService(services: CMSServiceContent[], id: string, dir: -1 | 1): CMSServiceContent[] {
  const list = [...services].sort((a, b) => a.order - b.order);
  const i = list.findIndex(s => s.id === id);
  const j = i + dir;
  if (i === -1 || j < 0 || j >= list.length) return services;
  [list[i], list[j]] = [list[j], list[i]];
  return list.map((s, idx) => ({ ...s, order: idx }));
}

/**
 * Renomeia preservando o ID (requisito da etapa: mudar "Video Making" para
 * "Produção de Vídeo" não muda o ID) e atualiza o rótulo `category` dos
 * projetos daquele serviço — o vínculo real (`serviceId`) não é tocado, e
 * nenhum projeto muda de serviço.
 */
export function renameService<T extends CMSProject>(
  services: CMSServiceContent[],
  projects: T[],
  id: string,
  newTitle: string,
): { services: CMSServiceContent[]; projects: T[] } {
  const current = services.find(s => s.id === id);
  if (!current) return { services, projects };
  const nextServices = services.map(s => (s.id === id ? { ...s, title: newTitle } : s));
  const nextProjects = projects.map(p =>
    projectBelongsToService(p, current) ? { ...p, serviceId: id, category: newTitle } : p,
  );
  return { services: nextServices, projects: nextProjects };
}

/* ── Cores ───────────────────────────────────────────────────────── */

/** Cores dos serviços que já existiam — mantidas idênticas para não
 *  mudar a identidade visual. Serviços novos recebem cor da paleta. */
export const DEFAULT_SERVICE_COLORS: Record<string, string> = {
  "motion-design": "#E8863A",
  "video-making": "#6C9EE8",
  "design-grafico": "#A278D4",
  "producao-fonografica": "#5BC49A",
  "videos-criados-com-ia": "#3EC9C0",
};

const FALLBACK_PALETTE = ["#E8863A", "#6C9EE8", "#A278D4", "#5BC49A", "#3EC9C0", "#D4A15B", "#D46C8A", "#7FB069"];

export function serviceColor(service: Pick<CMSServiceContent, "id">): string {
  const known = DEFAULT_SERVICE_COLORS[service.id];
  if (known) return known;
  let hash = 0;
  for (let i = 0; i < service.id.length; i++) hash = (hash * 31 + service.id.charCodeAt(i)) >>> 0;
  return FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length];
}

export function serviceColorById(id: string): string {
  return serviceColor({ id });
}

export { DEFAULT_SERVICE_ICON };
