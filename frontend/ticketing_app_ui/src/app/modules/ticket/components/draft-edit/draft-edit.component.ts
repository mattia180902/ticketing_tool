/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prefer-const */
// src/app/modules/ticket/components/draft-edit/draft-edit.component.ts

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
import { DynamicDialogRef, DynamicDialogConfig } from 'primeng/dynamicdialog'; 
import { MessageService, ConfirmationService, ConfirmEventType } from 'primeng/api';

import { Subject, Observable, Subscription, of } from 'rxjs';
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
  providers: [MessageService, ConfirmationService] 
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
  
  assignableUsers: UserDto[] = [];
  usersWithUserRole: UserDto[] = []; // Lista di utenti con ruolo USER per il dropdown dell'email

  isSaving = false;
  disableAutoSaveAfterEmailChange = false; // Flag per disabilitare l'auto-salvataggio
  isUserOwnerSelected = false; // Indica se l'email selezionata è di un utente USER

  private destroy$ = new Subject<void>();
  private currentUserId = '';
  private formSubscription: Subscription | undefined;
  private currentUserEmail = ''; // NUOVO: Email dell'utente corrente

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
    this.currentUserEmail = this.authService.getUserEmail(); //Ottieni l'email dell'utente corrente
    this.isUserRole = this.authService.isUser();
    this.isHelperOrPmRole = this.authService.isHelperOrPm();
    this.isAdminRole = this.authService.isAdmin();
    this.isAdminOrPmRole = this.authService.isAdminOrPm(); //Inizializza isAdminOrPmRole

    this.loadCategories();
    this.loadAllSupportServices();
    this.loadAssignableUsers();
    this.loadUsersWithUserRole(); //Carica la lista di utenti USER

    if (this.ticketId !== null) {
      this.loadTicketDetails(this.ticketId);
    } else {
      this.messageService.add({ severity: 'error', summary: 'Errore', detail: 'Impossibile caricare la bozza.' });
      this.ref.close();
    }

    // L'auto-salvataggio si attiva solo se non è in modalità sola lettura e se l'utente è autorizzato
    // E se non è già disabilitato a causa del cambio email
    if (!this.isReadOnly && (this.isUserRole || this.isHelperOrPmRole || this.isAdminRole)) {
      this.setupAutoSave();
    }

    this.ticketForm.get('categoryId')?.valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe(selectedCategoryId => {
      this.onCategoryChange(selectedCategoryId);
    });

    //Listener per il cambio dell'email per i ruoli Admin/Helper/PM
    this.ticketForm.get('email')?.valueChanges.pipe(
      takeUntil(this.destroy$),
      filter(() => !this.isUserRole && !this.isReadOnly), // Solo per Admin/Helper/PM e non in sola lettura
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
          // La logica di autorizzazione per la modifica della bozza è più stringente qui:
          // Solo l'owner può modificare la propria bozza.
          // Se non è una bozza O l'owner non è l'utente corrente, chiudi la modale.
          if (ticket.status !== TicketStatus.DRAFT || ticket.userId !== this.currentUserId) {
            this.messageService.add({ severity: 'warn', summary: 'Non Autorizzato', detail: 'Non puoi modificare questa bozza.' });
            this.ref.close();
            return;
          }

          this.currentTicket = ticket;
          this.isDraft = true;
          this.isEditMode = true;
          this.isReadOnly = false; // La bozza è sempre modificabile dal suo proprietario

          // Imposta i validatori iniziali e lo stato di abilitazione/disabilitazione
          this.ticketForm.get('email')?.setValidators([Validators.required, Validators.email]);
          this.ticketForm.get('assignedToId')?.clearValidators(); // Non richiesto per le bozze

          if (this.isUserRole) {
            this.ticketForm.get('email')?.disable(); // L'email dell'utente è fissa e disabilitata
            this.ticketForm.get('email')?.clearValidators(); // Rimuovi validatori se disabilitato
            this.isUserOwnerSelected = true; // Per USER, l'owner è sempre un USER
            this.ticketForm.get('fiscalCode')?.enable(); // Abilita per USER
            this.ticketForm.get('phoneNumber')?.enable(); // Abilita per USER
          } else { // Admin/PM/Helper
            this.ticketForm.get('email')?.enable(); // Il campo email è abilitato per la modifica (dropdown)
            
            // Determina isUserOwnerSelected basandosi sull'email del ticket caricato
            const ownerUserDto = this.usersWithUserRole.find(u => u.email === ticket.userEmail);
            this.isUserOwnerSelected = ownerUserDto?.role?.includes(UserRole.USER) || false;

            // Abilita/disabilita i campi dettagli proprietario e assegnatario in base a isUserOwnerSelected
            if (this.isUserOwnerSelected) {
              this.ticketForm.get('fiscalCode')?.enable();
              this.ticketForm.get('phoneNumber')?.enable();
              this.ticketForm.get('assignedToId')?.disable(); // Assegnatario disabilitato per bozze
              this.ticketForm.get('assignedToId')?.clearValidators();
            } else {
              this.ticketForm.get('fiscalCode')?.disable();
              this.ticketForm.get('phoneNumber')?.disable();
              this.ticketForm.get('assignedToId')?.disable();
              this.ticketForm.get('assignedToId')?.clearValidators();
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

          // Imposta disableAutoSaveAfterEmailChange se l'email del ticket non è la propria
          // SOLO se il ticket è una bozza e l'utente corrente è Admin/PM/Helper
          if (this.isDraft && (this.isAdminOrPmRole || this.isHelperOrPmRole) && ticket.userEmail !== this.currentUserEmail) {
            this.disableAutoSaveAfterEmailChange = true;
            this.messageService.add({ severity: 'warn', summary: 'Attenzione', detail: 'L\'auto-salvataggio è disabilitato perché il proprietario del ticket è un altro utente. Finalizza per salvare le modifiche.' });
          }
          this.ticketForm.updateValueAndValidity(); // Forza ricalcolo validità del form
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

    // Trova l'utente selezionato dalla lista degli utenti USER
    const selectedUser = this.usersWithUserRole.find(u => u.email === newEmail);
    // Imposta isUserOwnerSelected in base al ruolo dell'utente selezionato
    this.isUserOwnerSelected = selectedUser?.role?.includes(UserRole.USER) || false;

    // Logica per disabilitare auto-salvataggio
    // Si applica solo se è una bozza e l'email selezionata non è la propria
    if (this.isDraft && (this.isAdminOrPmRole || this.isHelperOrPmRole) && newEmail !== this.currentUserEmail) {
      this.disableAutoSaveAfterEmailChange = true;
      this.messageService.add({ severity: 'warn', summary: 'Auto-salvataggio Disabilitato', detail: 'Il proprietario del ticket è stato cambiato. L\'auto-salvataggio è disabilitato. Finalizza per salvare le modifiche.' });
    } else {
      this.disableAutoSaveAfterEmailChange = false;
    }

    // Logica per abilitare/disabilitare campi dettagli proprietario e assegnatario
    if (this.isUserOwnerSelected) {
      this.ticketForm.get('fiscalCode')?.enable();
      this.ticketForm.get('phoneNumber')?.enable();
      this.ticketForm.get('assignedToId')?.disable(); // Assegnatario è sempre disabilitato per le bozze
      this.ticketForm.get('assignedToId')?.clearValidators();
    } else {
      // Se l'email selezionata non è di un USER o è la propria (Admin/PM/Helper)
      // Disabilita i campi e pulisci i loro valori
      this.ticketForm.get('fiscalCode')?.disable();
      this.ticketForm.get('fiscalCode')?.setValue(''); 
      this.ticketForm.get('phoneNumber')?.disable();
      this.ticketForm.get('phoneNumber')?.setValue(''); 
      this.ticketForm.get('assignedToId')?.disable();
      this.ticketForm.get('assignedToId')?.clearValidators(); 
      this.ticketForm.get('assignedToId')?.setValue(null); 
    }
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
      // L'auto-salvataggio si attiva solo se non c'è un salvataggio in corso
      // E se non è stato disabilitato a causa del cambio email
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
      console.log('autoSaveDraft: Save already in progress or auto-save disabled, skipping.');
      return;
    }
    this.isSaving = true; 
    const ticketDto = this.prepareTicketDto(TicketStatus.DRAFT);

    const saveObservable = this.ticketService.updateTicket({ ticketId: this.ticketId!, body: ticketDto });

    saveObservable.pipe(
      takeUntil(this.destroy$),
      catchError((err: HttpErrorResponse) => {
        console.error('Errore nell\'auto-salvataggio della bozza:', err);
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
    // Carica sempre se non è un USER, perché anche un PM/Admin/Helper può aprire la propria bozza
    // e volerla riassegnare a un USER.
    if (!this.isUserRole) { 
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
    // Per le bozze, il codice fiscale e il numero di telefono non sono obbligatori
    // a meno che non si finalizzi il ticket con un owner USER.
    // La validazione sul backend garantirà che siano presenti al momento della finalizzazione.
    // Qui controlliamo solo la validità generale del form per i campi abilitati.
    return this.ticketForm.valid;
  }

  /**
   * Finalizza la bozza (la trasforma in un ticket OPEN).
   */
  finalizeDraft(): void {
    if (this.isSaving) { 
      console.log('finalizeDraft: Save already in progress, skipping.');
      this.messageService.add({ severity: 'warn', summary: 'Attenzione', detail: 'Un\'operazione di salvataggio è già in corso. Attendi.' });
      return;
    }

    // Prima di finalizzare, assicurati che i campi siano validi se l'owner è un USER
    const emailControl = this.ticketForm.get('email');
    const fiscalCodeControl = this.ticketForm.get('fiscalCode');
    const phoneNumberControl = this.ticketForm.get('phoneNumber');
    const assignedToIdControl = this.ticketForm.get('assignedToId');

    // Se l'owner è un USER, fiscalCode e phoneNumber diventano obbligatori
    if (this.isUserOwnerSelected) {
        fiscalCodeControl?.setValidators(Validators.required);
        phoneNumberControl?.setValidators(Validators.required);
    } else {
        fiscalCodeControl?.clearValidators();
        phoneNumberControl?.clearValidators();
    }
    // L'assegnatario è obbligatorio solo per i ticket finalizzati da Admin/PM/Helper
    if (!this.isUserRole && !this.isDraft && this.isUserOwnerSelected) { // Se non è una bozza e l'owner è USER
      assignedToIdControl?.setValidators(Validators.required);
    } else {
      assignedToIdControl?.clearValidators();
    }
    
    // Forza la ricalcolazione della validità dopo aver modificato i validatori
    fiscalCodeControl?.updateValueAndValidity();
    phoneNumberControl?.updateValueAndValidity();
    assignedToIdControl?.updateValueAndValidity();
    this.ticketForm.updateValueAndValidity();

    if (!this.isFormValidForFinalization()) {
      this.messageService.add({ severity: 'error', summary: 'Errore', detail: 'Compila tutti i campi obbligatori per finalizzare la bozza.' });
      this.ticketForm.markAllAsTouched();
      return;
    }

    this.isSaving = true; 
    const ticketDto = this.prepareTicketDto(TicketStatus.OPEN);

    const saveObservable = this.ticketService.updateTicket({ ticketId: this.ticketId!, body: ticketDto });

    saveObservable.pipe(
      takeUntil(this.destroy$),
      catchError((err: HttpErrorResponse) => {
        console.error('Errore nella finalizzazione della bozza:', err);
        let errorMessage = err.error?.message || 'Impossibile finalizzare la bozza.';
        
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
            console.error('Errore nell\'eliminazione della bozza:', err);
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
