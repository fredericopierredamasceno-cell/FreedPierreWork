/* Site copy defaults, theme defaults, seed content and CMS-record factory */
import { Palette, Film, Sparkles, Mic, MessageCircle, Mail } from "lucide-react";
import type { CMSServiceContent, CMSAdvantageContent, CMSData, DisplayProject } from "./types";
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
export const DEFAULT_SERVICES: CMSServiceContent[] = [
  {
    title: "Design Gráfico",
    description: "Identidade visual para singles musicais, lançamentos digitais, artes para redes sociais, capas de álbum, materiais institucionais e peças impressas.",
    tags: ["Photoshop", "Illustrator", "Identidade Visual", "Mídias Sociais", "Canva"],
  },
  {
    title: "Video Making",
    description: "Vídeos para redes sociais, videoclipes, lyric videos, vídeos institucionais e conteúdo audiovisual. Edição e storytelling visual.",
    tags: ["Premiere Pro", "Edição de Vídeo", "Lyric Video", "Reels", "Institucional"],
  },
  {
    title: "Motion Design",
    description: "Animações, vinhetas, motion graphics e edição de vídeo integrada. Cada frame pensado para gerar impacto e engajamento em poucos segundos.",
    tags: ["After Effects", "Motion Graphics", "Animação", "Vinhetas", "Reels"],
  },
  {
    title: "Produção Fonográfica",
    description: "Gravação, produção, edição, mixagem e masterização em estúdio. Cadastrado no ECAD. Entrega pronta para streaming.",
    tags: ["FL Studio", "Reaper", "Mixagem", "Masterização", "Streaming", "ECAD"],
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
  return {
    content: safeContent,
    theme: { ...THEME_DEFAULTS, ...(overrides.theme ?? {}) },
    services: overrides.services?.length ? overrides.services : DEFAULT_SERVICES,
    advantages: overrides.advantages?.length ? overrides.advantages : DEFAULT_ADVANTAGES,
    projects: overrides.projects ?? [],
    audios,
    pinned: overrides.pinned ?? [],
    hiddenSeeds: overrides.hiddenSeeds ?? [],
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

export const CATEGORIES = ["Motion Design", "Video Making", "Design Gráfico", "Produção Fonográfica"];

export const CATEGORY_COLORS: Record<string, string> = {
  "Motion Design": "#E8863A",
  "Video Making": "#6C9EE8",
  "Design Gráfico": "#A278D4",
  "Produção Fonográfica": "#5BC49A",
};

export const SERVICE_NUMBERS = ["01", "02", "03", "04"];
export const SERVICE_ICONS = [<Palette size={24} />, <Film size={24} />, <Sparkles size={24} />, <Mic size={24} />];
export const SERVICE_CATEGORIES = [["Design Gráfico"], ["Video Making"], ["Motion Design"], ["Produção Fonográfica"]];

export const AUDIO_ACCEPT = "audio/mpeg,audio/wav,audio/ogg,audio/aac,audio/mp4,audio/flac,audio/x-flac,.mp3,.wav,.ogg,.aac,.m4a,.flac";

export const CONTACT_LINKS = [
  { icon: <MessageCircle size={18} />, label: "WhatsApp", value: "(31) 97579-1151", href: "https://wa.me/5531975791151" },
  { icon: <Mail size={18} />, label: "E-mail", value: "fredericopierredamasceno@gmail.com", href: "mailto:fredericopierredamasceno@gmail.com" },
];
export const AUDIO_GENRES = ["Trap", "Beat", "Gospel", "Eletrônico", "Hip-Hop", "R&B", "Pop", "Funk", "Samba", "Reggaeton", "Lofi", "Instrumental", "Mix", "Outro"];
export const AUDIO_SERVICE_TITLE = "Produção Fonográfica";
