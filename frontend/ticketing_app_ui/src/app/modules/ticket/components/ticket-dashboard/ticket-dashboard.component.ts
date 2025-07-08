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

// Importa il tuo AuthService personalizzato
import { AuthService } from '../../service/auth.service';

// Importa le componenti che verranno aperte in modale
import { NewTicketComponent } from '../new-ticket/new-ticket.component';
import { TicketDetailsModalComponent } from '../ticket-details-modal/ticket-details-modal.component'; // Importa la modale dei dettagli
import { DashboardCountsDto, PageTicketResponseDto, TicketResponseDto } from '../../../../services/models';
import { UserRole } from '../../../../shared/enums/UserRole';
import { TicketStatus } from '../../../../shared/enums/TicketStatus';
import { TicketManagementService } from '../../../../services/services';
import { TicketListComponent } from '../ticket-list/ticket-list.component';


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

    if (this.authService.isUser()) {
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

    switch (status) {
      case 'ALL':
        headerText = 'Tutti i Ticket';
        if (this.authService.isUser()) {
          headerText = 'Tutti i miei Ticket e Associati';
        }
        break;
      case TicketStatus.OPEN:
        headerText = 'Ticket Aperti';
        break;
      case TicketStatus.ANSWERED:
        headerText = 'Ticket In Risposta';
        break;
        case TicketStatus.SOLVED:
        headerText = 'Ticket Risolti';
        break;
      case TicketStatus.DRAFT:
        headerText = 'Bozze';
        break;
      default:
        headerText = 'Lista Ticket';
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
        isModalSelection: false 
      }
    });

    this.ref.onClose.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.loadDashboardCounts(); 
      this.loadRecentTickets(); 
    });
  }

  openNewTicketEditModal(ticketId: number | null, isDraft: boolean, isReadOnly: boolean): void {
    this.ref = this.dialogService.open(NewTicketComponent, {
      header: isDraft ? 'Modifica Bozza' : 'Dettagli Ticket / Modifica',
      width: '90%',
      height: '90%',
      contentStyle: { "max-height": "calc(100vh - 100px)", "overflow": "auto" },
      baseZIndex: 10000,
      data: {
        ticketId: ticketId,
        isDraft: isDraft,
        isReadOnly: isReadOnly
      }
    });

    this.ref.onClose.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.loadDashboardCounts();
      this.loadRecentTickets();
    });
  }

  /**
   * Apre la modale dei dettagli del ticket usando TicketDetailsModalComponent.
   * Modificato per forzare la larghezza.
   * @param ticket Il ticket da visualizzare.
   */
  openTicketDetailsModal(ticket: TicketResponseDto): void {
    this.ref = this.dialogService.open(TicketDetailsModalComponent, {
      header: 'Dettagli Ticket',
      width: '90vw', // <--- Imposta la larghezza desiderata qui
      height: 'auto', // Lascia l'altezza automatica o imposta un max-height
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


  handleRecentTicketDetails(ticket: TicketResponseDto): void {
    const isOwner = ticket.userId === this.authService.getUserId();
    
    if (this.authService.isUser() && ticket.status === TicketStatus.DRAFT && isOwner) {
      this.openNewTicketEditModal(ticket.id!, true, false);
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
