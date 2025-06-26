/* eslint-disable @typescript-eslint/no-inferrable-types */
// src/app/modules/ticket/components/new-ticket/new-ticket.component.ts

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ActivatedRoute, Router } from '@angular/router';
import {
  TicketManagementService,
  UserService,
  CategoryService,     // Aggiunto per caricare le categorie
  SupportServicesService // Aggiunto per caricare i servizi
} from '../../../../services/services'; // Assicurati che il percorso sia corretto
import { DropdownModule } from 'primeng/dropdown';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import {
  UserDto,
  TicketRequestDto,
  TicketResponseDto,
  CategoryResponse,     // Importato per i dati di categoria
  SupportServiceResponse // Importato per i dati dei servizi
} from '../../../../services/models'; // Assicurati che il percorso sia corretto
import { AuthService } from '../../service/auth.service'; // Assicurati che il percorso sia corretto
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { Subject, debounceTime, distinctUntilChanged, takeUntil, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { TicketListComponent } from '../ticket-list/ticket-list.component'; // Assicurati che il percorso sia corretto
import { ConfirmDialogModule } from 'primeng/confirmdialog'; // Necessario per p-confirmDialog
import { ConfirmationService } from 'primeng/api'; // Necessario per ConfirmationService

@Component({
  selector: 'app-new-ticket',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DropdownModule,
    ButtonModule,
    ReactiveFormsModule,
    CardModule,
    InputTextModule,
    InputTextareaModule,
    ConfirmDialogModule,
    ToastModule
  ],
  templateUrl: './new-ticket.component.html',
  styleUrl: './new-ticket.component.scss',
  providers: [MessageService, DialogService, ConfirmationService], // Aggiungi ConfirmationService
})
export class NewTicketComponent implements OnInit, OnDestroy {
  ticketForm!: FormGroup;
  helpers: UserDto[] = [];
  categories: CategoryResponse[] = [];     // Nuova proprietà per le categorie
  services: SupportServiceResponse[] = []; // Nuova proprietà per i servizi
  isUserRole = false;
  currentTicketId: number | null = null;
  isEditMode = false;
  private destroy$ = new Subject<void>();
  private autoSaveSubject = new Subject<void>();

  ref: DynamicDialogRef | undefined; // Riferimento alla modale aperta

  constructor(
    private fb: FormBuilder,
    private ticketService: TicketManagementService,
    private userService: UserService,
    private categoryService: CategoryService,       // Iniettato
    private supportServicesService: SupportServicesService, // Iniettato
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private messageService: MessageService,
    public dialogService: DialogService,
    private confirmationService: ConfirmationService // Iniettato
  ) {}

  ngOnInit(): void {
    this.isUserRole = this.auth.isUser();
    this.loadInitialData(); // Carica categorie, helper all'inizio

    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const initialCategoryId = Number(params.get('categoryId'));
      const initialServiceId = Number(params.get('serviceId'));
      const ticketIdParam = params.get('ticketId');

      if (ticketIdParam) {
        this.currentTicketId = Number(ticketIdParam);
        this.isEditMode = true;
        this.loadTicketDetails(this.currentTicketId);
      } else {
        this.currentTicketId = null;
        this.isEditMode = false;
        // Inizializza il form con valori di default o da query params
        this.initForm(undefined, initialCategoryId, initialServiceId);
      }
    });

    // Sottoscrizione per l'auto-salvataggio delle bozze
    this.autoSaveSubject.pipe(
      debounceTime(2000), // Attende 2 secondi di inattività
      distinctUntilChanged(), // Emette solo se il valore del form è cambiato
      takeUntil(this.destroy$)
    ).subscribe(() => {
      // Salva la bozza solo se il form è stato modificato
      // e il ticket è valido per essere salvato come bozza (es. ha almeno un titolo o descrizione)
      if (this.ticketForm.dirty && (this.ticketForm.get('title')?.value || this.ticketForm.get('description')?.value)) {
        this.saveDraftToDb(false); // Salva in modo silente
      }
    });

    // Sottoscriviti ai cambiamenti del form per triggerare l'auto-salvataggio
    this.ticketForm.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.autoSaveSubject.next();
    });

    // Reagisci al cambio di categoria per caricare i servizi correlati
    this.ticketForm.get('categoryId')?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((categoryId: number) => {
      if (categoryId) {
        this.loadServicesByCategory(categoryId);
      } else {
        this.services = []; // Azzera i servizi se la categoria è deselezionata
        this.ticketForm.get('supportServiceId')?.patchValue(null); // Resetta il servizio
      }
    });
  }

  ngOnDestroy(): void {
    if (this.ref) {
      this.ref.close(); // Chiudi la modale se è aperta
    }
    this.destroy$.next();
    this.destroy$.complete(); // Completa il Subject per unsubscribere tutti gli Observable
  }

  /**
   * Carica i dati iniziali (categorie e helper) in parallelo all'avvio del componente.
   */
  private loadInitialData(): void {
    // Carica tutte le categorie
    const categories$ = this.categoryService.getAllCategories().pipe(
      catchError(err => {
        console.error("Errore nel caricamento delle categorie:", err);
        this.messageService.add({ severity: 'error', summary: 'Errore', detail: 'Impossibile caricare le categorie.' });
        return of([]); // Ritorna un array vuoto in caso di errore per non bloccare l'applicazione
      })
    );

    // Carica gli helper solo se l'utente NON è un USER
    const helpers$ = this.isUserRole
      ? of([]) // Se è un USER, non c'è bisogno di caricare gli helper
      : this.userService.getHelpers().pipe(
          map(helpers => {
            // Aggiungi l'utente corrente alla lista helper se è un ruolo gestore e non è già presente
            const currentUserId = this.auth.getUserId();
            const currentUserRole = this.auth.keycloak.getUserRoles().find(role => ['ADMIN', 'HELPER_JUNIOR', 'HELPER_SENIOR', 'PM'].includes(role));
            if (currentUserRole && !helpers.some(h => h.id === currentUserId)) {
              // Crea un DTO parziale per l'utente corrente da aggiungere alla lista degli helper
              const currentUserHelper = {
                id: currentUserId,
                fullName: this.auth.getUserFullName(),
                email: this.auth.getUserEmail(),
              } as UserDto; // Effettua il cast per compatibilità
              return [currentUserHelper, ...helpers];
            }
            return helpers;
          }),
          catchError(err => {
            console.error("Errore nel caricamento degli helper:", err);
            this.messageService.add({ severity: 'error', summary: 'Errore', detail: 'Impossibile caricare gli helper.' });
            return of([]); // Ritorna un array vuoto in caso di errore
          })
        );

    // Usa forkJoin per attendere il completamento di entrambi gli Observable
    forkJoin([categories$, helpers$]).pipe(takeUntil(this.destroy$)).subscribe({
      next: ([categories, helpers]) => {
        this.categories = categories;
        this.helpers = helpers;
      }
    });
  }

  /**
   * Carica i servizi di supporto basati sull'ID della categoria selezionata.
   * @param categoryId L'ID della categoria per cui caricare i servizi.
   */
  loadServicesByCategory(categoryId: number): void {
    this.supportServicesService.getByCategory({ categoryId }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (services) => {
        this.services = services;
      },
      error: (err) => {
        console.error("Errore nel caricamento dei servizi:", err);
        this.messageService.add({ severity: 'error', summary: 'Errore', detail: 'Impossibile caricare i servizi per la categoria selezionata.' });
        this.services = []; // Azzera la lista dei servizi in caso di errore
      }
    });
  }

  /**
   * Carica i dettagli di un ticket esistente per la modifica.
   * @param ticketId L'ID del ticket da caricare.
   */
  loadTicketDetails(ticketId: number): void {
    this.ticketService.getTicketDetails({ ticketId }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (ticketResponse: TicketResponseDto) => {
        this.isEditMode = true; // Indica che siamo in modalità modifica
        this.currentTicketId = ticketResponse.id || null;
        this.initForm(ticketResponse); // Popola il form con i dati del ticket caricato (inclusi phone/fiscal code)
        this.messageService.add({ severity: 'info', summary: 'Bozza/Ticket caricato', detail: `Ticket ID ${ticketId} recuperato.` });
      },
      error: (err) => {
        console.error('Errore nel caricamento del ticket:', err);
        const errorMessage = err.error?.message || 'Impossibile caricare il ticket o la bozza.';
        this.messageService.add({ severity: 'error', summary: 'Errore', detail: errorMessage });
        // Se il caricamento fallisce (es. ID non valido o non autorizzato), resetta a nuovo ticket
        this.startNewTicket(true); // Forza un nuovo ticket senza messaggio di avviso
      }
    });
  }

  /**
   * Inizializza il form reattivo con i valori di default o quelli di un ticket esistente.
   * @param ticketData Dati di un ticket esistente per pre-popolare il form.
   * @param initialCategoryId ID della categoria pre-selezionata (da query params).
   * @param initialServiceId ID del servizio pre-selezionato (da query params).
   */
  initForm(ticketData?: TicketResponseDto, initialCategoryId?: number, initialServiceId?: number) {
    const userEmail = this.auth.getUserEmail(); // L'email è l'unica informazione garantita da Keycloak

    this.ticketForm = this.fb.group({
      title: [ticketData?.title || '', Validators.required],
      description: [ticketData?.description || '', [Validators.required, Validators.minLength(5)]],
      // L'email è disabilitata per i USER (è sempre la loro), modificabile per altri ruoli
      email: [{
        value: this.isUserRole ? userEmail : (ticketData?.userEmail || ''),
        disabled: this.isUserRole
      }, [Validators.required, Validators.email]],
      // Telefono e codice fiscale non provengono da Keycloak,
      // vengono presi dal ticketData se si carica una bozza/ticket, altrimenti sono vuoti.
      phoneNumber: [
        ticketData?.userPhoneNumber || '',
        [Validators.required, Validators.pattern(/^\+?\d{7,15}$/)] // Regex per numero di telefono internazionale (+? consente il + opzionale)
      ],
      fiscalCode: [
        ticketData?.userFiscalCode || '',
        [Validators.required, Validators.pattern(/^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$/i)] // Regex specifica per codice fiscale italiano
      ],
      priority: [ticketData?.priority || 'MEDIUM', Validators.required],
      // Categoria e Servizio sono required
      categoryId: [ticketData?.categoryId || initialCategoryId || null, Validators.required],
      supportServiceId: [ticketData?.supportServiceId || initialServiceId || null, Validators.required],
      // assignedToId è richiesto solo se l'utente NON è un USER
      assignedToId: [ticketData?.assignedToId || null, this.isUserRole ? [] : Validators.required]
    });

    // Se si sta caricando un ticket esistente con una categoria, carica i servizi corrispondenti
    // Oppure se è stato passato un initialCategoryId via query params
    if (ticketData?.categoryId) {
        this.loadServicesByCategory(ticketData.categoryId);
    } else if (initialCategoryId) {
        this.loadServicesByCategory(initialCategoryId);
    }

    this.ticketForm.markAsPristine(); // Resetta lo stato di 'dirty' del form
    this.ticketForm.markAsUntouched(); // Resetta lo stato di 'touched' del form
  }

  /**
   * Salva il form come bozza nel database.
   * @param showSuccessMessage Indica se mostrare un messaggio di successo.
   */
  saveDraftToDb(showSuccessMessage: boolean = false): void {
    // Non salvare se il form è pulito (e non stiamo aggiornando una bozza esistente)
    // o se non ha almeno un titolo o una descrizione
    if (this.ticketForm.pristine && !this.currentTicketId && !(this.ticketForm.get('title')?.value || this.ticketForm.get('description')?.value)) {
        return;
    }

    // Usiamo getRawValue() per includere i campi disabilitati (es. email per USER)
    const payload: TicketRequestDto = {
      ...this.ticketForm.getRawValue(),
      status: 'DRAFT' // Forza lo stato a DRAFT per le bozze
    };

    // Utilizziamo SEMPRE createOrUpdateTicket per la creazione/aggiornamento di un ticket/bozza
    const apiCall = this.ticketService.createOrUpdateTicket({
      ticketId: this.currentTicketId !== null ? this.currentTicketId : undefined,
      body: payload
    });

    apiCall.pipe(takeUntil(this.destroy$)).subscribe({
      next: (res: TicketResponseDto) => {
        // Se è una nuova bozza, aggiorna l'ID e la modalità
        if (!this.currentTicketId) {
          this.currentTicketId = res.id || null;
          this.isEditMode = true;
          // Aggiorna l'URL con il ticketId della bozza salvata
          this.router.navigate([], {
              relativeTo: this.route,
              queryParams: { ticketId: this.currentTicketId },
              queryParamsHandling: 'merge'
          });
        }
        if (showSuccessMessage) {
          this.messageService.add({ severity: 'success', summary: 'Bozza Salvata', detail: 'Bozza aggiornata con successo.' });
        }
        this.ticketForm.markAsPristine(); // Resetta lo stato dirty del form dopo il salvataggio
      },
      error: (err) => {
        console.error('Errore salvataggio/aggiornamento bozza:', err);
        const errorMessage = err.error?.message || 'Errore durante il salvataggio della bozza.';
        this.messageService.add({ severity: 'error', summary: 'Errore', detail: errorMessage });
      }
    });
  }

  /**
   * Invia il ticket, forzandone lo stato a OPEN.
   * Effettua le validazioni del form prima dell'invio.
   */
  submitTicket(): void {
    this.ticketForm.markAllAsTouched(); // Marca tutti i controlli come "toccati" per mostrare gli errori di validazione
    if (this.ticketForm.invalid) {
      this.messageService.add({ severity: 'warn', summary: 'Attenzione', detail: 'Compila tutti i campi obbligatori per creare il ticket.' });
      return;
    }

    const payload: TicketRequestDto = {
      ...this.ticketForm.getRawValue(), // getRawValue() per tutti i campi, inclusi quelli disabilitati
      status: 'OPEN' // Forza lo stato a OPEN per un ticket definitivo
    };

    // Utilizziamo SEMPRE createOrUpdateTicket per la creazione/finalizzazione di un ticket
    const apiCall = this.ticketService.createOrUpdateTicket({
      ticketId: this.currentTicketId !== null ? this.currentTicketId : undefined, // Passa l'ID solo se stai finalizzando una bozza
      body: payload
    });

    apiCall.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Ticket creato!', detail: 'Ticket creato con successo!' });
        this.currentTicketId = null; // Resetta l'ID del ticket corrente
        this.isEditMode = false; // Esci dalla modalità modifica
        this.router.navigate(['/my-tickets']); // Reindirizza l'utente alla lista dei suoi ticket
      },
      error: (err) => {
        console.error('Errore creazione/aggiornamento ticket:', err);
        const errorMessage = err.error?.message || 'Errore durante la creazione del ticket.';
        this.messageService.add({ severity: 'error', summary: 'Errore', detail: errorMessage });
      }
    });
  }

  /**
   * Resetta il form e inizia la creazione di un nuovo ticket pulito.
   * @param silent Se true, non mostra il messaggio di "Nuovo Ticket".
   */
  startNewTicket(silent: boolean = false): void {
    this.currentTicketId = null;
    this.isEditMode = false;
    this.initForm(); // Re-inizializza il form con valori puliti
    if (!silent) {
        this.messageService.add({ severity: 'info', summary: 'Nuovo Ticket', detail: 'Iniziata la creazione di un nuovo ticket.' });
    }
    // Rimuovi il ticketId e gli ID di categoria/servizio dai query params per pulire l'URL
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { ticketId: null, categoryId: null, serviceId: null }, // Imposta a null per rimuoverli
      queryParamsHandling: 'merge'
    });
  }

  /**
   * Pulisce il form. Se è una bozza esistente, chiede conferma per eliminarla.
   */
  clearForm(): void {
    if (this.currentTicketId) {
      this.confirmationService.confirm({
        message: 'Sei sicuro di voler eliminare questa bozza? L\'operazione non è reversibile.',
        header: 'Conferma Eliminazione Bozza',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Sì',
        rejectLabel: 'No',
        accept: () => {
          this.ticketService.deleteTicket({ ticketId: this.currentTicketId! }).pipe(takeUntil(this.destroy$)).subscribe({
            next: () => {
              this.messageService.add({ severity: 'info', summary: 'Bozza eliminata', detail: 'Bozza eliminata dal sistema.' });
              this.startNewTicket(true); // Avvia un nuovo ticket in modo silente dopo l'eliminazione
            },
            error: (err) => {
              console.error('Errore eliminazione bozza:', err);
              const errorMessage = err.error?.message || 'Impossibile eliminare la bozza.';
              this.messageService.add({ severity: 'error', summary: 'Errore', detail: errorMessage });
            }
          });
        },
        reject: () => {
          // L'utente ha annullato l'eliminazione
          this.messageService.add({ severity: 'info', summary: 'Annullato', detail: 'Eliminazione della bozza annullata.' });
        }
      });
    } else {
        // Se non c'è un ticketId (nuovo form), semplicemente resetta il form
        this.initForm(); // Re-inizializza per ripristinare i valori predefiniti e le validazioni
        this.messageService.add({ severity: 'info', summary: 'Form pulito', detail: 'Tutti i campi del form sono stati resettati.' });
    }
  }

  /**
   * Apre una modale per consentire all'utente di selezionare una bozza esistente.
   */
  openDraftsModal(): void {
    this.ref = this.dialogService.open(TicketListComponent, {
      header: `Le mie bozze`,
      width: '90%', // Ampiezza della modale
      height: '90%', // Altezza della modale
      contentStyle: { "max-height": "500px", "overflow": "auto" }, // Stile del contenuto della modale
      baseZIndex: 10000, // Z-index per assicurare che sia sopra altri elementi
      data: {
        filterStatus: 'DRAFT',   // Filtra la lista per mostrare solo le bozze
        showEditButton: true,    // Indica alla lista che potrebbe mostrare un pulsante "modifica"
        isModalSelection: true   // Indica alla lista che è in modalità selezione per il componente padre
      }
    });

    this.ref.onClose.pipe(takeUntil(this.destroy$)).subscribe((result) => {
      if (result && typeof result === 'number') { // Se l'utente ha selezionato un ID ticket (il 'result' è l'ID)
        this.messageService.add({ severity: 'info', summary: 'Bozza selezionata!', detail: `Caricamento bozza ID: ${result}` });
        this.currentTicketId = result;
        this.isEditMode = true;
        this.loadTicketDetails(result); // Carica la bozza selezionata
        // Aggiorna l'URL per riflettere il ticketId caricato
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { ticketId: result },
          queryParamsHandling: 'merge'
        });
      } else if (result !== undefined) { // L'utente ha chiuso la modale senza selezionare (result è null o false)
          this.messageService.add({ severity: 'info', summary: 'Bozza non selezionata', detail: 'Nessuna bozza è stata caricata.' });
      }
    });
  }
}
