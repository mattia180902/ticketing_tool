import { Component, OnInit } from '@angular/core';
import { TicketDto } from '../../../../services/models';
import { TicketService } from '../../../../services/services';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

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
        this.tickets = data;
      },
      error: (err) => {
        console.error('Errore nel recupero ticket', err);
      }
    });
  }

}
