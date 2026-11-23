import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../services/api.service';
import type {
  AssistantConversation,
  AssistantMessage,
  AssistantProposal,
} from './assistant.model';

export type ConversationDetails = {
  conversation: AssistantConversation;
  messages: AssistantMessage[];
};

export type AskResponse = {
  conversation?: AssistantConversation;
  question: AssistantMessage;
  answer: AssistantMessage;
};

@Injectable({ providedIn: 'root' })
export class AssistantService {
  private readonly api = inject(ApiService);

  async listConversations(): Promise<AssistantConversation[]> {
    const res = await this.api.get<{ data?: AssistantConversation[] }>(
      'customer-portal/assistant/conversations',
    );
    return res?.data ?? [];
  }

  async getConversation(uuid: string): Promise<ConversationDetails> {
    const res = await this.api.get<{ data: ConversationDetails }>(
      `customer-portal/assistant/conversations/${uuid}`,
    );
    return res.data;
  }

  async startConversation(question: string, locale = 'pt-BR'): Promise<AskResponse> {
    const res = await this.api.post<{ data: AskResponse }>(
      'customer-portal/assistant/conversations',
      { question, locale },
    );
    return res.data;
  }

  async ask(
    conversationUUID: string,
    question: string,
    locale = 'pt-BR',
  ): Promise<AskResponse> {
    const res = await this.api.post<{ data: AskResponse }>(
      `customer-portal/assistant/conversations/${conversationUUID}/messages`,
      { question, locale },
    );
    return res.data;
  }

  async confirmProposal(proposalUUID: string): Promise<AssistantProposal> {
    const res = await this.api.post<{ data: { proposal: AssistantProposal } }>(
      `customer-portal/assistant/proposals/${proposalUUID}/confirm`,
    );
    return res.data.proposal;
  }

  async rejectProposal(proposalUUID: string): Promise<AssistantProposal> {
    const res = await this.api.post<{ data: { proposal: AssistantProposal } }>(
      `customer-portal/assistant/proposals/${proposalUUID}/reject`,
    );
    return res.data.proposal;
  }

  async deleteConversation(conversationUUID: string): Promise<void> {
    await this.api.delete(`customer-portal/assistant/conversations/${conversationUUID}`);
  }
}
