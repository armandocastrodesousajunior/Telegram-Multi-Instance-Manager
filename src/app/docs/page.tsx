"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  Book, 
  Code, 
  Terminal, 
  Play, 
  MessageSquare, 
  Image as ImageIcon, 
  Video, 
  FileText, 
  Mic, 
  Music, 
  PhoneCall,
  Webhook,
  Activity,
  Radio,
  CheckCircle2,
  PhoneForwarded,
  PhoneMissed,
  PhoneOff,
  PhoneIncoming,
  Trash2,
  Edit3,
  Layers
} from "lucide-react";

export default function DocsPage() {
  const [docSection, setDocSection] = useState<"endpoints" | "webhooks">("endpoints");
  const [activeTab, setActiveTab] = useState("text");
  const [activeWebhook, setActiveWebhook] = useState("overview");
  const [origin, setOrigin] = useState("https://your-domain.com");

  // Test Runner States (para API REST)
  const [testInstanceId, setTestInstanceId] = useState("");
  const [testApiToken, setTestApiToken] = useState("");
  const [testPayload, setTestPayload] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [testResponse, setTestResponse] = useState<any>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  // ── Endpoints REST ──────────────────────────────────────────────────────────
  const endpoints = [
    { id: "text", label: "Send Text", icon: MessageSquare },
    { id: "image", label: "Send Image", icon: ImageIcon },
    { id: "video", label: "Send Video", icon: Video },
    { id: "audio", label: "Send Audio", icon: Music },
    { id: "voice", label: "Send Voice Note", icon: Mic },
    { id: "document", label: "Send Document", icon: FileText },
    { id: "smart", label: "Smart Flow", icon: Play },
    { id: "call", label: "Phone Call", icon: PhoneCall },
  ];

  const getEndpointData = (id: string) => {
    if (id === "call") {
      const baseUrl = `${origin}/api/v1/[instanceId]/call`;
      const payloadFields = [
        { name: "chatId", type: "string | number", description: "O telefone (ex: 5511999999999), @username ou ID numérico do destinatário.", required: true },
        { name: "timeoutSeconds", type: "number", description: "Tempo máximo em segundos tocando até considerar não atendida (padrão: 30).", required: false },
        { name: "durationSeconds", type: "number", description: "Tempo em segundos conectado após o lead atender antes de desligar automaticamente (padrão: 5).", required: false },
        { name: "video", type: "boolean", description: "Se true, a chamada toca com indicação de chamada de vídeo na tela do lead (padrão: false).", required: false },
      ];
      const exampleJson = {
        chatId: "5511999999999",
        durationSeconds: 5,
        timeoutSeconds: 30,
        video: false
      };
      return { baseUrl, payloadFields, exampleJson };
    }

    const baseUrl = `${origin}/api/v1/[instanceId]/send/${id}`;
    const payloadFields: any[] = [
      { name: "chatId", type: "string | number", description: "O número de telefone, username (@) ou chat ID de destino.", required: true },
    ];
    
    if (id === "text") {
      payloadFields.push({ name: "text", type: "string", description: "Texto da mensagem a ser enviada.", required: true });
    } else if (id === "smart") {
      payloadFields.push({ name: "content", type: "string", description: "Texto dinâmico interpolado com tags de mídia (ex: <voice url='...'></voice> ou <image url='...'></image>).", required: true });
    } else {
      payloadFields.push({ name: "url", type: "string", description: `URL pública e acessível do arquivo de ${id}.`, required: true });
      if (id !== "voice") {
        payloadFields.push({ name: "caption", type: "string", description: "Legenda opcional anexada à mídia.", required: false });
      }
      if (id === "image" || id === "video") {
        payloadFields.push({ name: "viewOnce", type: "boolean", description: "Se true, envia como mídia de visualização única (autodestrói após visualizada).", required: false });
      }
    }
    
    if (id === "text" || id === "image" || id === "video" || id === "document" || id === "smart") {
      payloadFields.push({ name: "parseMode", type: "string", description: 'Modo de formatação do texto/legenda. Use "html" ou "md" (Markdown).', required: false });
    }
    
    payloadFields.push({ name: "replyToMsgId", type: "number", description: "ID de uma mensagem anterior para responder diretamente (Reply).", required: false });

    const exampleJson: any = { chatId: "5511999999999" };
    if (id === "text") {
      exampleJson.text = "Olá! Tudo bem? Segue sua mensagem.";
      exampleJson.parseMode = "html";
    } else if (id === "smart") {
      exampleJson.content = "Oi amor! Olha isso aqui:\n\n<voice url=\"https://example.com/audio.mp3\"></voice>\n\nVocê gostou?";
      exampleJson.parseMode = "html";
    } else {
      exampleJson.url = `https://example.com/arquivo.${id === "image" ? "jpg" : id === "video" ? "mp4" : "mp3"}`;
      if (id !== "voice") exampleJson.caption = "Confira este arquivo!";
      if (id === "image" || id === "video") exampleJson.viewOnce = true;
    }

    return { baseUrl, payloadFields, exampleJson };
  };

  const currentEndpointData = getEndpointData(activeTab);

  // ── Lista Completa de Webhook Events ────────────────────────────────────────
  const webhookCategories = [
    {
      name: "Visão Geral",
      items: [
        { id: "overview", label: "Arquitetura & Envelope", icon: Layers, event: "" }
      ]
    },
    {
      name: "Mensagens (Messages)",
      items: [
        { id: "wh-message", label: "message", icon: MessageSquare, event: "message" },
        { id: "wh-edited-message", label: "edited_message", icon: Edit3, event: "edited_message" },
        { id: "wh-deleted-message", label: "deleted_message", icon: Trash2, event: "deleted_message" }
      ]
    },
    {
      name: "Ações de Chat & Digitação",
      items: [
        { id: "wh-chat-typing", label: "chat.typing", icon: Activity, event: "chat.typing" },
        { id: "wh-chat-recording-audio", label: "chat.recording_audio", icon: Mic, event: "chat.recording_audio" },
        { id: "wh-chat-uploading-photo", label: "chat.uploading_photo", icon: ImageIcon, event: "chat.uploading_photo" },
        { id: "wh-chat-uploading-video", label: "chat.uploading_video", icon: Video, event: "chat.uploading_video" },
        { id: "wh-chat-uploading-document", label: "chat.uploading_document", icon: FileText, event: "chat.uploading_document" }
      ]
    },
    {
      name: "Ligações & Telemetria",
      items: [
        { id: "wh-call-ringing", label: "call.ringing", icon: Radio, event: "call.ringing" },
        { id: "wh-call-accepted", label: "call.accepted", icon: PhoneIncoming, event: "call.accepted" },
        { id: "wh-call-completed", label: "call.completed", icon: CheckCircle2, event: "call.completed" },
        { id: "wh-call-abandoned", label: "call.abandoned", icon: PhoneOff, event: "call.abandoned" },
        { id: "wh-call-declined", label: "call.declined", icon: PhoneMissed, event: "call.declined" },
        { id: "wh-call-missed", label: "call.missed", icon: PhoneForwarded, event: "call.missed" },
        { id: "wh-call-ended", label: "call.ended (Consolidado)", icon: PhoneCall, event: "call.ended" }
      ]
    }
  ];

  // ── Dados Detalhados de Cada Webhook ────────────────────────────────────────
  const getWebhookData = (id: string) => {
    switch (id) {
      case "overview":
        return {
          title: "Webhooks: Visão Geral & Arquitetura de Entrega",
          eventName: "Todos os Webhooks",
          badgeColor: "var(--accent-color)",
          description: "Os webhooks permitem que a sua aplicação receba notificações em tempo real sempre que mensagens, mídias, ações do usuário (como digitar ou gravar áudio) ou eventos de chamadas telefônicas ocorrerem em qualquer instância conectada.",
          deliveryInfo: {
            method: "POST",
            headers: { "Content-Type": "application/json", "User-Agent": "HotTelegram-WebhookDispatcher/1.0" },
            responseRequirement: "Sua URL receptora deve responder com código HTTP 200 OK em até 5 segundos.",
            filterInfo: "No painel de configuração do webhook, você pode filtrar os eventos desejados e escolher se deseja incluir mensagens de saída (enviadas pela própria instância) com a opção 'includeOutgoing'."
          },
          envelopeFields: [
            { name: "event", type: "string", description: "O nome exato do evento disparado (ex: 'message', 'chat.typing', 'call.accepted')." },
            { name: "instanceId", type: "string (UUID)", description: "O ID único da instância no sistema que gerou o evento." },
            { name: "instanceName", type: "string", description: "O nome de identificação da instância configurado no dashboard (ex: 'Sarinha', 'Comercial 01')." },
            { name: "language", type: "string", description: "O idioma configurado na instância (ex: 'pt-BR', 'en-US', 'es-ES')." },
            { name: "connection.endpoint", type: "string (URL)", description: "A URL base da API deste manager. Permite que sua aplicação faça requisições de volta sem precisar hardcodar a URL do servidor." },
            { name: "connection.token", type: "string", description: "O Bearer API Token da instância para autenticar chamadas de resposta à API." },
            { name: "data", type: "object", description: "O objeto contendo os dados específicos do evento (veja os detalhes de cada evento no menu ao lado)." }
          ],
          exampleJson: {
            event: "message",
            instanceId: "3a7f9dbb-6952-4663-974a-8230028d070c",
            instanceName: "Sarinha 🔥",
            language: "pt-BR",
            connection: {
              endpoint: "https://telegram-multi-instance-manager-production.up.railway.app",
              token: "e7b0a829-4fc1-4d39-953b-e015acb98192"
            },
            data: {
              id: 14205,
              type: "text",
              content: "Olá, gostaria de saber mais informações!",
              senderId: "8769981356",
              chatId: "8769981356",
              date: 1729000000,
              isOutgoing: false,
              mediaUrl: null
            }
          }
        };

      case "wh-message":
        return {
          title: "Evento: message (Nova Mensagem)",
          eventName: "message",
          badgeColor: "#60a5fa",
          description: "Disparado sempre que uma nova mensagem chega no chat (enviada pelo lead ou enviada pela própria instância). Contém suporte completo a textos e todos os formatos de mídia do Telegram.",
          fields: [
            { name: "id", type: "number", description: "ID único numérico da mensagem dentro do chat no Telegram." },
            { 
              name: "type", 
              type: "string", 
              description: "Tipo de mensagem detectado: 'text' (texto simples), 'image' (foto), 'view_once_image' (foto autodestrutiva), 'video' (vídeo), 'view_once_video' (vídeo autodestrutivo), 'audio' (música/áudio), 'view_once_audio' (áudio autodestrutivo), 'voice' (nota de voz/microfone), 'view_once_voice' (voz autodestrutiva), 'gif' (animação GIF), 'sticker' (figurinha), 'document' (arquivo genérico), 'unknown'." 
            },
            { name: "content", type: "string", description: "O texto da mensagem de texto, ou a legenda (caption) da mídia enviada." },
            { name: "senderId", type: "string", description: "ID numérico do Telegram do usuário que enviou a mensagem." },
            { name: "chatId", type: "string", description: "ID numérico do chat/conversa no Telegram." },
            { name: "date", type: "number", description: "Timestamp Unix (em segundos) do envio da mensagem." },
            { name: "isOutgoing", type: "boolean", description: "false se a mensagem veio do lead para você; true se foi enviada pela sua própria instância." },
            { name: "mediaUrl", type: "string | null", description: "URL pública e direta para baixar o arquivo de mídia via streaming seguro do Telegram. null caso seja apenas mensagem de texto." }
          ],
          exampleJson: {
            event: "message",
            instanceId: "3a7f9dbb-6952-4663-974a-8230028d070c",
            instanceName: "Sarinha 🔥",
            language: "pt-BR",
            connection: {
              endpoint: "https://seu-dominio.up.railway.app",
              token: "e7b0a829-4fc1-4d39-953b-e015acb98192"
            },
            data: {
              id: 98124,
              type: "view_once_video",
              content: "olha esse vídeo que gravei para você...",
              senderId: "8769981356",
              chatId: "8769981356",
              date: 1729000120,
              isOutgoing: false,
              mediaUrl: "https://seu-dominio.up.railway.app/api/v1/3a7f9dbb-6952-4663-974a-8230028d070c/messages/8769981356/98124/media"
            }
          }
        };

      case "wh-edited-message":
        return {
          title: "Evento: edited_message (Mensagem Editada)",
          eventName: "edited_message",
          badgeColor: "#38bdf8",
          description: "Disparado quando o remetente edita o texto ou a legenda de uma mensagem que já havia sido enviada anteriormente.",
          fields: [
            { name: "id", type: "number", description: "ID numérico da mensagem que foi editada." },
            { name: "type", type: "string", description: "Tipo da mensagem (ex: 'text', 'image', etc.)." },
            { name: "content", type: "string", description: "O novo texto ou legenda após a edição realizada pelo usuário." },
            { name: "senderId", type: "string", description: "ID numérico do Telegram de quem editou." },
            { name: "chatId", type: "string", description: "ID numérico do chat onde a edição ocorreu." },
            { name: "date", type: "number", description: "Timestamp Unix da data da mensagem." },
            { name: "isOutgoing", type: "boolean", description: "Se a mensagem editada foi de saída (true) ou recebida (false)." },
            { name: "mediaUrl", type: "string | null", description: "URL de mídia se aplicável, ou null." }
          ],
          exampleJson: {
            event: "edited_message",
            instanceId: "3a7f9dbb-6952-4663-974a-8230028d070c",
            instanceName: "Sarinha 🔥",
            language: "pt-BR",
            connection: {
              endpoint: "https://seu-dominio.up.railway.app",
              token: "e7b0a829-4fc1-4d39-953b-e015acb98192"
            },
            data: {
              id: 98120,
              type: "text",
              content: "Mensagem corrigida pelo lead: quero comprar agora!",
              senderId: "8769981356",
              chatId: "8769981356",
              date: 1729000150,
              isOutgoing: false,
              mediaUrl: null
            }
          }
        };

      case "wh-deleted-message":
        return {
          title: "Evento: deleted_message (Mensagens Deletadas)",
          eventName: "deleted_message",
          badgeColor: "#f87171",
          description: "Disparado quando uma ou mais mensagens são apagadas na conversa por qualquer participante.",
          fields: [
            { name: "messages", type: "number[]", description: "Array contendo os IDs numéricos de todas as mensagens que foram apagadas." },
            { name: "channelId", type: "string | null", description: "ID do canal ou supergrupo se a exclusão ocorreu em um grupo/canal. null se ocorreu em chat privado 1-a-1." }
          ],
          exampleJson: {
            event: "deleted_message",
            instanceId: "3a7f9dbb-6952-4663-974a-8230028d070c",
            instanceName: "Sarinha 🔥",
            language: "pt-BR",
            connection: {
              endpoint: "https://seu-dominio.up.railway.app",
              token: "e7b0a829-4fc1-4d39-953b-e015acb98192"
            },
            data: {
              messages: [98120, 98121],
              channelId: null
            }
          }
        };

      case "wh-chat-typing":
      case "wh-chat-recording-audio":
      case "wh-chat-uploading-photo":
      case "wh-chat-uploading-video":
      case "wh-chat-uploading-document": {
        const actionMap: Record<string, { name: string; action: string; desc: string }> = {
          "wh-chat-typing": { name: "chat.typing", action: "SendMessageTypingAction", desc: "O usuário começou a digitar texto no chat em tempo real." },
          "wh-chat-recording-audio": { name: "chat.recording_audio", action: "SendMessageRecordAudioAction", desc: "O usuário está com o dedo no microfone gravando uma mensagem de voz." },
          "wh-chat-uploading-photo": { name: "chat.uploading_photo", action: "SendMessageUploadPhotoAction", desc: "O usuário selecionou uma foto da galeria e está carregando." },
          "wh-chat-uploading-video": { name: "chat.uploading_video", action: "SendMessageUploadVideoAction", desc: "O usuário está gravando ou fazendo upload de um vídeo." },
          "wh-chat-uploading-document": { name: "chat.uploading_document", action: "SendMessageUploadDocumentAction", desc: "O usuário está anexando um documento ou arquivo." },
        };
        const current = actionMap[id];
        return {
          title: `Evento: ${current.name}`,
          eventName: current.name,
          badgeColor: "#34d399",
          description: current.desc,
          fields: [
            { name: "userId", type: "string", description: "ID numérico do usuário do Telegram que está executando a ação." },
            { name: "chatId", type: "string", description: "ID do chat onde a ação está acontecendo." },
            { name: "action", type: "string", description: `A classe de ação interna do Telegram MTProto: '${current.action}'.` }
          ],
          exampleJson: {
            event: current.name,
            instanceId: "3a7f9dbb-6952-4663-974a-8230028d070c",
            instanceName: "Sarinha 🔥",
            language: "pt-BR",
            connection: {
              endpoint: "https://seu-dominio.up.railway.app",
              token: "e7b0a829-4fc1-4d39-953b-e015acb98192"
            },
            data: {
              userId: "8769981356",
              chatId: "8769981356",
              action: current.action
            }
          }
        };
      }

      case "wh-call-ringing":
        return {
          title: "Evento: call.ringing (Chamada Tocando)",
          eventName: "call.ringing",
          badgeColor: "#a78bfa",
          description: "Disparado no momento em que a ligação é enviada e o aparelho do lead começa a tocar na outra ponta.",
          fields: [
            { name: "callId", type: "string", description: "ID numérico exclusivo da chamada no protocolo MTProto." },
            { name: "chatId", type: "string | number", description: "Telefone ou Chat ID do destinatário que está recebendo a chamada." },
            { name: "durationSeconds", type: "number", description: "Duração programada da ligação após o atendimento (padrão: 5 segundos)." },
            { name: "timeoutSeconds", type: "number", description: "Tempo limite configurado para o lead atender antes de desistir (padrão: 30 segundos)." },
            { name: "status", type: "string", description: "Status atual da chamada ('ringing')." },
            { name: "initiatedAt", type: "number", description: "Timestamp Unix em milissegundos do momento em que a chamada começou a tocar." }
          ],
          exampleJson: {
            event: "call.ringing",
            instanceId: "3a7f9dbb-6952-4663-974a-8230028d070c",
            instanceName: "Sarinha 🔥",
            language: "pt-BR",
            connection: {
              endpoint: "https://seu-dominio.up.railway.app",
              token: "e7b0a829-4fc1-4d39-953b-e015acb98192"
            },
            data: {
              callId: "982739182379123891",
              chatId: "5511999999999",
              durationSeconds: 5,
              timeoutSeconds: 30,
              status: "ringing",
              initiatedAt: 1729000200000
            }
          }
        };

      case "wh-call-accepted":
        return {
          title: "Evento: call.accepted (Chamada Atendida)",
          eventName: "call.accepted",
          badgeColor: "#10b981",
          description: "Disparado no exato milissegundo em que o lead aperta para atender a ligação no celular.",
          fields: [
            { name: "callId", type: "string", description: "ID numérico exclusivo da chamada." },
            { name: "chatId", type: "string | number", description: "Destinatário que atendeu a ligação." },
            { name: "durationSeconds", type: "number", description: "Duração planejada da conexão (padrão: 5 segundos)." },
            { name: "status", type: "string", description: "Status atual ('accepted')." },
            { name: "answeredAt", type: "number", description: "Timestamp Unix em milissegundos do momento exato do atendimento." }
          ],
          exampleJson: {
            event: "call.accepted",
            instanceId: "3a7f9dbb-6952-4663-974a-8230028d070c",
            instanceName: "Sarinha 🔥",
            language: "pt-BR",
            connection: {
              endpoint: "https://seu-dominio.up.railway.app",
              token: "e7b0a829-4fc1-4d39-953b-e015acb98192"
            },
            data: {
              callId: "982739182379123891",
              chatId: "5511999999999",
              durationSeconds: 5,
              status: "accepted",
              answeredAt: 1729000204210
            }
          }
        };

      case "wh-call-completed":
      case "wh-call-abandoned":
      case "wh-call-declined":
      case "wh-call-missed":
      case "wh-call-ended": {
        const callTypeMap: Record<string, { name: string; color: string; desc: string; sampleStatus: string; sampleAnswered: boolean; sampleDuration: number; sampleCompleted: boolean; sampleHungUp: string; sampleReason: string }> = {
          "wh-call-completed": {
            name: "call.completed",
            color: "#10b981",
            desc: "Disparado quando a chamada atingiu os 5 segundos planejados (ou o tempo configurado em durationSeconds) com o lead conectado, sendo desligada automaticamente com sucesso pelo sistema.",
            sampleStatus: "completed",
            sampleAnswered: true,
            sampleDuration: 5,
            sampleCompleted: true,
            sampleHungUp: "caller",
            sampleReason: "hangup"
          },
          "wh-call-abandoned": {
            name: "call.abandoned",
            color: "#f59e0b",
            desc: "Disparado quando o lead atendeu a ligação, porém desligou ativamente no botão vermelho antes de completar os 5 segundos planejados.",
            sampleStatus: "abandoned",
            sampleAnswered: true,
            sampleDuration: 2,
            sampleCompleted: false,
            sampleHungUp: "recipient",
            sampleReason: "hangup"
          },
          "wh-call-declined": {
            name: "call.declined",
            color: "#ef4444",
            desc: "Disparado se o lead rejeitou ativamente a chamada (clicou em Recusar) ou se a linha do lead estava ocupada.",
            sampleStatus: "declined",
            sampleAnswered: false,
            sampleDuration: 0,
            sampleCompleted: false,
            sampleHungUp: "recipient",
            sampleReason: "busy"
          },
          "wh-call-missed": {
            name: "call.missed",
            color: "#6b7280",
            desc: "Disparado quando a chamada tocou até o tempo limite (timeoutSeconds, padrão 30s) e o lead não atendeu a ligação.",
            sampleStatus: "missed",
            sampleAnswered: false,
            sampleDuration: 0,
            sampleCompleted: false,
            sampleHungUp: "caller",
            sampleReason: "missed"
          },
          "wh-call-ended": {
            name: "call.ended",
            color: "#8b5cf6",
            desc: "Evento consolidado disparado ao término de TODA E QUALQUER ligação, independente do desfecho (completada, abandonada, recusada ou não atendida). Ideal para quem prefere escutar um único evento com todas as métricas finais.",
            sampleStatus: "completed",
            sampleAnswered: true,
            sampleDuration: 5,
            sampleCompleted: true,
            sampleHungUp: "caller",
            sampleReason: "hangup"
          }
        };

        const current = callTypeMap[id];
        return {
          title: `Evento: ${current.name}`,
          eventName: current.name,
          badgeColor: current.color,
          description: current.desc,
          fields: [
            { name: "callId", type: "string", description: "ID numérico exclusivo da chamada no Telegram MTProto." },
            { name: "chatId", type: "string | number", description: "Telefone ou Chat ID do destinatário da ligação." },
            { name: "answered", type: "boolean", description: "true se o lead atendeu a ligação; false se não chegou a atender." },
            { name: "status", type: "string", description: "Status final da chamada: 'completed' (completou 100%), 'abandoned' (desligou antes), 'declined' (rejeitou), 'missed' (não atendeu)." },
            { name: "durationSeconds", type: "number", description: "Tempo real em segundos que a chamada durou conectada após o atendimento." },
            { name: "plannedDurationSeconds", type: "number", description: "Duração planejada configurada na requisição (padrão: 5 segundos)." },
            { name: "completedFullDuration", type: "boolean", description: "true se a chamada permaneceu conectada até o tempo final planejado." },
            { name: "hungUpBy", type: "string", description: "Quem encerrou a chamada: 'caller' (nossa instância/sistema) ou 'recipient' (o lead)." },
            { name: "disconnectReason", type: "string", description: "Motivo técnico do encerramento retornado pelo Telegram: 'hangup', 'busy', 'missed', 'disconnect'." },
            { name: "initiatedAt", type: "number", description: "Timestamp Unix em milissegundos do início da discagem." },
            { name: "answeredAt", type: "number | null", description: "Timestamp Unix em milissegundos do momento em que foi atendida (ou null se não atendeu)." },
            { name: "endedAt", type: "number", description: "Timestamp Unix em milissegundos da desconexão da chamada." }
          ],
          exampleJson: {
            event: current.name,
            instanceId: "3a7f9dbb-6952-4663-974a-8230028d070c",
            instanceName: "Sarinha 🔥",
            language: "pt-BR",
            connection: {
              endpoint: "https://seu-dominio.up.railway.app",
              token: "e7b0a829-4fc1-4d39-953b-e015acb98192"
            },
            data: {
              callId: "982739182379123891",
              chatId: "5511999999999",
              answered: current.sampleAnswered,
              status: current.sampleStatus,
              durationSeconds: current.sampleDuration,
              plannedDurationSeconds: 5,
              completedFullDuration: current.sampleCompleted,
              hungUpBy: current.sampleHungUp,
              disconnectReason: current.sampleReason,
              initiatedAt: 1729000200000,
              answeredAt: current.sampleAnswered ? 1729000204210 : null,
              endedAt: 1729000209220
            }
          }
        };
      }

      default:
        return getWebhookData("overview");
    }
  };

  const currentWebhookData = getWebhookData(activeWebhook);

  // Initialize test payload when tab changes or origin loads
  useEffect(() => {
    if (docSection === "endpoints") {
      setTestPayload(JSON.stringify(getEndpointData(activeTab).exampleJson, null, 2));
      setTestResponse(null);
    }
  }, [activeTab, origin, docSection]);

  const handleTestRequest = async () => {
    if (!testInstanceId || !testApiToken) {
      alert("Instance ID e API Token são obrigatórios para testar.");
      return;
    }
    
    let parsedPayload;
    try {
      parsedPayload = JSON.parse(testPayload);
    } catch (e) {
      alert("JSON inválido no corpo da requisição.");
      return;
    }

    setTestLoading(true);
    setTestResponse(null);
    try {
      const targetUrl = currentEndpointData.baseUrl.replace("[instanceId]", testInstanceId);
      const res = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${testApiToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(parsedPayload)
      });
      const data = await res.json();
      setTestResponse({ status: res.status, ok: res.ok, data });
    } catch (err: any) {
      setTestResponse({ status: "Error", ok: false, error: err.message });
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="page-container">
      {/* Sidebar */}
      <aside className="glass-panel" style={{ width: "320px", margin: "20px", padding: "24px 16px", display: "flex", flexDirection: "column", height: "calc(100vh - 40px)", position: "sticky", top: "20px" }}>
        <Link href="/" className="btn-secondary" style={{ marginBottom: "20px", width: "100%", justifyContent: "flex-start" }}>
          <ArrowLeft size={18} />
          Voltar ao Dashboard
        </Link>

        {/* Seletor de Modo: REST API vs Webhooks */}
        <div style={{ display: "flex", gap: "6px", marginBottom: "20px", background: "rgba(0,0,0,0.3)", padding: "4px", borderRadius: "10px", border: "1px solid var(--glass-border)" }}>
          <button
            onClick={() => setDocSection("endpoints")}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "8px 10px",
              borderRadius: "8px",
              border: "none",
              background: docSection === "endpoints" ? "var(--accent-color)" : "transparent",
              color: docSection === "endpoints" ? "#fff" : "var(--text-secondary)",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s"
            }}
          >
            <Terminal size={14} />
            API REST
          </button>
          <button
            onClick={() => setDocSection("webhooks")}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "8px 10px",
              borderRadius: "8px",
              border: "none",
              background: docSection === "webhooks" ? "var(--accent-color)" : "transparent",
              color: docSection === "webhooks" ? "#fff" : "var(--text-secondary)",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s"
            }}
          >
            <Webhook size={14} />
            Webhooks
          </button>
        </div>
        
        {/* Lista de Navegação com Scroll */}
        <div style={{ overflowY: "auto", flex: 1, paddingRight: "4px" }}>
          {docSection === "endpoints" ? (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-secondary)", marginBottom: "12px", fontSize: "11px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase" }}>
                <Book size={13} /> Endpoints de Envio
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {endpoints.map((ep) => {
                  const Icon = ep.icon;
                  const isActive = activeTab === ep.id;
                  return (
                    <button
                      key={ep.id}
                      onClick={() => setActiveTab(ep.id)}
                      style={{
                        display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px",
                        borderRadius: "8px", border: "none", background: isActive ? "rgba(255,255,255,0.1)" : "transparent",
                        color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                        cursor: "pointer", fontWeight: isActive ? 600 : 400, textAlign: "left", transition: "all 0.2s ease"
                      }}
                      className="sidebar-btn"
                    >
                      <Icon size={16} />
                      {ep.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div>
              {webhookCategories.map((cat, idx) => (
                <div key={idx} style={{ marginBottom: "18px" }}>
                  <div style={{ color: "var(--text-secondary)", marginBottom: "8px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase" }}>
                    {cat.name}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                    {cat.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeWebhook === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => setActiveWebhook(item.id)}
                          style={{
                            display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px",
                            borderRadius: "8px", border: "none", background: isActive ? "rgba(255,255,255,0.12)" : "transparent",
                            color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                            cursor: "pointer", fontWeight: isActive ? 600 : 400, textAlign: "left", transition: "all 0.2s ease",
                            fontSize: "13px"
                          }}
                          className="sidebar-btn"
                        >
                          <Icon size={15} style={{ opacity: isActive ? 1 : 0.7 }} />
                          <span style={{ fontFamily: item.event ? "monospace" : "inherit" }}>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content" style={{ padding: "40px 60px", flex: 1, minWidth: 0 }}>
        {docSection === "endpoints" ? (
          /* ── VIEW: ENDPOINTS REST ─────────────────────────────────────────── */
          <div className="animate-fade-in">
            <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "8px" }}>
              <span className="badge" style={{ backgroundColor: "rgba(16, 185, 129, 0.1)", color: "var(--success-color)", fontSize: "14px", padding: "6px 12px", borderRadius: "99px", fontWeight: "bold" }}>POST</span>
              <h1 className="page-title">{endpoints.find(e => e.id === activeTab)?.label}</h1>
            </div>
            <div style={{ fontFamily: "monospace", fontSize: "15px", color: "var(--text-secondary)", marginBottom: "40px", padding: "12px 16px", background: "rgba(0,0,0,0.3)", borderRadius: "8px", border: "1px solid var(--glass-border)" }}>
              {currentEndpointData.baseUrl}
            </div>

            <div className="grid grid-cols-2" style={{ gap: "32px" }}>
              {/* Left Column: Parameters */}
              <div>
                <h2 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "20px", borderBottom: "1px solid var(--glass-border)", paddingBottom: "12px" }}>Headers</h2>
                <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "40px", fontSize: "14px" }}>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <td style={{ padding: "12px 0", fontWeight: 500 }}>Authorization</td>
                      <td style={{ padding: "12px 0", color: "var(--text-secondary)" }}>Bearer SEU_API_TOKEN</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <td style={{ padding: "12px 0", fontWeight: 500 }}>Content-Type</td>
                      <td style={{ padding: "12px 0", color: "var(--text-secondary)" }}>application/json</td>
                    </tr>
                  </tbody>
                </table>

                <h2 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "20px", borderBottom: "1px solid var(--glass-border)", paddingBottom: "12px" }}>Parâmetros (JSON Body)</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {currentEndpointData.payloadFields.map((field, i) => (
                    <div key={i} className="glass-card" style={{ padding: "16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                        <span style={{ fontWeight: 600, fontFamily: "monospace" }}>{field.name}</span>
                        <span style={{ fontSize: "12px", color: "var(--accent-color)" }}>{field.type}</span>
                        {field.required && <span className="status-badge status-error" style={{ fontSize: "10px", padding: "2px 8px" }}>Obrigatório</span>}
                      </div>
                      <p style={{ color: "var(--text-secondary)", fontSize: "14px", lineHeight: 1.5 }}>
                        {field.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Code Snippets & Test Runner */}
              <div>
                {/* Test Runner */}
                <div className="glass-panel" style={{ padding: 0, overflow: "hidden", marginBottom: "24px", border: "1px solid rgba(255,255,255,0.2)" }}>
                  <div style={{ background: "rgba(255,255,255,0.05)", borderBottom: "1px solid var(--glass-border)", padding: "12px 20px", display: "flex", alignItems: "center", gap: "8px", fontWeight: 500 }}>
                    <Play size={16} /> Testar Agora (Interactive Runner)
                  </div>
                  <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div style={{ display: "flex", gap: "12px" }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: "block", fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px", fontWeight: 500 }}>Instance ID</label>
                        <input type="text" className="input-field" placeholder="Ex: 3a7f9dbb..." value={testInstanceId} onChange={e => setTestInstanceId(e.target.value)} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: "block", fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px", fontWeight: 500 }}>API Token</label>
                        <input type="password" className="input-field" placeholder="Bearer Token da Instância" value={testApiToken} onChange={e => setTestApiToken(e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px", fontWeight: 500 }}>Payload JSON</label>
                      <textarea 
                        className="input-field" 
                        style={{ height: "130px", fontFamily: "monospace", resize: "vertical" }}
                        value={testPayload}
                        onChange={e => setTestPayload(e.target.value)}
                      />
                    </div>
                    <button className="btn-primary" onClick={handleTestRequest} disabled={testLoading} style={{ alignSelf: "flex-start" }}>
                      <Play size={16} />
                      {testLoading ? "Enviando..." : "Disparar Requisição"}
                    </button>

                    {testResponse && (
                      <div style={{ marginTop: "12px", padding: "12px", background: "rgba(0,0,0,0.4)", borderRadius: "8px", border: `1px solid ${testResponse.ok ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}` }}>
                        <div style={{ fontSize: "12px", color: testResponse.ok ? "var(--success-color)" : "var(--error-color)", marginBottom: "8px", fontWeight: "bold" }}>
                          Status de Resposta: {testResponse.status}
                        </div>
                        <pre style={{ fontSize: "12px", color: "var(--text-secondary)", whiteSpace: "pre-wrap", wordBreak: "break-all", margin: 0 }}>
                          {JSON.stringify(testResponse.data || testResponse.error, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>

                {/* cURL Example */}
                <div className="glass-panel" style={{ padding: 0, overflow: "hidden" }}>
                  <div style={{ background: "rgba(255,255,255,0.05)", borderBottom: "1px solid var(--glass-border)", padding: "12px 20px", display: "flex", alignItems: "center", gap: "8px", fontWeight: 500 }}>
                    <Terminal size={16} /> Exemplo cURL
                  </div>
                  <div style={{ padding: "20px", overflowX: "auto" }}>
                    <pre style={{ fontFamily: "monospace", fontSize: "13px", color: "var(--text-primary)", whiteSpace: "pre-wrap", margin: 0 }}>
{`curl -X POST "${currentEndpointData.baseUrl.replace('[instanceId]', 'SUA_INSTANCE_ID')}" \\
  -H "Authorization: Bearer SEU_API_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(currentEndpointData.exampleJson, null, 2)}'`}
                    </pre>
                  </div>
                </div>

                {/* Node.js Fetch */}
                <div className="glass-panel" style={{ padding: 0, overflow: "hidden", marginTop: "24px" }}>
                  <div style={{ background: "rgba(255,255,255,0.05)", borderBottom: "1px solid var(--glass-border)", padding: "12px 20px", display: "flex", alignItems: "center", gap: "8px", fontWeight: 500 }}>
                    <Code size={16} /> Exemplo em Node.js (fetch)
                  </div>
                  <div style={{ padding: "20px", overflowX: "auto" }}>
                    <pre style={{ fontFamily: "monospace", fontSize: "13px", color: "#61dafb", whiteSpace: "pre-wrap", margin: 0 }}>
{`const response = await fetch("${currentEndpointData.baseUrl.replace('[instanceId]', 'SUA_INSTANCE_ID')}", {
  method: "POST",
  headers: {
    "Authorization": "Bearer SEU_API_TOKEN",
    "Content-Type": "application/json"
  },
  body: JSON.stringify(${JSON.stringify(currentEndpointData.exampleJson, null, 4).replace(/\n/g, '\n  ')})
});

const data = await response.json();
console.log(data);`}
                    </pre>
                  </div>
                </div>

              </div>
            </div>
          </div>
        ) : (
          /* ── VIEW: WEBHOOKS & EVENTOS ─────────────────────────────────────── */
          <div className="animate-fade-in">
            <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "12px" }}>
              <span 
                className="badge" 
                style={{ 
                  backgroundColor: "rgba(139, 92, 246, 0.15)", 
                  color: currentWebhookData.badgeColor || "var(--accent-color)", 
                  fontSize: "13px", 
                  padding: "6px 14px", 
                  borderRadius: "99px", 
                  fontWeight: "bold",
                  border: `1px solid ${currentWebhookData.badgeColor}33`
                }}
              >
                WEBHOOK EVENT
              </span>
              <h1 className="page-title">{currentWebhookData.title}</h1>
            </div>

            <p style={{ color: "var(--text-secondary)", fontSize: "15px", lineHeight: 1.6, marginBottom: "32px", maxWidth: "900px" }}>
              {currentWebhookData.description}
            </p>

            {/* Caso Especial: OVERVIEW DOS WEBHOOKS */}
            {activeWebhook === "overview" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
                {/* Cartão de Informações de Entrega */}
                <div className="glass-panel" style={{ padding: "24px" }}>
                  <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <Radio size={18} color="var(--accent-color)" /> Protocolo de Envio HTTP
                  </h2>
                  <div className="grid grid-cols-2" style={{ gap: "20px", fontSize: "14px" }}>
                    <div>
                      <div style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>Método & Headers:</div>
                      <div style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
                        O servidor envia um <code>POST</code> com header <code>Content-Type: application/json</code> diretamente para a URL configurada no seu webhook.
                      </div>
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>Resposta Esperada:</div>
                      <div style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
                        Sua aplicação deve responder com status <strong>HTTP 200 OK</strong> o mais rápido possível (em menos de 5s).
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tabela do Envelope */}
                <div>
                  <h2 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "16px", borderBottom: "1px solid var(--glass-border)", paddingBottom: "12px" }}>
                    Estrutura do Envelope Padrão (Root Payload)
                  </h2>
                  <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "20px" }}>
                    Todos os webhooks disparados pelo sistema são empacotados dentro deste formato padrão. O objeto <code>data</code> contém o conteúdo específico de cada evento.
                  </p>

                  <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "32px" }}>
                    {currentWebhookData.envelopeFields?.map((f, i) => (
                      <div key={i} className="glass-card" style={{ padding: "16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
                          <span style={{ fontWeight: 600, fontFamily: "monospace", fontSize: "15px" }}>{f.name}</span>
                          <span style={{ fontSize: "12px", color: "var(--accent-color)", background: "rgba(99, 102, 241, 0.1)", padding: "2px 8px", borderRadius: "4px" }}>{f.type}</span>
                        </div>
                        <p style={{ color: "var(--text-secondary)", fontSize: "14px", margin: 0, lineHeight: 1.5 }}>
                          {f.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Exemplo JSON Completo do Envelope */}
                <div className="glass-panel" style={{ padding: 0, overflow: "hidden" }}>
                  <div style={{ background: "rgba(255,255,255,0.05)", borderBottom: "1px solid var(--glass-border)", padding: "12px 20px", display: "flex", alignItems: "center", gap: "8px", fontWeight: 500 }}>
                    <Code size={16} /> Exemplo de Payload Completo do Webhook (JSON)
                  </div>
                  <div style={{ padding: "20px", overflowX: "auto" }}>
                    <pre style={{ fontFamily: "monospace", fontSize: "13px", color: "#34d399", whiteSpace: "pre-wrap", margin: 0 }}>
                      {JSON.stringify(currentWebhookData.exampleJson, null, 2)}
                    </pre>
                  </div>
                </div>

                {/* Exemplo de Servidor Receptor (Express & FastAPI) */}
                <div className="grid grid-cols-2" style={{ gap: "24px" }}>
                  <div className="glass-panel" style={{ padding: 0, overflow: "hidden" }}>
                    <div style={{ background: "rgba(255,255,255,0.05)", borderBottom: "1px solid var(--glass-border)", padding: "12px 20px", display: "flex", alignItems: "center", gap: "8px", fontWeight: 500 }}>
                      <Code size={16} /> Receptor em Node.js (Express)
                    </div>
                    <div style={{ padding: "20px", overflowX: "auto" }}>
                      <pre style={{ fontFamily: "monospace", fontSize: "12px", color: "#60a5fa", whiteSpace: "pre-wrap", margin: 0 }}>
{`app.post('/webhook', express.json(), (req, res) => {
  const { event, instanceId, data, connection } = req.body;

  console.log(\`[Webhook Recebido] Evento: \${event} da Instância: \${instanceId}\`);

  if (event === 'message') {
    console.log(\`Nova mensagem de \${data.senderId}: \${data.content}\`);
  } else if (event === 'call.accepted') {
    console.log(\`Lead \${data.chatId} atendeu a chamada telefônica!\`);
  }

  // Sempre responda 200 OK rapidamente
  res.status(200).json({ received: true });
});`}
                      </pre>
                    </div>
                  </div>

                  <div className="glass-panel" style={{ padding: 0, overflow: "hidden" }}>
                    <div style={{ background: "rgba(255,255,255,0.05)", borderBottom: "1px solid var(--glass-border)", padding: "12px 20px", display: "flex", alignItems: "center", gap: "8px", fontWeight: 500 }}>
                      <Code size={16} /> Receptor em Python (FastAPI)
                    </div>
                    <div style={{ padding: "20px", overflowX: "auto" }}>
                      <pre style={{ fontFamily: "monospace", fontSize: "12px", color: "#f59e0b", whiteSpace: "pre-wrap", margin: 0 }}>
{`from fastapi import FastAPI, Request

app = FastAPI()

@app.post("/webhook")
async def receive_webhook(request: Request):
    payload = await request.json()
    event = payload.get("event")
    data = payload.get("data")

    if event == "message":
        print(f"Mensagem de {data['senderId']}: {data['content']}")
    elif event == "call.completed":
        print(f"Chamada com {data['chatId']} durou {data['durationSeconds']}s")

    return {"status": "ok"}`}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Eventos Específicos de Webhook */}
            {activeWebhook !== "overview" && (
              <div className="grid grid-cols-2" style={{ gap: "32px" }}>
                {/* Coluna Esquerda: Campos de `data` */}
                <div>
                  <h2 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "16px", borderBottom: "1px solid var(--glass-border)", paddingBottom: "12px" }}>
                    Campos do Objeto <code>data</code>
                  </h2>
                  <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "20px" }}>
                    Abaixo estão os parâmetros entregues dentro do atributo <code>data</code> para o evento <code>{currentWebhookData.eventName}</code>:
                  </p>

                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {currentWebhookData.fields?.map((field: any, i: number) => (
                      <div key={i} className="glass-card" style={{ padding: "16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
                          <span style={{ fontWeight: 600, fontFamily: "monospace", fontSize: "14px", color: "var(--text-primary)" }}>{field.name}</span>
                          <span style={{ fontSize: "12px", color: currentWebhookData.badgeColor || "var(--accent-color)", background: "rgba(255,255,255,0.05)", padding: "2px 8px", borderRadius: "4px" }}>
                            {field.type}
                          </span>
                        </div>
                        <p style={{ color: "var(--text-secondary)", fontSize: "13px", lineHeight: 1.5, margin: 0 }}>
                          {field.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Coluna Direita: Payload JSON & Como Tratar */}
                <div>
                  <div className="glass-panel" style={{ padding: 0, overflow: "hidden", marginBottom: "24px" }}>
                    <div style={{ background: "rgba(255,255,255,0.05)", borderBottom: "1px solid var(--glass-border)", padding: "12px 20px", display: "flex", alignItems: "center", gap: "8px", fontWeight: 500 }}>
                      <Code size={16} /> Payload JSON Completo do Evento
                    </div>
                    <div style={{ padding: "20px", overflowX: "auto" }}>
                      <pre style={{ fontFamily: "monospace", fontSize: "13px", color: "#34d399", whiteSpace: "pre-wrap", margin: 0 }}>
                        {JSON.stringify(currentWebhookData.exampleJson, null, 2)}
                      </pre>
                    </div>
                  </div>

                  <div className="glass-panel" style={{ padding: 0, overflow: "hidden" }}>
                    <div style={{ background: "rgba(255,255,255,0.05)", borderBottom: "1px solid var(--glass-border)", padding: "12px 20px", display: "flex", alignItems: "center", gap: "8px", fontWeight: 500 }}>
                      <Terminal size={16} /> Como Processar no seu Backend
                    </div>
                    <div style={{ padding: "20px", overflowX: "auto" }}>
                      <pre style={{ fontFamily: "monospace", fontSize: "12px", color: "var(--text-primary)", whiteSpace: "pre-wrap", margin: 0 }}>
{`// Exemplo no manipulador de webhook
if (body.event === "${currentWebhookData.eventName}") {
  const data = body.data;
  
  // Acessando os dados do evento
  console.log("Recebido evento ${currentWebhookData.eventName}:", data);
  
  // Faça o processamento aqui...
}`}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
      
      <style jsx>{`
        .sidebar-btn:hover {
          background: rgba(255,255,255,0.06) !important;
        }
      `}</style>
    </div>
  );
}
