import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatIconRegistry } from '@angular/material/icon';
import { ThemeService } from './core/theme/theme.service';
import { AppUpdateNoticeComponent } from './core/update/app-update-notice.component';

@Component({
  selector: 'mcp-root',
  imports: [RouterOutlet, AppUpdateNoticeComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: '<router-outlet /><mcp-app-update-notice />',
})
export class AppComponent {
  constructor() {
    inject(MatIconRegistry).setDefaultFontSetClass('material-icons-outlined');
    inject(ThemeService);
  }
}
