IMPLEMENTAÇÃO CORRETIVA – PRESERVAÇÃO DE CONTEÚDO, CMS E CORREÇÕES FINAIS

Antes de iniciar qualquer alteração, leia toda a arquitetura do projeto e compreenda completamente o funcionamento do CMS, do GitHub, da Vercel e do sistema de publicação.

Esta solicitação deve ser tratada como uma atualização corretiva e arquitetural.

O objetivo é corrigir definitivamente problemas estruturais do projeto, sem criar regressões.

1. PRESERVAÇÃO DOS DADOS DO ADMINISTRADOR (PRIORIDADE MÁXIMA)

Este é o problema mais crítico do projeto.

Atualmente, sempre que uma nova versão do site é publicada pelo Figma Make, alterações realizadas manualmente pelo administrador são sobrescritas.

Isso faz com que sejam perdidos:

textos editados;
cores personalizadas;
uploads de imagens;
uploads de vídeos;
uploads de áudios;
thumbnails;
documentos;
configurações.

Isso não pode mais acontecer.

Objetivo

O Figma Make deverá ser apenas o responsável pela estrutura do site.

O conteúdo deverá ser responsabilidade exclusiva do CMS.

Implementação

Separar completamente:

código da aplicação;
conteúdo do CMS;
uploads;
configurações.

Criar uma arquitetura onde:

Código

Responsável apenas por:

layout;
componentes;
lógica;
navegação.
Conteúdo

Responsável por:

textos;
imagens;
vídeos;
áudios;
documentos;
cores configuráveis;
conteúdos do administrador.

Esses conteúdos nunca poderão ser substituídos por novos commits.

GitHub

Organizar o projeto para que o GitHub mantenha separação entre:

Código

e

Conteúdo.

Caso seja necessário criar diretórios exclusivos para conteúdo dinâmico ou outra estratégia equivalente, implementar a solução mais robusta possível.

O importante é garantir que:

Novos commits enviados pelo Figma nunca sobrescrevam conteúdos cadastrados pelo administrador.

Essa regra é obrigatória.

2. CMS COMPLETO

Ainda existem diversos textos que não podem ser editados.

Isso precisa ser corrigido.

Objetivo

Todo texto existente no site deverá ser editável pelo painel administrativo.

Sem exceções.

Exemplo identificado:

Sessão:

"O que fazer"

As abas dessa seção ainda não possuem gerenciamento.

Adicionar gerenciamento completo.

Revisar todas as páginas e garantir que:

Todo texto visível seja editável pelo CMS.

3. PRODUÇÃO FONOGRÁFICA

Todo áudio enviado deverá ser automaticamente publicado na seção:

Produção Fonográfica

Não apenas cadastrado na biblioteca.

Também deverá aparecer automaticamente na página pública.

Fluxo esperado:

Upload

↓

Thumbnail

↓

Salvar

↓

Cadastro

↓

Disponível na biblioteca

↓

Disponível automaticamente na seção Produção Fonográfica

4. PLAYER DE ÁUDIO

O design ficou excelente.

Porém existe um bug crítico.

Os áudios não reproduzem.

Corrigir completamente.

Validar:

play;
pause;
barra de progresso;
tempo;
volume;
troca de faixa;
carregamento;
preload.

Todos os formatos suportados devem funcionar corretamente.

5. CARROSSEL DOS ÁUDIOS

O carrossel ficou visualmente correto.

Porém a navegação não funciona.

Corrigir:

Desktop

scroll horizontal.

Mobile

swipe horizontal.

Mouse

roda horizontal.

Touchpad

rolagem.

Barra de rolagem

sincronizada.

O comportamento deverá ser idêntico ao da galeria de vídeos.

6. RESPONSIVIDADE

Sessão:

"Menos intermediários. Mais resultado."

Na versão mobile os textos ultrapassam os limites da tela.

Corrigir completamente.

Nenhum texto poderá ultrapassar a largura da viewport.

Revisar:

largura;
quebra;
padding;
margin;
alinhamento;
line-height.
7. HERO MOBILE

Na versão mobile, o Hero encontra-se desalinhado.

Reposicionar aproximadamente 70% para a direita.

Manter proporcionalidade em diferentes resoluções.

Validar:

Android

iPhone

Tablet

8. CARROSSEL DE IMAGENS

Na seção Design desejo poder publicar projetos com várias imagens.

Funcionamento semelhante ao Instagram.

Cada projeto deverá aceitar:

várias imagens;
ordem personalizada;
navegação horizontal;
indicadores;
swipe;
popup;
zoom.

Tudo administrado pelo CMS.

9. IMAGENS

O comportamento das imagens deverá seguir exatamente o padrão dos vídeos.

Cada imagem deverá possuir:

thumbnail padronizada;
popup;
visualização ampliada;
carregamento otimizado;
lazy loading.

Aceitar múltiplos formatos.

10. TOUCH MOBILE

Ainda existe excesso de sensibilidade.

O popup continua abrindo quando o usuário apenas tenta navegar.

Corrigir definitivamente.

Implementar detecção inteligente.

Diferenciar:

tap;
drag;
scroll vertical;
scroll horizontal.

Somente abrir popup quando houver toque intencional.

Cancelar automaticamente qualquer clique caso exista deslocamento acima da tolerância definida.

Priorizar Pointer Events.

Validar em:

Android

iPhone

Tablets

11. VALIDAÇÃO FINAL

Antes de concluir:

Executar uma auditoria completa.

Validar:

✓ CMS

✓ Uploads

✓ Vídeos

✓ Áudios

✓ Player

✓ Biblioteca

✓ Produção Fonográfica

✓ Carrosséis

✓ Mobile

✓ Desktop

✓ Responsividade

✓ Persistência dos dados

✓ Deploy

✓ GitHub

✓ Vercel

CRITÉRIO DE ACEITAÇÃO

A implementação somente deverá ser considerada concluída quando:

Nenhum conteúdo do administrador puder ser perdido após novos commits do Figma Make.
Todo texto do site estiver disponível para edição pelo CMS.
Todos os uploads permanecerem persistentes.
Os áudios reproduzirem corretamente.
O carrossel de áudios funcionar em desktop e mobile.
Todos os novos áudios forem automaticamente exibidos na seção Produção Fonográfica.
O carrossel de imagens da seção Design estiver funcional e totalmente administrável.
As imagens utilizarem o mesmo padrão visual e funcional dos vídeos.
O Hero estiver corretamente alinhado no mobile.
A seção "Menos intermediários. Mais resultado." estiver totalmente responsiva.
Os popups de vídeos e imagens forem acionados apenas por um toque intencional, sem interferir na navegação do usuário.
Uma observação importante sobre o primeiro item

Há um detalhe técnico que merece atenção: separar apenas por pastas no GitHub não resolve, por si só, o problema de sobrescrita. O ideal é que a IA implemente uma arquitetura em que o conteúdo gerenciado pelo administrador seja armazenado em uma camada persistente (banco de dados, armazenamento de objetos ou arquivos de conteúdo independentes) e que o Figma Make altere apenas o código da aplicação. Você pode mencionar isso no final do prompt:

Importante: não limite a solução à criação de pastas separadas. Implemente a estratégia arquitetural mais robusta para garantir que conteúdos criados pelo administrador (textos, cores, uploads e configurações) nunca sejam sobrescritos por atualizações do Figma Make ou novos deploys, preservando totalmente os dados existentes. Isso dará liberdade para escolher a implementação mais segura e durável.