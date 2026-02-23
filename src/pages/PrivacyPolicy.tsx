import Header from "@/components/Header";

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-12 max-w-2xl animate-fade-in">
        <h1 className="text-2xl font-display font-bold text-foreground mb-8">Política de Privacidade</h1>
        <div className="prose prose-sm max-w-none text-muted-foreground space-y-6">
          <p className="text-foreground font-semibold">Vitrine dos Especialistas da Beleza</p>

          <section>
            <h2 className="text-lg font-display font-semibold text-foreground">1. Coleta de Informações</h2>
            <p>Podemos coletar:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Nome</li>
              <li>Email</li>
              <li>Cidade/Estado</li>
              <li>Número de WhatsApp (no caso de profissionais)</li>
              <li>Informações inseridas voluntariamente no perfil</li>
            </ul>
            <p>Não coletamos dados bancários nem realizamos transações financeiras.</p>
          </section>

          <section>
            <h2 className="text-lg font-display font-semibold text-foreground">2. Finalidade do Uso dos Dados</h2>
            <p>Os dados são utilizados para:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Exibição do perfil profissional</li>
              <li>Funcionamento da busca por localização</li>
              <li>Comunicação com o profissional (via WhatsApp)</li>
              <li>Melhoria da experiência da Plataforma</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-display font-semibold text-foreground">3. Compartilhamento de Dados</h2>
            <p>A Plataforma não vende nem comercializa dados pessoais.</p>
            <p>Os dados do profissional são exibidos publicamente conforme inseridos no perfil.</p>
          </section>

          <section>
            <h2 className="text-lg font-display font-semibold text-foreground">4. Armazenamento e Segurança</h2>
            <p>Adotamos medidas técnicas razoáveis para proteção das informações.</p>
            <p>Entretanto, nenhum sistema é totalmente invulnerável, e não podemos garantir segurança absoluta contra acessos indevidos.</p>
          </section>

          <section>
            <h2 className="text-lg font-display font-semibold text-foreground">5. Direitos do Titular (LGPD)</h2>
            <p>O usuário pode solicitar:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Correção de dados</li>
              <li>Atualização</li>
              <li>Exclusão de perfil</li>
              <li>Informações sobre tratamento de dados</li>
            </ul>
            <p>Solicitações devem ser feitas pelo canal oficial de contato.</p>
          </section>

          <section>
            <h2 className="text-lg font-display font-semibold text-foreground">6. Uso de Cookies</h2>
            <p>Podemos utilizar cookies para:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Melhorar desempenho</li>
              <li>Analisar navegação</li>
              <li>Otimizar experiência do usuário</li>
            </ul>
            <p>O usuário pode desativar cookies nas configurações do navegador.</p>
          </section>

          <section>
            <h2 className="text-lg font-display font-semibold text-foreground">7. Alterações nesta Política</h2>
            <p>Esta Política poderá ser atualizada periodicamente.</p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
