import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LoadingBarComponent } from './core/ui/loading/loading-bar.component';
import { NotificationHostComponent } from './core/ui/notification/notification-host.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, LoadingBarComponent, NotificationHostComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {}
