# AP Auto Prime — Publicação na Play Store (Android via TWA)

Este app não é um projeto Android nativo — ele é o mesmo site (PWA) empacotado
como **Trusted Web Activity (TWA)**: um app Android que abre o site em tela
cheia, sem barra de navegador, usando o Chrome por baixo. É a forma mais
simples de publicar na Play Store sem escrever código Android, feita
inteiramente pelo navegador (PWABuilder), sem precisar instalar Android
Studio.

Toda a geração do pacote (`.aab`) é feita em https://pwabuilder.com — este
diretório só documenta as decisões e os passos manuais que dependem de você
(conta Google, chave de assinatura, textos da ficha da loja). Nenhuma etapa
automática publica nada sozinha.

## 1. Pré-requisitos (uma vez só)

- Conta de desenvolvedor Google Play: https://play.google.com/console —
  taxa única de US$25, pagamento no cartão.
- E-mail de suporte público (aparece na ficha da loja).
- Este repositório já tem os itens técnicos exigidos: manifest válido,
  service worker, ícones (192/512 + maskable), screenshots e política de
  privacidade em `/privacidade`.

## 2. Package name (identificador do app)

Sugestão: `app.autoprime.twa` — pode trocar por outro, mas **depois de
publicado na loja, o package name não pode mais mudar** (published a exclusão
e recriação do zero). Decida com calma antes do primeiro upload.

## 3. Gerar o pacote no PWABuilder

1. Acesse https://pwabuilder.com pelo navegador do celular ou computador.
2. Cole a URL do site: `https://truthful-empathy-production-e4ef.up.railway.app`
   (ou o domínio definitivo, se você configurar um antes de publicar).
3. Confirme que a análise mostra **0 erros** (os 2 avisos de service worker e
   screenshots já foram corrigidos nesta sessão).
4. Escolha a opção **Android** → preencha o package name (item 2) → gera o
   `.aab`.
5. O PWABuilder também gera, nesse processo, uma **chave de assinatura**
   (arquivo `.keystore` ou similar) e mostra o **SHA-256 fingerprint** dela.

**Guarde o arquivo da chave de assinatura em local seguro (ex.: Google
Drive privado, gerenciador de senhas).** Ele é indispensável para publicar
qualquer atualização futura do mesmo app — se for perdido, não tem como
recuperar, e o app precisaria ser republicado do zero como um app novo,
perdendo avaliações e histórico de instalações.

## 4. Digital Asset Links (obrigatório para abrir sem barra de navegador)

Sem esse passo, o app até abre, mas mostra a barra de endereço do Chrome por
cima — foi exatamente o que apareceu no print que você mandou antes. Pra
sumir de vez:

1. Pegue o **SHA-256 fingerprint** que o PWABuilder gerou no passo 3.
2. Edite o arquivo `autoprime/web/public/.well-known/assetlinks.json` neste
   repositório, substituindo:
   - `SUBSTITUIR_PELO_PACKAGE_NAME_REAL` → o package name do passo 2.
   - `SUBSTITUIR_PELO_FINGERPRINT_SHA256_REAL` → o fingerprint do passo 3.
3. Peça pra eu (Claude) fazer o commit e o push dessa alteração — like
   qualquer mudança de código, ela precisa passar pelo mesmo processo de
   revisão e deploy.
4. Depois do deploy, confirme que
   `https://SEU-DOMINIO/.well-known/assetlinks.json` abre e mostra o JSON
   preenchido (não o placeholder).

## 5. Testar antes de publicar

1. No Play Console, use a opção de **teste interno** (internal testing) —
   permite instalar o `.aab` no seu próprio celular antes de qualquer pessoa
   ver o app na loja pública.
2. Confirma que abre em tela cheia (sem barra de navegador), que login,
   cadastro e agendamento funcionam normalmente.

## 6. Ficha da loja (Play Console → "Store presence")

Itens obrigatórios que você preenche direto no Play Console (não é algo que
eu consiga preencher por você, pois exige decisões de negócio e acesso à sua
conta):

- **Ícone do app**: já pronto em `autoprime/web/public/icons/icon-512.png`.
- **Feature graphic** (banner 1024×500 da ficha): gerado em
  `autoprime/android-twa/feature-graphic.png` — pode usar direto ou ajustar.
- **Screenshots**: as mesmas já usadas no manifest
  (`autoprime/web/public/screenshots/`), ou tire novas direto do celular.
- **Política de Privacidade (URL obrigatória)**:
  `https://SEU-DOMINIO/privacidade` (página já criada nesta sessão).
- **Categoria**: sugestão "Negócios" ou "Estilo de vida".
- **Classificação de conteúdo**: questionário do próprio Play Console
  (App não tem conteúdo sensível — deve classificar como "Livre").

## 7. Data Safety ("Segurança dos dados")

Formulário obrigatório no Play Console declarando quais dados o app coleta.
Baseado no que o app realmente coleta hoje (ver `/privacidade` para o texto
completo), declare:

| Tipo de dado | Coletado? | Finalidade |
|---|---|---|
| Nome | Sim | Funcionalidade do app (conta) |
| E-mail | Sim | Conta, comunicação |
| Telefone | Sim | Conta, comunicação |
| CPF | Sim | Identificação do cliente |
| Endereço | Opcional | Cadastro do cliente |
| Localização | Não | — |
| Informações de pagamento | Sim (status, não o número do cartão) | Processar pagamento |
| Identificadores do dispositivo | Não | — |

Marque que os dados **não são vendidos a terceiros**, e que a criptografia em
trânsito (HTTPS) está ativa.

## 8. Publicar

Depois de preencher tudo acima e passar no teste interno, envie para revisão
("Enviar para revisão" no Play Console). A Google normalmente revisa em
algumas horas a poucos dias. **Eu não envio essa etapa por você** — é uma
ação irreversível de publicação pública que só você deve confirmar.

## O que já está pronto neste repositório

- [x] Manifest válido (`autoprime/web/public/manifest.json`)
- [x] Service worker registrado de forma síncrona (detectável por scanners)
- [x] Ícones 192/512 (normal e maskable)
- [x] Screenshots (mobile e desktop)
- [x] Política de privacidade (`/privacidade`)
- [x] Feature graphic (`feature-graphic.png`)
- [x] Pacote `.aab` gerado no PWABuilder — package name
      `app.railway.up.truthful_empathy_production_e4ef.twa`
- [x] Chave de assinatura gerada (guardada por você — `signing.keystore`)
- [x] `assetlinks.json` preenchido com o fingerprint real
- [ ] Conta de desenvolvedor Google Play
- [ ] Teste interno do `.aab` no seu celular
- [ ] Preencher ficha da loja e formulário de segurança de dados
- [ ] Envio para revisão (ação manual sua)

> Nota sobre o package name: como ele foi gerado a partir do domínio
> temporário do Railway (`truthful-empathy-production-e4ef...`), ficou com
> esse nome pouco legível. Isso não aparece pro usuário final (ele só vê o
> nome "AP Auto Prime" e o ícone), então não é um problema — mas se um dia
> você trocar para um domínio próprio, o pacote e os asset links precisam
> ser gerados de novo com o novo domínio.
