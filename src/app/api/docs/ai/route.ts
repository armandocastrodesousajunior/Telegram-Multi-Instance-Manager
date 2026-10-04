import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const section = searchParams.get('section') || 'all'; // 'endpoints' | 'webhooks' | 'all'
  const event = searchParams.get('event') || '';
  const endpoint = searchParams.get('endpoint') || '';
  const format = searchParams.get('format') || 'markdown'; // 'markdown' | 'json'

  const origin = process.env.PUBLIC_URL || 'https://telegram-multi-instance-manager-production.up.railway.app';

  // ── Documentação dos Webhooks ───────────────────────────────────────────────
  const webhookDocs: Record<string, any> = {
    overview: {
      name: "Visão Geral dos Webhooks",
      event: "*",
      description: "Arquitetura de entrega HTTP POST, envelope raiz e diretrizes de integração.",
      delivery: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        response: "HTTP 200 OK em menos de 5 segundos."
      },
      envelope: {
        event: "Nome do evento disparado (string)",
        instanceId: "UUID único da instância (string)",
        instanceName: "Nome de exibição da instância (string)",
        language: "Idioma configurado (ex: pt-BR)",
        connection: {
          endpoint: "URL base da API do manager para requisições de resposta",
          token: "Bearer Token da instância para autenticação"
        },
        data: "Objeto com os dados do evento específico"
      }
    },
    message: {
      name: "Nova Mensagem",
      event: "message",
      description: "Disparado quando uma nova mensagem é recebida do lead ou enviada pela instância. Suporta texto e todos os tipos de mídia.",
      parameters: [
        { field: "id", type: "number", description: "ID numérico da mensagem no Telegram" },
        { field: "type", type: "string", description: "Tipo de mensagem: 'text', 'image', 'view_once_image', 'video', 'view_once_video', 'audio', 'view_once_audio', 'voice', 'view_once_voice', 'gif', 'sticker', 'document', 'unknown'" },
        { field: "content", type: "string", description: "Texto da mensagem ou legenda (caption) da mídia" },
        { field: "senderId", type: "string", description: "ID numérico do remetente no Telegram" },
        { field: "chatId", type: "string", description: "ID numérico do chat/conversa no Telegram" },
        { field: "date", type: "number", description: "Timestamp Unix em segundos do envio da mensagem" },
        { field: "isOutgoing", type: "boolean", description: "false se veio do lead; true se foi enviada pela sua própria instância" },
        { field: "mediaUrl", type: "string | null", description: "URL pública para download direto da mídia via streaming. null para texto" }
      ],
      samplePayload: {
        event: "message",
        instanceId: "3a7f9dbb-6952-4663-974a-8230028d070c",
        instanceName: "Sarinha 🔥",
        language: "pt-BR",
        connection: { endpoint: origin, token: "api_token_aqui" },
        data: {
          id: 14205,
          type: "text",
          content: "Olá! Gostaria de saber mais informações.",
          senderId: "8769981356",
          chatId: "8769981356",
          date: 1729000000,
          isOutgoing: false,
          mediaUrl: null
        }
      }
    },
    edited_message: {
      name: "Mensagem Editada",
      event: "edited_message",
      description: "Disparado quando o remetente edita o conteúdo ou legenda de uma mensagem anterior.",
      parameters: [
        { field: "id", type: "number", description: "ID numérico da mensagem editada" },
        { field: "type", type: "string", description: "Tipo de conteúdo da mensagem" },
        { field: "content", type: "string", description: "Texto ou legenda atualizada após edição" },
        { field: "senderId", type: "string", description: "ID do remetente que realizou a edição" },
        { field: "chatId", type: "string", description: "ID do chat" },
        { field: "date", type: "number", description: "Timestamp Unix da mensagem" },
        { field: "isOutgoing", type: "boolean", description: "Se foi mensagem de saída (true) ou entrada (false)" },
        { field: "mediaUrl", type: "string | null", description: "URL de mídia se aplicável" }
      ]
    },
    deleted_message: {
      name: "Mensagem Deletada",
      event: "deleted_message",
      description: "Disparado quando uma ou mais mensagens são apagadas no chat por qualquer participante.",
      parameters: [
        { field: "messages", type: "number[]", description: "Array contendo os IDs numéricos de todas as mensagens apagadas" },
        { field: "channelId", type: "string | null", description: "ID do canal se ocorreu em canal/supergrupo, null para privado" }
      ]
    },
    "chat.typing": {
      name: "Digitando...",
      event: "chat.typing",
      description: "Notificação em tempo real de que o lead começou a digitar texto no chat.",
      parameters: [
        { field: "userId", type: "string", description: "ID do usuário executando a ação" },
        { field: "chatId", type: "string", description: "ID do chat onde ocorre a digitação" },
        { field: "action", type: "string", description: "Classe da ação: 'SendMessageTypingAction'" }
      ]
    },
    "chat.recording_audio": {
      name: "Gravando Áudio",
      event: "chat.recording_audio",
      description: "Notificação de que o lead está gravando uma mensagem de voz no microfone.",
      parameters: [
        { field: "userId", type: "string", description: "ID do usuário" },
        { field: "chatId", type: "string", description: "ID do chat" },
        { field: "action", type: "string", description: "Classe da ação: 'SendMessageRecordAudioAction'" }
      ]
    },
    "chat.uploading_photo": {
      name: "Enviando Foto",
      event: "chat.uploading_photo",
      description: "Notificação de que o lead está carregando uma imagem para enviar.",
      parameters: [
        { field: "userId", type: "string", description: "ID do usuário" },
        { field: "chatId", type: "string", description: "ID do chat" },
        { field: "action", type: "string", description: "Classe da ação: 'SendMessageUploadPhotoAction'" }
      ]
    },
    "chat.uploading_video": {
      name: "Enviando Vídeo",
      event: "chat.uploading_video",
      description: "Notificação de que o lead está gravando ou fazendo upload de um vídeo.",
      parameters: [
        { field: "userId", type: "string", description: "ID do usuário" },
        { field: "chatId", type: "string", description: "ID do chat" },
        { field: "action", type: "string", description: "Classe da ação: 'SendMessageUploadVideoAction'" }
      ]
    },
    "chat.uploading_document": {
      name: "Enviando Documento",
      event: "chat.uploading_document",
      description: "Notificação de que o lead está anexando um arquivo/documento.",
      parameters: [
        { field: "userId", type: "string", description: "ID do usuário" },
        { field: "chatId", type: "string", description: "ID do chat" },
        { field: "action", type: "string", description: "Classe da ação: 'SendMessageUploadDocumentAction'" }
      ]
    },
    "call.ringing": {
      name: "Chamada Tocando",
      event: "call.ringing",
      description: "Disparado no momento em que a ligação começa a tocar no aparelho do lead.",
      parameters: [
        { field: "callId", type: "string", description: "ID único da chamada no protocolo MTProto" },
        { field: "chatId", type: "string", description: "Telefone ou chat ID do destinatário" },
        { field: "durationSeconds", type: "number", description: "Duração planejada após o atendimento (padrão: 5s)" },
        { field: "timeoutSeconds", type: "number", description: "Tempo limite tocando antes de desistir (padrão: 30s)" },
        { field: "status", type: "string", description: "'ringing'" },
        { field: "initiatedAt", type: "number", description: "Timestamp em ms do início da chamada" }
      ]
    },
    "call.accepted": {
      name: "Chamada Atendida",
      event: "call.accepted",
      description: "Disparado no exato milissegundo em que o lead atende a ligação no celular.",
      parameters: [
        { field: "callId", type: "string", description: "ID único da chamada" },
        { field: "chatId", type: "string", description: "Destinatário que atendeu" },
        { field: "durationSeconds", type: "number", description: "Duração planejada da conexão (padrão: 5s)" },
        { field: "status", type: "string", description: "'accepted'" },
        { field: "answeredAt", type: "number", description: "Timestamp em ms do momento do atendimento" }
      ]
    },
    "call.completed": {
      name: "Chamada Completa (100%)",
      event: "call.completed",
      description: "Disparado quando a ligação permaneceu conectada até o tempo planejado (ex: 5s) e foi desligada automaticamente pelo sistema com sucesso.",
      parameters: [
        { field: "callId", type: "string", description: "ID único da chamada" },
        { field: "chatId", type: "string", description: "Destinatário" },
        { field: "answered", type: "boolean", description: "true" },
        { field: "status", type: "string", description: "'completed'" },
        { field: "durationSeconds", type: "number", description: "Duração real da chamada em segundos" },
        { field: "plannedDurationSeconds", type: "number", description: "Duração planejada (padrão: 5s)" },
        { field: "completedFullDuration", type: "boolean", description: "true" },
        { field: "hungUpBy", type: "string", description: "'caller' (nossa instância desligou)" },
        { field: "disconnectReason", type: "string", description: "'hangup'" },
        { field: "initiatedAt", type: "number", description: "Timestamp de início" },
        { field: "answeredAt", type: "number", description: "Timestamp de atendimento" },
        { field: "endedAt", type: "number", description: "Timestamp de encerramento" }
      ]
    },
    "call.abandoned": {
      name: "Chamada Abandonada",
      event: "call.abandoned",
      description: "Disparado quando o lead atendeu, mas desligou antes do tempo planejado terminar.",
      parameters: [
        { field: "callId", type: "string", description: "ID único da chamada" },
        { field: "chatId", type: "string", description: "Destinatário" },
        { field: "answered", type: "boolean", description: "true" },
        { field: "status", type: "string", description: "'abandoned'" },
        { field: "durationSeconds", type: "number", description: "Tempo real em segundos conectado antes do lead desligar" },
        { field: "hungUpBy", type: "string", description: "'recipient' (o lead desligou)" }
      ]
    },
    "call.declined": {
      name: "Chamada Recusada",
      event: "call.declined",
      description: "Disparado quando o lead recusou ativamente a ligação ou sua linha estava ocupada.",
      parameters: [
        { field: "callId", type: "string", description: "ID único da chamada" },
        { field: "chatId", type: "string", description: "Destinatário" },
        { field: "answered", type: "boolean", description: "false" },
        { field: "status", type: "string", description: "'declined'" },
        { field: "disconnectReason", type: "string", description: "'busy'" }
      ]
    },
    "call.missed": {
      name: "Chamada Não Atendida",
      event: "call.missed",
      description: "Disparado quando a chamada tocou até o tempo limite sem atendimento.",
      parameters: [
        { field: "callId", type: "string", description: "ID único da chamada" },
        { field: "chatId", type: "string", description: "Destinatário" },
        { field: "answered", type: "boolean", description: "false" },
        { field: "status", type: "string", description: "'missed'" },
        { field: "disconnectReason", type: "string", description: "'missed'" }
      ]
    },
    "call.ended": {
      name: "Chamada Finalizada (Consolidado)",
      event: "call.ended",
      description: "Evento consolidado disparado ao término de toda chamada telefônica com telemetria completa.",
      parameters: [
        { field: "callId", type: "string", description: "ID da chamada" },
        { field: "chatId", type: "string", description: "Destinatário" },
        { field: "answered", type: "boolean", description: "Se o lead atendeu ou não" },
        { field: "status", type: "string", description: "'completed' | 'abandoned' | 'declined' | 'missed'" },
        { field: "durationSeconds", type: "number", description: "Tempo de conexão em segundos" },
        { field: "plannedDurationSeconds", type: "number", description: "Tempo planejado da chamada" },
        { field: "completedFullDuration", type: "boolean", description: "Se completou o tempo total" },
        { field: "hungUpBy", type: "string", description: "'caller' ou 'recipient'" },
        { field: "disconnectReason", type: "string", description: "'hangup' | 'busy' | 'missed' | 'disconnect'" },
        { field: "initiatedAt", type: "number", description: "Início" },
        { field: "answeredAt", type: "number | null", description: "Atendimento" },
        { field: "endedAt", type: "number", description: "Término" }
      ]
    }
  };

  // ── Documentação dos Endpoints REST ─────────────────────────────────────────
  const endpointDocs: Record<string, any> = {
    text: {
      name: "Send Text",
      method: "POST",
      url: `${origin}/api/v1/:instanceId/send/text`,
      description: "Envia uma mensagem de texto simples ou formatada com simulação de digitação.",
      body: [
        { field: "chatId", type: "string | number", required: true, description: "Telefone com DDI/DDD, @username ou chat ID numérico" },
        { field: "text", type: "string", required: true, description: "Texto da mensagem a ser enviada" },
        { field: "parseMode", type: "string", required: false, description: "'html' ou 'md' (Markdown)" },
        { field: "replyToMsgId", type: "number", required: false, description: "ID da mensagem para responder (reply)" }
      ]
    },
    image: {
      name: "Send Image",
      method: "POST",
      url: `${origin}/api/v1/:instanceId/send/image`,
      description: "Envia uma foto/imagem com suporte a legenda e modo visualização única (View-Once).",
      body: [
        { field: "chatId", type: "string | number", required: true, description: "Destinatário" },
        { field: "url", type: "string", required: true, description: "URL direta da imagem" },
        { field: "caption", type: "string", required: false, description: "Legenda opcional" },
        { field: "viewOnce", type: "boolean", required: false, description: "Se true, autodestrói após visualização" },
        { field: "parseMode", type: "string", required: false, description: "'html' ou 'md'" }
      ]
    },
    video: {
      name: "Send Video",
      method: "POST",
      url: `${origin}/api/v1/:instanceId/send/video`,
      description: "Envia um vídeo MP4 com simulação de envio e suporte a View-Once.",
      body: [
        { field: "chatId", type: "string | number", required: true, description: "Destinatário" },
        { field: "url", type: "string", required: true, description: "URL direta do vídeo MP4" },
        { field: "caption", type: "string", required: false, description: "Legenda opcional" },
        { field: "viewOnce", type: "boolean", required: false, description: "Se true, autodestrói após visualização" }
      ]
    },
    voice: {
      name: "Send Voice Note",
      method: "POST",
      url: `${origin}/api/v1/:instanceId/send/voice`,
      description: "Envia um áudio gravado no microfone (Voice Note) com simulação de gravando áudio.",
      body: [
        { field: "chatId", type: "string | number", required: true, description: "Destinatário" },
        { field: "url", type: "string", required: true, description: "URL do áudio (MP3, OGG, etc.)" }
      ]
    },
    call: {
      name: "Phone Call (Ligação MTProto)",
      method: "POST",
      url: `${origin}/api/v1/:instanceId/call`,
      description: "Inicia uma ligação telefônica via conta pessoal da instância. Toca no aparelho do lead, conecta, aguarda 5 segundos (ou durationSeconds) e desliga automaticamente com telemetria completa.",
      body: [
        { field: "chatId", type: "string | number", required: true, description: "Telefone com DDI/DDD (ex: 5511999999999) ou @username" },
        { field: "durationSeconds", type: "number", required: false, description: "Tempo em segundos conectado após atendimento antes de desligar (padrão: 5)" },
        { field: "timeoutSeconds", type: "number", required: false, description: "Tempo limite tocando antes de considerar missed (padrão: 30)" },
        { field: "video", type: "boolean", required: false, description: "Se true, toca com ícone de chamada de vídeo (padrão: false)" }
      ]
    }
  };

  if (format === 'json') {
    return NextResponse.json({
      section,
      event,
      endpoint,
      webhooks: section === 'endpoints' ? undefined : (event && webhookDocs[event] ? { [event]: webhookDocs[event] } : webhookDocs),
      endpoints: section === 'webhooks' ? undefined : (endpoint && endpointDocs[endpoint] ? { [endpoint]: endpointDocs[endpoint] } : endpointDocs)
    });
  }

  // ── Renderização em Markdown Limpo para Leitura por IA / LLM ───────────────
  let md = `# Hot Telegram API & Webhook Technical Reference\n\n`;
  md += `> Documentação gerada para análise por modelos de IA e LLMs.\n`;
  md += `> Base URL: ${origin}\n\n`;

  // Se a consulta for sobre um evento específico de webhook:
  const normalizedEvent = event.replace(/^wh-/, '');
  if (normalizedEvent && webhookDocs[normalizedEvent]) {
    const item = webhookDocs[normalizedEvent];
    md += `## Webhook Event: \`${item.event}\` (${item.name})\n\n`;
    md += `**Descrição:** ${item.description}\n\n`;
    md += `### Formato de Entrega HTTP\n`;
    md += `- **Método:** POST\n`;
    md += `- **Headers:** \`Content-Type: application/json\`\n`;
    md += `- **Resposta Requerida:** HTTP 200 OK em menos de 5s\n\n`;
    md += `### Estrutura do Envelope Raiz\n`;
    md += `Todo webhook é entregue no formato:\n`;
    md += `\`\`\`json
{
  "event": "${item.event}",
  "instanceId": "UUID-da-instancia",
  "instanceName": "Nome da Instância",
  "language": "pt-BR",
  "connection": {
    "endpoint": "${origin}",
    "token": "bearer_token_da_instancia"
  },
  "data": { ... }
}
\`\`\`\n\n`;

    if (item.parameters) {
      md += `### Campos do Objeto \`data\`:\n\n`;
      md += `| Campo | Tipo | Descrição |\n`;
      md += `| :--- | :--- | :--- |\n`;
      for (const p of item.parameters) {
        md += `| \`${p.field}\` | \`${p.type}\` | ${p.description} |\n`;
      }
      md += `\n`;
    }

    if (item.samplePayload) {
      md += `### Exemplo Completo de Payload:\n\n`;
      md += `\`\`\`json\n${JSON.stringify(item.samplePayload, null, 2)}\n\`\`\`\n\n`;
    }

    return new NextResponse(md, {
      status: 200,
      headers: { 'Content-Type': 'text/markdown; charset=utf-8' }
    });
  }

  // Se a consulta for sobre um endpoint específico da API:
  if (endpoint && endpointDocs[endpoint]) {
    const item = endpointDocs[endpoint];
    md += `## Endpoint REST: \`${item.method} ${item.url}\`\n\n`;
    md += `**Nome:** ${item.name}\n\n`;
    md += `**Descrição:** ${item.description}\n\n`;
    md += `### Headers Necessários:\n`;
    md += `- \`Authorization: Bearer <API_TOKEN>\`\n`;
    md += `- \`Content-Type: application/json\`\n\n`;
    md += `### Parâmetros do Body (JSON):\n\n`;
    md += `| Campo | Tipo | Obrigatório | Descrição |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;
    for (const b of item.body) {
      md += `| \`${b.field}\` | \`${b.type}\` | ${b.required ? 'Sim' : 'Não'} | ${b.description} |\n`;
    }
    md += `\n`;

    return new NextResponse(md, {
      status: 200,
      headers: { 'Content-Type': 'text/markdown; charset=utf-8' }
    });
  }

  // Documentação Completa (Geral)
  if (section === 'webhooks' || section === 'all') {
    md += `## ⚡ Seção de Webhooks\n\n`;
    md += `Todos os webhooks são despachados via HTTP POST com o envelope padrão contendo \`event\`, \`instanceId\`, \`instanceName\`, \`connection\` e \`data\`.\n\n`;

    for (const [key, item] of Object.entries(webhookDocs)) {
      md += `### Evento: \`${item.event}\` - ${item.name}\n`;
      md += `- **Descrição:** ${item.description}\n`;
      if (item.parameters) {
        md += `- **Parâmetros em \`data\`:**\n`;
        for (const p of item.parameters) {
          md += `  - \`${p.field}\` (${p.type}): ${p.description}\n`;
        }
      }
      md += `\n`;
    }
  }

  if (section === 'endpoints' || section === 'all') {
    md += `## 🚀 Seção de Endpoints REST\n\n`;
    for (const [key, item] of Object.entries(endpointDocs)) {
      md += `### \`${item.method} ${item.url}\`\n`;
      md += `- **Descrição:** ${item.description}\n`;
      md += `- **Body:**\n`;
      for (const b of item.body) {
        md += `  - \`${b.field}\` (${b.type}, ${b.required ? 'obrigatório' : 'opcional'}): ${b.description}\n`;
      }
      md += `\n`;
    }
  }

  return new NextResponse(md, {
    status: 200,
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' }
  });
}
