/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/modules/ticket/components/ticket-list/ticket-list.component.ts

import { Component, OnInit, OnDestroy, inject, Optional, ViewChild } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Table, TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { PaginatorModule } from 'primeng/paginator';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DynamicDialogRef, DynamicDialogConfig, DialogService } from 'primeng/dynamicdialog';
import { MessageService, ConfirmationService, ConfirmEventType } from 'primeng/api';
import { BadgeModule } from 'primeng/badge';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';

import { Subject, of, combineLatest, Observable } from 'rxjs'; // Aggiunto Observable
import { takeUntil, catchError, take, filter } from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';

import { TicketManagementService } from '../../../../services/services';
import { UserManagementService } from '../../../../services/services';
import { PageTicketResponseDto, TicketResponseDto, UserDto } from '../../../../services/models';
import { TicketStatus } from '../../../../shared/enums/TicketStatus';
import { TicketPriority } from '../../../../shared/enums/TicketPriority';
import { UserRole } from '../../../../shared/enums/UserRole';
import { AuthService } from '../../service/auth.service';
import { NewTicketComponent } from '../new-ticket/new-ticket.component';
import { TicketDetailsModalComponent } from '../ticket-details-modal/ticket-details-modal.component';

import { TicketFilterComponent, TicketFilterParams } from '../ticket-filter/ticket-filter.component';
import { DialogModule } from 'primeng/dialog';

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
  filterOwnerId: string | null = null;

  displayActionDialog = false;
  actionType: 'assign' | 'reject' | 'escalate' | null = null;
  selectedTicketForAction: TicketResponseDto | null = null;
  availableUsersForAssignment: UserDto[] = [];
  selectedAssigneeId: string | null = null;
  actionDialogHeader = '';
  actionDialogMessage = '';

  ref: DynamicDialogRef | undefined;

  public selfRef: DynamicDialogRef | undefined | null = inject(DynamicDialogRef, { optional: true });

  private firstLazyLoadFromTable = true;


  public UserRole = UserRole;
  public TicketStatus = TicketStatus;
  public TicketPriority = TicketPriority;

  private destroy$ = new Subject<void>();
  private initialLoadCompleted = false;

  currentUserId = '';
  currentUserEmail = '';
  isUserRole = false;
  isHelperOrPmRole = false;
  isAdminRole = false;
  isAdminOrPmRole = false;

  constructor(
    private ticketService: TicketManagementService,
    private userService: UserManagementService,
    public authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    public dialogService: DialogService,
    @Optional() public dialogConfig: DynamicDialogConfig // Assicurati che sia Optional
  ) {}

  ngOnInit(): void {
    this.currentUserId = this.authService.getUserId();
    this.currentUserEmail = this.authService.getUserEmail();
    this.isUserRole = this.authService.isUser();
    this.isHelperOrPmRole = this.authService.isHelperOrPm();
    this.isAdminRole = this.authService.isAdmin();
    this.isAdminOrPmRole = this.authService.isAdminOrPm();

    this.loadUsersForAssignment();

    // Modifica qui: Prioritizza dialogConfig.data per i filtri iniziali
    // Esegui la logica di inizializzazione dei filtri solo una volta
    if (!this.initialLoadCompleted) {
      this.initialLoadCompleted = true;

      if (this.dialogConfig && this.dialogConfig.data) {
        // Se è una modale di selezione bozza (dal pulsante "Carica Bozza" in NewTicketComponent)
        if (this.dialogConfig.data.isModalSelection) {
          this.isModalSelectionMode = true;
          this.initialFilterStatusForChild = TicketStatus.DRAFT;
          this.selectedStatusFilter = TicketStatus.DRAFT;
          this.filterOwnerId = this.currentUserId;
          this.disableStatusFilterInChild = true;
        } 
        // Se è una modale aperta dalla dashboard (card di stato)
        else if (this.dialogConfig.data.filterStatus) {
          this.initialFilterStatusForChild = this.dialogConfig.data.filterStatus;
          this.selectedStatusFilter = this.dialogConfig.data.filterStatus;
          this.disableStatusFilterInChild = this.dialogConfig.data.disableStatusFilter || false;
          
          // Passa anche gli altri filtri se presenti nel dialogConfig.data
          if (this.dialogConfig.data.filterPriority) {
              this.initialFilterPriorityForChild = this.dialogConfig.data.filterPriority;
              this.selectedPriorityFilter = this.dialogConfig.data.filterPriority;
          }
          if (this.dialogConfig.data.filterSearch) {
              this.initialSearchTermForChild = this.dialogConfig.data.filterSearch;
              this.searchTerm = this.dialogConfig.data.filterSearch;
          }
        }
      } 
      // Se non è una modale (aperto direttamente via routing)
      else {
        // Mantiene la logica esistente per i queryParams
        const queryParams = this.route.snapshot.queryParams;
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
        this.disableStatusFilterInChild = false; // Di default non disabilitato se aperto via routing
      }

      // Assicurati che i filtri locali siano sincronizzati con quelli iniziali per il figlio
      this.selectedStatusFilter = this.initialFilterStatusForChild;
      this.selectedPriorityFilter = this.initialFilterPriorityForChild;
      this.searchTerm = this.initialSearchTermForChild;

      this.loadTickets(null, true);
    }
  }

  ngOnDestroy(): void {
    if (this.ref) {
      this.ref.close();
    }
    // Chiudi anche selfRef se è stato aperto da un altro componente
    if (this.selfRef) {
      this.selfRef.close();
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  onFiltersChanged(params: TicketFilterParams): void {
    this.selectedStatusFilter = params.status;
    this.selectedPriorityFilter = params.priority;
    this.searchTerm = params.search;
    this.first = 0; // Reset paginazione ad ogni cambio filtro
    this.loadTickets();
  }

  onClearFilters(): void {
    // Questa funzione viene chiamata quando il componente figlio (TicketFilterComponent)
    // emette l'evento clearFiltersEvent.
    // A questo punto, il TicketFilterComponent ha già resettato i suoi valori interni
    // e ha già emesso un filtersChanged con i nuovi valori.
    // Quindi, qui dobbiamo solo assicurarci che i filtri locali siano sincronizzati
    // con i valori che il TicketFilterComponent ha resettato.
    // Il filtro di stato deve rispettare la disabilitazione.

    // Se il filtro di stato è disabilitato, mantiene il suo valore iniziale
    if (this.disableStatusFilterInChild) {
      this.selectedStatusFilter = this.initialFilterStatusForChild; // Mantiene il valore iniziale
    } else {
      this.selectedStatusFilter = 'ALL'; // Resetta a ALL se non disabilitato
    }
    this.selectedPriorityFilter = 'ALL';
    this.searchTerm = '';
    this.first = 0; // Reset paginazione

    this.loadTickets(); // Ricarica i ticket con i filtri aggiornati
  }

  /**
   * Carica i ticket dalla API in base ai filtri e alla paginazione correnti.
   * @param event L'evento del paginatore (opzionale).
   * @param isInitialLoadFromNgOnInit Indica se questa è la chiamata iniziale da ngOnInit.
   */
  loadTickets(event?: any, isInitialLoadFromNgOnInit = false): void {
    if (event && this.firstLazyLoadFromTable && !isInitialLoadFromNgOnInit) {
        this.firstLazyLoadFromTable = false;
        return;
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

    // Applica i filtri solo se non sono 'ALL' o vuoti
    if (this.selectedStatusFilter !== 'ALL') {
      params.status = this.selectedStatusFilter;
    }
    if (this.selectedPriorityFilter !== 'ALL') {
      params.priority = this.selectedPriorityFilter;
    }
    if (this.searchTerm && this.searchTerm.trim() !== '') {
      params.search = this.searchTerm.trim();
    }

    let apiCall: Observable<PageTicketResponseDto | TicketResponseDto[]>;

    // Logica per filtrare le bozze per l'owner in modalità selezione modale
    if (this.isModalSelectionMode && this.selectedStatusFilter === TicketStatus.DRAFT && this.filterOwnerId) {
      apiCall = this.ticketService.getMyDrafts(); // Questa API dovrebbe filtrare per l'utente loggato
    } else if (this.isUserRole && !this.isAdminOrPmRole && !this.isHelperOrPmRole) {
        // Utente normale: solo i propri ticket e quelli associati
        apiCall = this.ticketService.getMyTicketsAndAssociatedByEmail(params);
    } else {
        // Admin/Helper/PM: tutti i ticket con i filtri
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
        if ('content' in res) {
          this.tickets = res.content ?? [];
          this.totalRecords = res.totalElements ?? 0;
        } else {
          // Questo caso è per getMyDrafts() che restituisce TicketResponseDto[]
          this.tickets = res as TicketResponseDto[];
          this.totalRecords = (res as TicketResponseDto[]).length;
        }
        this.loading = false;
        this.firstLazyLoadFromTable = false; 
      },
    });
  }

  loadUsersForAssignment(): void {
    if (this.isHelperOrPmRole || this.isAdminOrPmRole) {
      this.userService.getHelpersAndAdmins().pipe(
        takeUntil(this.destroy$),
        catchError(err => {
          console.error('Errore nel caricamento degli utenti per assegnazione:', err);
          this.messageService.add({ severity: 'error', summary: 'Errore', detail: 'Impossibile caricare gli utenti per le azioni.' });
          return of([]);
        })
      ).subscribe(users => {
        if (this.isHelperOrPmRole && !this.isAdminRole) {
          this.availableUsersForAssignment = users.filter(u => u.id !== this.currentUserId);
        } else {
          this.availableUsersForAssignment = users;
        }
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
   * Gestisce il click sulla riga del ticket o sul pulsante Dettagli/Modifica.
   * Apre la modale appropriata (NewTicketComponent per bozze proprie, TicketDetailsModalComponent per dettagli).
   * @param ticket Il ticket selezionato.
   */
  handleTicketAction(ticket: TicketResponseDto): void {
    const isOwner = this.isTicketOwner(ticket);
    const isDraft = ticket.status === TicketStatus.DRAFT;

    if (this.isModalSelectionMode) {
      if (isDraft && isOwner) {
        this.selfRef?.close(ticket.id);
      } else {
        this.messageService.add({ severity: 'warn', summary: 'Selezione Non Valida', detail: 'Puoi selezionare solo le tue bozze.' });
      }
      return;
    }

    if (isDraft && isOwner) {
      this.ref = this.dialogService.open(NewTicketComponent, {
        header: 'Modifica Bozza',
        width: '90%',
        height: '90%',
        contentStyle: { "max-height": "calc(100vh - 100px)", "overflow": "auto" },
        baseZIndex: 10000,
        data: {
          ticketId: ticket.id!,
          isDraft: true,
          isReadOnly: false
        }
      });
    } else {
      let isReadOnlyForDetails = true;

      if (isDraft && !isOwner && (this.isAdminOrPmRole || this.isHelperOrPmRole)) {
        isReadOnlyForDetails = true;
      } else if (ticket.status === TicketStatus.SOLVED && (this.isAdminOrPmRole || this.isHelperOrPmRole)) {
        isReadOnlyForDetails = true;
      } else if (this.isAdminOrPmRole || this.isHelperOrPmRole) {
        isReadOnlyForDetails = false;
      }

      this.ref = this.dialogService.open(TicketDetailsModalComponent, {
        header: 'Dettagli Ticket',
        width: '90vw',
        height: 'auto',
        contentStyle: { "max-height": "calc(100vh - 100px)", "overflow": "auto" },
        baseZIndex: 10000,
        data: {
          ticket: ticket,
          isReadOnly: isReadOnlyForDetails
        }
      });
    }

    this.ref.onClose.pipe(takeUntil(this.destroy$)).subscribe(result => {
      if (result === true || result === 'Deleted' || result === 'StatusUpdated') {
        this.messageService.add({ severity: 'success', summary: 'Aggiornamento', detail: 'Ticket aggiornato con successo.' });
        this.loadTickets();
      } else if (result === 'OpenNewTicket') {
        this.navigateToCategorySelection();
      } else if (result !== undefined) {
        this.messageService.add({ severity: 'info', summary: 'Annullato', detail: 'Operazione annullata.' });
      }
    });
  }

  confirmDeleteTicket(ticketId: number): void {
    this.confirmationService.confirm({
      message: `Sei sicuro di voler eliminare il ticket ${ticketId}?`,
      header: 'Conferma Eliminazione',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.ticketService.deleteTicket({ ticketId: ticketId }).pipe(
          takeUntil(this.destroy$),
          catchError(err => {
            console.error('Errore durante l\'eliminazione del ticket:', err);
            this.messageService.add({ severity: 'error', summary: 'Errore', detail: err.error?.message || 'Impossibile eliminare il ticket.' });
            return of(null);
          })
        ).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Successo', detail: 'Ticket eliminato con successo.' });
            this.loadTickets();
          }
        });
      },
      reject: (type: ConfirmEventType) => {
        this.messageService.add({ severity: 'info', summary: 'Annullato', detail: 'Eliminazione ticket annullata.' });
      }
    });
  }

  acceptTicket(ticket: TicketResponseDto): void {
    this.confirmationService.confirm({
      message: `Sei sicuro di voler accettare il ticket "${ticket.title}"? Lo stato diventerà ANSWERED.`,
      header: 'Conferma Accettazione',
      icon: 'pi pi-question-circle',
      accept: () => {
        this.ticketService.acceptTicket({ ticketId: ticket.id! }).pipe(
          takeUntil(this.destroy$),
          catchError((err: HttpErrorResponse) => {
            console.error('Errore nell\'accettazione del ticket:', err);
            this.messageService.add({ severity: 'error', summary: 'Errore', detail: err.error?.message || 'Impossibile accettare il ticket.' });
            return of(null);
          })
        ).subscribe({
          next: (res) => {
            if (res) {
              this.messageService.add({ severity: 'success', summary: 'Successo', detail: 'Ticket accettato con successo!' });
              this.loadTickets();
            }
          }
        });
      }
    });
  }

  showRejectDialog(ticket: TicketResponseDto): void {
    if (!this.isHelperOrPmRole && !this.isAdminOrPmRole) {
      this.messageService.add({ severity: 'error', summary: 'Non Autorizzato', detail: 'Non hai i permessi per rifiutare ticket.' });
      return;
    }
    if (this.isHelperOrPmRole && ticket.assignedToId !== this.currentUserId) {
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
    if (!this.isHelperOrPmRole && !this.isAdminOrPmRole) {
      this.messageService.add({ severity: 'error', summary: 'Non Autorizzato', detail: 'Non hai i permessi per escalare ticket.' });
      return;
    }
    if (this.isHelperOrPmRole && ticket.assignedToId !== this.currentUserId) {
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

  isTicketOwner(ticket: TicketResponseDto): boolean {
    return ticket.userId === this.currentUserId;
  }

  showEditButton(ticket: TicketResponseDto): boolean {
    const isOwner = this.isTicketOwner(ticket);
    const isDraft = ticket.status === TicketStatus.DRAFT;
    return isDraft && isOwner;
  }

  showDetailsButton(ticket: TicketResponseDto): boolean {
    const isOwner = this.isTicketOwner(ticket);
    const isDraft = ticket.status === TicketStatus.DRAFT;

    if (isDraft && !isOwner && (this.isAdminOrPmRole || this.isHelperOrPmRole)) {
      return true;
    }
    if (!isDraft) {
      return true;
    }
    return false;
  }

  showAcceptButton(ticket: TicketResponseDto): boolean {
    const isAssignedToMe = ticket.assignedToId === this.currentUserId;
    return ticket.status === TicketStatus.OPEN && isAssignedToMe && (this.isHelperOrPmRole || this.isAdminOrPmRole);
  }

  showRejectButton(ticket: TicketResponseDto): boolean {
    const isAssignedToMe = ticket.assignedToId === this.currentUserId;
    return ticket.status === TicketStatus.OPEN && isAssignedToMe && (this.isHelperOrPmRole || this.isAdminOrPmRole);
  }

  showEscalateButton(ticket: TicketResponseDto): boolean {
    const isAssignedToMe = ticket.assignedToId === this.currentUserId;
    return ticket.status === TicketStatus.ANSWERED && isAssignedToMe && (this.isHelperOrPmRole || this.isAdminOrPmRole);
  }

  showSolveButton(ticket: TicketResponseDto): boolean {
    const isAssignedToMe = ticket.assignedToId === this.currentUserId;
    return ticket.status === TicketStatus.ANSWERED && (isAssignedToMe || this.isAdminOrPmRole);
  }

  showAssignButton(ticket: TicketResponseDto): boolean {
    return (this.isAdminRole || this.isAdminOrPmRole) && ticket.status !== TicketStatus.DRAFT && ticket.status !== TicketStatus.SOLVED;
  }

  showDeleteButton(ticket: TicketResponseDto): boolean {
    const isOwner = this.isTicketOwner(ticket);
    const isDraft = ticket.status === TicketStatus.DRAFT;
    const isAssignedToMe = ticket.assignedToId === this.currentUserId;

    if (this.isAdminRole) {
      return true;
    }
    if (isDraft && isOwner) {
      return true;
    }
    if ((this.isHelperOrPmRole || this.isAdminOrPmRole) && isAssignedToMe && ticket.status !== TicketStatus.SOLVED) {
      return true;
    }
    return false;
  }

  navigateToCategorySelection(): void {
    if (this.selfRef) {
      this.selfRef.close('OpenNewTicket');
    } else {
      this.router.navigate(['/categories']);
    }
  }
}
