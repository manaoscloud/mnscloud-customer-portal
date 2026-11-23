export type AssistantRole = 'user' | 'assistant';

export type AssistantLink = {
  kind: 'screen' | 'article';
  title: string;
  route: string | null;
  menuPath: string | null;
};

export type AssistantProposal = {
  proposalUUID: string;
  tool: string;
  targetLabel: string | null;
  params: Record<string, unknown>;
  status: 'proposed' | 'executing' | 'executed' | 'failed' | 'rejected' | 'expired';
  resultCode: number | null;
  resultMessage: string | null;
  expiresAt: string | null;
};

export type AssistantMessage = {
  messageUUID: string;
  role: AssistantRole;
  text: string;
  links: AssistantLink[];
  outcome: string | null;
  createdAt: string | null;
  proposals?: AssistantProposal[];
  followUps?: string[];
};

export type AssistantConversation = {
  conversationUUID: string;
  title: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};
