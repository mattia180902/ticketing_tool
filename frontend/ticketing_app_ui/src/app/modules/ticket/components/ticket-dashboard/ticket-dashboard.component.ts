import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { BadgeModule } from 'primeng/badge';
import { MessageModule } from 'primeng/message';
import { ToastModule } from 'primeng/toast';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { MessageService } from 'primeng/api';

import { Subject, Observable, of } from 'rxjs';
import { takeUntil, catchError } from 'rxjs/operators';

import { AuthService } from '../../service/auth.service';

import { TicketDetailsModalComponent } from '../ticket-details-modal/ticket-details-modal.component'; 
import { DashboardCountsDto, PageTicketResponseDto, TicketResponseDto } from '../../../../services/models';
import { UserRole } from '../../../../shared/enums/UserRole';
import { TicketStatus } from '../../../../shared/enums/TicketStatus';
import { TicketManagementService } from '../../../../services/services';
import { TicketListComponent } from '../ticket-list/ticket-list.component';
import { DraftEditComponent } from '../draft-edit/draft-edit.component';


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
    BadgeModule,
    MessageModule,
    ToastModule,
    DatePipe
  ],
  templateUrl: './ticket-dashboard.component.html',
  styleUrl: './ticket-dashboard.component.scss',
  providers: [DialogService, MessageService] 
})
export class TicketDashboardComponent implements OnInit, OnDestroy {
  counts: DashboardCountsDto | null = null;
  tickets: TicketResponseDto[] = [];
  roles: UserRole[] = [];
  page = 0;
  size = 5;

  ref: DynamicDialogRef | undefined;

  public UserRole = UserRole;
  public TicketStatus = TicketStatus;

  private destroy$ = new Subject<void>();

  constructor(
    private ticketService: TicketManagementService,
    public authService: AuthService,
    private router: Router,
    public dialogService: DialogService, 
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.authService.currentUserRoles$
      .pipe(takeUntil(this.destroy$))
      .subscribe(roles => {
        this.roles = roles;
        this.loadDashboardCounts();
        this.loadRecentTickets();
      });
  }

  ngOnDestroy(): void {
    if (this.ref) {
      this.ref.close();
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadDashboardCounts(): void {
    this.ticketService.getDashboardCounts().pipe(
      takeUntil(this.destroy$),
      catchError(err => {
        console.error('Errore nel caricamento dei conteggi della dashboard:', err);
        this.messageService.add({ severity: 'error', summary: 'Errore', detail: 'Impossibile caricare i conteggi dei ticket.' });
        return of(null);
      })
    ).subscribe({
      next: (data) => {
        if (data) {
          this.counts = data;
        }
      }
    });
  }

  loadRecentTickets(): void {
    const params = {
      page: this.page,
      size: this.size,
      sort: ['createdDate','desc'] 
    };

    let apiCall: Observable<PageTicketResponseDto>;

    // Utilizza hasAnyRole per una verifica più robusta dei ruoli
    if (this.authService.isUser() && !this.authService.hasRole([UserRole.HELPER_JUNIOR, UserRole.HELPER_SENIOR, UserRole.PM, UserRole.ADMIN])) {
        apiCall = this.ticketService.getMyTicketsAndAssociatedByEmail(params);
    } else {
        apiCall = this.ticketService.getTickets(params);
    }

    apiCall.pipe(
      takeUntil(this.destroy$),
      catchError(err => {
        console.error('Errore nel caricamento dei ticket recenti:', err);
        this.messageService.add({ severity: 'error', summary: 'Errore', detail: 'Impossibile caricare i ticket recenti.' });
        return of({ content: [], totalElements: 0 } as PageTicketResponseDto);
      })
    ).subscribe({
      next: (res) => {
        this.tickets = res.content ?? [];
      },
    });
  }

  openTicketListModal(status: 'ALL' | TicketStatus): void {
    let headerText = '';
    const filterStatus: TicketStatus | 'ALL' = status;
    let disableStatusFilter = false; 

    switch (status) {
      case 'ALL':
        headerText = 'Tutti i Ticket';
        if (this.authService.isUser()) {
          headerText = 'Tutti i miei Ticket e Associati';
        }
        disableStatusFilter = false; // Abilita il filtro stato per "Tutti i ticket"
        break;
      case TicketStatus.OPEN:
        headerText = 'Ticket Aperti';
        disableStatusFilter = true; // Disabilita il filtro stato per gli stati specifici
        break;
      case TicketStatus.ANSWERED:
        headerText = 'Ticket In Risposta';
        disableStatusFilter = true;
        break;
      case TicketStatus.SOLVED:
        headerText = 'Ticket Risolti';
        disableStatusFilter = true;
        break;
      case TicketStatus.DRAFT:
        headerText = 'Bozze';
        disableStatusFilter = true;
        break;
      default:
        headerText = 'Lista Ticket';
        disableStatusFilter = false;
        break;
    }

    this.ref = this.dialogService.open(TicketListComponent, {
      header: headerText,
      width: '90%',
      height: '90%',
      contentStyle: { "max-height": "calc(100vh - 100px)", "overflow": "auto" },
      baseZIndex: 10000,
      data: {
        filterStatus: filterStatus,
        isModalSelection: false, 
        disableStatusFilter: disableStatusFilter
      }
    });

    this.ref.onClose.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.loadDashboardCounts(); 
      this.loadRecentTickets(); 
    });
  }

  /**
   * Apre la modale per modificare una bozza esistente usando DraftEditComponent.
   * @param ticketId L'ID della bozza da modificare.
   */
  openDraftEditModal(ticketId: number): void { 
    this.ref = this.dialogService.open(DraftEditComponent, {
      header: 'Modifica Bozza',
      width: '90%',
      height: '90%',
      contentStyle: { "max-height": "calc(100vh - 100px)", "overflow": "auto" },
      baseZIndex: 10000,
      data: {
        ticketId: ticketId // Passa l'ID della bozza
      }
    });

    this.ref.onClose.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.loadDashboardCounts();
      this.loadRecentTickets();
    });
  }

  /**
   * Apre la modale dei dettagli del ticket usando TicketDetailsModalComponent.
   * @param ticket Il ticket da visualizzare.
   */
  openTicketDetailsModal(ticket: TicketResponseDto): void {
    this.ref = this.dialogService.open(TicketDetailsModalComponent, {
      header: 'Dettagli Ticket',
      width: '90vw',
      height: 'auto',
      contentStyle: { "max-height": "calc(100vh - 100px)", "overflow": "auto" },
      baseZIndex: 10000,
      data: {
        ticket: ticket
      }
    });

    this.ref.onClose.pipe(takeUntil(this.destroy$)).subscribe(result => {
      if (result === 'Deleted') {
        this.messageService.add({ severity: 'success', summary: 'Successo', detail: 'Ticket eliminato con successo!' });
        this.loadDashboardCounts();
        this.loadRecentTickets();
      } else if (result === 'OpenNewTicket') {
        this.navigateToCategorySelection();
      } else if (result === 'StatusUpdated') {
        this.messageService.add({ severity: 'success', summary: 'Successo', detail: 'Stato ticket aggiornato con successo!' });
        this.loadDashboardCounts();
        this.loadRecentTickets();
      } else {
        this.loadDashboardCounts();
        this.loadRecentTickets();
      }
    });
  }

  /**
   * Gestisce il click sul pulsante "Dettagli" nella tabella dei ticket recenti.
   * Decide se aprire DraftEditComponent (per bozze dell'utente) o TicketDetailsModalComponent.
   * @param ticket Il ticket su cui è stato cliccato.
   */
  handleRecentTicketDetails(ticket: TicketResponseDto): void {
    const isOwner = ticket.userId === this.authService.getUserId();
    
    if (ticket.status === TicketStatus.DRAFT && isOwner) {
      this.openDraftEditModal(ticket.id!); // Usa il nuovo metodo per aprire la modale di modifica bozza
    } else {
      this.openTicketDetailsModal(ticket);
    }
  }

  hasRole(role: UserRole): boolean {
    return this.authService.hasRole(role);
  }

  navigateToCategorySelection(): void {
    this.router.navigate(['/categories']);
  }

  statusColor(status: TicketStatus | undefined): BadgeSeverity {
    switch (status) {
      case TicketStatus.OPEN: return 'info';
      case TicketStatus.ANSWERED: return 'warning';
      case TicketStatus.SOLVED: return 'success';
      case TicketStatus.DRAFT: return 'contrast';
      default: return 'danger';
    }
  }
}
