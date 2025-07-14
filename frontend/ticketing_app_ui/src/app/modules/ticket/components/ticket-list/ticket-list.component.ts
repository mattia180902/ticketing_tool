/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

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

import { Subject, of, Observable } from 'rxjs'; 
import { takeUntil, catchError, switchMap } from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';

import { TicketManagementService } from '../../../../services/services';
import { UserManagementService } from '../../../../services/services';
import { PageTicketResponseDto, TicketResponseDto, UserDto } from '../../../../services/models';
import { TicketStatus } from '../../../../shared/enums/TicketStatus';
import { TicketPriority } from '../../../../shared/enums/TicketPriority';
import { UserRole } from '../../../../shared/enums/UserRole';
import { AuthService } from '../../service/auth.service';
import { TicketDetailsModalComponent } from '../ticket-details-modal/ticket-details-modal.component';

import { TicketFilterComponent, TicketFilterParams } from '../ticket-filter/ticket-filter.component';
import { DialogModule } from 'primeng/dialog';
import { DraftEditComponent } from '../draft-edit/draft-edit.component';

type BadgeSeverity = 'success' | 'info' | 'warning' | 'danger' | 'help' | 'primary' | 'secondary' | 'contrast';

export interface AssignableUser extends UserDto {
  fullName: string;
}

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
  

  private _allAssignableUsers: AssignableUser[] = []; 
  availableUsersForAssignment: AssignableUser[] = []; 

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
  isHelperRole = false; 
  isPmRole = false; 
  isAdminRole = false;
  isHelperOrPmRole = false;
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
    @Optional() public dialogConfig: DynamicDialogConfig 
  ) {}

  ngOnInit(): void {
    this.currentUserId = this.authService.getUserId();
    this.currentUserEmail = this.authService.getUserEmail();
    this.isUserRole = this.authService.isUser();
    this.isHelperRole = this.authService.hasRole([UserRole.HELPER_JUNIOR, UserRole.HELPER_SENIOR]); 
    this.isPmRole = this.authService.hasRole(UserRole.PM); 
    this.isAdminRole = this.authService.isAdmin();
    this.isHelperOrPmRole = this.authService.isHelperOrPm();
    this.isAdminOrPmRole = this.authService.isAdminOrPm();

    this.loadAllAssignableUsers(); 

    if (!this.initialLoadCompleted) {
      this.initialLoadCompleted = true;

      if (this.dialogConfig && this.dialogConfig.data) {
        if (this.dialogConfig.data.isModalSelection) {
          this.isModalSelectionMode = true;
          this.initialFilterStatusForChild = TicketStatus.DRAFT;
          this.selectedStatusFilter = TicketStatus.DRAFT;
          this.filterOwnerId = this.currentUserId;
          this.disableStatusFilterInChild = true;
        } 
        else if (this.dialogConfig.data.filterStatus) {
          this.initialFilterStatusForChild = this.dialogConfig.data.filterStatus;
          this.selectedStatusFilter = this.dialogConfig.data.filterStatus;
          this.disableStatusFilterInChild = this.dialogConfig.data.disableStatusFilter || false;
          
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
      else {
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
        this.disableStatusFilterInChild = false;
      }

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
    this.first = 0; 
    this.loadTickets();
  }

  onClearFilters(): void {
    if (this.disableStatusFilterInChild) {
      this.selectedStatusFilter = this.initialFilterStatusForChild; 
    } else {
      this.selectedStatusFilter = 'ALL'; 
    }
    this.selectedPriorityFilter = 'ALL';
    this.searchTerm = '';
    this.first = 0; 

    this.loadTickets(); 
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

    if (this.isModalSelectionMode && this.selectedStatusFilter === TicketStatus.DRAFT && this.filterOwnerId) {
      apiCall = this.ticketService.getMyDrafts(); 
    } else if (this.isUserRole && !this.isAdminOrPmRole && !this.isHelperOrPmRole) {
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
        if ('content' in res) {
          this.tickets = res.content ?? [];
          this.totalRecords = res.totalElements ?? 0;
        } else {
          this.tickets = res as TicketResponseDto[];
          this.totalRecords = (res as TicketResponseDto[]).length;
        }
        this.loading = false;
        this.firstLazyLoadFromTable = false; 
      },
    });
  }

  /**
   * Carica la master list di tutti gli utenti assegnabili (Helper Junior, Helper Senior, PM, Admin).
   * Questa lista viene caricata una sola volta e usata come base per i filtraggi specifici delle dialoghe.
   */
  loadAllAssignableUsers(): void {
    console.log('loadAllAssignableUsers: Inizio caricamento utenti assegnabili...');
    this.userService.getHelpersAndAdmins().pipe(
      takeUntil(this.destroy$),
      catchError(err => {
        console.error('Errore nel caricamento degli utenti per assegnazione:', err);
        this.messageService.add({ severity: 'error', summary: 'Errore', detail: 'Impossibile caricare gli utenti per le azioni.' });
        return of([]);
      })
    ).subscribe(users => {
      // Mappa gli utenti per aggiungere la proprietà fullName
      this._allAssignableUsers = users.map(user => ({
        ...user,
        fullName: `${user.firstName} ${user.lastName}`.trim() 
      }));
      console.log('loadAllAssignableUsers: Utenti assegnabili caricati e mappati:', this._allAssignableUsers);
      if (this._allAssignableUsers.length === 0) {
        this.messageService.add({ severity: 'warn', summary: 'Attenzione', detail: 'Nessun utente Helper/PM/Admin trovato nel sistema per le assegnazioni.' });
      }
    });
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
   * Apre la modale appropriata (DraftEditComponent per bozze proprie, TicketDetailsModalComponent per dettagli).
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
      this.ref = this.dialogService.open(DraftEditComponent, { 
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
    } 
    else {
      this.ref = this.dialogService.open(TicketDetailsModalComponent, {
        header: 'Dettagli Ticket',
        width: '90vw',
        height: 'auto',
        contentStyle: { "max-height": "calc(100vh - 100px)", "overflow": "auto" },
        baseZIndex: 10000,
        data: {
          ticket: ticket,
          isReadOnly: true 
        }
      });
    }

    this.ref.onClose.pipe(takeUntil(this.destroy$)).subscribe(result => {
      if (result === true || result === 'Deleted' || result === 'StatusUpdated') {
        this.messageService.add({ severity: 'success', summary: 'Aggiornamento', detail: 'Ticket aggiornato con successo.' });
        this.loadTickets();
      } else if (result === 'OpenNewTicket') {
        this.navigateToCategorySelection();
      } else if (result !== undefined && result !== 'Close click') { 
        this.messageService.add({ severity: 'info', summary: 'Annullato', detail: 'Operazione annullata.' });
      }
    });
  }

  // Metodi d'azione (Accetta, Rifiuta, Escala, Risolvi, Assegna, Elimina)

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
    // 1. Reset dello stato della modale prima di aprirla
    this.selectedTicketForAction = null;
    this.selectedAssigneeId = null;
    this.availableUsersForAssignment = []; 

    // 2. Popola la lista filtrata
    this.availableUsersForAssignment = this._allAssignableUsers.filter(u => u.id !== this.currentUserId);
    
    if (this.availableUsersForAssignment.length === 0) {
      this.messageService.add({ severity: 'warn', summary: 'Attenzione', detail: 'Nessun utente disponibile per la riassegnazione.' });
      return;
    }

    // 3. Imposta i dettagli del ticket e il tipo di azione
    this.selectedTicketForAction = ticket;
    this.actionType = 'reject';
    this.actionDialogHeader = `Rifiuta Ticket #${ticket.id}`;
    this.actionDialogMessage = `Seleziona un utente a cui riassegnare il ticket "${ticket.title}". Lo stato rimarrà OPEN.`;
    
    // 4. Apre la modale
    this.displayActionDialog = true;
  }

  showEscalateDialog(ticket: TicketResponseDto): void {
    // 1. Reset dello stato della modale prima di aprirla
    this.selectedTicketForAction = null;
    this.selectedAssigneeId = null;
    this.availableUsersForAssignment = []; 

    // 2. Popola la lista filtrata
    this.availableUsersForAssignment = this._allAssignableUsers.filter(u => u.id !== this.currentUserId);
    
    if (this.availableUsersForAssignment.length === 0) {
      this.messageService.add({ severity: 'warn', summary: 'Attenzione', detail: 'Nessun utente disponibile per l\'escalation.' });
      return;
    }

    // 3. Imposta i dettagli del ticket e il tipo di azione
    this.selectedTicketForAction = ticket;
    this.actionType = 'escalate';
    this.actionDialogHeader = `Escala Ticket #${ticket.id}`;
    this.actionDialogMessage = `Seleziona un utente a cui escalare il ticket "${ticket.title}". Lo stato tornerà OPEN.`;
    
    // 4. Apri la modale
    this.displayActionDialog = true;
  }

  showAssignDialog(ticket: TicketResponseDto): void {
    // 1. Reset dello stato della modale prima di aprirla
    this.selectedTicketForAction = null;
    this.selectedAssigneeId = null;
    this.availableUsersForAssignment = []; 

    // 2. Popola la lista filtrata
    const currentAssigneeId = ticket.assignedToId;
    this.availableUsersForAssignment = this._allAssignableUsers.filter(u => u.id !== currentAssigneeId);

    if (this.availableUsersForAssignment.length === 0) {
      this.messageService.add({ severity: 'warn', summary: 'Attenzione', detail: 'Nessun utente disponibile per l\'assegnazione.' });
      return;
    }

    // 3. Imposta i dettagli del ticket e il tipo di azione
    this.selectedTicketForAction = ticket;
    this.actionType = 'assign';
    this.actionDialogHeader = `Assegna Ticket #${ticket.id}`;
    this.actionDialogMessage = `Seleziona un utente a cui assegnare il ticket "${ticket.title}".`;
    
    // 4. Apre la modale
    this.displayActionDialog = true;
  }

  performAction(): void {
    if (!this.selectedTicketForAction || !this.selectedAssigneeId) {
      this.messageService.add({ severity: 'error', summary: 'Errore', detail: 'Seleziona un ticket e un assegnatario.' });
      return;
    }

    const ticketId = this.selectedTicketForAction.id!;
    const assigneeId = this.selectedAssigneeId;
    
    let actionObservable: Observable<TicketResponseDto | null>; 

    switch (this.actionType) {
      case 'assign':
        if (this.selectedTicketForAction.status === TicketStatus.ANSWERED) {
          actionObservable = this.ticketService.assignTicket({ ticketId: ticketId, helperId: assigneeId }).pipe(
            switchMap(assignRes => { 
              if (assignRes) {
                return this.ticketService.updateTicketStatus({ ticketId: ticketId, newStatus: TicketStatus.OPEN });
              }
              return of(null); 
            })
          );
        } else {
          actionObservable = this.ticketService.assignTicket({ ticketId: ticketId, helperId: assigneeId });
        }
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
    const isAssignedToMe = ticket.assignedToId === this.currentUserId;
    const isDraftOrSolved = ticket.status === TicketStatus.DRAFT || ticket.status === TicketStatus.SOLVED;

    if ((this.isAdminOrPmRole) && !isDraftOrSolved) {
      if (!isAssignedToMe || !ticket.assignedToId) { 
        return true;
      }
    }
    return false;
  }

  showDeleteButton(ticket: TicketResponseDto): boolean {
    const isOwner = this.isTicketOwner(ticket);
    const isDraft = ticket.status === TicketStatus.DRAFT;
    const isAssignedToMe = ticket.assignedToId === this.currentUserId;
    const isSolved = ticket.status === TicketStatus.SOLVED;

    if (this.isAdminRole && !isSolved) {
      return true;
    }
    if (isDraft && isOwner) {
      return true;
    }
    if ((this.isHelperOrPmRole || this.isAdminOrPmRole) && isAssignedToMe && !isSolved) {
      return true;
    }
    if ((this.isAdminOrPmRole) && isDraft && !isOwner) {
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

