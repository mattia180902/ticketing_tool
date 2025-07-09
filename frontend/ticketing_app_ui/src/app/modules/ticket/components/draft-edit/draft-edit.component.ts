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
    private confirmationService: ConfirmationService
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

    this.loadCategories();
    this.loadAllSupportServices();
    this.loadAssignableUsers();

    if (this.ticketId !== null) {
      this.loadTicketDetails(this.ticketId);
    } else {
      this.messageService.add({ severity: 'error', summary: 'Errore', detail: 'Impossibile caricare la bozza.' });
      this.ref.close();
    }

    if (this.isUserRole && this.isDraft && !this.isReadOnly) {
      this.setupAutoSave();
    }

    this.ticketForm.get('categoryId')?.valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe(selectedCategoryId => {
      this.onCategoryChange(selectedCategoryId);
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

          this.ticketForm.get('email')?.disable();
        }
      }
    });
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
      if (!this.isSaving) { // Aggiunto !this.isSaving
        this.autoSaveDraft();
      }
    });
  }

  /**
   * Salva automaticamente il ticket come bozza.
   */
  autoSaveDraft(): void {
    if (this.isSaving) { // Previene l'esecuzione se un salvataggio è già in corso
      console.log('autoSaveDraft: Save already in progress, skipping.');
      return;
    }
    this.isSaving = true; // Imposta il flag di salvataggio
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
        this.isSaving = false; // Resetta il flag di salvataggio al termine dell'operazione
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
    return this.ticketForm.valid;
  }

  /**
   * Finalizza la bozza (la trasforma in un ticket OPEN).
   */
  finalizeDraft(): void {
    if (this.isSaving) { // Previene l'esecuzione se un salvataggio è già in corso
      console.log('finalizeDraft: Save already in progress, skipping.');
      this.messageService.add({ severity: 'warn', summary: 'Attenzione', detail: 'Un\'operazione di salvataggio è già in corso. Attendi.' });
      return;
    }

    if (!this.isFormValidForFinalization()) {
      this.messageService.add({ severity: 'error', summary: 'Errore', detail: 'Compila tutti i campi obbligatori per finalizzare la bozza.' });
      this.ticketForm.markAllAsTouched();
      return;
    }

    this.isSaving = true; // Imposta il flag di salvataggio
    const ticketDto = this.prepareTicketDto(TicketStatus.OPEN);

    const saveObservable = this.ticketService.updateTicket({ ticketId: this.ticketId!, body: ticketDto });

    saveObservable.pipe(
      takeUntil(this.destroy$),
      catchError((err: HttpErrorResponse) => {
        console.error('Errore nella finalizzazione della bozza:', err);
        let errorMessage = err.error?.message || 'Impossibile finalizzare la bozza.';
        this.messageService.add({ severity: 'error', summary: 'Errore', detail: errorMessage });
        return of(null);
      }),
      finalize(() => {
        this.isSaving = false; // Resetta il flag di salvataggio al termine dell'operazione
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
