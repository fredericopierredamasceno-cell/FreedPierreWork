# Implementação de autenticação e publicação segura

## Auditoria antes da alteração

O projeto original tinha uma autenticação exclusivamente no navegador: usuário e senha estavam em `src/app/lib/session.ts`. O estado de login era apenas uma data no `sessionStorage`; portanto não protegia rotas nem operações de escrita de forma real. O painel também pedia um PAT do GitHub e o enviava diretamente do navegador para a API do GitHub. Embora fosse apagado ao encerrar a sessão, continuava acessível por DevTools, extensões e qualquer script executado na página.

Os uploads eram enviados ao GitHub pelo navegador e os dados eram gravados no branch `cms-data`. Isso preservava os recursos do CMS, mas expunha a credencial com permissão de escrita.

## Arquitetura implementada

- **Supabase Auth** faz login por e-mail/senha, renova a sessão oficial, logout e recuperação/redefinição de senha.
- A aplicação usa o cliente oficial do Supabase. A senha nunca é armazenada pelo app.
- A função serverless `api/cms.ts` valida o JWT com o Supabase e aceita operações administrativas somente para `CMS_ADMIN_EMAIL`.
- O PAT do GitHub fica exclusivamente em uma variável de ambiente da Vercel. O bundle do navegador não contém token, chamadas diretas à API do GitHub, nem tela para informá-lo.
- Novos uploads usam o bucket `cms-media` do Supabase Storage; assim arquivos grandes não passam pelo limite de corpo de requisição das funções Vercel. URLs de mídia antigas continuam funcionando sem migração.
- O conteúdo do CMS continua sendo publicado no branch `cms-data` através da função serverless, preservando o fluxo de publicação e o isolamento do conteúdo em relação ao código.

## Configuração externa obrigatória

1. Crie um projeto no Supabase e adicione a URL de produção em **Authentication > URL Configuration > Redirect URLs** (inclua `https://seu-dominio/#admin-reset`).
2. Em **Authentication > Users**, crie o usuário administrador diretamente no painel do Supabase. Não coloque senha em arquivo, commit ou variável do projeto.
3. Crie o bucket público `cms-media` em **Storage**. Aplique estas políticas SQL no editor SQL, ajustando o e-mail somente na variável da Vercel (não há e-mail fixo no código):

```sql
create policy "public can read CMS media" on storage.objects for select
using (bucket_id = 'cms-media');

create policy "authenticated users upload CMS media" on storage.objects for insert
to authenticated with check (bucket_id = 'cms-media');
```

4. Na Vercel, configure os valores listados em `.env.example`. Somente `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` chegam ao navegador. Todos os demais são segredos do servidor.
5. Crie um fine-grained GitHub PAT com acesso apenas ao repositório necessário e permissões mínimas de **Contents: Read and write**. Salve-o como `GITHUB_TOKEN` na Vercel. Revogue imediatamente qualquer PAT que já tenha sido digitado no CMS antigo, pois ele deve ser considerado exposto.

## Testes realizados

- Build de produção Vite concluída com sucesso.
- Revisão estática: senha antiga e token do GitHub foram removidos do cliente; somente `api/cms.ts` contém chamadas ao GitHub.
- A configuração real de Supabase, envio de e-mail, publicação e upload exigem as variáveis/serviços externos acima; não é seguro simular credenciais.
