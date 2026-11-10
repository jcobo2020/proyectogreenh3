import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NoticeService } from './@core/services/notice.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly notice = inject(NoticeService);
}
