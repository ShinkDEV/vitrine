

## Plano: Restringir cadastro a domínios de e-mail públicos

### O que será feito
Adicionar validação no formulário de registro para aceitar apenas e-mails dos domínios permitidos: gmail.com, outlook.com, hotmail.com, yahoo.com, yahoo.com.br, icloud.com, aol.com. E-mails temporários ou corporativos serão bloqueados.

### Alterações

**`src/pages/Register.tsx`**
- Criar uma lista de domínios permitidos
- Antes de submeter o formulário, extrair o domínio do e-mail e verificar se está na lista
- Exibir toast de erro caso o domínio não seja permitido
- Adicionar também a validação na edge function `send-confirmation-email` para segurança server-side

**`supabase/functions/send-confirmation-email/index.ts`**
- Adicionar a mesma validação de domínio no backend, rejeitando e-mails com domínios não autorizados antes de criar a conta

### Domínios permitidos
```
gmail.com, outlook.com, hotmail.com, yahoo.com, yahoo.com.br, icloud.com, aol.com
```

