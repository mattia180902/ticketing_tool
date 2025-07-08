/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, Optional, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { Table, TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { PaginatorModule } from 'primeng/paginator';
import { ToastModule } from 'primeng/toast';
import { DialogService, DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { MessageService, ConfirmationService, ConfirmEventType } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { BadgeModule } from 'primeng/badge';
import { CardModule } from 'primeng/card';

import { Subject, Observable, of, combineLatest } from 'rxjs';
import { takeUntil, catchError, debounceTime, distinctUntilChanged, take, filter } from 'rxjs/operators';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

// Importa i servizi e i modelli generati da ng-openapi-gen
import { TicketManagementService } from '../../../../services/services';
import { UserManagementService } from '../../../../services/services'; // Per ottenere la lista degli helper/admin
import {
  PageTicketResponseDto,
  TicketResponseDto,
  UserDto,
} from '../../../../services/models';

import { UserRole } from '../../../../shared/enums/UserRole';
import { TicketStatus } from '../../../../shared/enums/TicketStatus';
import { TicketPriority } from '../../../../shared/enums/TicketPriority'; 
import { AuthService } from '../../service/auth.service';
import { NewTicketComponent } from '../new-ticket/new-ticket.component'; // Per la modale di dettaglio/modifica
import { DialogModule } from 'primeng/dialog'; // Per la modale di assegnazione/rifiuto/escalation
import { TicketDetailsModalComponent } from '../ticket-details-modal/ticket-details-modal.component';
import { TicketFilterParams, TicketFilterComponent } from '../ticket-filter/ticket-filter.component';
import { DraftEditComponent } from '../draft-edit/draft-edit.component';

type BadgeSeverity = 'success' | 'info' | 'warning' | 'danger' | 'help' | 'primary' | 'secondary' | 'contrast';

@Component({
  selector: 'app-ticket-list',
  standalone: true,
  imports: [
    CommonModule,
    TableModule,
    ButtonModule,
    TagModule,
    InputTextModule,
    DropdownModule,
    PaginatorModule,
    ToastModule,
    ConfirmDialogModule,
    BadgeModule,
    FormsModule,
    ReactiveFormsModule,
    DialogModule,
    CardModule,
    DatePipe,
    TicketFilterComponent
],
  templateUrl: './ticket-list.component.html',
  styleUrl: './ticket-list.component.scss',
  providers: [MessageService, ConfirmationService, DialogService]
})
export class TicketListComponent implements OnInit, OnDestroy {
  @ViewChild('dt') dt: Table | undefined;

  tickets: TicketResponseDto[] = [];
  totalRecords = 0;
  loading = true;
  first = 0;
  rows = 10;
  sortField = 'createdDate';
  sortOrder = 'desc';

  selectedStatusFilter: 'ALL' | TicketStatus = 'ALL';
  selectedPriorityFilter: 'ALL' | TicketPriority = 'ALL';
  searchTerm = '';

  initialFilterStatusForChild: 'ALL' | TicketStatus = 'ALL';
  initialFilterPriorityForChild: 'ALL' | TicketPriority = 'ALL';
  initialSearchTermForChild = '';
  disableStatusFilterInChild = false;

  isModalSelectionMode = false;

  displayActionDialog = false;
  actionType: 'assign' | 'reject' | 'escalate' | null = null;
  selectedTicketForAction: TicketResponseDto | null = null;
  availableUsersForAssignment: UserDto[] = [];
  selectedAssigneeId: string | null = null;
  actionDialogHeader = '';
  actionDialogMessage = '';

  ref: DynamicDialogRef | undefined; // Questo è per le modali APERTE DA questo componente

  // NUOVO: Riferimento alla propria modale (se questo componente è una modale)
  public selfRef: DynamicDialogRef | undefined | null = inject(DynamicDialogRef, { optional: true });

  // NUOVO: Flag per gestire il primo lazy load della tabella
  private firstLazyLoadFromTable = true;


  public UserRole = UserRole;
  public TicketStatus = TicketStatus;
  public TicketPriority = TicketPriority;

  private destroy$ = new Subject<void>();
  private initialLoadCompleted = false;

  constructor(
    private ticketService: TicketManagementService,
    private userService: UserManagementService,
    public authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    public dialogService: DialogService,
    @Optional() public dialogConfig: DynamicDialogConfig
  ) {}

  ngOnInit(): void {
    this.loadUsersForAssignment();

    combineLatest([
      this.route.queryParams.pipe(take(1)),
      of(this.dialogConfig)
    ]).pipe(
      takeUntil(this.destroy$),
      filter(() => !this.initialLoadCompleted)
    ).subscribe(([queryParams, dialogConfig]) => {
      this.initialLoadCompleted = true;

      // Determina se siamo in modalità selezione bozza
      if (dialogConfig && dialogConfig.data && dialogConfig.data.isModalSelection) {
        this.isModalSelectionMode = true;
      }

      if (dialogConfig && dialogConfig.data) {
        if (dialogConfig.data.filterStatus && dialogConfig.data.filterStatus !== 'ALL') {
          this.initialFilterStatusForChild = dialogConfig.data.filterStatus;
          this.disableStatusFilterInChild = true;
        } else {
          this.initialFilterStatusForChild = 'ALL';
          this.disableStatusFilterInChild = false;
        }
        if (dialogConfig.data.filterPriority) {
          this.initialFilterPriorityForChild = dialogConfig.data.filterPriority;
        }
        if (dialogConfig.data.searchTerm) {
          this.initialSearchTermForChild = dialogConfig.data.searchTerm;
        }
      } else {
        this.disableStatusFilterInChild = false;
        const statusFromUrl = queryParams['status'] as TicketStatus | 'ALL';
        if (statusFromUrl && (Object.values(TicketStatus).includes(statusFromUrl as TicketStatus) || statusFromUrl === 'ALL')) {
          this.initialFilterStatusForChild = statusFromUrl;
        } else {
          this.initialFilterStatusForChild = 'ALL';
        }
        if (queryParams['priority']) {
          this.initialFilterPriorityForChild = queryParams['priority'];
        }
        if (queryParams['search']) {
          this.initialSearchTermForChild = queryParams['search'];
        }
      }

      this.selectedStatusFilter = this.initialFilterStatusForChild;
      this.selectedPriorityFilter = this.initialFilterPriorityForChild;
      this.searchTerm = this.initialSearchTermForChild;

      // Chiamata esplicita per il caricamento iniziale, bypassando il controllo del lazy load della tabella
      this.loadTickets(null, true);
    });
  }

  ngOnDestroy(): void {
    // Rimosso this.selfRef.close() qui. La modale viene chiusa da handleRowDetails
    // o dal sistema di dialoghi di PrimeNG quando viene distrutta.
    if (this.ref) {
      this.ref.close(); // Chiudi le modali aperte da questo componente
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  onFiltersChanged(params: TicketFilterParams): void {
    this.selectedStatusFilter = params.status;
    this.selectedPriorityFilter = params.priority;
    this.searchTerm = params.search;
    this.first = 0;
    this.loadTickets();
  }

  onClearFilters(): void {
    // I filtri sono già stati resettati nel componente figlio e onFiltersChanged è già stato chiamato.
  }

  /**
   * Carica i ticket dalla API in base ai filtri e alla paginazione correnti.
   * @param event L'evento del paginatore (opzionale).
   * @param isInitialLoadFromNgOnInit Indica se questa è la chiamata iniziale da ngOnInit.
   */
  loadTickets(event?: any, isInitialLoadFromNgOnInit = false): void {
    // Se è il primo lazy load della tabella (event non nullo) E non è la chiamata iniziale da ngOnInit,
    // allora salta questa esecuzione. La chiamata da ngOnInit è quella che vogliamo.
    if (event && this.firstLazyLoadFromTable && !isInitialLoadFromNgOnInit) {
        this.firstLazyLoadFromTable = false; // Marca che il primo lazy load della tabella è stato gestito
        return; // Salta questa chiamata API duplicata
    }

    this.loading = true;

    if (event) {
      this.first = event.first;
      this.rows = event.rows;
      this.sortField = event.sortField || 'createdDate';
      this.sortOrder = (event.sortOrder === 1 ? 'asc' : 'desc'); 
    }

    const page = this.first / this.rows;
    const size = this.rows;
    const sort: string[] = [`${this.sortField},${this.sortOrder}`];

    const params: any = { page, size, sort };

    if (this.selectedStatusFilter !== 'ALL') {
      params.status = this.selectedStatusFilter;
    }
    if (this.selectedPriorityFilter !== 'ALL') {
      params.priority = this.selectedPriorityFilter;
    }
    if (this.searchTerm && this.searchTerm.trim() !== '') {
      params.search = this.searchTerm.trim();
    }

    let apiCall: Observable<PageTicketResponseDto>;

    if (this.isModalSelectionMode) {
      params.status = TicketStatus.DRAFT;
      apiCall = this.ticketService.getMyTicketsAndAssociatedByEmail(params);
    } else if (this.authService.isUser() && !this.authService.hasRole([UserRole.HELPER_JUNIOR, UserRole.HELPER_SENIOR, UserRole.PM, UserRole.ADMIN])) {
        apiCall = this.ticketService.getMyTicketsAndAssociatedByEmail(params);
    } else {
        apiCall = this.ticketService.getTickets(params);
    }

    apiCall.pipe(
      takeUntil(this.destroy$),
      catchError(err => {
        console.error('Errore nel caricamento dei ticket:', err);
        this.messageService.add({ severity: 'error', summary: 'Errore', detail: 'Impossibile caricare i ticket.' });
        this.loading = false;
        return of({ content: [], totalElements: 0 } as PageTicketResponseDto);
      })
    ).subscribe({
      next: (res) => {
        this.tickets = res.content ?? [];
        this.totalRecords = res.totalElements ?? 0;
        this.loading = false;
        // Una volta che i dati sono stati caricati con successo, le successive chiamate lazy load sono permesse
        this.firstLazyLoadFromTable = false; 
      },
    });
  }

  loadUsersForAssignment(): void {
    if (this.authService.isHelperOrPm() || this.authService.isAdminOrPm()) {
      this.userService.getHelpersAndAdmins().pipe(
        takeUntil(this.destroy$),
        catchError(err => {
          console.error('Errore nel caricamento degli utenti per assegnazione:', err);
          this.messageService.add({ severity: 'error', summary: 'Errore', detail: 'Impossibile caricare gli utenti per le azioni.' });
          return of([]);
        })
      ).subscribe(users => {
        this.availableUsersForAssignment = users.filter(u => u.id !== this.authService.getUserId());
      });
    }
  }

  getBadgeSeverity(status: TicketStatus | undefined): BadgeSeverity {
    switch (status) {
      case TicketStatus.OPEN: return 'info';
      case TicketStatus.ANSWERED: return 'warning';
      case TicketStatus.SOLVED: return 'success';
      case TicketStatus.DRAFT: return 'contrast';
      default: return 'danger';
    }
  }

  /**
   * Gestisce il click sulla riga del ticket.
   * Se in modalità selezione bozza, chiude la modale con l'ID della bozza.
   * Altrimenti, apre la modale di dettaglio/modifica.
   * @param ticket Il ticket selezionato.
   */
  handleRowDetails(ticket: TicketResponseDto): void {
    if (this.isModalSelectionMode) {
      // In modalità selezione bozza, solo le bozze dell'utente corrente possono essere "caricate"
      if (ticket.status === TicketStatus.DRAFT && this.authService.isUser() && ticket.userId === this.authService.getUserId()) {
        this.selfRef?.close(ticket.id); // USA selfRef per chiudere la propria modale e passare il valore
      } else {
        this.messageService.add({ severity: 'warn', summary: 'Selezione Non Valida', detail: 'Puoi selezionare solo le tue bozze.' });
      }
    } else {
      // Logica esistente per aprire dettagli/modifica
      const isOwner = ticket.userId === this.authService.getUserId();
      const isDraft = ticket.status === TicketStatus.DRAFT;

      if (isDraft && isOwner && this.authService.isUser()) {
        // Apri DraftEditComponent per la modifica di una bozza
        this.openDraftEditModal(ticket.id!);
      } else {
        // Apri TicketDetailsModalComponent per tutti gli altri casi
        this.openTicketDetailsModal(ticket);
      }
    }
  }

  openTicketDetailsModal(ticket: TicketResponseDto): void {
    this.ref = this.dialogService.open(TicketDetailsModalComponent, {
      header: 'Dettagli Ticket',
      width: '90vw',
      height: 'auto',
      contentStyle: { "max-height": "calc(100vh - 100px)", "overflow": "auto" },
      baseZIndex: 10000,
      data: { ticket: ticket }
    });

    this.ref.onClose.pipe(takeUntil(this.destroy$)).subscribe(result => {
      if (result === 'Deleted') {
        this.messageService.add({ severity: 'success', summary: 'Successo', detail: 'Ticket eliminato con successo!' });
        this.loadTickets();
      } else if (result === 'OpenNewTicket') {
        this.navigateToCategorySelection();
      } else if (result === 'StatusUpdated') {
        this.messageService.add({ severity: 'success', summary: 'Successo', detail: 'Stato ticket aggiornato con successo!' });
        this.loadTickets();
      } else {
        this.loadTickets();
      }
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

    this.ref.onClose.pipe(takeUntil(this.destroy$)).subscribe(result => {
      if (result === 'Deleted') {
        this.messageService.add({ severity: 'success', summary: 'Successo', detail: 'Bozza eliminata con successo!' });
      } else if (result === true) { // Bozza finalizzata
        this.messageService.add({ severity: 'success', summary: 'Successo', detail: 'Bozza finalizzata come ticket!' });
      }
      this.loadTickets(); // Ricarica la lista dopo modifica/eliminazione/finalizzazione
    });
  }

  showAssignDialog(ticket: TicketResponseDto): void {
    if (!this.authService.isAdminOrPm()) {
      this.messageService.add({ severity: 'error', summary: 'Non Autorizzato', detail: 'Non hai i permessi per assegnare ticket.' });
      return;
    }
    if (ticket.status === TicketStatus.DRAFT || ticket.status === TicketStatus.SOLVED) {
      this.messageService.add({ severity: 'warn', summary: 'Azione non consentita', detail: 'Non puoi assegnare bozze o ticket risolti.' });
      return;
    }
    this.selectedTicketForAction = ticket;
    this.actionType = 'assign';
    this.actionDialogHeader = `Assegna Ticket #${ticket.id}`;
    this.actionDialogMessage = `Seleziona un utente a cui assegnare il ticket "${ticket.title}".`;
    this.selectedAssigneeId = ticket.assignedToId || null;
    this.displayActionDialog = true;
  }

  showRejectDialog(ticket: TicketResponseDto): void {
    if (!this.authService.isHelperOrPm() && !this.authService.isAdminOrPm()) {
      this.messageService.add({ severity: 'error', summary: 'Non Autorizzato', detail: 'Non hai i permessi per rifiutare ticket.' });
      return;
    }
    if (this.authService.isHelperOrPm() && ticket.assignedToId !== this.authService.getUserId()) {
      this.messageService.add({ severity: 'error', summary: 'Non Autorizzato', detail: 'Puoi rifiutare solo ticket assegnati a te.' });
      return;
    }
    if (ticket.status !== TicketStatus.OPEN) {
      this.messageService.add({ severity: 'warn', summary: 'Azione non consentita', detail: 'Puoi rifiutare solo ticket in stato OPEN.' });
      return;
    }
    this.selectedTicketForAction = ticket;
    this.actionType = 'reject';
    this.actionDialogHeader = `Rifiuta Ticket #${ticket.id}`;
    this.actionDialogMessage = `Seleziona un utente a cui riassegnare il ticket "${ticket.title}".`;
    this.selectedAssigneeId = null;
    this.displayActionDialog = true;
  }

  showEscalateDialog(ticket: TicketResponseDto): void {
    if (!this.authService.isHelperOrPm() && !this.authService.isAdminOrPm()) {
      this.messageService.add({ severity: 'error', summary: 'Non Autorizzato', detail: 'Non hai i permessi per escalare ticket.' });
      return;
    }
    if (this.authService.isHelperOrPm() && ticket.assignedToId !== this.authService.getUserId()) {
      this.messageService.add({ severity: 'error', summary: 'Non Autorizzato', detail: 'Puoi escalare solo ticket assegnati a te.' });
      return;
    }
    if (ticket.status !== TicketStatus.ANSWERED) {
      this.messageService.add({ severity: 'warn', summary: 'Azione non consentita', detail: 'Puoi escalare solo ticket in stato ANSWERED.' });
      return;
    }
    this.selectedTicketForAction = ticket;
    this.actionType = 'escalate';
    this.actionDialogHeader = `Escala Ticket #${ticket.id}`;
    this.actionDialogMessage = `Seleziona un utente a cui escalare il ticket "${ticket.title}".`;
    this.selectedAssigneeId = null;
    this.displayActionDialog = true;
  }

  performAction(): void {
    if (!this.selectedTicketForAction || !this.selectedAssigneeId) {
      this.messageService.add({ severity: 'error', summary: 'Errore', detail: 'Seleziona un ticket e un assegnatario.' });
      return;
    }

    const ticketId = this.selectedTicketForAction.id!;
    const assigneeId = this.selectedAssigneeId;
    let actionObservable: Observable<TicketResponseDto>;

    switch (this.actionType) {
      case 'assign':
        actionObservable = this.ticketService.assignTicket({ ticketId: ticketId, helperId: assigneeId });
        break;
      case 'reject':
        actionObservable = this.ticketService.rejectTicket({ ticketId: ticketId, newAssignedToId: assigneeId });
        break;
      case 'escalate':
        actionObservable = this.ticketService.escalateTicket({ ticketId: ticketId, newAssignedToId: assigneeId });
        break;
      default:
        this.messageService.add({ severity: 'error', summary: 'Errore', detail: 'Tipo di azione non valido.' });
        return;
    }

    actionObservable.pipe(
      takeUntil(this.destroy$),
      catchError(err => {
        console.error(`Errore nell'azione ${this.actionType} per ticket ${ticketId}:`, err);
        this.messageService.add({ severity: 'error', summary: 'Errore', detail: `Impossibile completare l'azione: ${err.error?.message || err.message}` });
        return of(null);
      })
    ).subscribe({
      next: (res) => {
        if (res) {
          this.messageService.add({ severity: 'success', summary: 'Successo', detail: `Ticket #${ticketId} ${this.actionType === 'assign' ? 'assegnato' : (this.actionType === 'reject' ? 'rifiutato' : 'escalato')} con successo.` });
          this.displayActionDialog = false;
          this.selectedTicketForAction = null;
          this.selectedAssigneeId = null;
          this.loadTickets();
        }
      }
    });
  }

  acceptTicket(ticket: TicketResponseDto): void {
    this.confirmationService.confirm({
      message: `Sei sicuro di voler accettare il ticket "${ticket.title}"?`,
      header: 'Conferma Accettazione',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.ticketService.acceptTicket({ ticketId: ticket.id! }).pipe(
          takeUntil(this.destroy$),
          catchError(err => {
            console.error('Errore nell\'accettazione del ticket:', err);
            this.messageService.add({ severity: 'error', summary: 'Errore', detail: `Impossibile accettare il ticket: ${err.error?.message || err.message}` });
            return of(null);
          })
        ).subscribe({
          next: (res) => {
            if (res) {
              this.messageService.add({ severity: 'success', summary: 'Successo', detail: `Ticket #${ticket.id} accettato con successo.` });
              this.loadTickets();
            }
          }
        });
      },
      reject: (type: ConfirmEventType) => {
        this.messageService.add({ severity: 'info', summary: 'Annullato', detail: 'Accettazione annullata.' });
      }
    });
  }

  updateTicketStatus(ticket: TicketResponseDto, newStatus: TicketStatus): void {
    this.confirmationService.confirm({
      message: `Sei sicuro di voler cambiare lo stato del ticket "${ticket.title}" a "${newStatus}"?`,
      header: 'Conferma Cambio Stato',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.ticketService.updateTicketStatus({ ticketId: ticket.id!, newStatus: newStatus }).pipe(
          takeUntil(this.destroy$),
          catchError(err => {
            console.error('Errore nell\'aggiornamento stato ticket:', err);
            this.messageService.add({ severity: 'error', summary: 'Errore', detail: `Impossibile aggiornare lo stato: ${err.error?.message || err.message}` });
            return of(null);
          })
        ).subscribe({
          next: (res) => {
            if (res) {
              this.messageService.add({ severity: 'success', summary: 'Successo', detail: `Stato ticket #${ticket.id} aggiornato a ${newStatus}.` });
              this.loadTickets();
            }
          }
        });
      },
      reject: (type: ConfirmEventType) => {
        this.messageService.add({ severity: 'info', summary: 'Annullato', detail: 'Cambio stato annullato.' });
      }
    });
  }

  deleteTicket(ticket: TicketResponseDto): void {
    this.confirmationService.confirm({
      message: `Sei sicuro di voler eliminare il ticket "${ticket.title}"? Questa operazione è irreversibile.`,
      header: 'Conferma Eliminazione',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.ticketService.deleteTicket({ ticketId: ticket.id! }).pipe(
          takeUntil(this.destroy$),
          catchError(err => {
            console.error('Errore nell\'eliminazione del ticket:', err);
            this.messageService.add({ severity: 'error', summary: 'Errore', detail: `Impossibile eliminare il ticket: ${err.error?.message || err.message}` });
            return of(null);
          })
        ).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Successo', detail: `Ticket #${ticket.id} eliminato con successo.` });
            this.loadTickets();
          }
        });
      },
      reject: (type: ConfirmEventType) => {
        this.messageService.add({ severity: 'info', summary: 'Annullato', detail: 'Eliminazione annullata.' });
      }
    });
  }

  showEditOrDetailsButton(ticket: TicketResponseDto): boolean {
    const isOwner = ticket.userId === this.authService.getUserId();
    if (this.authService.isUser()) {
      return ticket.status === TicketStatus.DRAFT && isOwner;
    }
    return this.authService.isHelperOrPm() || this.authService.isAdminOrPm();
  }

  showAcceptButton(ticket: TicketResponseDto): boolean {
    const isAssignedToMe = ticket.assignedToId === this.authService.getUserId();
    return ticket.status === TicketStatus.OPEN && (isAssignedToMe);
  }

  showRejectButton(ticket: TicketResponseDto): boolean {
    const isAssignedToMe = ticket.assignedToId === this.authService.getUserId();
    return ticket.status === TicketStatus.OPEN && (isAssignedToMe);
  }

  showEscalateButton(ticket: TicketResponseDto): boolean {
    const isAssignedToMe = ticket.assignedToId === this.authService.getUserId();
    return ticket.status === TicketStatus.ANSWERED && (isAssignedToMe || this.authService.isAdminOrPm());
  }

  showSolveButton(ticket: TicketResponseDto): boolean {
    const isAssignedToMe = ticket.assignedToId === this.authService.getUserId();
    return ticket.status === TicketStatus.ANSWERED && (isAssignedToMe || this.authService.isAdminOrPm());
  }

  showDeleteButton(ticket: TicketResponseDto): boolean {
    const isOwner = ticket.userId === this.authService.getUserId();
    const isAssignedToMe = ticket.assignedToId === this.authService.getUserId();
    const canHelperPmDelete = (this.authService.isHelperOrPm() || this.authService.isAdminOrPm()) && isAssignedToMe && ticket.status !== TicketStatus.SOLVED;

    return this.authService.isAdmin() || (this.authService.isUser() && ticket.status === TicketStatus.DRAFT && isOwner) || canHelperPmDelete;
  }

  navigateToCategorySelection(): void {
    if (this.selfRef) { // Se è una modale, chiudila
      this.selfRef.close('OpenNewTicket');
    } else { // Altrimenti, naviga
      this.router.navigate(['/categories']);
    }
  }
}