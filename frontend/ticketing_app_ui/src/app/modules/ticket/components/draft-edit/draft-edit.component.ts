/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prefer-const */

import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { DropdownModule } from 'primeng/dropdown';
import { InputMaskModule } from 'primeng/inputmask';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageModule } from 'primeng/message';
import { CardModule } from 'primeng/card';
import { DynamicDialogRef, DynamicDialogConfig, DialogService } from 'primeng/dynamicdialog'; 
import { MessageService, ConfirmationService, ConfirmEventType } from 'primeng/api';

import { Subject, Observable, Subscription, of, forkJoin } from 'rxjs';
import { takeUntil, catchError, debounceTime, filter, distinctUntilChanged, finalize } from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';

import { TicketManagementService } from '../../../../services/services';
import { CategoryService } from '../../../../services/services';
import { SupportServicesService } from '../../../../services/services';
import { UserManagementService } from '../../../../services/services';
import { CategoryResponse, SupportServiceResponse, TicketRequestDto, TicketResponseDto, UserDto } from '../../../../services/models';
import { UserRole } from '../../../../shared/enums/UserRole';
import { TicketStatus } from '../../../../shared/enums/TicketStatus';
import { TicketPriority } from '../../../../shared/enums/TicketPriority';
import { AuthService } from '../../service/auth.service';
import { DialogModule } from 'primeng/dialog';

export interface AssignableUser extends UserDto {
  fullName: string;
}

@Component({
  selector: 'app-draft-edit',
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
    CardModule,
    DialogModule
  ],
  templateUrl: './draft-edit.component.html',
  styleUrl: './draft-edit.component.scss',
  providers: [MessageService, ConfirmationService, DialogService]
})
export class DraftEditComponent implements OnInit, OnDestroy {
  ticketForm: FormGroup;
  categories: CategoryResponse[] = [];
  allSupportServices: SupportServiceResponse[] = [];
  filteredSupportServices: SupportServiceResponse[] = [];
  priorities: TicketPriority[] = Object.values(TicketPriority);
  
  ticketId: number | null = null;
  isEditMode = true;
  isDraft = true;
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
  private autoSaveMessageShown = false; //Flag per tracciare il messaggio di auto-salvataggio

  public isUserRole = false;
  public isHelperOrPmRole = false;
  public isAdminRole = false;
  public isAdminOrPmRole = false; 

  public UserRole = UserRole;
  public TicketStatus = TicketStatus;
  public TicketPriority = TicketPriority;

  public ref: DynamicDialogRef = inject(DynamicDialogRef);
  public config: DynamicDialogConfig = inject(DynamicDialogConfig);

  constructor(
    private fb: FormBuilder,
    private ticketService: TicketManagementService,
    private categoryService: CategoryService,
    private supportServiceService: SupportServicesService,
    private userService: UserManagementService,
    private authService: AuthService,
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

    if (this.config && this.config.data && typeof this.config.data.ticketId === 'number' && this.config.data.ticketId !== null) {
      this.ticketId = this.config.data.ticketId;
    } else {
      console.error('DraftEditComponent: Ticket ID non fornito nella configurazione della modale.');
      this.messageService.add({ severity: 'error', summary: 'Errore', detail: 'Impossibile caricare la bozza: ID mancante.' });
      this.ref.close();
    }
  }

  ngOnInit(): void {
    this.currentUserId = this.authService.getUserId();
    this.isUserRole = this.authService.isUser();
    this.isHelperOrPmRole = this.authService.isHelperOrPm();
    this.isAdminRole = this.authService.isAdmin();
    this.isAdminOrPmRole = this.authService.isAdminOrPm(); 

    // Carica tutte le dipendenze in parallelo per velocità
    forkJoin([
      this.categoryService.getAllCategories(),
      this.supportServiceService.getAll(),
      this.isHelperOrPmRole || this.isAdminRole ? this.userService.getHelpersAndAdmins() : of([]),
      !this.isUserRole ? this.userService.getUsersByRole({ roleName: UserRole.USER }) : of([])
    ]).pipe(
      takeUntil(this.destroy$),
      catchError(err => {
        console.error('Errore nel caricamento delle dipendenze iniziali:', err);
        this.messageService.add({ severity: 'error', summary: 'Errore', detail: 'Impossibile caricare i dati iniziali del form.' });
        this.ref.close();
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

      // Ora che tutti i dati sono caricati, carica i dettagli del ticket
      if (this.ticketId !== null) {
        this.loadTicketDetails(this.ticketId);
      } else {
        this.messageService.add({ severity: 'error', summary: 'Errore', detail: 'Impossibile caricare la bozza.' });
        this.ref.close();
      }

      // Configura l'auto-salvataggio solo dopo il caricamento iniziale e se non è readOnly
      if (!this.isReadOnly && (this.isUserRole || this.isHelperOrPmRole || this.isAdminRole)) {
        this.setupAutoSave();
      }
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
    if (this.formSubscription) {
      this.formSubscription.unsubscribe();
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Carica i dettagli di una bozza esistente.
   * @param id L'ID della bozza da caricare.
   */
  loadTicketDetails(id: number): void {
    this.ticketService.getTicketDetails({ ticketId: id }).pipe(
      takeUntil(this.destroy$),
      catchError(err => {
        console.error('Errore nel caricamento dei dettagli della bozza:', err);
        this.messageService.add({ severity: 'error', summary: 'Errore', detail: err.error?.message || 'Impossibile caricare i dettagli della bozza.' });
        this.ref.close();
        return of(null);
      })
    ).subscribe({
      next: (ticket) => {
        if (ticket) {
          if (ticket.status !== TicketStatus.DRAFT || ticket.userId !== this.currentUserId) {
            this.messageService.add({ severity: 'warn', summary: 'Non Autorizzato', detail: 'Non puoi modificare questa bozza.' });
            this.ref.close();
            return;
          }

          this.currentTicket = ticket;
          this.isDraft = true;
          this.isEditMode = true;
          this.isReadOnly = false; 

          this.ticketForm.get('email')?.setValidators([Validators.required, Validators.email]);
          this.ticketForm.get('assignedToId')?.clearValidators(); 

          if (this.isUserRole) {
            this.ticketForm.get('email')?.disable(); 
            this.ticketForm.get('email')?.clearValidators(); 
            this.isUserOwnerSelected = true; 
            
            // Carica e pre-compila fiscalCode e phoneNumber per l'utente USER loggato
            this.userService.getMe().pipe(
              takeUntil(this.destroy$),
              catchError(err => {
                console.error('Errore nel caricamento del profilo utente per pre-compilazione:', err);
                this.messageService.add({ severity: 'warn', summary: 'Attenzione', detail: 'Impossibile pre-compilare codice fiscale e telefono. Inseriscili manualmente se necessario.' });
                return of(null);
              })
            ).subscribe(userProfile => {
              console.log('USER Profile for pre-fill:', userProfile); 
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

          } else { 
            this.ticketForm.get('email')?.enable(); 
            
            const ownerUserDto = this.usersWithUserRole.find(u => u.email === ticket.userEmail);
            this.isUserOwnerSelected = ownerUserDto?.role?.includes(UserRole.USER) || false;

            this.onEmailFieldChange(ticket.userEmail!); 
          }

          this.ticketForm.patchValue({
            title: ticket.title,
            description: ticket.description,
            categoryId: ticket.categoryId,
            priority: ticket.priority,
            email: ticket.userEmail, 
            assignedToId: ticket.assignedToId
          });

          this.onCategoryChange(ticket.categoryId!, () => {
            this.ticketForm.get('supportServiceId')?.setValue(ticket.supportServiceId);
          });
          
          this.ticketForm.updateValueAndValidity(); 
          this.ticketForm.markAllAsTouched(); 
        }
      }
    });
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

    const selectedUser = this.usersWithUserRole.find(u => u.email === newEmail);
    const wasUserOwnerSelected = this.isUserOwnerSelected; // Salva lo stato precedente
    this.isUserOwnerSelected = selectedUser?.role?.includes(UserRole.USER) || false;

    // Determina il nuovo stato di disableAutoSaveAfterEmailChange
    const newDisableAutoSaveState = (this.isUserOwnerSelected && (this.isAdminOrPmRole || this.isHelperOrPmRole)) || (!newEmail && (this.isAdminOrPmRole || this.isHelperOrPmRole));

    // Solo se lo stato di disabilitazione dell'auto-salvataggio cambia O se l'email è stata appena pulita
    if (newDisableAutoSaveState !== this.disableAutoSaveAfterEmailChange || (newDisableAutoSaveState && !this.autoSaveMessageShown)) {
      this.disableAutoSaveAfterEmailChange = newDisableAutoSaveState;
      if (this.disableAutoSaveAfterEmailChange) {
        this.messageService.add({ severity: 'warn', summary: 'Auto-salvataggio Disabilitato', detail: 'Il proprietario del ticket è un utente USER o l\'email è stata pulita. Finalizza per salvare le modifiche.' });
        this.autoSaveMessageShown = true; // Imposta il flag a true
      } else {
        // Se l'auto-salvataggio viene riabilitato, possiamo resettare il flag
        this.autoSaveMessageShown = false; 
      }
    } else if (!newDisableAutoSaveState) {
      // Se l'auto-salvataggio è abilitato, assicurarsi che il flag sia false
      this.autoSaveMessageShown = false;
    }


    if (this.isUserOwnerSelected) {
      this.ticketForm.get('fiscalCode')?.enable();
      this.ticketForm.get('phoneNumber')?.enable();
      this.ticketForm.patchValue({
        fiscalCode: selectedUser?.fiscalCode || '',
        phoneNumber: selectedUser?.phoneNumber || ''
      });
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
      filter(() => this.ticketForm.dirty && (this.ticketForm.get('email')?.valid ?? false)),
      distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      if (!this.isSaving && !this.disableAutoSaveAfterEmailChange) {
        this.autoSaveDraft();
      }
    });
  }

  /**
   * Salva automaticamente il ticket come bozza.
   */
  autoSaveDraft(): void {
    if (this.isSaving || this.disableAutoSaveAfterEmailChange) { 
      return;
    }
    this.isSaving = true; 
    const ticketDto = this.prepareTicketDto(TicketStatus.DRAFT);

    const saveObservable = this.ticketService.updateTicket({ ticketId: this.ticketId!, body: ticketDto });

    saveObservable.pipe(
      takeUntil(this.destroy$),
      catchError((err: HttpErrorResponse) => {
        let errorMessage = err.error?.message || 'Impossibile salvare la bozza automaticamente.';
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
          this.currentTicket = ticket;
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
    if (!this.isUserRole) { 
      this.userService.getUsersByRole({ roleName: UserRole.USER }).pipe(
        takeUntil(this.destroy$),
        catchError(err => {
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
   * Questo metodo è chiamato dal template per controllare lo stato del pulsante.
   * @returns True se il form è valido, false altrimenti.
   */
  isFinalizeButtonEnabled(): boolean {
    // Se l'utente è un USER, la validazione standard del form è sufficiente.
    if (this.isUserRole) {
      return this.ticketForm.valid;
    }

    // Per Admin/Helper/PM:
    //    Se l'owner selezionato NON è un USER (cioè Admin/Helper/PM stesso),
    //    il pulsante "Finalizza Bozza" deve essere SEMPRE DISABLED.
    //    Non possono finalizzare una bozza che non è di un USER.
    if (!this.isUserOwnerSelected) {
        return false; 
    }

    // Se l'owner IS a USER, allora procedi con la validazione completa per la finalizzazione.
    const emailControl = this.ticketForm.get('email');
    const fiscalCodeControl = this.ticketForm.get('fiscalCode');
    const phoneNumberControl = this.ticketForm.get('phoneNumber');
    const assignedToIdControl = this.ticketForm.get('assignedToId');

    // Controlla la validità dei campi principali
    if (!emailControl?.valid || !this.ticketForm.get('title')?.valid || !this.ticketForm.get('description')?.valid ||
        !this.ticketForm.get('categoryId')?.valid || !this.ticketForm.get('supportServiceId')?.valid || !this.ticketForm.get('priority')?.valid) {
      return false;
    }

    // Se l'owner è un USER, i campi fiscalCode, phoneNumber e assignedToId sono obbligatori.
    // Controlla che abbiano un valore.
    if (!fiscalCodeControl?.value || !phoneNumberControl?.value || !assignedToIdControl?.value) {
        return false;
    }
    // Controlla anche la loro validità (se abilitati, il che dovrebbero essere qui)
    if (fiscalCodeControl?.enabled && !fiscalCodeControl?.valid) return false;
    if (phoneNumberControl?.enabled && !phoneNumberControl?.valid) return false;
    if (assignedToIdControl?.enabled && !assignedToIdControl?.valid) return false;

    return true; 
  }


  /**
   * Finalizza la bozza (la trasforma in un ticket OPEN).
   */
  finalizeDraft(): void {
    if (this.isSaving) { 
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
      this.messageService.add({ severity: 'error', summary: 'Errore', detail: 'Compila tutti i campi obbligatori per finalizzare la bozza.' });
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

    const saveObservable = this.ticketService.updateTicket({ ticketId: this.ticketId!, body: ticketDto });

    saveObservable.pipe(
      takeUntil(this.destroy$),
      catchError((err: HttpErrorResponse) => {
        let errorMessage = err.error?.message || 'Impossibile finalizzare la bozza.';
        
        if (err.status === 500 && errorMessage.includes("Un ticket creato da un Admin/PM/Helper deve avere come proprietario un utente con ruolo USER.")) {
          errorMessage = "Il proprietario del ticket deve essere un utente con ruolo USER per finalizzare la bozza.";
        } else if (err.status === 500 && errorMessage.includes("Utente con email") && errorMessage.includes("non trovato nel sistema")) {
          errorMessage = "L'email specificata per l'utente non è registrata. Assicurati che l'utente esista in Keycloak.";
        }

        this.messageService.add({ severity: 'error', summary: 'Errore', detail: 'Errore nella finalizzazione: ' + errorMessage }); 
        return of(null);
      }),
      finalize(() => {
        this.isSaving = false; 
        this.ref.close(true);
      })
    ).subscribe({
      next: (ticket) => {
        if (ticket) {
          this.messageService.add({ severity: 'success', summary: 'Successo', detail: 'Bozza finalizzata con successo come ticket!' });
        }
      }
    });
  }

  /**
   * Elimina la bozza corrente.
   */
  deleteDraft(): void {
    if (!this.ticketId) {
      this.messageService.add({ severity: 'warn', summary: 'Attenzione', detail: 'Nessuna bozza da eliminare.' });
      return;
    }

    this.confirmationService.confirm({
      message: `Sei sicuro di voler eliminare questa bozza?`,
      header: 'Conferma Eliminazione Bozza',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.ticketService.deleteTicket({ ticketId: this.ticketId! }).pipe(
          takeUntil(this.destroy$),
          catchError(err => {
            this.messageService.add({ severity: 'error', summary: 'Errore', detail: err.error?.message || 'Impossibile eliminare la bozza.' });
            return of(null);
          })
        ).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Successo', detail: 'Bozza eliminata con successo.' });
            this.ref.close('Deleted');
          }
        });
      },
      reject: (type: ConfirmEventType) => {
        this.messageService.add({ severity: 'info', summary: 'Annullato', detail: 'Eliminazione bozza annullata.' });
      }
    });
  }
}