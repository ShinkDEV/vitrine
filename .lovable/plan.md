

## Solicitar Reativação de Perfil Pausado

### Resumo
Quando o perfil estiver pausado, o profissional poderá editar seus dados e depois clicar em "Solicitar Reativação" no dashboard. Um dialog pedirá o motivo (opções pré-definidas ou texto livre). Ao enviar, o status muda para "pendente" e o campo `rejection_reason` armazena o motivo de reativação com prefixo identificador para o admin saber que veio de um perfil pausado.

### Mudanças

**1. Dashboard (`src/pages/Dashboard.tsx`)**
- Adicionar estado para controle do dialog de reativação (`reactivateDialogOpen`, `reactivateReason`, `customReason`)
- Adicionar mutation `requestReactivation` que atualiza o status para `"pendente"` e salva o motivo no campo `rejection_reason` com prefixo `[REATIVAÇÃO]`
- No bloco de status "pausado", adicionar botão "Solicitar Reativação" (aparece quando `isComplete === true`)
- Dialog com radio/select com 2 opções:
  - "Dados atualizados conforme solicitado"
  - "Outro" (campo de texto livre)
- Importar `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `Textarea` e `RadioGroup`

**2. Admin Panel (`src/pages/Admin.tsx`)**
- Na listagem, quando um profissional tem status `"pendente"` e `rejection_reason` começa com `[REATIVAÇÃO]`, exibir uma tag/badge "Pausado" ao lado do status "Aguardando Aprovação" para que o admin saiba que é uma reativação
- O motivo de reativação será visível na pré-visualização do perfil

**3. Nenhuma mudança no banco de dados**
- Reutiliza o campo `rejection_reason` existente para armazenar o motivo da reativação com prefixo `[REATIVAÇÃO]`
- O status `"pendente"` já é permitido pelo check constraint

### Fluxo
```text
Perfil Pausado → Profissional edita dados → Clica "Solicitar Reativação"
→ Escolhe motivo → Status muda para "pendente" 
→ Admin vê "Aguardando Aprovação" + tag "Pausado" 
→ Admin aprova → Status "publicado"
```

