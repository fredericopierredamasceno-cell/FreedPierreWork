/* Constantes compartilhadas pela "vitrine" de Produções (capa em destaque + carrossel). */

/**
 * Transição usada pelo layoutId compartilhado entre a capa em destaque
 * (FeaturedAudioCard) e a miniatura correspondente no carrossel (AudioCoverThumb).
 * Ao clicar numa miniatura ela "sobe" para o lugar da capa principal — a Motion
 * anima essa troca de posição/tamanho usando esta duração, nunca instantânea.
 */
export const COVER_TRANSITION = { duration: 0.26, ease: [0.4, 0, 0.2, 1] };
