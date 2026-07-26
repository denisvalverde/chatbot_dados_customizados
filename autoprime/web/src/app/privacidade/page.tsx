import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { SITE, whatsappHref } from '@/lib/config';

export const metadata = {
  title: 'Política de Privacidade — AP Auto Prime',
};

export default function PrivacyPolicyPage() {
  const waHref = whatsappHref('Olá! Tenho uma dúvida sobre privacidade e uso dos meus dados no AP Auto Prime.');

  return (
    <div className="min-h-screen px-4 py-10 pt-safe pb-safe">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="inline-block text-xs text-graphite-400 dark:text-white/40 hover:text-primary-500 mb-4">
          ← Voltar ao site
        </Link>

        <Card className="prose-sm">
          <h1 className="text-xl font-semibold text-graphite-900 dark:text-white mb-1">
            Política de Privacidade
          </h1>
          <p className="text-xs text-graphite-400 dark:text-white/40 mb-6">
            Última atualização: julho de 2026
          </p>

          <div className="flex flex-col gap-5 text-sm text-graphite-600 dark:text-white/70">
            <section>
              <h2 className="font-medium text-graphite-900 dark:text-white mb-1">1. Quem somos</h2>
              <p>
                O {SITE.brand} é uma plataforma de gestão para lava-rápidos e estética automotiva,
                usada tanto pela equipe do estabelecimento quanto pelos clientes que agendam
                serviços. Esta política explica quais dados coletamos, para quê, e quais são os
                seus direitos sobre eles, conforme a Lei Geral de Proteção de Dados (LGPD — Lei nº
                13.709/2018).
              </p>
            </section>

            <section>
              <h2 className="font-medium text-graphite-900 dark:text-white mb-1">2. Quais dados coletamos</h2>
              <ul className="list-disc pl-5 flex flex-col gap-1">
                <li>Dados de cadastro: nome, e-mail, telefone e senha (armazenada de forma criptografada, nunca em texto puro).</li>
                <li>Dados do cliente: CPF, data de nascimento e endereço, quando informados.</li>
                <li>Dados do veículo: marca, modelo, ano, cor e placa, para identificar o veículo atendido.</li>
                <li>Histórico de uso: agendamentos, serviços realizados, avaliações e comunicações trocadas com o estabelecimento.</li>
                <li>Dados de pagamento: status e forma de pagamento (Pix, cartão, etc.) — não armazenamos número completo de cartão de crédito.</li>
                <li>Dados técnicos de segurança: endereço IP e registro de ações administrativas, usados para auditoria e prevenção de fraude.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-medium text-graphite-900 dark:text-white mb-1">3. Para que usamos esses dados</h2>
              <p>
                Usamos os dados para criar e manter sua conta, agendar e prestar os serviços
                contratados, enviar lembretes e comunicações sobre seus agendamentos (e-mail,
                WhatsApp ou notificações do aplicativo), processar pagamentos, e manter registros
                de segurança e auditoria exigidos por lei.
              </p>
            </section>

            <section>
              <h2 className="font-medium text-graphite-900 dark:text-white mb-1">4. Base legal e consentimento</h2>
              <p>
                O tratamento dos seus dados pessoais é feito com base no seu consentimento
                explícito, dado no momento do cadastro (aceite dos termos LGPD), e no legítimo
                interesse necessário para a execução do serviço contratado.
              </p>
            </section>

            <section>
              <h2 className="font-medium text-graphite-900 dark:text-white mb-1">5. Com quem compartilhamos</h2>
              <p>
                Não vendemos nem compartilhamos seus dados com terceiros para fins de publicidade.
                Compartilhamos dados apenas com prestadores estritamente necessários para operar o
                serviço: processadores de pagamento (ex.: Stripe, Mercado Pago) e provedores de
                comunicação (e-mail, WhatsApp), sempre limitados ao necessário para cada
                finalidade.
              </p>
            </section>

            <section>
              <h2 className="font-medium text-graphite-900 dark:text-white mb-1">6. Por quanto tempo guardamos seus dados</h2>
              <p>
                Mantemos seus dados enquanto sua conta estiver ativa. Você pode solicitar a
                exclusão da sua conta e dos seus dados a qualquer momento pelos canais de contato
                abaixo — hoje esse pedido é processado manualmente pela nossa equipe, e
                confirmamos a conclusão por e-mail ou WhatsApp.
              </p>
            </section>

            <section>
              <h2 className="font-medium text-graphite-900 dark:text-white mb-1">7. Seus direitos</h2>
              <p>Conforme a LGPD, você pode solicitar a qualquer momento:</p>
              <ul className="list-disc pl-5 flex flex-col gap-1">
                <li>Confirmação de que tratamos seus dados, e acesso a eles;</li>
                <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
                <li>Exclusão dos seus dados pessoais;</li>
                <li>Portabilidade dos seus dados a outro fornecedor;</li>
                <li>Revogação do consentimento dado anteriormente.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-medium text-graphite-900 dark:text-white mb-1">8. Segurança</h2>
              <p>
                Senhas são armazenadas com hash criptográfico (bcrypt), a comunicação com nossos
                servidores é sempre criptografada (HTTPS), e o acesso aos dados é controlado por
                autenticação e permissões por papel (equipe x cliente x administrador).
              </p>
            </section>

            <section>
              <h2 className="font-medium text-graphite-900 dark:text-white mb-1">9. Fale conosco</h2>
              <p>
                Para exercer qualquer um dos seus direitos, ou tirar dúvidas sobre esta política,
                entre em contato{' '}
                {waHref ? (
                  <a href={waHref} target="_blank" rel="noopener noreferrer" className="text-primary-500 hover:underline">
                    pelo WhatsApp
                  </a>
                ) : (
                  'pelo WhatsApp informado no site'
                )}
                .
              </p>
            </section>
          </div>
        </Card>
      </div>
    </div>
  );
}
