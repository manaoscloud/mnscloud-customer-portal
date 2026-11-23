import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { AssistantPageComponent } from './assistant-page.component';
import { AssistantService } from './assistant.service';
import type {
  AssistantConversation,
  AssistantMessage,
  AssistantProposal,
} from './assistant.model';

describe('AssistantPageComponent', () => {
  let assistantServiceMock: {
    listConversations: ReturnType<typeof vi.fn>;
    getConversation: ReturnType<typeof vi.fn>;
    startConversation: ReturnType<typeof vi.fn>;
    ask: ReturnType<typeof vi.fn>;
    confirmProposal: ReturnType<typeof vi.fn>;
    rejectProposal: ReturnType<typeof vi.fn>;
    deleteConversation: ReturnType<typeof vi.fn>;
  };

  const sampleConv: AssistantConversation = {
    conversationUUID: 'conv-1',
    title: 'Minhas faturas',
    active: true,
    createdAt: '2026-11-23T00:00:00Z',
    updatedAt: '2026-11-23T00:00:00Z',
  };

  const sampleQuestion: AssistantMessage = {
    messageUUID: 'msg-1',
    role: 'user',
    text: 'Como emitir 2a via do boleto?',
    links: [],
    outcome: null,
    createdAt: '2026-11-23T00:00:00Z',
  };

  const sampleAnswer: AssistantMessage = {
    messageUUID: 'msg-2',
    role: 'assistant',
    text: 'Você pode acessar a seção Financeiro para visualizar boletos.',
    links: [
      {
        kind: 'screen',
        title: 'Financeiro',
        route: '/financial',
        menuPath: 'Principal › Financeiro',
      },
    ],
    outcome: 'answered',
    createdAt: '2026-11-23T00:00:01Z',
    followUps: ['Quais são meus serviços ativos?'],
  };

  beforeEach(() => {
    assistantServiceMock = {
      listConversations: vi.fn().mockResolvedValue([sampleConv]),
      getConversation: vi.fn().mockResolvedValue({
        conversation: sampleConv,
        messages: [sampleQuestion, sampleAnswer],
      }),
      startConversation: vi.fn().mockResolvedValue({
        conversation: sampleConv,
        question: sampleQuestion,
        answer: sampleAnswer,
      }),
      ask: vi.fn().mockResolvedValue({
        question: sampleQuestion,
        answer: sampleAnswer,
      }),
      confirmProposal: vi.fn().mockResolvedValue({
        proposalUUID: 'prop-1',
        tool: 'financial.boletos.second_copy',
        targetLabel: 'Boleto 12345',
        params: {},
        status: 'executed',
        resultCode: 200,
        resultMessage: 'Segunda via gerada com sucesso.',
        expiresAt: null,
      } as AssistantProposal),
      rejectProposal: vi.fn().mockResolvedValue({
        proposalUUID: 'prop-1',
        tool: 'financial.boletos.second_copy',
        targetLabel: 'Boleto 12345',
        params: {},
        status: 'rejected',
        resultCode: null,
        resultMessage: null,
        expiresAt: null,
      } as AssistantProposal),
      deleteConversation: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      imports: [AssistantPageComponent],
      providers: [
        provideRouter([]),
        provideTransloco({
          config: { defaultLang: 'pt-BR', availableLangs: ['pt-BR', 'en-US', 'es-ES'] },
        }),
        { provide: AssistantService, useValue: assistantServiceMock },
      ],
    });
  });

  it('loads conversations on init', async () => {
    const fixture = TestBed.createComponent(AssistantPageComponent);
    const component = fixture.componentInstance;
    await component.ngOnInit();

    expect(assistantServiceMock.listConversations).toHaveBeenCalled();
    expect(component.conversations().length).toBe(1);
    expect(component.conversations()[0].conversationUUID).toBe('conv-1');
  });

  it('selects conversation and loads messages', async () => {
    const fixture = TestBed.createComponent(AssistantPageComponent);
    const component = fixture.componentInstance;
    await component.selectConversation('conv-1');

    expect(assistantServiceMock.getConversation).toHaveBeenCalledWith('conv-1');
    expect(component.messages().length).toBe(2);
    expect(component.selectedConversationUUID()).toBe('conv-1');
  });

  it('submits question and appends response', async () => {
    const fixture = TestBed.createComponent(AssistantPageComponent);
    const component = fixture.componentInstance;
    component.questionText = 'Como emitir 2a via do boleto?';
    await component.submitQuestion();

    expect(assistantServiceMock.startConversation).toHaveBeenCalled();
    expect(component.messages().length).toBe(2);
    expect(component.messages()[1].links[0].route).toBe('/financial');
  });

  it('confirms action proposal', async () => {
    const fixture = TestBed.createComponent(AssistantPageComponent);
    const component = fixture.componentInstance;
    const msgWithProp: AssistantMessage = {
      ...sampleAnswer,
      proposals: [
        {
          proposalUUID: 'prop-1',
          tool: 'financial.boletos.second_copy',
          targetLabel: 'Boleto 12345',
          params: {},
          status: 'proposed',
          resultCode: null,
          resultMessage: null,
          expiresAt: null,
        },
      ],
    };
    component.messages.set([msgWithProp]);

    await component.confirmProposal('prop-1');
    expect(assistantServiceMock.confirmProposal).toHaveBeenCalledWith('prop-1');
    expect(component.messages()[0].proposals?.[0].status).toBe('executed');
  });
});
