import Header from "@/components/Header";

const Disclaimer = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-12 max-w-2xl animate-fade-in">
        <h1 className="text-2xl font-display font-bold text-foreground mb-8">Isenção de Responsabilidade</h1>
        <div className="prose prose-sm max-w-none text-muted-foreground space-y-6">
          <p className="text-foreground font-semibold">Vitrine dos Especialistas da Beleza</p>

          <p>A Vitrine dos Especialistas da Beleza atua exclusivamente como um portal de indicação de profissionais formados em curso específico.</p>

          <p>Não há qualquer vínculo empregatício, societário, comercial ou de parceria entre a Plataforma e os profissionais listados.</p>

          <p>A Plataforma:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Não intermedeia pagamentos</li>
            <li>Não define preços</li>
            <li>Não agenda serviços</li>
            <li>Não fiscaliza a execução dos atendimentos</li>
            <li>Não garante resultados</li>
          </ul>

          <p>Toda negociação, contratação e execução do serviço ocorre diretamente entre cliente e profissional, sob responsabilidade exclusiva das partes envolvidas.</p>

          <p>Ao utilizar a Plataforma, o usuário declara estar ciente de que a Vitrine dos Especialistas da Beleza não poderá ser responsabilizada por eventuais danos, prejuízos, insatisfações ou disputas decorrentes da prestação de serviços pelos profissionais cadastrados.</p>
        </div>
      </div>
    </div>
  );
};

export default Disclaimer;
