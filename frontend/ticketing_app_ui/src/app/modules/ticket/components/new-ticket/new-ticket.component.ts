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
import { Subject, of, Observable, Subscription, forkJoin } from 'rxjs';
import { takeUntil, catchError, debounceTime, distinctUntilChanged, finalize, filter } from 'rxjs/operators';
import { MessageModule } from 'primeng/message';
import { AuthService } from '../../service/auth.service';
import { DialogService, DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog'; 
import { TicketListComponent } from '../ticket-list/ticket-list.component';

// Importa gli enum definiti manualmente
import { TicketStatus } from '../../../../shared/enums/TicketStatus';
import { UserRole } from '../../../../shared/enums/UserRole';
import { TicketPriority } from '../../../../shared/enums/TicketPriority';

export interface AssignableUser extends UserDto {
  fullName: string;
}

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
  
  assignableUsers: AssignableUser[] = []; 
  usersWithUserRole: UserDto[] = []; 

  isSaving = false;
  disableAutoSaveAfterEmailChange = false; 
  isUserOwnerSelected = false; 

  private destroy$ = new Subject<void>();
  private formSubscription: Subscription | undefined;
  private currentUserId = '';
  private currentUserEmail = '';
  private isInitialFormSetup = true; // Flag per tracciare l'inizializzazione del form

  public isUserRole = false;
  public isHelperOrPmRole = false;
  public isAdminRole = false;
  public isAdminOrPmRole = false;

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
      fiscalCode: ['', Validators.required], 
      phoneNumber: ['', Validators.required], 
      assignedToId: [null]
    });

    if (this.config && this.config.data) {
      if (typeof this.config.data.ticketId === 'number' && this.config.data.ticketId !== null) {
        this.ticketId = this.config.data.ticketId;
        this.isEditMode = true;
        this.isDraft = this.config.data.isDraft || false;
        this.isReadOnly = this.config.data.isReadOnly || false;
      } else {
        this.initializeNewTicketForm();
      }
    } else {
      this.initializeNewTicketForm();
    }
  }

  ngOnInit(): void {
    this.currentUserId = this.authService.getUserId();
    this.currentUserEmail = this.authService.getUserEmail();
    this.isUserRole = this.authService.isUser();
    this.isHelperOrPmRole = this.authService.isHelperOrPm();
    this.isAdminRole = this.authService.isAdmin();
    this.isAdminOrPmRole = this.authService.isAdminOrPm();

    forkJoin([
      this.categoryService.getAllCategories(),
      this.supportServiceService.getAll(),
      (this.isHelperOrPmRole || this.isAdminRole) ? this.userService.getHelpersAndAdmins() : of([]),
      !this.isUserRole ? this.userService.getUsersByRole({ roleName: UserRole.USER }) : of([])
    ]).pipe(
      takeUntil(this.destroy$),
      catchError(err => {
        console.error('Errore nel caricamento delle dipendenze iniziali:', err);
        this.messageService.add({ severity: 'error', summary: 'Errore', detail: 'Impossibile caricare i dati iniziali del form.' });
        if (this.ref) { this.ref.close(); } else { this.router.navigate(['/dashboard']); }
        return of([[], [], [], []]);
      })
    ).subscribe(([categories, allSupportServices, assignableUsers, usersWithUserRole]) => {
      this.categories = categories;
      this.allSupportServices = allSupportServices;
      this.filteredSupportServices = allSupportServices;
      this.assignableUsers = assignableUsers.map(user => ({
        ...user,
        fullName: `${user.firstName} ${user.lastName}`.trim() 
      }));
      this.usersWithUserRole = usersWithUserRole;

      if (this.ticketId !== null) {
        this.loadTicketDetails(this.ticketId);
      } else if (!this.isEditMode) { 
        const idFromQueryParams = this.route.snapshot.queryParams['ticketId'] ? +this.route.snapshot.queryParams['ticketId'] : null;
        if (typeof idFromQueryParams === 'number' && idFromQueryParams !== null) {
          this.ticketId = idFromQueryParams;
          this.isEditMode = true;
          this.isReadOnly = false; 
          this.loadTicketDetails(this.ticketId!);
        } else {
          this.initializeNewTicketForm();
          const initialCategoryId = this.route.snapshot.queryParams['categoryId'] ? +this.route.snapshot.queryParams['categoryId'] : null;
          const initialSupportServiceId = this.route.snapshot.queryParams['supportServiceId'] ? +this.route.snapshot.queryParams['supportServiceId'] : (this.route.snapshot.queryParams['serviceId'] ? +this.route.snapshot.queryParams['serviceId'] : null);
          if (initialCategoryId) {
            this.ticketForm.get('categoryId')?.setValue(initialCategoryId);
            this.onCategoryChange(initialCategoryId, () => {
              if (initialSupportServiceId && this.filteredSupportServices.some(s => s.id === initialSupportServiceId)) {
                this.ticketForm.get('supportServiceId')?.setValue(initialSupportServiceId);
              }
            });
          }
        }
      }

      if (!this.isReadOnly && (this.isUserRole || this.isHelperOrPmRole || this.isAdminRole)) {
        this.setupAutoSave();
      }
      this.isInitialFormSetup = false; // Imposta il flag a false dopo l'inizializzazione completa
    });

    this.ticketForm.get('categoryId')?.valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe(selectedCategoryId => {
      this.onCategoryChange(selectedCategoryId);
    });

    this.ticketForm.get('email')?.valueChanges.pipe(
      takeUntil(this.destroy$),
      filter(() => !this.isUserRole && !this.isReadOnly), 
      distinctUntilChanged() 
    ).subscribe(newEmail => {
      this.onEmailFieldChange(newEmail);
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
   * Per Admin/Helper/PM, pre-compila l'email con la propria e abilita la modifica.
   */
  initializeNewTicketForm(): void {
    console.log('initializeNewTicketForm called: Resetting form state.');
    this.isEditMode = false;
    this.isDraft = false;
    this.isReadOnly = false;
    this.ticketId = null;
    this.currentTicket = null;
    this.disableAutoSaveAfterEmailChange = false; 
    this.isUserOwnerSelected = false; 
    this.ticketForm.reset(); 
    this.ticketForm.enable(); 

    this.ticketForm.get('email')?.setValidators([Validators.required, Validators.email]);
    this.ticketForm.get('assignedToId')?.clearValidators(); 

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
        this.ticketForm.get('email')?.clearValidators(); 
        this.ticketForm.get('email')?.updateValueAndValidity();
        this.isUserOwnerSelected = true; 
        this.ticketForm.get('fiscalCode')?.setValidators(Validators.required); 
        this.ticketForm.get('phoneNumber')?.setValidators(Validators.required); 
        this.ticketForm.get('fiscalCode')?.updateValueAndValidity();
        this.ticketForm.get('phoneNumber')?.updateValueAndValidity();
        this.ticketForm.updateValueAndValidity(); 
      });
    } else { 
      this.ticketForm.patchValue({
        email: this.currentUserEmail, 
        fiscalCode: '',
        phoneNumber: ''
      });
      this.ticketForm.get('email')?.enable(); 
      this.isUserOwnerSelected = false; 
      this.ticketForm.get('fiscalCode')?.disable();
      this.ticketForm.get('phoneNumber')?.disable();
      this.ticketForm.get('assignedToId')?.disable();
      this.ticketForm.get('fiscalCode')?.clearValidators(); 
      this.ticketForm.get('phoneNumber')?.clearValidators(); 
      this.ticketForm.get('assignedToId')?.clearValidators(); 
    }
    this.ticketForm.get('priority')?.setValue(TicketPriority.MEDIUM);
    this.ticketForm.get('assignedToId')?.setValue(null);
    this.filteredSupportServices = [];
    this.ticketForm.updateValueAndValidity(); 
    this.ticketForm.markAllAsTouched(); 
  }

  /**
   * Carica i dettagli di un ticket esistente (può essere una bozza caricata da selezione, o un ticket non bozza).
   * @param id L'ID del ticket da caricare.
   */
  loadTicketDetails(id: number): void {
    console.log('loadTicketDetails called for ID:', id);
    this.ticketId = id;
    this.isEditMode = true;
    this.disableAutoSaveAfterEmailChange = false; 
    this.isUserOwnerSelected = false; 

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

          if (this.config && typeof this.config.data.isReadOnly === 'boolean') {
            this.isReadOnly = this.config.data.isReadOnly;
          } else {
            this.isReadOnly = this.determineReadOnlyStatus(ticket);
          }
          
          if (this.isReadOnly) {
            this.ticketForm.disable(); 
            this.ticketForm.get('email')?.clearValidators(); 
            this.ticketForm.get('assignedToId')?.clearValidators(); 
            this.isUserOwnerSelected = false; 
          } else {
            this.ticketForm.enable(); 
            if (this.isUserRole) {
              this.ticketForm.get('email')?.disable(); 
              this.ticketForm.get('email')?.clearValidators(); 
              this.isUserOwnerSelected = true; 
              this.userService.getMe().pipe(
                takeUntil(this.destroy$),
                catchError(err => {
                  console.error('Errore nel caricamento del profilo utente per pre-compilazione:', err);
                  this.messageService.add({ severity: 'warn', summary: 'Attenzione', detail: 'Impossibile pre-compilare codice fiscale e telefono. Inseriscili manualmente se necessario.' });
                  return of(null);
                })
              ).subscribe(userProfile => {
                this.ticketForm.patchValue({
                  fiscalCode: userProfile?.fiscalCode || '', 
                  phoneNumber: userProfile?.phoneNumber || '' 
                });
                this.ticketForm.get('fiscalCode')?.setValidators(Validators.required);
                this.ticketForm.get('phoneNumber')?.setValidators(Validators.required);
                this.ticketForm.get('fiscalCode')?.updateValueAndValidity();
                this.ticketForm.get('phoneNumber')?.updateValueAndValidity();
                this.ticketForm.updateValueAndValidity(); 
              });
              this.ticketForm.get('fiscalCode')?.enable();
              this.ticketForm.get('phoneNumber')?.enable();
              this.ticketForm.get('assignedToId')?.clearValidators(); 
              this.ticketForm.get('assignedToId')?.disable(); 
            } else { 
              this.ticketForm.get('email')?.enable(); 
              this.ticketForm.get('email')?.setValidators([Validators.required, Validators.email]); 
              
              const ownerUserDto = this.usersWithUserRole.find(u => u.email === ticket.userEmail);
              this.isUserOwnerSelected = ownerUserDto?.role?.includes(UserRole.USER) || false;

              this.onEmailFieldChange(ticket.userEmail!); 
            }
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
          
          this.ticketForm.updateValueAndValidity(); 
          this.ticketForm.markAllAsTouched(); 
          console.log('loadTicketDetails: Ticket loaded. ticketId=', this.ticketId, 'isEditMode=', this.isEditMode, 'isDraft=', this.isDraft, 'isReadOnly=', this.isReadOnly);
        }
      }
    });
  }

  /**
   * Determina se il form deve essere in sola lettura in base al ruolo e allo stato del ticket.
   * Questa logica viene usata se isReadOnly non è esplicitamente passato dalla config.
   * @param ticket Il DTO del ticket.
   * @returns True se il form deve essere in sola lettura, false altrimenti.
   */
  private determineReadOnlyStatus(ticket: TicketResponseDto): boolean {
    const isOwner = ticket.userId === this.currentUserId;

    if (this.isAdminOrPmRole || this.isHelperOrPmRole) {
      if ((ticket.status === TicketStatus.DRAFT && !isOwner) || ticket.status === TicketStatus.SOLVED) {
        return true;
      }
      return false; 
    } else if (this.isUserRole) {
      return !(ticket.status === TicketStatus.DRAFT && isOwner);
    }
    return true; 
  }

  /**
   * Listener per il cambio del valore nel campo email.
   * Abilita/Disabilita l'auto-salvataggio e i campi dettagli proprietario in base al proprietario.
   * @param newEmail La nuova email selezionata/inserita.
   */
  onEmailFieldChange(newEmail: string): void {
    if (this.isUserRole || this.isReadOnly) {
      return; 
    }

    // Salva lo stato precedente di disableAutoSaveAfterEmailChange per rilevare la transizione
    const previousDisableAutoSaveState = this.disableAutoSaveAfterEmailChange; 
    
    const selectedUser = this.usersWithUserRole.find(u => u.email === newEmail);
    this.isUserOwnerSelected = selectedUser?.role?.includes(UserRole.USER) || false;

    // Determina il nuovo stato di disableAutoSaveAfterEmailChange
    // L'auto-salvataggio è disabilitato se:
    // 1. L'owner selezionato è un USER (per Admin/PM/Helper)
    // 2. L'email è stata pulita (newEmail è falsy)
    const newDisableAutoSaveState = (this.isUserOwnerSelected) || (!newEmail);
    
    // Mostra il messaggio SOLO se lo stato di disabilitazione è cambiato da false a true
    // E l'utente corrente è Admin/Helper/PM, E NON siamo nella fase di setup iniziale del form.
    if ((this.isAdminOrPmRole || this.isHelperOrPmRole) && newDisableAutoSaveState && !previousDisableAutoSaveState && !this.isInitialFormSetup) {
      this.messageService.add({ severity: 'warn', summary: 'Auto-salvataggio Disabilitato', detail: 'Il proprietario del ticket è un utente USER o l\'email è stata pulita. Finalizza per salvare le modifiche.' });
    } 
    // Se lo stato è cambiato da true a false, pulisci i messaggi di warning
    else if ((this.isAdminOrPmRole || this.isHelperOrPmRole) && !newDisableAutoSaveState && previousDisableAutoSaveState) {
        this.messageService.clear('warn'); 
    }

    // Aggiorna il flag di stato dell'auto-salvataggio
    this.disableAutoSaveAfterEmailChange = newDisableAutoSaveState;


    if (this.isUserOwnerSelected) {
      this.ticketForm.get('fiscalCode')?.enable();
      this.ticketForm.get('phoneNumber')?.enable();
      this.ticketForm.patchValue({
        fiscalCode: selectedUser?.fiscalCode || '',
        phoneNumber: selectedUser?.phoneNumber || ''
      }, { emitEvent: false }); // Aggiunto { emitEvent: false } per evitare loop ricorsivi
      this.ticketForm.get('fiscalCode')?.setValidators(Validators.required);
      this.ticketForm.get('phoneNumber')?.setValidators(Validators.required);
      
      this.ticketForm.get('assignedToId')?.enable(); 
      this.ticketForm.get('assignedToId')?.setValidators(Validators.required); 
    } else {
      this.ticketForm.get('fiscalCode')?.disable();
      this.ticketForm.get('fiscalCode')?.setValue(''); 
      this.ticketForm.get('phoneNumber')?.disable();
      this.ticketForm.get('phoneNumber')?.setValue(''); 
      this.ticketForm.get('fiscalCode')?.clearValidators();
      this.ticketForm.get('phoneNumber')?.clearValidators();

      this.ticketForm.get('assignedToId')?.disable(); 
      this.ticketForm.get('assignedToId')?.clearValidators(); 
      this.ticketForm.get('assignedToId')?.setValue(null); 
    }
    this.ticketForm.get('fiscalCode')?.updateValueAndValidity();
    this.ticketForm.get('phoneNumber')?.updateValueAndValidity();
    this.ticketForm.get('assignedToId')?.updateValueAndValidity(); 
    this.ticketForm.updateValueAndValidity(); 
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
      if (!this.isReadOnly && !this.isSaving && !this.disableAutoSaveAfterEmailChange) {
        this.autoSaveDraft();
      }
    });
  }

  /**
   * Salva automaticamente il ticket come bozza.
   */
  autoSaveDraft(): void {
    if (this.isSaving || this.disableAutoSaveAfterEmailChange) {
      console.log('autoSaveDraft: Save already in progress or auto-save disabled, skipping.');
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
        this.assignableUsers = users.map(user => ({
          ...user,
          fullName: `${user.firstName} ${user.lastName}`.trim() 
        })); 
      });
    }
  }

  /**
   * Carica la lista di utenti con ruolo USER.
   * Utilizzato per il dropdown di selezione email per Admin/PM/Helper.
   */
  loadUsersWithUserRole(): void {
    if (this.isAdminOrPmRole || this.isHelperOrPmRole) {
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
   * Controlla se il pulsante "Finalizza Ticket" deve essere abilitato.
   * @returns True se il pulsante deve essere abilitato, false altrimenti.
   */
  isFinalizeButtonEnabled(): boolean {
    if (this.isUserRole) {
      return this.ticketForm.valid;
    }

    if (!this.isUserOwnerSelected) {
        return false; 
    }

    const emailControl = this.ticketForm.get('email');
    const fiscalCodeControl = this.ticketForm.get('fiscalCode');
    const phoneNumberControl = this.ticketForm.get('phoneNumber');
    const assignedToIdControl = this.ticketForm.get('assignedToId');

    if (!emailControl?.valid || !this.ticketForm.get('title')?.valid || !this.ticketForm.get('description')?.valid ||
        !this.ticketForm.get('categoryId')?.valid || !this.ticketForm.get('supportServiceId')?.valid || !this.ticketForm.get('priority')?.valid) {
      return false;
    }

    if (!fiscalCodeControl?.value || !phoneNumberControl?.value || !assignedToIdControl?.value) {
        return false;
    }
    if (fiscalCodeControl?.enabled && !fiscalCodeControl?.valid) return false;
    if (phoneNumberControl?.enabled && !phoneNumberControl?.valid) return false;
    if (assignedToIdControl?.enabled && !assignedToIdControl?.valid) return false;

    return true; 
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

    const fiscalCodeControl = this.ticketForm.get('fiscalCode');
    const phoneNumberControl = this.ticketForm.get('phoneNumber');
    const assignedToIdControl = this.ticketForm.get('assignedToId');

    const originalFiscalCodeValidators = fiscalCodeControl?.validator ?? null;
    const originalPhoneNumberValidators = phoneNumberControl?.validator ?? null;
    const originalAssignedToIdValidators = assignedToIdControl?.validator ?? null;

    if (this.isUserOwnerSelected) {
        fiscalCodeControl?.setValidators(Validators.required);
        phoneNumberControl?.setValidators(Validators.required);
    } else {
        fiscalCodeControl?.clearValidators();
        phoneNumberControl?.clearValidators();
    }
    if (!this.isUserRole && this.isUserOwnerSelected) { 
      assignedToIdControl?.setValidators(Validators.required);
    } else {
      assignedToIdControl?.clearValidators();
    }
    
    fiscalCodeControl?.updateValueAndValidity();
    phoneNumberControl?.updateValueAndValidity();
    assignedToIdControl?.updateValueAndValidity();
    this.ticketForm.updateValueAndValidity();

    if (!this.ticketForm.valid) {
      this.messageService.add({ severity: 'error', summary: 'Errore', detail: 'Compila tutti i campi obbligatori per finalizzare il ticket.' });
      this.ticketForm.markAllAsTouched(); 
      
      fiscalCodeControl?.setValidators(originalFiscalCodeValidators);
      phoneNumberControl?.setValidators(originalPhoneNumberValidators);
      assignedToIdControl?.setValidators(originalAssignedToIdValidators);
      fiscalCodeControl?.updateValueAndValidity();
      phoneNumberControl?.updateValueAndValidity();
      assignedToIdControl?.updateValueAndValidity();
      this.ticketForm.updateValueAndValidity();

      return;
    }

    fiscalCodeControl?.setValidators(originalFiscalCodeValidators);
    phoneNumberControl?.setValidators(originalPhoneNumberValidators);
    assignedToIdControl?.setValidators(originalAssignedToIdValidators);
    fiscalCodeControl?.updateValueAndValidity();
    phoneNumberControl?.updateValueAndValidity();
    assignedToIdControl?.updateValueAndValidity();
    this.ticketForm.updateValueAndValidity();


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

        if (err.status === 500 && errorMessage.includes("Un ticket creato da un Admin/PM/Helper deve avere come proprietario un utente con ruolo USER.")) {
          errorMessage = "Il proprietario del ticket deve essere un utente con ruolo USER per finalizzare la bozza.";
        } else if (err.status === 500 && errorMessage.includes("Utente con email") && errorMessage.includes("non trovato nel sistema")) {
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
          if (!this.ref || (this.ref && !this.isEditMode)) { 
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
   * Ora filtra per le bozze dell'utente corrente, indipendentemente dal ruolo.
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
        isModalSelection: true,
        filterOwnerId: this.currentUserId 
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