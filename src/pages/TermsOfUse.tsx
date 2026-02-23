import Header from "@/components/Header";

const TermsOfUse = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-12 max-w-2xl animate-fade-in">
        <h1 className="text-2xl font-display font-bold text-foreground mb-8">Termos de Uso</h1>
        <div className="prose prose-sm max-w-none text-muted-foreground space-y-6">
          <p className="text-foreground font-semibold">Vitrine dos Especialistas da Beleza</p>

          <section>
            <h2 className="text-lg font-display font-semibold text-foreground">1. Aceitação dos Termos</h2>
            <p>Ao acessar e utilizar a plataforma Vitrine dos Especialistas da Beleza ("Plataforma"), o usuário declara que leu, compreendeu e concorda com estes Termos de Uso.</p>
            <p>Caso não concorde com qualquer condição aqui prevista, o usuário não deverá utilizar a Plataforma.</p>
          </section>

          <section>
            <h2 className="text-lg font-display font-semibold text-foreground">2. Natureza da Plataforma</h2>
            <p>A Vitrine dos Especialistas da Beleza é um portal de indicação de profissionais formados em curso específico, com a finalidade de facilitar a conexão entre clientes e profissionais.</p>
            <p>A Plataforma:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Não intermedeia pagamentos</li>
              <li>Não realiza agendamentos</li>
              <li>Não presta serviços de beleza</li>
              <li>Não participa da negociação entre cliente e profissional</li>
            </ul>
            <p>A relação contratual ocorre exclusivamente entre cliente e profissional.</p>
          </section>

          <section>
            <h2 className="text-lg font-display font-semibold text-foreground">3. Cadastro de Profissionais</h2>
            <p>A publicação do perfil está disponível exclusivamente para alunos que concluíram o curso correspondente.</p>
            <p>O profissional é o único responsável por:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Informações fornecidas no perfil</li>
              <li>Preços divulgados</li>
              <li>Serviços oferecidos</li>
              <li>Cumprimento de horários</li>
              <li>Qualidade dos serviços</li>
              <li>Atendimento ao cliente</li>
            </ul>
            <p>A Plataforma poderá remover perfis que violem estes Termos.</p>
          </section>

          <section>
            <h2 className="text-lg font-display font-semibold text-foreground">4. Responsabilidades do Usuário (Cliente)</h2>
            <p>O cliente reconhece que:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>A escolha do profissional é de sua livre decisão</li>
              <li>A negociação é feita diretamente via WhatsApp</li>
              <li>A Plataforma não garante resultados</li>
            </ul>
            <p>Recomenda-se que o cliente confirme previamente valores, condições e disponibilidade antes de agendar.</p>
          </section>

          <section>
            <h2 className="text-lg font-display font-semibold text-foreground">5. Limitação de Responsabilidade</h2>
            <p>A Vitrine dos Especialistas da Beleza não se responsabiliza por:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Resultados dos serviços prestados</li>
              <li>Cancelamentos ou atrasos</li>
              <li>Divergências de valores</li>
              <li>Danos materiais ou morais decorrentes do atendimento</li>
              <li>Conflitos entre cliente e profissional</li>
            </ul>
            <p>Qualquer eventual controvérsia deverá ser resolvida diretamente entre as partes envolvidas.</p>
          </section>

          <section>
            <h2 className="text-lg font-display font-semibold text-foreground">6. Propriedade Intelectual</h2>
            <p>Todo o conteúdo da Plataforma (marca, layout, identidade visual e estrutura) é protegido por direitos autorais e não pode ser reproduzido sem autorização.</p>
          </section>

          <section>
            <h2 className="text-lg font-display font-semibold text-foreground">7. Alterações</h2>
            <p>A Plataforma poderá atualizar estes Termos a qualquer momento, sendo responsabilidade do usuário consultá-los periodicamente.</p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermsOfUse;
