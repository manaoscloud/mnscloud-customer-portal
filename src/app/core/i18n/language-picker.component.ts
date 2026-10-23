import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';
import { PortalI18nService } from './portal-i18n.service';

/** Icon button with the three portal languages; the choice is kept like the App's manual choice. */
@Component({
  selector: 'mcp-language-picker',
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <button
      matIconButton
      type="button"
      [matMenuTriggerFor]="languageMenu"
      [matTooltip]="'lang.label' | transloco"
      [attr.aria-label]="'lang.label' | transloco"
    >
      <mat-icon>translate</mat-icon>
    </button>
    <mat-menu #languageMenu="matMenu" xPosition="before">
      @for (language of i18n.languages; track language) {
        <button
          mat-menu-item
          type="button"
          [attr.lang]="language"
          [attr.aria-current]="language === i18n.language() ? 'true' : null"
          (click)="void i18n.setLanguage(language)"
        >
          <mat-icon>{{ language === i18n.language() ? 'check' : '' }}</mat-icon>
          <span>{{ 'lang.' + language | transloco }}</span>
        </button>
      }
    </mat-menu>
  `,
})
export class LanguagePickerComponent {
  readonly i18n = inject(PortalI18nService);
}
