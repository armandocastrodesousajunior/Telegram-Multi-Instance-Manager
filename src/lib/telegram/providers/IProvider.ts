export interface MessageOptions {
  replyToMsgId?: number;
  parseMode?: string;
}

export interface MediaOptions extends MessageOptions {
  caption?: string;
  forceDocument?: boolean;
  voiceNote?: boolean;
}

export interface ViewOnceOptions extends MediaOptions {
  ttlSeconds: number;
}

export interface ITelegramProvider {
  /**
   * Conecta a instância ao servidor do Telegram
   */
  connect(): Promise<void>;

  /**
   * Desconecta a instância
   */
  disconnect(): Promise<void>;

  /**
   * Envia uma mensagem de texto simples
   */
  sendMessage(chatId: string | number, text: string, options?: MessageOptions): Promise<{ id: number; [key: string]: any }>;

  /**
   * Envia uma mídia normal (imagem, vídeo, áudio, doc)
   */
  sendFile(chatId: string | number, file: string | Buffer | any, options?: MediaOptions): Promise<{ id: number; [key: string]: any }>;

  /**
   * Envia uma mídia de visualização única (View Once)
   */
  sendViewOnceFile(chatId: string | number, file: string | Buffer | any, mediaType: 'photo' | 'video', options?: ViewOnceOptions): Promise<{ id: number; [key: string]: any }>;

  /**
   * Simula a ação de digitando
   */
  simulateTyping(chatId: string | number, durationMs?: number): Promise<void>;

  /**
   * Simula envio de arquivos
   */
  simulateFileAction(chatId: string | number, action: 'document' | 'photo' | 'video' | 'audio', durationMs?: number): Promise<void>;
}
