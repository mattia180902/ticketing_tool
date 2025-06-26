// src/app/modules/ticket/components/ticket-dashboard/ticket-dashboard.component.ts

import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { DashboardCountsDto, TicketResponseDto } from '../../../../services/models';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { BadgeModule } from 'primeng/badge';
import { ToastModule } from 'primeng/toast';
import { MessageModule } from 'primeng/message';
import { AuthService } from '../../service/auth.service';

// Per la modale
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { TicketListComponent } from '../ticket-list/ticket-list.component';

// Import per RxJS
import { Subject } from 'rxjs';
import { takeUntil, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

// Importa MessageService di PrimeNG
import { MessageService } from 'primeng/api';
import { TicketManagementService } from '../../../../services/services';

// Definizione del tipo per la gravità del badge
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
    BadgeModule,
    ToastModule
  ],
  templateUrl: './ticket-dashboard.component.html',
  styleUrl: './ticket-dashboard.component.scss',
  providers: [DialogService, MessageService]
})
export class TicketDashboardComponent implements OnInit, OnDestroy {
  counts: DashboardCountsDto | null = null;
  tickets: TicketResponseDto[] = [];
  roles: string[] = [];
  page = 0;
  size = 5;

  ref: DynamicDialogRef | undefined;

  private destroy$ = new Subject<void>();

  constructor(
    private ticketService: TicketManagementService,
    private authService: AuthService,
    private router: Router,
    public dialogService: DialogService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.roles = this.authService.keycloak.getUserRoles();
    this.loadCounts();
    this.loadRecentTickets();
  }

  ngOnDestroy(): void {
    if (this.ref) {
      this.ref.close();
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Carica i conteggi dei ticket per la dashboard in base al ruolo dell'utente.
   */
  loadCounts(): void {
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

  /**
   * Carica gli ultimi 5 ticket recenti.
   * La paginazione è fissa a page 0, size 5, ordinamento per data di creazione discendente.
   */
  loadRecentTickets(): void {
    const pageableParams = { 
      page: this.page, 
      size: this.size, 
      // MODIFICA QUI: Invia solo il nome della proprietà, senza la direzione.
      // Questo dovrebbe evitare il problema di codifica della virgola.
      // Se il backend supporta solo l'ordinamento ascendente per default senza direzione esplicita.
      // O se la direzione va passata in un altro modo.
      sort: ['createdBy'] 
    };
    
    this.ticketService.getTickets({ pageable: pageableParams }).pipe(
      takeUntil(this.destroy$),
      catchError(err => {
        console.error('Errore nel caricamento dei ticket recenti:', err);
        this.messageService.add({ severity: 'error', summary: 'Errore', detail: 'Impossibile caricare i ticket recenti.' });
        return of({ content: [] });
      })
    ).subscribe({
      next: (res) => this.tickets = res.content ?? [],
    });
  }

  /**
   * Reindirizza l'utente o apre una modale in base allo stato del ticket cliccato.
   * Se lo stato è 'DRAFT', cerca la prima bozza e reindirizza al form di creazione/modifica.
   * Altrimenti, apre una modale con la lista dei ticket filtrati per lo stato.
   * @param status Lo stato del ticket su cui filtrare (es. 'OPEN', 'ANSWERED', 'DRAFT').
   */
  goToTicketsByStatus(status: string): void {
    if (status === 'DRAFT') {
      this.ticketService.getMyDrafts().pipe(
        takeUntil(this.destroy$),
        catchError(err => {
          console.error("Errore nel recupero delle bozze:", err);
          this.messageService.add({ severity: 'error', summary: 'Errore', detail: 'Impossibile recuperare le bozze.' });
          this.router.navigate(['/new-ticket']);
          return of([]);
        })
      ).subscribe({
        next: (drafts: TicketResponseDto[]) => {
          if (drafts && drafts.length > 0) {
            this.router.navigate(['/new-ticket'], { queryParams: { ticketId: drafts[0].id } });
          } else {
            this.messageService.add({ severity: 'info', summary: 'Nessuna Bozza', detail: 'Nessuna bozza trovata. Inizia la creazione di un' + ' nuovo ticket.' });
            this.router.navigate(['/new-ticket']);
          }
        }
      });
    } else {
      this.openFilteredTicketListModal(status);
    }
  }

  /**
   * Apre una modale con la lista dei ticket filtrati per uno stato specifico.
   * @param status Lo stato dei ticket da visualizzare nella modale.
   */
  openFilteredTicketListModal(status: string): void {
    this.ref = this.dialogService.open(TicketListComponent, {
      header: `Ticket ${status.toUpperCase()}`,
      width: '90%',
      height: '90%',
      contentStyle: { "max-height": "500px", "overflow": "auto" },
      baseZIndex: 10000,
      data: {
        filterStatus: status,
        isModalSelection: false
      }
    });

    this.ref.onClose.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.loadCounts();
      this.loadRecentTickets();
    });
  }

  /**
   * Controlla se l'utente ha un ruolo specifico.
   * @param role Il ruolo da controllare.
   * @returns True se l'utente ha il ruolo, false altrimenti.
   */
  hasRole(role: string): boolean {
    return this.authService.hasRole(role);
  }

  /**
   * Controlla se l'utente è un helper o un project manager.
   * @returns True se l'utente è HELPER_JUNIOR, HELPER_SENIOR o PM, false altrimenti.
   */
  isHelperOrPm(): boolean {
    return this.authService.isHelperOrPm();
  }

  /**
   * Restituisce la gravità del badge di PrimeNG in base allo stato del ticket.
   * @param status Lo stato del ticket.
   * @returns Una stringa che rappresenta la gravità del badge.
   */
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
