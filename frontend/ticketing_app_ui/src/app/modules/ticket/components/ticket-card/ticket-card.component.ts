/* eslint-disable @typescript-eslint/no-explicit-any */
import { Component, OnInit } from '@angular/core';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { TicketService } from '../../../../services/services';
import { TicketResponse } from '../../../../services/models';

@Component({
  selector: 'app-ticket-card',
  standalone: true,
  imports: [CardModule, TableModule],
  templateUrl: './ticket-card.component.html',
  styleUrl: './ticket-card.component.scss'
})
export class TicketCardComponent implements OnInit{
  totalTickets = 0;
  openTickets = 0;
  closedTickets = 0;
  resolvedTickets = 0;
  rejectedTickets = 0;
  inProgressTicket = 0;
  recentTickets: TicketResponse[] = [];

  constructor(private ticketService: TicketService) {}

  ngOnInit() {
    this.loadDashboardData();
  }

  loadDashboardData() {
    this.ticketService.getAllTickets().subscribe(response => {
      const tickets: TicketResponse[] = response.content ?? [];
      this.totalTickets = response.totalElements ?? 0;

      this.openTickets = tickets.filter(t => t.status === 'OPEN').length;
      this.closedTickets = tickets.filter(t => t.status === 'CLOSED').length;
      this.resolvedTickets = tickets.filter(t => t.status === 'RESOLVED').length;
      this.rejectedTickets = tickets.filter(t => t.status === 'REJECTED').length;
      this.inProgressTicket = tickets.filter(t => t.status === 'IN_PROGRESS').length;

      this.recentTickets = tickets.slice(0, 5);
    });
  }
}
