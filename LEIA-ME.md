# Bloco: microinterações do painel admin

- Painel abre com fade + leve slide-up (respeitando prefers-reduced-motion)
- Fundo escurecido com fade suave
- Botões "Upload", "Fechar" (topo e rodapé) e abas de navegação com
  transição de cor/hover mais perceptível
- Botão "Upload" com leve "press" (active:scale-95) ao clicar

Nenhuma lógica, dado ou estrutura de aba foi alterada — só CSS/transições.

## Como aplicar
Substitua src/app/components/AdminPanel.tsx e rode `npm run build` antes
de commitar.
