/* Ícones das plataformas de streaming — line-art monocromático (currentColor)
   para acompanhar a identidade visual do site (ícones lucide, sem cores de
   marca competindo com o laranja primário). */
import type { CMSRelease } from "./types";

export interface PlatformIconProps { size?: number; className?: string; }

export function SpotifyIcon({ size = 16, className = "" }: PlatformIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="9.3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6.7 9.9c3.5-1.1 7.4-.8 10.4 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7.3 12.8c2.9-.9 6.2-.6 8.8.9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M7.9 15.5c2.3-.7 4.9-.5 6.9.7" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

export function AppleMusicIcon({ size = 16, className = "" }: PlatformIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M15.3 4.3c.1 1-.3 2-.9 2.7-.7.7-1.7 1.2-2.7 1.1-.1-1 .3-2 .9-2.8.7-.7 1.8-1.1 2.7-1z" fill="currentColor" />
      <path d="M17.6 9.7c-.9-.1-1.7.3-2.3.3-.6 0-1.3-.3-2.1-.3-1.1 0-2.1.6-2.7 1.7-1.1 2-.3 5 1 6.7.6.8 1.2 1.7 2.1 1.7.8 0 1.2-.5 2.2-.5s1.4.5 2.2.5c.9 0 1.5-.8 2-1.6.7-1 1-1.9 1-2-.1 0-1.8-.7-1.8-2.7 0-1.7 1.4-2.5 1.4-2.6-.8-1.2-2-1.3-2.5-1.3h-.5z" fill="currentColor" />
    </svg>
  );
}

export function DeezerIcon({ size = 16, className = "" }: PlatformIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="2.5" y="14.2" width="3.4" height="4.3" rx="0.5" stroke="currentColor" strokeWidth="1.3" />
      <rect x="7.9" y="10.8" width="3.4" height="7.7" rx="0.5" stroke="currentColor" strokeWidth="1.3" />
      <rect x="13.3" y="7" width="3.4" height="11.5" rx="0.5" stroke="currentColor" strokeWidth="1.3" />
      <rect x="18.1" y="4.2" width="3.4" height="14.3" rx="0.5" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

export function YoutubeMusicIcon({ size = 16, className = "" }: PlatformIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="9.3" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10.7 10.2l3 1.8-3 1.8v-3.6z" fill="currentColor" />
    </svg>
  );
}

export type ReleasePlatformField = "spotifyUrl" | "appleMusicUrl" | "deezerUrl" | "youtubeMusicUrl";

export interface PlatformMeta {
  key: string;
  label: string;
  field: ReleasePlatformField;
  required?: boolean;
  Icon: (props: PlatformIconProps) => JSX.Element;
}

export const PLATFORM_META: PlatformMeta[] = [
  { key: "spotify", label: "Spotify", field: "spotifyUrl", required: true, Icon: SpotifyIcon },
  { key: "appleMusic", label: "Apple Music", field: "appleMusicUrl", Icon: AppleMusicIcon },
  { key: "deezer", label: "Deezer", field: "deezerUrl", Icon: DeezerIcon },
  { key: "youtubeMusic", label: "YouTube Music", field: "youtubeMusicUrl", Icon: YoutubeMusicIcon },
];

/** Links preenchidos de um lançamento, na ordem definida em PLATFORM_META. */
export function releaseLinks(release: CMSRelease): { meta: PlatformMeta; url: string }[] {
  return PLATFORM_META
    .map(meta => ({ meta, url: release[meta.field] }))
    .filter((x): x is { meta: PlatformMeta; url: string } => !!x.url);
}
