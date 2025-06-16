import { Component, OnInit } from '@angular/core';
import { TicketService } from '../../../../services/services';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TicketDto } from '../../../../services/models';

@Component({
  selector: 'app-ticket-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ticket-list.component.html',
  styleUrl: './ticket-list.component.scss'
})
export class TicketListComponent implements OnInit {

  tickets: TicketDto[] = [];

  constructor(private ticketService: TicketService, private router: Router) {}

  ngOnInit(): void {
    this.loadTickets();
  }

  loadTickets() {
    this.ticketService.getAllTickets().subscribe({
      next: (data) => {
        this.tickets = (data.content ?? []).map(ticket => ({
          id: ticket.id,
          title: ticket.title ?? '',
          description: ticket.description ?? '',
          priority: ticket.priority ?? 'LOW',  // fallback se undefined
          status: ticket.status ?? 'OPEN'     // fallback se undefined
        }));
      },
      error: (err) => {
        console.error('Errore nel recupero ticket', err);
      }
    });
  }
}
