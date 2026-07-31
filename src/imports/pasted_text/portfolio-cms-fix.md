PROMPT PARA O FIGMA MAKE
CONTEXTO DO PROJETO

Este projeto é o meu portfólio profissional.

O projeto foi criado inteiramente no Figma Make.

O código está conectado a um repositório GitHub.

O deploy é realizado automaticamente pela Netlify.

O site já está praticamente finalizado.

NÃO altere o layout, identidade visual, animações, design, UX, estrutura das páginas, responsividade, componentes visuais ou estilo do portfólio.

O único objetivo desta tarefa é corrigir completamente o sistema administrativo.

ANALISE TODO O PROJETO

Antes de realizar qualquer alteração:

analise toda a arquitetura do projeto;
identifique como o painel administrativo foi implementado;
identifique onde os dados estão sendo armazenados;
identifique porque as alterações não persistem;
identifique porque os uploads não aparecem em outros dispositivos;
identifique porque nenhuma alteração gera commit no GitHub;
identifique porque a Netlify nunca detecta alterações feitas pelo painel.

Não faça alterações superficiais.

Corrija a arquitetura inteira se necessário.

PROBLEMA ATUAL

Hoje o painel administrativo permite:

login
upload de imagens
upload de vídeos
adicionar projetos
excluir projetos
editar textos
alterar projetos em destaque
alterar categorias
editar informações

Visualmente tudo funciona.

Porém nenhuma alteração é permanente.

Tudo fica apenas no navegador onde foi realizado.

Quando acesso o mesmo site em outro computador ou celular:

os uploads desaparecem;
os novos projetos desaparecem;
as alterações de textos desaparecem;
as alterações de imagens desaparecem.

Também percebi que:

nenhum commit é criado no GitHub;
nenhuma alteração chega ao repositório;
a Netlify nunca realiza novo deploy.
OBJETIVO

Transformar o painel administrativo em um CMS REAL.

Não quero um painel que apenas altere estados do React.

Não quero um painel que utilize memória.

Não quero um painel que utilize armazenamento temporário.

Quero um painel profissional semelhante ao Wix.

É PROIBIDO UTILIZAR

Não utilizar:

localStorage
sessionStorage
IndexedDB
estados temporários
mocks
dados em memória
JSON temporário
dados falsos
armazenamento apenas no navegador

Toda informação deve ser persistida.

PERSISTÊNCIA

Toda alteração realizada pelo administrador deve permanecer para sempre.

Ao atualizar a página:

o conteúdo deve continuar.

Ao abrir outro navegador:

o conteúdo deve continuar.

Ao abrir outro computador:

o conteúdo deve continuar.

Ao abrir no celular:

o conteúdo deve continuar.

INTEGRAÇÃO COM GITHUB

O projeto já possui um repositório GitHub conectado.

Utilize esta integração.

Sempre que o administrador salvar qualquer alteração:

o sistema deverá automaticamente:

enviar novos arquivos;
atualizar arquivos existentes;
criar commit automaticamente;
enviar para a branch principal;
manter o histórico do repositório.

Não quero realizar commits manualmente.

Não quero utilizar Git Desktop.

Não quero abrir VS Code.

Tudo deve acontecer automaticamente pelo painel.

NETLIFY

Após cada commit:

a Netlify deverá detectar automaticamente a alteração.

Executar novo deploy.

Publicar a nova versão.

Sem nenhuma ação manual.

UPLOAD DE ARQUIVOS

O administrador deve conseguir enviar:

Imagens

PNG
JPG
JPEG
WEBP
SVG

Vídeos

MP4
MOV
WEBM

Os arquivos devem ser enviados automaticamente para o projeto.

Criar organização automática como:

public/uploads/images/

public/uploads/videos/

ou estrutura equivalente.

Todos os caminhos devem ser atualizados automaticamente.

Nenhum caminho quebrado.

Nenhum arquivo perdido.

EDITOR ESTILO WIX

Quero administrar o site inteiro sem editar código.

O painel deve permitir alterar:

HOME

Título

Subtítulo

Descrição

Botões

Imagem principal

Vídeo principal

Banner

CTA

SOBRE

Texto

Imagem

Currículo

Experiência

Skills

SERVIÇOS

Adicionar

Editar

Excluir

Reordenar

Alterar ícones

Alterar descrição

PORTFÓLIO

Adicionar projeto

Excluir projeto

Duplicar projeto

Editar projeto

Alterar categoria

Alterar thumbnail

Alterar vídeo

Alterar imagens

Alterar descrição

Alterar tecnologias

Alterar cliente

Alterar data

Alterar links

Marcar destaque

Remover destaque

Ocultar projeto

Publicar projeto

Rascunho

CONTATOS

Instagram

Behance

LinkedIn

YouTube

TikTok

Spotify

Email

WhatsApp

Telefone

RODAPÉ

Todo texto deve ser editável.

SEO

Título

Descrição

Keywords

Open Graph

Imagem Social

Favicon

robots.txt

Sitemap

APARÊNCIA

Logo

Cores

Tipografia

Ícones

Tema

EXPERIÊNCIA DO ADMINISTRADOR

Quero um painel semelhante ao Wix.

Tudo deve ser editável.

Tudo deve possuir:

Salvar

Cancelar

Editar

Excluir

Duplicar

Visualizar

Upload

Preview

Pesquisar

Filtros

Ordenação

Drag and Drop para reorganizar projetos.

SEGURANÇA

Somente administradores autenticados podem editar.

Nenhum visitante pode acessar o painel.

PERFORMANCE

Não alterar:

layout

design

responsividade

animações

efeitos

componentes

experiência visual

Continuar utilizando:

React

Vite

Lazy Loading

Code Splitting

Otimização de imagens

CASO O GITHUB NÃO POSSA SER UTILIZADO

Se existir qualquer limitação técnica que impeça commits automáticos diretamente pelo painel administrativo:

NÃO mantenha armazenamento local.

Implemente automaticamente uma solução persistente compatível com Netlify que permita:

armazenar textos;
armazenar imagens;
armazenar vídeos;
armazenar projetos;
armazenar configurações;
sincronizar entre dispositivos.

Escolha a melhor arquitetura possível.

IMPORTANTE

Antes de concluir a tarefa:

revise toda a arquitetura;
elimine qualquer armazenamento local;
elimine qualquer dado temporário;
elimine qualquer comportamento que faça alterações desaparecerem;
garanta persistência permanente;
garanta sincronização entre dispositivos;
garanta integração com GitHub e Netlify sempre que tecnicamente possível.
RESULTADO ESPERADO

Quero um painel administrativo profissional.

Quero entrar no site, fazer login e conseguir administrar 100% do portfólio sem abrir o código-fonte.

Quero que qualquer alteração feita pelo painel seja permanente, sincronizada entre todos os dispositivos e publicada automaticamente no site.

Uma recomendação adicional

Se o Figma Make responder que não consegue implementar commits automáticos no GitHub por limitações da plataforma, peça que ele explique qual limitação impede isso e proponha a arquitetura oficial recomendada para esse caso. Assim você evita ficar preso tentando resolver algo que a própria plataforma não suporta e consegue seguir pela solução mais adequada.