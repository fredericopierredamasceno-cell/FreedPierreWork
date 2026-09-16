/* Site copy defaults, theme defaults, seed content and CMS-record factory */
import { MessageCircle, Mail, Linkedin, Instagram } from "lucide-react";
import type { CMSServiceContent, CMSAdvantageContent, CMSData, DisplayProject } from "./types";
import { normalizeProjects } from "./gallery";
import { normalizeServices, normalizeProjectsServices } from "./services";
import pizzaVideo from "../../imports/Lan_amento_Pizza_Ifood.mp4";
export const CONTENT_DEFAULTS = {
  heroLine1: "ONDE ÁUDIO,",
  heroLine2: "DESIGN",
  heroLine3: "E MOVIMENTOS",
  heroLine4: "SE ENCONTRAM",
  heroBadge: "Disponível para projetos",
  heroSubtitle: "Um profissional. Quatro linguagens. Design, motion, vídeo e produção fonográfica para marcas, artistas e conteúdo digital.",
  stat1Val: "10+", stat1Label: "Anos de experiência",
  stat2Val: "4",   stat2Label: "Áreas de atuação",
  stat3Val: "Multi", stat3Label: "Perfil criativo",
  stat4Val: "ECAD", stat4Label: "Cadastrado",
  servicesHeading1: "O que posso",
  servicesHeading2: "fazer por você?",
  servicesSectionLabel: "Serviços",
  workSectionLabel: "Explorando Meu Trabalho",
  whyMeSectionLabel: "Por que eu?",
  contactSectionLabel: "Contato",
  difHeading1: "Menos",
  difHeading2: "intermediários.",
  difHeading3: "Mais resultado.",
  difSubtext: "Com mais de 10 anos de experiência em design gráfico, motion design, edição de vídeo e produção musical, ofereço uma solução criativa completa sem dividir o projeto entre múltiplos profissionais.",
  contactHeading: "Bora criar algo?",
  contactSubtext: "Tem um projeto de design, vídeo, motion ou música? Me manda uma mensagem. Respondo pelo WhatsApp ou e-mail — sem enrolação.",
  footerCopy: "© 2026 Frederico Pierre · Design · Motion Designer · Video Maker · Audiovisual",
};
export type SiteContent = typeof CONTENT_DEFAULTS;

export const THEME_DEFAULTS = {
  primary: "#E8863A", background: "#07080F", foreground: "#EDE9E2",
  card: "#0F111A", muted: "#1A1E2B", border: "rgba(237,233,226,0.08)",
};
export type SiteTheme = typeof THEME_DEFAULTS;
/* Serviços padrão — usados só quando o CMS ainda não tem nenhum serviço
   gravado. A partir daí, a fonte de verdade é sempre o CMS/Admin.
   Os IDs abaixo são exatamente o slug dos títulos originais, então projetos
   antigos (que só têm `category`) continuam batendo sem migração alguma. */
export const DEFAULT_SERVICES: CMSServiceContent[] = [
  {
    id: "design-grafico",
    title: "Design Gráfico",
    description: "Identidade visual para singles musicais, lançamentos digitais, artes para redes sociais, capas de álbum, materiais institucionais e peças impressas.",
    tags: ["Photoshop", "Illustrator", "Identidade Visual", "Mídias Sociais", "Canva"],
    icon: "palette", order: 0, active: true,
  },
  {
    id: "video-making",
    title: "Video Making",
    description: "Vídeos para redes sociais, videoclipes, lyric videos, vídeos institucionais e conteúdo audiovisual. Edição e storytelling visual.",
    tags: ["Premiere Pro", "Edição de Vídeo", "Lyric Video", "Reels", "Institucional"],
    icon: "film", order: 1, active: true,
  },
  {
    id: "motion-design",
    title: "Motion Design",
    description: "Animações, vinhetas, motion graphics e edição de vídeo integrada. Cada frame pensado para gerar impacto e engajamento em poucos segundos.",
    tags: ["After Effects", "Motion Graphics", "Animação", "Vinhetas", "Reels"],
    icon: "sparkles", order: 2, active: true,
  },
  {
    id: "producao-fonografica",
    title: "Produção Fonográfica",
    description: "Gravação, produção, edição, mixagem e masterização em estúdio. Cadastrado no ECAD. Entrega pronta para streaming.",
    tags: ["FL Studio", "Reaper", "Mixagem", "Masterização", "Streaming", "ECAD"],
    icon: "mic", order: 3, active: true,
  },
  {
    id: "videos-criados-com-ia",
    title: "Vídeos criados com IA",
    description: "Criação de vídeos e conteúdos audiovisuais com inteligência artificial, combinando direção criativa, storytelling, geração de cenas, edição e pós-produção para campanhas, redes sociais e projetos digitais.",
    tags: ["Inteligência Artificial", "Geração de Vídeo", "Storytelling", "Direção Criativa", "Vídeos para Redes", "Conteúdo Digital"],
    icon: "bot", order: 4, active: true,
  },
];

export const DEFAULT_ADVANTAGES: CMSAdvantageContent[] = [
  { title: "Um profissional, quatro frentes", body: "Design, motion, vídeo e áudio sob o mesmo teto — sem intermediários, sem ruído de comunicação." },
  { title: "Entrega com mais agilidade", body: "Menos dependência de terceiros significa prazos menores e maior controle criativo do início ao fim." },
  { title: "Linguagem visual + sonora integrada", body: "Quem entende de áudio entende de ritmo — e isso se reflete na edição, no corte e na identidade visual." },
  { title: "10+ anos de experiência", body: "Trajetória em agências, gráficas, estúdios e mercado independente. Da teoria à prática em projetos reais." },
];
export function isCorrupted(obj: Record<string, string>): boolean {
  return Object.values(obj).some(v => typeof v === "string" && /Ã|Â[ª-¿]|â€/.test(v));
}

export function makeCMSData(overrides: Partial<CMSData & { audio?: { name: string; url: string } | null }> = {}): CMSData {
  const safeContent = overrides.content && !isCorrupted(overrides.content)
    ? { ...CONTENT_DEFAULTS, ...overrides.content }
    : { ...CONTENT_DEFAULTS };
  let audios = overrides.audios ?? [];
  if (!audios.length && overrides.audio) {
    audios = [{ id: "migrated-audio", title: (overrides.audio as { name: string; url: string }).name.replace(/\.[^.]+$/, ""), url: (overrides.audio as { name: string; url: string }).url, createdAt: 0 }];
  }
  // Serviços: normalizados SEMPRE (formato antigo — só title/description/tags —
  // ganha id/icon/order/active automaticamente, em memória e na próxima gravação).
  // ATENÇÃO: lista VAZIA é um estado legítimo (o admin pode excluir todos os
  // serviços) e precisa ser respeitada. Só cai no default quando a chave não
  // existe no JSON — que é o caso de dados antigos, anteriores a esta etapa.
  const services = normalizeServices(Array.isArray(overrides.services) ? overrides.services : DEFAULT_SERVICES);
  return {
    content: safeContent,
    theme: { ...THEME_DEFAULTS, ...(overrides.theme ?? {}) },
    services,
    advantages: overrides.advantages?.length ? overrides.advantages : DEFAULT_ADVANTAGES,
    // Normaliza SEMPRE — qualquer projeto vindo do GitHub (formato antigo,
    // intermediário ou novo) chega aqui e sai já convertido para `images[]`.
    // Isso é o que garante "nenhuma migração manual necessária".
    // ...e o mesmo vale para o vínculo projeto→serviço: `serviceId` é
    // preenchido a partir de `category` quando ainda não existir, sem
    // apagar `category` (nada de migração destrutiva).
    projects: normalizeProjectsServices(normalizeProjects(overrides.projects ?? []), services),
    audios,
    releases: overrides.releases ?? [],
    pinned: overrides.pinned ?? [],
    hiddenSeeds: overrides.hiddenSeeds ?? [],
    designCategories: overrides.designCategories?.length ? overrides.designCategories : DEFAULT_DESIGN_CATEGORIES,
    updatedAt: overrides.updatedAt ?? new Date().toISOString(),
  };
}
export const ALL_SEEDS: DisplayProject[] = [
  {
    id: "seed-pizza", category: "Motion Design",
    title: "Motion Lançamento de Pizzas",
    description: "🍕✨ Motion Design desenvolvido para o Grupo Beija-flor, promovendo novidades do cardápio da unidade de Jardim Teresópolis, Betim/MG.\n\nCada animação, transição e detalhe foi pensado para valorizar o produto e criar uma comunicação dinâmica, moderna, envolvente e com apelo comercial.",
    mediaType: "video", mediaUrl: pizzaVideo, createdAt: 0,
  },
];

/* ═══════════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════════ */

// IDs estáveis de serviços com comportamento próprio no site.
// São IDs (não títulos): renomear "Design Gráfico" no Admin não quebra nada.
// Não existe lógica especial por NOME de serviço em lugar nenhum.
export const DESIGN_SERVICE_ID = "design-grafico";
export const AUDIO_SERVICE_ID = "producao-fonografica";

// Lista inicial (default de código) das subcategorias de Design Gráfico.
// Serve apenas de ponto de partida — o admin pode criar, renomear e remover
// livremente pelo painel; a lista efetiva vive em cms.designCategories.
export const DEFAULT_DESIGN_CATEGORIES = [
  "Posts para Redes Sociais",
  "Material Impresso",
  "Identidade Visual",
  "Branding",
  "Editorial",
  "Embalagens",
  "Outros",
];

export const AUDIO_ACCEPT = "audio/mpeg,audio/wav,audio/ogg,audio/aac,audio/mp4,audio/flac,audio/x-flac,.mp3,.wav,.ogg,.aac,.m4a,.flac";

export const CONTACT_LINKS = [
  { icon: <MessageCircle size={18} />, label: "WhatsApp", value: "(31) 97579-1151", href: "https://wa.me/5531975791151" },
  { icon: <Mail size={18} />, label: "E-mail", value: "fredericopierredamasceno@gmail.com", href: "mailto:fredericopierredamasceno@gmail.com" },
  { icon: <Linkedin size={18} />, label: "LinkedIn", value: "linkedin.com/in/fredericopierre", href: "https://www.linkedin.com/in/fredericopierre" },
  { icon: <Instagram size={18} />, label: "Instagram", value: "@freedpierre", href: "https://www.instagram.com/freedpierre/" },
];
export const AUDIO_GENRES = ["Trap", "Beat", "Gospel", "Eletrônico", "Hip-Hop", "R&B", "Pop", "Funk", "Samba", "Reggaeton", "Lofi", "Instrumental", "Mix", "Outro"];
