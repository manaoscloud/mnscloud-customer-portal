import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiService } from '../../services/api.service';
import type { ApiEnvelope } from '../../models/session.model';

type PublishedConversation = {
  CnvUUID: string;
  CnvSubject: string | null;
  ChannelName: string;
  AccountName: string;
  CnvState: string;
  LastMessage: string | null;
  LastMessageAt: string | null;
  CnvDateUpdated: string;
};

type ConversationMessage = {
  CvmUUID: string;
  CvmAuthorRole: string;
  AuthorName: string | null;
  CvmBody: string;
  CvmKind: string;
  CvmDateCreated: string;
};

type ConversationPage = {
  items: PublishedConversation[];
  total: number;
  limit: number;
  offset: number;
};

type MessageList = {
  items: ConversationMessage[];
  total: number;
  limit: number;
};

@Component({
  selector: 'mcp-conversations-page',
  imports: [DatePipe, FormsModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <h1>{{ 'conversations.title' | transloco }}</h1>
          <p>{{ 'conversations.description' | transloco }}</p>
        </div>
        @if (!activeConversation()) {
          <button matButton="filled" type="button" (click)="toggleNewModal()">
            <mat-icon>add</mat-icon>
            {{ 'conversations.new' | transloco }}
          </button>
        }
      </header>

      @if (!activeConversation()) {
        @if (showNewModal()) {
          <article class="card new-dialog">
            <h2>{{ 'conversations.newTitle' | transloco }}</h2>
            <form (ngSubmit)="startConversation()">
              <mat-form-field class="full-field">
                <mat-label>{{ 'conversations.subject' | transloco }}</mat-label>
                <input matInput name="newSubject" [(ngModel)]="newSubject" maxlength="160" />
              </mat-form-field>
              <mat-form-field class="full-field">
                <mat-label>{{ 'conversations.message' | transloco }}</mat-label>
                <textarea matInput rows="3" name="newMessage" [(ngModel)]="newMessage" required></textarea>
              </mat-form-field>
              @if (createError()) {
                <p class="error-msg" role="alert">{{ 'conversations.createError' | transloco }}</p>
              }
              <div class="new-actions">
                <button matButton type="button" (click)="toggleNewModal()" [disabled]="creating()">
                  {{ 'conversations.cancel' | transloco }}
                </button>
                <button matButton="filled" type="submit" [disabled]="creating() || !newMessage.trim()">
                  <mat-icon>send</mat-icon>
                  {{ (creating() ? 'conversations.starting' : 'conversations.start') | transloco }}
                </button>
              </div>
            </form>
          </article>
        }

        <!-- Conversations List View -->
        <form class="search" (ngSubmit)="load(0)">
          <mat-form-field>
            <mat-label>{{ 'conversations.search' | transloco }}</mat-label>
            <input matInput name="search" [(ngModel)]="search" maxlength="160" />
          </mat-form-field>
          <button matButton="filled" type="submit" [disabled]="loading()">
            {{ 'conversations.search' | transloco }}
          </button>
        </form>

        @if (error()) { <p class="card" role="alert">{{ 'conversations.error' | transloco }}</p> }
        @if (loading()) { <p role="status">{{ 'conversations.loading' | transloco }}</p> }
        @else if (!error() && conversations().length === 0) {
          <p class="card">{{ 'conversations.empty' | transloco }}</p>
        }

        <div class="conversation-list">
          @for (conv of conversations(); track conv.CnvUUID) {
            <article class="card conversation-card" (click)="openConversation(conv)">
              <div class="conv-info">
                <h2>{{ conv.CnvSubject || conv.ChannelName }}</h2>
                <p class="meta">
                  <span class="channel-badge">{{ conv.ChannelName }}</span>
                  @if (conv.AccountName) { <span>· {{ conv.AccountName }}</span> }
                  <span>· {{ conv.CnvState }}</span>
                </p>
                @if (conv.LastMessage) {
                  <p class="last-msg">{{ conv.LastMessage }}</p>
                }
              </div>
              <button matButton="outlined" type="button" (click)="openConversation(conv); $event.stopPropagation()">
                <mat-icon>chat</mat-icon>
                {{ 'conversations.open' | transloco }}
              </button>
            </article>
          }
        </div>

        <nav class="pagination" [attr.aria-label]="'conversations.pagination' | transloco">
          <button matButton type="button" [disabled]="loading() || offset() === 0" (click)="load(offset() - 20)">
            {{ 'conversations.previous' | transloco }}
          </button>
          <button matButton type="button" [disabled]="loading() || offset() + 20 >= total()" (click)="load(offset() + 20)">
            {{ 'conversations.next' | transloco }}
          </button>
        </nav>
      } @else {
        <!-- Thread Messages View -->
        <div class="thread-header">
          <button matButton="text" type="button" (click)="closeThread()">
            <mat-icon>arrow_back</mat-icon>
            {{ 'conversations.back' | transloco }}
          </button>
          <div class="thread-title">
            <h2>{{ activeConversation()?.CnvSubject || activeConversation()?.ChannelName }}</h2>
            <small>{{ activeConversation()?.ChannelName }} · {{ activeConversation()?.CnvState }}</small>
          </div>
        </div>

        @if (messagesLoading()) {
          <p role="status">{{ 'conversations.loading' | transloco }}</p>
        } @else {
          <div class="messages-container card">
            @if (messages().length === 0) {
              <p class="empty-messages">{{ 'conversations.noMessages' | transloco }}</p>
            } @else {
              @for (msg of messages(); track msg.CvmUUID) {
                <div class="message-bubble" [class.customer]="msg.CvmAuthorRole === 'contact'" [class.agent]="msg.CvmAuthorRole !== 'contact'">
                  <div class="bubble-header">
                    <span class="author">{{ msg.AuthorName || (msg.CvmAuthorRole === 'contact' ? 'Você' : 'Atendimento') }}</span>
                    <span class="time">{{ msg.CvmDateCreated | date:'shortTime' }}</span>
                  </div>
                  <div class="body">{{ msg.CvmBody }}</div>
                </div>
              }
            }
          </div>

          @if (activeConversation()?.CnvState !== 'resolved') {
            <form class="reply-box" (ngSubmit)="sendMessage()">
              <mat-form-field class="reply-input">
                <mat-label>{{ 'conversations.replyPlaceholder' | transloco }}</mat-label>
                <textarea matInput rows="2" [(ngModel)]="replyText" name="replyText" [disabled]="sending()"></textarea>
              </mat-form-field>
              <button matButton="filled" type="submit" [disabled]="sending() || !replyText.trim()">
                <mat-icon>send</mat-icon>
                {{ (sending() ? 'conversations.sending' : 'conversations.send') | transloco }}
              </button>
            </form>
          } @else {
            <p class="closed-notice">{{ 'conversations.closedNotice' | transloco }}</p>
          }
        }
      }
    </section>
  `,
  styles: [`
    .page-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; margin-bottom: 16px; }
    .new-dialog { margin-bottom: 20px; padding: 20px; }
    .new-dialog h2 { margin: 0 0 16px 0; font-size: 1.15rem; }
    .full-field { width: 100%; display: block; margin-bottom: 8px; }
    .new-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 8px; }
    .error-msg { color: var(--mat-sys-error, #ba1a1a); font-size: 0.9rem; margin: 4px 0 8px 0; }
    .search, .pagination { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; }
    .search mat-form-field { flex: 1; min-width: 180px; }
    .conversation-list { display: grid; gap: 16px; margin-top: 16px; }
    .conversation-card { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; padding: 20px; cursor: pointer; transition: transform 0.1s ease; }
    .conversation-card:hover { transform: translateY(-2px); }
    .conv-info { min-width: 0; flex: 1 1 220px; overflow-wrap: anywhere; }
    .conv-info h2 { font-size: 1.1rem; margin: 0 0 4px 0; }
    .meta { font-size: 0.85rem; color: var(--mat-sys-outline, #777); margin: 0 0 8px 0; }
    .channel-badge { font-weight: 600; }
    .last-msg { font-size: 0.95rem; margin: 0; color: var(--mat-sys-on-surface-variant, #555); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 500px; }
    .pagination { justify-content: flex-end; margin-top: 16px; }

    .thread-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
    .thread-title h2 { margin: 0; font-size: 1.2rem; }
    .thread-title small { color: var(--mat-sys-outline, #777); }
    .messages-container { display: flex; flex-direction: column; gap: 12px; padding: 20px; min-height: 300px; max-height: 500px; overflow-y: auto; }
    .empty-messages { text-align: center; color: var(--mat-sys-outline, #777); margin: auto; }
    .message-bubble { max-width: 75%; padding: 10px 14px; border-radius: 12px; display: flex; flex-direction: column; gap: 4px; }
    .message-bubble.customer { align-self: flex-end; background: var(--mat-sys-primary-container, #e3f2fd); color: var(--mat-sys-on-primary-container, #0d47a1); border-bottom-right-radius: 2px; }
    .message-bubble.agent { align-self: flex-start; background: var(--mat-sys-surface-variant, #f5f5f5); color: var(--mat-sys-on-surface-variant, #212121); border-bottom-left-radius: 2px; }
    .bubble-header { display: flex; justify-content: space-between; gap: 12px; font-size: 0.75rem; opacity: 0.8; font-weight: 500; }
    .message-bubble .body { font-size: 0.95rem; white-space: pre-wrap; word-break: break-word; }
    .reply-box { display: flex; gap: 12px; align-items: flex-end; margin-top: 16px; }
    .reply-input { flex: 1; }
    .closed-notice { text-align: center; color: var(--mat-sys-outline, #777); margin-top: 16px; font-style: italic; }
  `],
})
export class ConversationsPageComponent {
  private readonly api = inject(ApiService);
  readonly conversations = signal<PublishedConversation[]>([]);
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly total = signal(0);
  readonly offset = signal(0);
  search = '';

  readonly activeConversation = signal<PublishedConversation | null>(null);
  readonly messages = signal<ConversationMessage[]>([]);
  readonly messagesLoading = signal(false);
  readonly sending = signal(false);
  replyText = '';

  readonly showNewModal = signal(false);
  readonly creating = signal(false);
  readonly createError = signal(false);
  newSubject = '';
  newMessage = '';

  toggleNewModal() {
    this.showNewModal.update(v => !v);
    this.createError.set(false);
    this.newSubject = '';
    this.newMessage = '';
  }

  async startConversation() {
    const text = this.newMessage.trim();
    if (!text || this.creating()) return;
    this.creating.set(true);
    this.createError.set(false);
    try {
      const firstAccount = this.conversations()[0] as (PublishedConversation & { AccountUUID?: string }) | undefined;
      const accountUUID = firstAccount?.AccountUUID;
      const res = await this.api.post<ApiEnvelope<{ conversationUUID: string }>>('customer-portal/conversations', {
        accountUUID,
        subject: this.newSubject.trim() || null,
        message: text,
      });
      this.toggleNewModal();
      await this.load(0);
      const newUUID = res.data?.conversationUUID;
      if (newUUID) {
        const createdConv = this.conversations().find(c => c.CnvUUID === newUUID);
        if (createdConv) {
          await this.openConversation(createdConv);
        }
      }
    } catch {
      this.createError.set(true);
    } finally {
      this.creating.set(false);
    }
  }

  private request = 0;

  constructor() {
    void this.load(0);
  }

  async load(offset: number) {
    const request = ++this.request;
    this.loading.set(true);
    this.error.set(false);
    this.conversations.set([]);
    try {
      const query = new URLSearchParams({ search: this.search, limit: '20', offset: String(offset) });
      const response = await this.api.get<ApiEnvelope<ConversationPage>>(`customer-portal/conversations?${query}`);
      if (request !== this.request) return;
      this.conversations.set(response.data.items);
      this.total.set(response.data.total);
      this.offset.set(offset);
    } catch {
      if (request === this.request) {
        this.error.set(true);
        this.total.set(0);
      }
    } finally {
      if (request === this.request) this.loading.set(false);
    }
  }

  async openConversation(conv: PublishedConversation) {
    this.activeConversation.set(conv);
    this.messagesLoading.set(true);
    this.messages.set([]);
    this.replyText = '';
    try {
      const response = await this.api.get<ApiEnvelope<MessageList>>(
        `customer-portal/conversations/${encodeURIComponent(conv.CnvUUID)}/messages?limit=50`,
      );
      this.messages.set(response.data.items || []);
    } catch {
      this.messages.set([]);
    } finally {
      this.messagesLoading.set(false);
    }
  }

  closeThread() {
    this.activeConversation.set(null);
    this.messages.set([]);
    this.replyText = '';
    void this.load(this.offset());
  }

  async sendMessage() {
    const conv = this.activeConversation();
    const text = this.replyText.trim();
    if (!conv || !text || this.sending()) return;
    this.sending.set(true);
    try {
      await this.api.post(`customer-portal/conversations/${encodeURIComponent(conv.CnvUUID)}/messages`, {
        body: text,
      });
      this.replyText = '';
      const response = await this.api.get<ApiEnvelope<MessageList>>(
        `customer-portal/conversations/${encodeURIComponent(conv.CnvUUID)}/messages?limit=50`,
      );
      this.messages.set(response.data.items || []);
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      this.sending.set(false);
    }
  }
}
