import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';
import { AssistantService } from './assistant.service';
import { PortalI18nService } from '../../core/i18n/portal-i18n.service';
import type {
  AssistantConversation,
  AssistantMessage,
  AssistantProposal,
} from './assistant.model';

@Component({
  selector: 'mcp-assistant-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatTooltipModule,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page assistant-page">
      <header class="page-header">
        <div>
          <span class="eyebrow">{{ 'assistant.eyebrow' | transloco }}</span>
          <h1>{{ 'assistant.title' | transloco }}</h1>
          <p class="subtitle">{{ 'assistant.subtitle' | transloco }}</p>
        </div>
        <div class="actions">
          <button mat-stroked-button type="button" (click)="startNewChat()">
            <mat-icon>add</mat-icon>
            {{ 'assistant.newChat' | transloco }}
          </button>
        </div>
      </header>

      <div class="chat-container card">
        <aside class="conversations-sidebar">
          <div class="sidebar-header">
            <h3>{{ 'assistant.conversations' | transloco }}</h3>
          </div>
          <div class="conversations-list">
            @if (loadingConversations()) {
              <div class="loading-state">{{ 'assistant.loading' | transloco }}</div>
            } @else if (conversations().length === 0) {
              <div class="empty-state">{{ 'assistant.noConversations' | transloco }}</div>
            } @else {
              @for (conv of conversations(); track conv.conversationUUID) {
                <div
                  class="conversation-item"
                  [class.active]="selectedConversationUUID() === conv.conversationUUID"
                  (click)="selectConversation(conv.conversationUUID)"
                >
                  <mat-icon class="conv-icon">chat_bubble_outline</mat-icon>
                  <span class="conv-title">{{ conv.title || ('assistant.untitled' | transloco) }}</span>
                  <button
                    mat-icon-button
                    type="button"
                    class="delete-btn"
                    [matTooltip]="'assistant.delete' | transloco"
                    (click)="deleteConversation($event, conv.conversationUUID)"
                  >
                    <mat-icon>delete_outline</mat-icon>
                  </button>
                </div>
              }
            }
          </div>
        </aside>

        <main class="chat-main">
          <div class="messages-area">
            @if (messages().length === 0 && !asking()) {
              <div class="welcome-box">
                <span class="welcome-badge"><mat-icon>smart_toy</mat-icon></span>
                <h2>{{ 'assistant.welcomeTitle' | transloco }}</h2>
                <p>{{ 'assistant.welcomeText' | transloco }}</p>
                <div class="suggested-chips">
                  @for (sug of defaultSuggestions(); track sug) {
                    <button class="suggestion-chip" type="button" (click)="askSuggestion(sug)">
                      {{ sug }}
                    </button>
                  }
                </div>
              </div>
            }

            @for (msg of messages(); track msg.messageUUID || $index) {
              <div class="message-row" [class.user]="msg.role === 'user'" [class.assistant]="msg.role === 'assistant'">
                <div class="message-bubble">
                  <div class="message-sender">
                    <mat-icon>{{ msg.role === 'user' ? 'person' : 'smart_toy' }}</mat-icon>
                    <span>{{ (msg.role === 'user' ? 'assistant.you' : 'assistant.bot') | transloco }}</span>
                  </div>
                  <div class="message-text">{{ msg.text }}</div>

                  @if (msg.links && msg.links.length > 0) {
                    <div class="message-links">
                      <span class="links-title">{{ 'assistant.linksTitle' | transloco }}:</span>
                      <div class="links-list">
                        @for (link of msg.links; track link.title) {
                          @if (link.route) {
                            <a class="assistant-link" [routerLink]="link.route">
                              <mat-icon>open_in_new</mat-icon>
                              <span>{{ link.title }}</span>
                            </a>
                          }
                        }
                      </div>
                    </div>
                  }

                  @if (msg.proposals && msg.proposals.length > 0) {
                    <div class="proposals-list">
                      @for (prop of msg.proposals; track prop.proposalUUID) {
                        <div class="proposal-card">
                          <div class="proposal-header">
                            <mat-icon>bolt</mat-icon>
                            <strong>{{ 'assistant.actionRequired' | transloco }}</strong>
                          </div>
                          <div class="proposal-body">
                            <p class="target-label">{{ prop.targetLabel || prop.tool }}</p>
                            @if (prop.status === 'proposed') {
                              <div class="proposal-actions">
                                <button
                                  mat-flat-button
                                  color="primary"
                                  type="button"
                                  [disabled]="operatingProposal() === prop.proposalUUID"
                                  (click)="confirmProposal(prop.proposalUUID)"
                                >
                                  {{ 'assistant.confirm' | transloco }}
                                </button>
                                <button
                                  mat-stroked-button
                                  type="button"
                                  [disabled]="operatingProposal() === prop.proposalUUID"
                                  (click)="rejectProposal(prop.proposalUUID)"
                                >
                                  {{ 'assistant.cancel' | transloco }}
                                </button>
                              </div>
                            } @else if (prop.status === 'executed') {
                              <span class="status-badge success">{{ 'assistant.executed' | transloco }}</span>
                            } @else if (prop.status === 'rejected') {
                              <span class="status-badge rejected">{{ 'assistant.rejected' | transloco }}</span>
                            } @else if (prop.status === 'failed') {
                              <span class="status-badge failed">{{ 'assistant.failed' | transloco }}</span>
                            }
                          </div>
                        </div>
                      }
                    </div>
                  }

                  @if (msg.followUps && msg.followUps.length > 0) {
                    <div class="follow-ups">
                      <span class="follow-ups-title">{{ 'assistant.suggestions' | transloco }}:</span>
                      <div class="follow-ups-list">
                        @for (f of msg.followUps; track f) {
                          <button class="follow-up-btn" type="button" (click)="askSuggestion(f)">
                            {{ f }}
                          </button>
                        }
                      </div>
                    </div>
                  }
                </div>
              </div>
            }

            @if (asking()) {
              <div class="message-row assistant">
                <div class="message-bubble loading-bubble">
                  <mat-icon class="spin-icon">autorenew</mat-icon>
                  <span>{{ 'assistant.thinking' | transloco }}</span>
                </div>
              </div>
            }
          </div>

          <div class="input-area">
            <form (ngSubmit)="submitQuestion()" class="input-form">
              <input
                type="text"
                name="questionInput"
                class="question-input"
                [placeholder]="'assistant.inputPlaceholder' | transloco"
                [(ngModel)]="questionText"
                [disabled]="asking()"
                autocomplete="off"
              />
              <button
                mat-flat-button
                color="primary"
                type="submit"
                class="send-btn"
                [disabled]="asking() || !questionText.trim()"
              >
                <mat-icon>send</mat-icon>
                <span>{{ 'assistant.send' | transloco }}</span>
              </button>
            </form>
          </div>
        </main>
      </div>
    </section>
  `,
  styles: [`
    .assistant-page {
      display: flex;
      flex-direction: column;
      height: calc(100vh - 120px);
    }
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1rem;
    }
    .subtitle {
      color: var(--mat-sys-on-surface-variant);
      margin: 0.25rem 0 0;
      font-size: 0.95rem;
    }
    .chat-container {
      display: grid;
      grid-template-columns: 280px 1fr;
      flex: 1;
      overflow: hidden;
      border: 1px solid var(--mat-sys-outline-variant, #e0e0e0);
      border-radius: 12px;
      background: var(--mat-sys-surface, #ffffff);
    }
    .conversations-sidebar {
      border-right: 1px solid var(--mat-sys-outline-variant, #e0e0e0);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: var(--mat-sys-surface-container-low, #fafafa);
    }
    .sidebar-header {
      padding: 1rem;
      border-bottom: 1px solid var(--mat-sys-outline-variant, #e0e0e0);
    }
    .sidebar-header h3 {
      margin: 0;
      font-size: 0.95rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .conversations-list {
      flex: 1;
      overflow-y: auto;
      padding: 0.5rem;
    }
    .conversation-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.6rem 0.75rem;
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.15s ease;
      font-size: 0.9rem;
    }
    .conversation-item:hover {
      background: var(--mat-sys-surface-container, #f0f0f0);
    }
    .conversation-item.active {
      background: var(--mat-sys-secondary-container, #e8f0fe);
      font-weight: 500;
    }
    .conv-icon {
      font-size: 1.1rem;
      width: 1.1rem;
      height: 1.1rem;
      color: var(--mat-sys-on-surface-variant);
    }
    .conv-title {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .delete-btn {
      width: 28px;
      height: 28px;
      line-height: 28px;
      display: none;
    }
    .conversation-item:hover .delete-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .chat-main {
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .messages-area {
      flex: 1;
      overflow-y: auto;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }
    .welcome-box {
      text-align: center;
      max-width: 520px;
      margin: auto;
      padding: 2rem 1rem;
    }
    .welcome-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: var(--mat-sys-primary-container, #e3f2fd);
      color: var(--mat-sys-on-primary-container, #1976d2);
      margin-bottom: 1rem;
    }
    .welcome-badge mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
    }
    .welcome-box h2 {
      margin: 0 0 0.5rem;
      font-size: 1.4rem;
    }
    .welcome-box p {
      color: var(--mat-sys-on-surface-variant);
      margin: 0 0 1.5rem;
    }
    .suggested-chips {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 0.5rem;
    }
    .suggestion-chip {
      background: var(--mat-sys-surface-container, #f5f5f5);
      border: 1px solid var(--mat-sys-outline-variant, #e0e0e0);
      border-radius: 20px;
      padding: 0.5rem 1rem;
      font-size: 0.85rem;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .suggestion-chip:hover {
      background: var(--mat-sys-secondary-container, #e8f0fe);
      border-color: var(--mat-sys-primary, #1976d2);
    }
    .message-row {
      display: flex;
      flex-direction: column;
    }
    .message-row.user {
      align-items: flex-end;
    }
    .message-row.assistant {
      align-items: flex-start;
    }
    .message-bubble {
      max-width: 80%;
      border-radius: 12px;
      padding: 1rem 1.25rem;
      background: var(--mat-sys-surface-container, #f5f5f5);
      border: 1px solid var(--mat-sys-outline-variant, #e0e0e0);
    }
    .message-row.user .message-bubble {
      background: var(--mat-sys-primary-container, #e3f2fd);
      border-color: transparent;
    }
    .message-sender {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--mat-sys-on-surface-variant);
      margin-bottom: 0.4rem;
      text-transform: uppercase;
    }
    .message-sender mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }
    .message-text {
      font-size: 0.95rem;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .message-links {
      margin-top: 0.75rem;
      padding-top: 0.75rem;
      border-top: 1px solid var(--mat-sys-outline-variant, #e0e0e0);
    }
    .links-title {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--mat-sys-on-surface-variant);
      display: block;
      margin-bottom: 0.4rem;
    }
    .links-list {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .assistant-link {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      font-size: 0.85rem;
      color: var(--mat-sys-primary, #1976d2);
      text-decoration: none;
      font-weight: 500;
    }
    .assistant-link:hover {
      text-decoration: underline;
    }
    .assistant-link mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }
    .proposals-list {
      margin-top: 0.75rem;
    }
    .proposal-card {
      border: 1px solid var(--mat-sys-outline-variant, #e0e0e0);
      border-radius: 8px;
      padding: 0.75rem 1rem;
      background: var(--mat-sys-surface, #ffffff);
    }
    .proposal-header {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      color: var(--mat-sys-primary, #1976d2);
      font-size: 0.85rem;
      margin-bottom: 0.4rem;
    }
    .proposal-header mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    .proposal-actions {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.5rem;
    }
    .follow-ups {
      margin-top: 0.75rem;
      padding-top: 0.5rem;
      border-top: 1px dashed var(--mat-sys-outline-variant, #e0e0e0);
    }
    .follow-ups-title {
      font-size: 0.8rem;
      color: var(--mat-sys-on-surface-variant);
      margin-bottom: 0.4rem;
      display: block;
    }
    .follow-ups-list {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }
    .follow-up-btn {
      background: var(--mat-sys-surface, #ffffff);
      border: 1px solid var(--mat-sys-outline-variant, #e0e0e0);
      border-radius: 16px;
      padding: 0.35rem 0.75rem;
      font-size: 0.8rem;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .follow-up-btn:hover {
      background: var(--mat-sys-secondary-container, #e8f0fe);
    }
    .loading-bubble {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--mat-sys-on-surface-variant);
    }
    .spin-icon {
      animation: spin 1.2s linear infinite;
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .input-area {
      padding: 1rem 1.5rem;
      border-top: 1px solid var(--mat-sys-outline-variant, #e0e0e0);
      background: var(--mat-sys-surface, #ffffff);
    }
    .input-form {
      display: flex;
      gap: 0.75rem;
    }
    .question-input {
      flex: 1;
      border: 1px solid var(--mat-sys-outline-variant, #e0e0e0);
      border-radius: 8px;
      padding: 0.75rem 1rem;
      font-size: 0.95rem;
      outline: none;
      background: var(--mat-sys-surface, #ffffff);
    }
    .question-input:focus {
      border-color: var(--mat-sys-primary, #1976d2);
    }
    .send-btn {
      height: auto;
      padding: 0 1.25rem;
    }
    .status-badge {
      display: inline-block;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.8rem;
      font-weight: 500;
      margin-top: 0.5rem;
    }
    .status-badge.success {
      background: #e8f5e9;
      color: #2e7d32;
    }
    .status-badge.rejected {
      background: #ffebee;
      color: #c62828;
    }
    .status-badge.failed {
      background: #fff3e0;
      color: #e65100;
    }
    @media (max-width: 768px) {
      .chat-container {
        grid-template-columns: 1fr;
      }
      .conversations-sidebar {
        display: none;
      }
    }
  `],
})
export class AssistantPageComponent implements OnInit {
  private readonly assistantService = inject(AssistantService);
  private readonly i18n = inject(PortalI18nService);

  readonly conversations = signal<AssistantConversation[]>([]);
  readonly selectedConversationUUID = signal<string | null>(null);
  readonly messages = signal<AssistantMessage[]>([]);
  readonly loadingConversations = signal(false);
  readonly loadingMessages = signal(false);
  readonly asking = signal(false);
  readonly operatingProposal = signal<string | null>(null);

  questionText = '';

  readonly defaultSuggestions = computed(() => [
    this.i18n.t('assistant.sug1'),
    this.i18n.t('assistant.sug2'),
    this.i18n.t('assistant.sug3'),
  ]);

  async ngOnInit(): Promise<void> {
    await this.loadConversations();
  }

  async loadConversations(): Promise<void> {
    this.loadingConversations.set(true);
    try {
      const list = await this.assistantService.listConversations();
      this.conversations.set(list);
    } catch {
      this.conversations.set([]);
    } finally {
      this.loadingConversations.set(false);
    }
  }

  async selectConversation(uuid: string): Promise<void> {
    this.selectedConversationUUID.set(uuid);
    this.loadingMessages.set(true);
    try {
      const details = await this.assistantService.getConversation(uuid);
      this.messages.set(details.messages || []);
    } catch {
      this.messages.set([]);
    } finally {
      this.loadingMessages.set(false);
    }
  }

  startNewChat(): void {
    this.selectedConversationUUID.set(null);
    this.messages.set([]);
    this.questionText = '';
  }

  askSuggestion(suggestion: string): void {
    this.questionText = suggestion;
    void this.submitQuestion();
  }

  async submitQuestion(): Promise<void> {
    const text = this.questionText.trim();
    if (!text || this.asking()) return;

    this.questionText = '';
    this.asking.set(true);

    const locale = this.i18n.language() || 'pt-BR';
    const activeUUID = this.selectedConversationUUID();

    try {
      if (activeUUID) {
        const res = await this.assistantService.ask(activeUUID, text, locale);
        this.messages.update((prev) => [...prev, res.question, res.answer]);
      } else {
        const res = await this.assistantService.startConversation(text, locale);
        if (res.conversation) {
          this.selectedConversationUUID.set(res.conversation.conversationUUID);
          this.conversations.update((prev) => [res.conversation!, ...prev]);
        }
        this.messages.set([res.question, res.answer]);
      }
    } catch {
      this.messages.update((prev) => [
        ...prev,
        {
          messageUUID: 'error-' + Date.now(),
          role: 'user',
          text,
          links: [],
          outcome: null,
          createdAt: new Date().toISOString(),
        },
        {
          messageUUID: 'error-ans-' + Date.now(),
          role: 'assistant',
          text: this.i18n.t('assistant.errorFallback'),
          links: [],
          outcome: 'error',
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      this.asking.set(false);
    }
  }

  async confirmProposal(proposalUUID: string): Promise<void> {
    this.operatingProposal.set(proposalUUID);
    try {
      const updated = await this.assistantService.confirmProposal(proposalUUID);
      this.updateProposalInMessages(updated);
    } finally {
      this.operatingProposal.set(null);
    }
  }

  async rejectProposal(proposalUUID: string): Promise<void> {
    this.operatingProposal.set(proposalUUID);
    try {
      const updated = await this.assistantService.rejectProposal(proposalUUID);
      this.updateProposalInMessages(updated);
    } finally {
      this.operatingProposal.set(null);
    }
  }

  private updateProposalInMessages(updated: AssistantProposal): void {
    this.messages.update((list) =>
      list.map((msg) => {
        if (!msg.proposals) return msg;
        return {
          ...msg,
          proposals: msg.proposals.map((p) =>
            p.proposalUUID === updated.proposalUUID ? { ...p, ...updated } : p
          ),
        };
      })
    );
  }

  async deleteConversation(event: MouseEvent, uuid: string): Promise<void> {
    event.stopPropagation();
    try {
      await this.assistantService.deleteConversation(uuid);
      this.conversations.update((list) => list.filter((c) => c.conversationUUID !== uuid));
      if (this.selectedConversationUUID() === uuid) {
        this.startNewChat();
      }
    } catch {
      // Ignored
    }
  }
}
