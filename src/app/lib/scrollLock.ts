/* Trava de scroll do <body> com contagem de referências.
 *
 * BUG CORRIGIDO: AdminPanel, GalleryModal e UploadModal cada um escrevia
 * `document.body.style.overflow = "hidden"` ao abrir e `= ""` ao fechar,
 * de forma totalmente independente. Como App.tsx abre um modal e fecha
 * outro NO MESMO evento (ex: `onOpenUpload = () => { setAdminOpen(false);
 * setUploadOpen(true); }`), os efeitos das duas modais rodam no mesmo
 * commit do React — e o cleanup do modal que está FECHANDO podia rodar
 * DEPOIS do effect do modal que está ABRINDO (a ordem segue a posição de
 * cada componente na árvore JSX, não a ordem "lógica" das duas chamadas de
 * `setState`). Resultado: `overflow` terminava como `""` mesmo com um
 * modal aberto na tela — o scroll do fundo da página continuava livre por
 * trás do modal.
 *
 * A correção: um contador de referências em nível de módulo. Cada modal
 * "pede" a trava (`lockBodyScroll`) e recebe uma função de "liberar" só
 * dele. O `overflow: hidden` só é removido quando o ÚLTIMO lock ativo é
 * liberado — não importa a ordem de abertura/fechamento entre os modais.
 */
let lockCount = 0;
let previousOverflow = "";

export function lockBodyScroll(): () => void {
  if (lockCount === 0) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  lockCount++;
  let released = false;
  return () => {
    if (released) return; // proteção contra chamar o "unlock" duas vezes
    released = true;
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) document.body.style.overflow = previousOverflow;
  };
}
