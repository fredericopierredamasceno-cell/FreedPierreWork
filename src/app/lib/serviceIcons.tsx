/* ═══════════════════════════════════════════════════════════════════
   Registro de ícones dos serviços.

   O CMS guarda APENAS a chave do ícone (ex: "palette") — nunca JSX,
   nunca um componente, nunca um índice de array. Este arquivo é o único
   lugar que traduz chave → componente React.

   Para oferecer um ícone novo ao admin basta adicionar uma linha no mapa
   abaixo: ele passa a aparecer automaticamente no seletor do painel.
═══════════════════════════════════════════════════════════════════ */
import {
  Palette, Brush, PenTool, Type, Layers, Image as ImageIcon, Camera, Film, Video,
  Clapperboard, Sparkles, Wand2, Bot, Cpu, Mic, Music, Headphones, Radio, Disc,
  Megaphone, Monitor, Smartphone, Globe, Rocket, Zap, Star, Heart, Lightbulb,
  Box, Package, Scissors, Printer, BookOpen, FileText, ShoppingBag,
  Instagram, Youtube, Aperture, Compass, Target, Flame, Award,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/** Chave (gravada no CMS) → componente (usado só no frontend). */
export const SERVICE_ICON_MAP: Record<string, LucideIcon> = {
  palette: Palette,
  brush: Brush,
  "pen-tool": PenTool,
  type: Type,
  layers: Layers,
  image: ImageIcon,
  camera: Camera,
  film: Film,
  video: Video,
  clapperboard: Clapperboard,
  sparkles: Sparkles,
  wand: Wand2,
  bot: Bot,
  cpu: Cpu,
  mic: Mic,
  music: Music,
  headphones: Headphones,
  radio: Radio,
  disc: Disc,
  megaphone: Megaphone,
  monitor: Monitor,
  smartphone: Smartphone,
  globe: Globe,
  rocket: Rocket,
  zap: Zap,
  star: Star,
  heart: Heart,
  lightbulb: Lightbulb,
  box: Box,
  package: Package,
  scissors: Scissors,
  printer: Printer,
  "book-open": BookOpen,
  "file-text": FileText,
  "shopping-bag": ShoppingBag,
  instagram: Instagram,
  youtube: Youtube,
  aperture: Aperture,
  compass: Compass,
  target: Target,
  flame: Flame,
  award: Award,
};

export const SERVICE_ICON_KEYS: string[] = Object.keys(SERVICE_ICON_MAP);

export const DEFAULT_SERVICE_ICON = "sparkles";

export function isServiceIconKey(value: unknown): value is string {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(SERVICE_ICON_MAP, value);
}

/** Aceita qualquer valor vindo do CMS (inclusive dado antigo/ausente) e
 *  devolve sempre uma chave válida — nunca quebra a renderização. */
export function serviceIconKeyOrDefault(value: unknown): string {
  return isServiceIconKey(value) ? value : DEFAULT_SERVICE_ICON;
}

export function ServiceIcon({ name, size = 24, className }: { name: string; size?: number; className?: string }) {
  const Icon = SERVICE_ICON_MAP[name] ?? SERVICE_ICON_MAP[DEFAULT_SERVICE_ICON];
  return <Icon size={size} className={className} />;
}
