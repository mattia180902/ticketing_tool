// src/app/modules/ticket/components/new-ticket/new-ticket.component.ts

import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { DropdownModule } from 'primeng/dropdown';
import { CardModule } from 'primeng/card';
import { InputMaskModule } from 'primeng/inputmask';
import { MessageService, ConfirmationService } from 'primeng/api';
import {
  TicketManagementService,
  CategoryService,
  SupportServicesService,
  UserManagementService
} from '../../../../services/services';
import { ActivatedRoute, Router } from '@angular/router';
import {
  CategoryResponse,
  SupportServiceResponse,
  TicketRequestDto,
  TicketResponseDto,
  UserDto,
} from '../../../../services/models'; 
import { HttpErrorResponse } from '@angular/common/http';

import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { Subject, of, Observable, Subscription } from 'rxjs';
import { takeUntil, catchError, debounceTime, distinctUntilChanged, finalize, filter } from 'rxjs/operators';
import { MessageModule } from 'primeng/message';
import { AuthService } from '../../service/auth.service';
import { DialogService, DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog'; 
import { TicketListComponent } from '../ticket-list/ticket-list.component';

// Importa gli enum definiti manualmente
import { TicketStatus } from '../../../../shared/enums/TicketStatus';
import { UserRole } from '../../../../shared/enums/UserRole';
import { TicketPriority } from '../../../../shared/enums/TicketPriority';

@Component({
  selector: 'app-new-ticket',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    InputTextareaModule,
    DropdownModule,
    InputMaskModule,
    ToastModule,
    ConfirmDialogModule,
    MessageModule,
    CardModule
  ],
  templateUrl: './new-ticket.component.html',
  styleUrl: './new-ticket.component.scss',
  providers: [MessageService, ConfirmationService, DialogService] 
})
export class NewTicketComponent implements OnInit, OnDestroy {
  ticketForm: FormGroup;
  categories: CategoryResponse[] = [];
  allSupportServices: SupportServiceResponse[] = [];
  filteredSupportServices: SupportServiceResponse[] = [];
  priorities: TicketPriority[] = Object.values(TicketPriority);
  
  ticketId: number | null = null;
  isEditMode = false;
  isDraft = false;
  isReadOnly = false;
  currentTicket: TicketResponseDto | null = null;
  
  assignableUsers: UserDto[] = [];
  usersWithUserRole: UserDto[] = [];

  isSaving = false;

  private destroy$ = new Subject<void>();
  private currentUserId = '';
  private formSubscription: Subscription | undefined;

  public isUserRole = false;
  public isHelperOrPmRole = false;
  public isAdminRole = false;

  public UserRole = UserRole;
  public TicketStatus = TicketStatus;
  public TicketPriority = TicketPriority;

  refDraftSelection: DynamicDialogRef | undefined; 
  
  public ref: DynamicDialogRef | null = inject(DynamicDialogRef, { optional: true });
  public config: DynamicDialogConfig | null = inject(DynamicDialogConfig, { optional: true });

  constructor(
    private fb: FormBuilder,
    private ticketService: TicketManagementService,
    private categoryService: CategoryService,
    private supportServiceService: SupportServicesService,
    private userService: UserManagementService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    public dialogService: DialogService,
  ) {
    this.ticketForm = this.fb.group({
      title: ['', Validators.required],
      description: ['', Validators.required],
      categoryId: [null, Validators.required],
      supportServiceId: [null, Validators.required],
      priority: [TicketPriority.MEDIUM, Validators.required],
      email: ['', [Validators.required, Validators.email]], 
      fiscalCode: [''],
      phoneNumber: [''],
      assignedToId: [null]
    });

    if (this.config && this.config.data) {
      if (typeof this.config.data.ticketId === 'number' && this.config.data.ticketId !== null) {
        this.ticketId = this.config.data.ticketId;
        this.isEditMode = true;
        this.isDraft = this.config.data.isDraft || false;
        this.isReadOnly = this.config.data.isReadOnly || false;
        this.loadTicketDetails(this.ticketId!);
      } else {
        this.initializeNewTicketForm();
      }
    }
  }

  ngOnInit(): void {
    this.currentUserId = this.authService.getUserId();
    this.isUserRole = this.authService.isUser();
    this.isHelperOrPmRole = this.authService.isHelperOrPm();
    this.isAdminRole = this.authService.isAdmin();

    console.log('NGONINIT: ticketId=', this.ticketId, 'isEditMode=', this.isEditMode, 'isDraft=', this.isDraft);


    this.loadCategories();
    this.loadAllSupportServices();
    this.loadAssignableUsers();
    this.loadUsersWithUserRole();

    if (!this.ticketId && !this.config?.data?.ticketId) {
      const routeSnapshot = this.route.snapshot;
      const idFromQueryParams = routeSnapshot.queryParams['ticketId'] ? +routeSnapshot.queryParams['ticketId'] : null;
      const initialCategoryId = routeSnapshot.queryParams['categoryId'] ? +routeSnapshot.queryParams['categoryId'] : null;
      const initialSupportServiceId = routeSnapshot.queryParams['supportServiceId'] ? +routeSnapshot.queryParams['supportServiceId'] : (routeSnapshot.queryParams['serviceId'] ? +routeSnapshot.queryParams['serviceId'] : null);

      if (typeof idFromQueryParams === 'number' && idFromQueryParams !== null) {
        this.ticketId = idFromQueryParams;
        this.isEditMode = true;
        this.loadTicketDetails(this.ticketId!);
      } else {
        this.initializeNewTicketForm();
        if (initialCategoryId) {
          this.ticketForm.get('categoryId')?.setValue(initialCategoryId);
          this.supportServiceService.getByCategory({ categoryId: initialCategoryId }).pipe(
            takeUntil(this.destroy$)
          ).subscribe(services => {
            this.filteredSupportServices = services;
            if (initialSupportServiceId && services.some(s => s.id === initialSupportServiceId)) {
              this.ticketForm.get('supportServiceId')?.setValue(initialSupportServiceId);
            }
          });
        }
      }
    }

    // Modificata la condizione per l'auto-salvataggio
    if (!this.isReadOnly && (this.isUserRole || this.isHelperOrPmRole || this.isAdminRole)) {
      this.setupAutoSave();
    }

    this.ticketForm.get('categoryId')?.valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe(selectedCategoryId => {
      this.onCategoryChange(selectedCategoryId);
    });
  }

  ngOnDestroy(): void {
    if (this.ref) {
      this.ref.close();
    }
    if (this.refDraftSelection) {
      this.refDraftSelection.close();
    }
    if (this.formSubscription) {
      this.formSubscription.unsubscribe();
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Inizializza il form per un nuovo ticket.
   * Pre-compila l'email, codice fiscale e numero di telefono dell'utente corrente se è un USER.
   * Queste informazioni vengono recuperate dal backend tramite UserManagementService.getMe().
   */
  initializeNewTicketForm(): void {
    console.log('initializeNewTicketForm called: Resetting form state.');
    this.isEditMode = false;
    this.isDraft = false;
    this.isReadOnly = false;
    this.ticketId = null;
    this.currentTicket = null;
    this.ticketForm.reset(); 
    this.ticketForm.enable();

    if (this.isUserRole) {
      this.userService.getMe().pipe(
        takeUntil(this.destroy$),
        catchError(err => {
          console.error('Errore nel caricamento del profilo utente per pre-compilazione:', err);
          this.messageService.add({ severity: 'warn', summary: 'Attenzione', detail: 'Impossibile pre-compilare codice fiscale e telefono. Inseriscili manualmente se necessario.' });
          return of(null);
        })
      ).subscribe(userProfile => {
        this.ticketForm.patchValue({
          email: this.authService.getUserEmail(),
          fiscalCode: userProfile?.fiscalCode || '', 
          phoneNumber: userProfile?.phoneNumber || '' 
        });
        this.ticketForm.get('email')?.disable();
      });
    } else {
      this.ticketForm.get('email')?.enable();
    }
    this.ticketForm.get('priority')?.setValue(TicketPriority.MEDIUM);
    this.ticketForm.get('assignedToId')?.setValue(null);
    this.filteredSupportServices = [];
  }

  /**
   * Carica i dettagli di un ticket esistente (può essere una bozza caricata da selezione, o un ticket non bozza).
   * @param id L'ID del ticket da caricare.
   */
  loadTicketDetails(id: number): void {
    console.log('loadTicketDetails called for ID:', id);
    this.ticketId = id;
    this.isEditMode = true;
    
    this.ticketService.getTicketDetails({ ticketId: id }).pipe(
      takeUntil(this.destroy$),
      catchError(err => {
        console.error('Errore nel caricamento dei dettagli del ticket:', err);
        this.messageService.add({ severity: 'error', summary: 'Errore', detail: err.error?.message || 'Impossibile caricare i dettagli del ticket.' });
        if (this.ref) {
          this.ref.close();
        } else {
          this.router.navigate(['/dashboard']); 
        }
        return of(null);
      })
    ).subscribe({
      next: (ticket) => {
        if (ticket) {
          this.currentTicket = ticket;
          this.isDraft = ticket.status === TicketStatus.DRAFT;

          this.isReadOnly = this.determineReadOnlyStatus(ticket);
          if (this.isReadOnly) {
            this.ticketForm.disable();
          } else {
            this.ticketForm.enable();
          }

          this.ticketForm.patchValue({
            title: ticket.title,
            description: ticket.description,
            categoryId: ticket.categoryId,
            priority: ticket.priority,
            email: ticket.userEmail,
            fiscalCode: ticket.userFiscalCode,
            phoneNumber: ticket.userPhoneNumber,
            assignedToId: ticket.assignedToId
          });

          this.onCategoryChange(ticket.categoryId!, () => {
            this.ticketForm.get('supportServiceId')?.setValue(ticket.supportServiceId);
          });

          // Gestione del campo email dopo il caricamento
          if (this.isUserRole && (ticket.userId === this.currentUserId || ticket.userEmail === this.authService.getUserEmail())) {
            this.ticketForm.get('email')?.disable();
          } else if (this.isAdminRole || this.isHelperOrPmRole) {
            // Se Admin/Helper/PM caricano un ticket, l'email deve essere selezionabile dal dropdown
            this.ticketForm.get('email')?.enable();
          } else {
            this.ticketForm.get('email')?.disable(); // Per altri ruoli o se readOnly
          }
          console.log('loadTicketDetails: Ticket loaded. ticketId=', this.ticketId, 'isEditMode=', this.isEditMode, 'isDraft=', this.isDraft);
        }
      }
    });
  }

  /**
   * Determina se il form deve essere in sola lettura in base al ruolo e allo stato del ticket.
   * @param ticket Il DTO del ticket.
   * @returns True se il form deve essere in sola lettura, false altrimenti.
   */
  private determineReadOnlyStatus(ticket: TicketResponseDto): boolean {
    if (this.isAdminRole || this.isHelperOrPmRole) {
      // NUOVO: Se Admin/PM/Helper visualizzano una bozza NON loro, è read-only.
      if (ticket.status === TicketStatus.DRAFT && ticket.userId !== this.currentUserId) {
        return true;
      }
      return ticket.status === TicketStatus.SOLVED;
    } else if (this.isUserRole) {
      const isOwner = ticket.userId === this.currentUserId;
      return !(ticket.status === TicketStatus.DRAFT && isOwner);
    }
    return true;
  }

  /**
   * Configura l'auto-salvataggio della bozza.
   */
  setupAutoSave(): void {
    if (this.formSubscription) {
      this.formSubscription.unsubscribe();
    }
    this.formSubscription = this.ticketForm.valueChanges.pipe(
      debounceTime(1500),
      filter(() => this.ticketForm.dirty && (this.ticketForm.get('title')?.value || this.ticketForm.get('description')?.value)),
      distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      if (!this.isReadOnly && !this.isSaving) { // La condizione sul ruolo è ora gestita da ngOnInit
        this.autoSaveDraft();
      }
    });
  }

  /**
   * Salva automaticamente il ticket come bozza.
   */
  autoSaveDraft(): void {
    if (this.isSaving) {
      console.log('autoSaveDraft: Save already in progress, skipping.');
      return;
    }
    this.isSaving = true;
    console.log('autoSaveDraft triggered. Current state: ticketId=', this.ticketId, 'isEditMode=', this.isEditMode, 'isDraft=', this.isDraft);
    const ticketDto = this.prepareTicketDto(TicketStatus.DRAFT);

    let saveObservable: Observable<TicketResponseDto>;
    
    if (this.isEditMode && this.ticketId !== null) {
      console.log('autoSaveDraft: Calling updateTicket (PUT) for existing draft ID:', this.ticketId);
      saveObservable = this.ticketService.updateTicket({ ticketId: this.ticketId, body: ticketDto });
    } else {
      console.log('autoSaveDraft: Calling createTicket (POST) for new draft.');
      saveObservable = this.ticketService.createTicket({ body: ticketDto });
    }

    saveObservable.pipe(
      takeUntil(this.destroy$),
      catchError((err: HttpErrorResponse) => {
        console.error('Errore nell\'auto-salvataggio della bozza:', err);
        let errorMessage = err.error?.message || 'Impossibile salvare la bozza automaticamente.';
        
        if (err.status === 500 && errorMessage.includes("Utente con email") && errorMessage.includes("non trovato nel sistema")) {
          errorMessage = "L'email specificata per l'utente non è registrata. Assicurati che l'utente esista in Keycloak.";
        }

        this.messageService.add({ severity: 'error', summary: 'Errore Auto-salvataggio', detail: errorMessage });
        return of(null);
      }),
      finalize(() => {
        this.isSaving = false;
      })
    ).subscribe({
      next: (ticket) => {
        if (ticket) {
          this.messageService.add({ severity: 'success', summary: 'Bozza Salvata', detail: 'Il ticket è stato salvato automaticamente come bozza.' });
          this.ticketId = ticket.id!;
          this.isEditMode = true;
          this.isDraft = true;
          this.currentTicket = ticket;
          console.log('autoSaveDraft success: New ticketId=', this.ticketId, 'isEditMode=', this.isEditMode);
          this.ticketForm.markAsPristine();
        }
      }
    });
  }

  /**
   * Carica tutte le categorie disponibili.
   */
  loadCategories(): void {
    this.categoryService.getAllCategories().pipe(
      takeUntil(this.destroy$),
      catchError(err => {
        console.error('Errore nel caricamento delle categorie:', err);
        this.messageService.add({ severity: 'error', summary: 'Errore', detail: 'Impossibile caricare le categorie.' });
        return of([]);
      })
    ).subscribe(data => this.categories = data);
  }

  /**
   * Carica tutti i servizi di supporto disponibili.
   */
  loadAllSupportServices(): void {
    this.supportServiceService.getAll().pipe(
      takeUntil(this.destroy$),
      catchError(err => {
        console.error('Errore nel caricamento di tutti i servizi di supporto:', err);
        this.messageService.add({ severity: 'error', summary: 'Errore', detail: 'Impossibile caricare i servizi di supporto.' });
        return of([]);
      })
    ).subscribe(data => {
      this.allSupportServices = data;
      if (!this.ticketForm.get('categoryId')?.value) {
        this.filteredSupportServices = data;
      }
    });
  }

  /**
   * Carica la lista di utenti assegnabili (Helper Junior, Helper Senior, PM, Admin).
   * Solo per Helper, PM, Admin.
   */
  loadAssignableUsers(): void {
    if (this.isHelperOrPmRole || this.isAdminRole) {
      this.userService.getHelpersAndAdmins().pipe(
        takeUntil(this.destroy$),
        catchError(err => {
          console.error('Errore nel caricamento degli utenti assegnabili:', err);
          this.messageService.add({ severity: 'error', summary: 'Errore', detail: 'Impossibile caricare gli utenti assegnabili.' });
          return of([]);
        })
      ).subscribe(users => {
        this.assignableUsers = users;
      });
    }
  }

  /**
   * Carica la lista di utenti con ruolo USER.
   * Utilizzato per il dropdown di selezione email per Admin/PM/Helper.
   */
  loadUsersWithUserRole(): void {
    if (this.isAdminRole || this.isHelperOrPmRole) {
      this.userService.getUsersByRole({ roleName: UserRole.USER }).pipe(
        takeUntil(this.destroy$),
        catchError(err => {
          console.error('Errore nel caricamento degli utenti con ruolo USER:', err);
          this.messageService.add({ severity: 'error', summary: 'Errore', detail: 'Impossibile caricare la lista degli utenti USER.' });
          return of([]);
        })
      ).subscribe(users => {
        this.usersWithUserRole = users;
      });
    }
  }

  /**
   * Filtra i servizi di supporto in base alla categoria selezionata.
   * @param categoryId L'ID della categoria selezionata.
   * @param callback Una callback opzionale da eseguire dopo il filtraggio (es. per impostare il supportServiceId iniziale).
   */
  onCategoryChange(categoryId: number, callback?: () => void): void {
    this.ticketForm.get('supportServiceId')?.setValue(null); 
    if (categoryId) {
      this.supportServiceService.getByCategory({ categoryId: categoryId }).pipe(
        takeUntil(this.destroy$),
        catchError(err => {
          console.error('Errore nel caricamento dei servizi per categoria:', err);
          this.messageService.add({ severity: 'error', summary: 'Errore', detail: 'Impossibile caricare i servizi per la categoria selezionata.' });
          return of([]);
        })
      ).subscribe(data => {
        this.filteredSupportServices = data;
        if (callback) {
          callback();
        }
      });
    } else {
      this.filteredSupportServices = [];
    }
  }

  /**
   * Prepara il DTO del ticket dalla form.
   * Utilizza getRawValue() per includere i campi disabilitati (es. email per USER).
   * @param status Lo stato da assegnare al ticket.
   * @returns Il DTO del ticket.
   */
  private prepareTicketDto(status: TicketStatus): TicketRequestDto {
    const formValue = this.ticketForm.getRawValue(); 
    return {
      title: formValue.title,
      description: formValue.description,
      categoryId: formValue.categoryId,
      supportServiceId: formValue.supportServiceId,
      priority: formValue.priority,
      email: formValue.email, 
      fiscalCode: formValue.fiscalCode,
      phoneNumber: formValue.phoneNumber,
      status: status,
      assignedToId: formValue.assignedToId
    };
  }

  /**
   * Controlla se il form è valido per la finalizzazione (non bozza).
   * @returns True se il form è valido, false altrimenti.
   */
  isFormValidForFinalization(): boolean {
    if (!this.isUserRole && !this.isDraft && !this.ticketForm.get('assignedToId')?.value) {
      this.ticketForm.get('assignedToId')?.setErrors({ required: true });
    } else {
      this.ticketForm.get('assignedToId')?.setErrors(null);
    }
    return this.ticketForm.valid;
  }

  /**
   * Finalizza la bozza o crea un nuovo ticket con stato OPEN.
   */
  finalizeTicket(): void {
    if (this.isSaving) {
      console.log('finalizeTicket: Save already in progress, skipping.');
      this.messageService.add({ severity: 'warn', summary: 'Attenzione', detail: 'Un\'operazione di salvataggio è già in corso. Attendi.' });
      return;
    }

    if (!this.isFormValidForFinalization()) {
      this.messageService.add({ severity: 'error', summary: 'Errore', detail: 'Compila tutti i campi obbligatori per finalizzare il ticket.' });
      this.ticketForm.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    const ticketDto = this.prepareTicketDto(TicketStatus.OPEN);

    let saveObservable: Observable<TicketResponseDto>;
    console.log('FinalizeTicket: isEditMode =', this.isEditMode, 'ticketId =', this.ticketId);

    if (this.isEditMode && this.ticketId !== null) {
      console.log('FinalizeTicket: Calling updateTicket (PUT) for ticket ID:', this.ticketId);
      saveObservable = this.ticketService.updateTicket({ ticketId: this.ticketId, body: ticketDto });
    } else {
      console.log('FinalizeTicket: Calling createTicket (POST) for new ticket.');
      saveObservable = this.ticketService.createTicket({ body: ticketDto });
    }

    saveObservable.pipe(
      takeUntil(this.destroy$),
      catchError((err: HttpErrorResponse) => {
        console.error('Errore nel salvataggio/finalizzazione del ticket:', err);
        let errorMessage = err.error?.message || 'Impossibile salvare il ticket.';

        if (err.status === 500 && errorMessage.includes("Utente con email") && errorMessage.includes("non trovato nel sistema")) {
          errorMessage = "L'email specificata per l'utente non è registrata. Assicurati che l'utente esista in Keycloak.";
        }
        
        this.messageService.add({ severity: 'error', summary: 'Errore', detail: errorMessage });
        return of(null);
      }),
      finalize(() => {
        this.isSaving = false;
        if (this.ref) {
          this.ref.close(true);
        }
      })
    ).subscribe({
      next: (ticket) => {
        if (ticket) {
          this.messageService.add({ severity: 'success', summary: 'Successo', detail: 'Ticket salvato/finalizzato con successo!' });
          if (!this.ref) {
            this.router.navigate(['/dashboard']);
          }
          if (!this.ref) {
            this.initializeNewTicketForm();
          }
        }
      }
    });
  }

  /**
   * Gestisce il click sul pulsante "Nuovo Ticket".
   * Resetta il form per un nuovo ticket o chiude la modale.
   */
  onNewTicket(): void {
    if (this.ref) {
      this.ref.close();
      return; 
    }
    this.router.navigate(['/new-ticket']).then(() => {
      this.initializeNewTicketForm();
    });
  }

  /**
   * Apre la modale per selezionare una bozza esistente.
   */
  openDraftSelectionModal(): void {
    this.refDraftSelection = this.dialogService.open(TicketListComponent, {
      header: 'Seleziona Bozza',
      width: '90%',
      height: '90%',
      contentStyle: { "max-height": "calc(100vh - 100px)", "overflow": "auto" },
      baseZIndex: 10000,
      data: {
        filterStatus: TicketStatus.DRAFT, 
        isModalSelection: true 
      }
    });

    this.refDraftSelection.onClose.pipe(takeUntil(this.destroy$)).subscribe((ticketId: number | undefined) => {
      if (ticketId) {
        this.loadTicketDetails(ticketId!);
        this.messageService.add({ severity: 'success', summary: 'Bozza Caricata', detail: 'Bozza caricata con successo nel form.' });
      } else {
        this.messageService.add({ severity: 'info', summary: 'Nessuna Bozza Selezionata', detail: 'Nessuna bozza è stata caricata.' });
      }
    });
  }
}