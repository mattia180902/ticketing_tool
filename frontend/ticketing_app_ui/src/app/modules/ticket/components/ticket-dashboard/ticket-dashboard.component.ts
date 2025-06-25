import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DashboardCountsDto, TicketResponseDto } from '../../../../services/models';
import { TicketControllerService } from '../../../../services/services';
import { KeycloakService } from '../../../../utils/keycloak/keycloak.service';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { BadgeModule } from 'primeng/badge';
import { MessageModule } from 'primeng/message';

type BadgeSeverity = 'success' | 'info' | 'warning' | 'danger' | 'help' | 'primary' | 'secondary' | 'contrast';

@Component({
  selector: 'app-ticket-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    TableModule,
    CardModule,
    TagModule,
    ButtonModule,
    MessageModule,
    BadgeModule
  ],
  templateUrl: './ticket-dashboard.component.html',
  styleUrl: './ticket-dashboard.component.scss'
})
export class TicketDashboardComponent implements OnInit {
  counts: DashboardCountsDto | null = null;
  tickets: TicketResponseDto[] = [];
  roles: string[] = [];
  page = 0;
  size = 5;
  localDraftCount = 0;

  constructor(
    private ticketService: TicketControllerService,
    private keycloakService: KeycloakService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.roles = this.keycloakService.getUserRoles();
    this.loadCounts();
    this.loadTickets();
    this.checkLocalDraft();

    // ascolta evento custom per aggiornare il count in tempo reale
    window.addEventListener('draftCountUpdated', () => this.checkLocalDraft());
  }

  loadCounts(): void {
    this.ticketService.getCounts().subscribe({
      next: (data) => this.counts = data,
      error: (err) => console.error('Errore counts:', err)
    });
  }

  loadTickets(): void {
    if (this.hasRole('ADMIN') || this.isHelperOrPm()) {
      this.ticketService.getTickets({
        pageable: {
          page: 0,
          size: 5
        }
      }).subscribe({
        next: (res) => this.tickets = res.content ?? [],
        error: (err) => console.error('Errore getTickets:', err)
      });
    } else {
      this.ticketService.getMyTickets().subscribe({
        next: (res) => this.tickets = res,
        error: (err) => console.error('Errore getMyTickets:', err)
      });
    }
  }

  checkLocalDraft() {
    this.localDraftCount = localStorage.getItem('draft_ticket') ? 1 : 0;
  }

  hasRole(role: string): boolean {
    return this.roles.includes(role);
  }

  isHelperOrPm(): boolean {
    return this.roles.some(role => ['HELPER_JUNIOR', 'HELPER_SENIOR', 'PM'].includes(role));
  }

  goToTickets(status: string): void {
    if (status === 'DRAFT') {
      this.router.navigate(['/new-ticket']);
    } else {
      this.router.navigate(['/my-tickets'], { queryParams: { status } });
    }
  }

  statusColor(status: string | undefined): BadgeSeverity {
    switch (status) {
      case 'OPEN': return 'info';
      case 'ANSWERED': return 'warning';
      case 'SOLVED': return 'success';
      case 'DRAFT': return 'contrast';
      default: return 'danger';
    }
  }
}

