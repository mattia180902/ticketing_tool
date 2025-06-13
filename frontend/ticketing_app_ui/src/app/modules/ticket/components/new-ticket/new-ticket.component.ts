import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { TicketService } from '../../../../services/services';
import { TicketDto } from '../../../../services/models';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-new-ticket',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './new-ticket.component.html',
  styleUrl: './new-ticket.component.scss'
})
export class NewTicketComponent{
  ticket: TicketDto = {
    title: '',
    description: '',
    priority: 'LOW',
    status: 'OPEN'
  };

  constructor(private ticketService: TicketService, private router: Router) {}

  saveTicket() {
    this.ticketService.createTicket({ body: this.ticket }).subscribe(() => {
      this.router.navigate(['/my-tickets']);
    });
  }
}
