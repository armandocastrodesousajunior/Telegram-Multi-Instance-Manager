# Telegram Multi-Instance Manager

**Telegram Multi-Instance Manager** é uma solução completa em infraestrutura para empresas e desenvolvedores que precisam gerenciar múltiplas sessões do Telegram de forma centralizada e controlada.

Seja para disparo de mensagens, gerenciamento automatizado de grupos, ou integração do seu CRM ao Telegram, este projeto unifica múltiplas instâncias (contas do Telegram) sob uma única API (Application Programming Interface), garantindo o paralelismo e estabilidade através do PostgreSQL e de um container Docker otimizado.

---

## 🌟 Principais Recursos

- **Suporte Multicontas**: Faça o pareamento por QR Code ou Número de Telefone e gerencie quantas instâncias quiser a partir de um único painel.
- **Painel Glassmorphism Elegante**: A interface de usuário (UI) não é só funcional; é responsiva, animada e projetada para as mais recentes diretrizes de usabilidade moderna.
- **API Pública e Privada**: Permite integrações limpas, oferecendo endpoints robustos com autenticação protegida por tokens de segurança (Bearer Tokens).
- **Simulação Humana de Digitação (Typing Simulation)**: Permite configurar por quantos milissegundos a sua conta simulará `Escrevendo...`, `Gravando Áudio...` e `Gravando Vídeo...` antes do envio, para não ser pego nos algoritmos de anti-spam do Telegram!
- **Envios de "Visualização Única" (View-Once)**: Envie imagens e vídeos que desaparecem automaticamente após o destinatário visualizar — direto pela API.
- **Webhook Events**: Toda mensagem recebida, edição e interação nas suas instâncias configuradas pode ser enviada por Webhook para servidores e CRMs externos em tempo real.
- **PostgreSQL Ready**: Utiliza o PostgreSQL em uma arquitetura de banco conteinerizado, permitindo migração de dados à prova de falhas em grandes fluxos.

---

## 🛠 Arquitetura e Tecnologias
- **Frontend & Backend**: Construído inteiramente com **Next.js 15 (App Router)** usando TypeScript.
- **Protocolo MTProto**: Usa o [GramJS](https://painor.gitbook.io/gramjs/) no coração do servidor para a comunicação em tempo real com a infraestrutura nativa do Telegram.
- **Banco de Dados**: [PostgreSQL 15](https://www.postgresql.org/) para a guarda unificada das configurações.
- **ORM**: [Prisma](https://www.prisma.io/) como ponte tipada para as tabelas de Instâncias e Webhooks.
- **Deploy**: Imagem Docker Otimizada (Modo *Standalone*), compactando módulos NPM apenas aos que são essenciais, executando num SO *Alpine Linux*.

---

## 🚀 Como Iniciar

1. Certifique-se de que o seu [Docker Desktop](https://www.docker.com/) (ou Engine) está instalado e ativo.
2. Acesse [my.telegram.org](https://my.telegram.org) para obter as suas credenciais (`api_id` e `api_hash`).
3. Renomeie o arquivo `.env.example` para `.env` e preencha as credenciais.
4. Rode no terminal:

```bash
docker-compose -f docker-compose-local.yml up -d --build
```

O Docker baixará o PostgreSQL e compilará o painel. Após o término, o acesso estará disponível em **http://localhost:3000**.

---

## 🎥 Dica de Otimização de Vídeos

Se você for realizar disparos de vídeos muito grandes (como 15MB+), recomendamos fortemente que os vídeos estejam "Otimizados para a Web" (*Fast Start*). Caso contrário, os servidores da API do Telegram podem falhar ao tentar ler os metadados do seu vídeo e retornar o erro `WEBPAGE_CURL_FAILED`.

Para otimizar e comprimir seus vídeos automaticamente de forma fácil e em lote, sugerimos utilizar o **[HandBrake](https://handbrake-online.com/)**.
Basta importar os seus vídeos, marcar a caixinha **"Web Optimized"** e exportar. Os seus vídeos ficarão mais leves e serão entregues pelo Telegram de forma instantânea!

---

## 📖 Documentação da API

Quando você estiver logado no painel usando sua chave mestre (`ACCESS_TOKEN`), você poderá clicar no botão **"API Docs"** diretamente no sistema. 

Lá você encontrará guias interativos, exemplos de `cURL` e bibliotecas `Node.js` para enviar e receber mensagens de forma programática. Todo o endpoint é auto-explicativo e pode ser testado dentro da própria tela de documentação.

---

*Gerencie em alto nível. Envie em escala.*
