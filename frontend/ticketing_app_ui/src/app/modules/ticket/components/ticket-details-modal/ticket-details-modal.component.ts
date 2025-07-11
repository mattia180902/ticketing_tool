import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { DynamicDialogRef, DynamicDialogConfig } from 'primeng/dynamicdialog';
import { TicketResponseDto } from '../../../../services/models';
import { AuthService } from '../../service/auth.service';
import { Router } from '@angular/router';
import { TicketManagementService } from '../../../../services/services';
import { MessageService } from 'primeng/api';

// Importazioni dei moduli PrimeNG necessari per il template
import { ToastModule } from 'primeng/toast';
import { CommonModule, DatePipe } from '@angular/common';
// import { InputTextModule } from 'primeng/inputtext'; // Rimosso
// import { InputTextareaModule }m 'primeng/inputtextarea'; // Rimosso
import { ButtonModule } from 'primeng/button'; // Per pButton
import { DropdownModule } from 'primeng/dropdown'; // Per pDropdown
import { TagModule } from 'primeng/tag'; // Per pTag (se lo usi)
import { FormsModule } from '@angular/forms'; // Cruciale per [(ngModel)]

import { TicketStatus } from '../../../../shared/enums/TicketStatus';
import { UserRole } from '../../../../shared/enums/UserRole';

@Component({
  selector: 'app-ticket-details-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule, // Assicurati che FormsModule sia qui per [(ngModel)]
    ToastModule,
    // InputTextModule, // Rimosso
    // InputTextareaModule, // Rimosso
    ButtonModule, // Per pButton
    DropdownModule, // Per pDropdown
    TagModule, // Per pTag
    DatePipe // Per la pipe date
  ],
  templateUrl: './ticket-details-modal.component.html',
  styleUrl: './ticket-details-modal.component.scss',
  providers: [MessageService]
})
export class TicketDetailsModalComponent implements OnInit {
  ticket!: TicketResponseDto;

  @Output() ticketDeleted: EventEmitter<void> = new EventEmitter<void>();
  @Output() openNewTicketModal: EventEmitter<void> = new EventEmitter<void>();

  isUserRole = false;
  isAdminOrPm = false;
  isHelper = false;

  public TicketStatus = TicketStatus;
  public UserRole = UserRole;

  selectedStatus: TicketStatus | undefined;
  statusOptions: { label: string, value: TicketStatus }[];

  constructor(
    public ref: DynamicDialogRef,
    public config: DynamicDialogConfig,
    private authService: AuthService,
    private router: Router,
    private ticketService: TicketManagementService,
    private messageService: MessageService
  ) {
    this.statusOptions = [
      { label: 'Aperto', value: TicketStatus.OPEN },
      { label: 'In Risposta', value: TicketStatus.ANSWERED },
      { label: 'Risolto', value: TicketStatus.SOLVED },
    ];
  }

  ngOnInit(): void {
    if (this.config.data && this.config.data['ticket']) {
      this.ticket = this.config.data['ticket'];
    } else {
      console.error("TicketDetailsModalComponent: Nessun dato ticket trovato nella configurazione della modale.");
      this.messageService.add({ severity: 'error', summary: 'Errore', detail: 'Dati ticket non disponibili.' });
      this.closeModal();
      return;
    }

    this.authService.currentUserRoles$.subscribe(roles => {
      this.isUserRole = roles.includes(UserRole.USER);
      this.isAdminOrPm = roles.includes(UserRole.ADMIN) || roles.includes(UserRole.PM);
      this.isHelper = roles.includes(UserRole.HELPER_JUNIOR) || roles.includes(UserRole.HELPER_SENIOR);
    });

    if (this.ticket && this.ticket.status) {
      this.selectedStatus = this.ticket.status as TicketStatus;
    }
  }

  /**
   * Determina se un campo specifico deve essere disabilitato.
   * @param fieldName Il nome del campo da controllare (es. 'title', 'status').
   * @returns true se il campo deve essere disabilitato, false altrimenti.
   */
  isFieldReadOnly(fieldName: string): boolean {
    if (!this.ticket) return true;

    // Tutti i campi sono sempre disabilitati per l'utente con ruolo 'USER'
    if (this.isUserRole) {
      return true;
    }

    // Se il ticket è RISOLTO, il campo 'status' è sempre disabilitato per tutti
    if (fieldName === 'status' && this.ticket.status === TicketStatus.SOLVED) {
      return true;
    }

    // Per ADMIN, PM, Helper:
    // Solo il campo 'status' può essere modificabile sotto certe condizioni.
    // Tutti gli altri campi sono disabilitati.
    if (fieldName !== 'status') {
      return true;
    }

    // Logica specifica per il campo 'status' quando non è SOLVED
    if (fieldName === 'status') {
      if (this.isAdminOrPm) {
        return false;
      }
      if (this.isHelper) {
        return this.ticket.assignedToId !== this.authService.getUserId();
      }
    }
    
    return true;
  }

  /**
   * Restituisce la severità del badge in base allo stato del ticket.
   * @param status Lo stato del ticket.
   * @returns La severità del badge.
   */
  statusColor(status: TicketStatus | undefined): 'success' | 'info' | 'warning' | 'danger' | 'help' | 'primary' | 'secondary' | 'contrast' {
    switch (status) {
      case TicketStatus.OPEN: return 'info';
      case TicketStatus.ANSWERED: return 'warning';
      case TicketStatus.SOLVED: return 'success';
      case TicketStatus.DRAFT: return 'contrast';
      default: return 'danger';
    }
  }

  /**
   * Determina se il pulsante "Elimina Ticket" deve essere visualizzato e abilitato.
   * @returns true se il ticket può essere eliminato, false altrimenti.
   */
  canDeleteTicket(): boolean {
    if (!this.ticket || !this.ticket.status || this.ticket.status === TicketStatus.SOLVED) {
      return false;
    }

    const currentUserId = this.authService.getUserId();
    const currentUserEmail = this.authService.getUserEmail();

    // Logica per il ruolo USER
    if (this.isUserRole) {
      const isOwner = this.ticket.userId === currentUserId;
      const isAssociatedByEmail = this.ticket.userEmail === currentUserEmail;
      return (isOwner || isAssociatedByEmail);
    }

    // Logica per i ruoli ADMIN/PM
    if (this.isAdminOrPm) {
      return true;
    }

    // Logica per i ruoli HELPER
    if (this.isHelper) {
      const isAssignedToMe = this.ticket.assignedToId === currentUserId;
      return isAssignedToMe;
    }

    return false;
  }

  /**
   * Metodo per eliminare il ticket.
   */
  deleteTicket(): void {
    if (this.canDeleteTicket()) {
      if (confirm('Sei sicuro di voler eliminare questo ticket? Questa azione è irreversibile.')) {
        if (this.ticket && this.ticket.id) {
          this.ticketService.deleteTicket({ ticketId: this.ticket.id }).subscribe({
            next: () => {
              this.messageService.add({ severity: 'success', summary: 'Successo', detail: 'Ticket eliminato con successo!' });
              this.ticketDeleted.emit();
              this.ref.close('Deleted');
            },
            error: (err) => {
              console.error('Errore durante l\'eliminazione del ticket:', err);
              this.messageService.add({ severity: 'error', summary: 'Errore', detail: 'Errore durante l\'eliminazione del ticket: ' + (err.error?.message || err.message) });
            }
          });
        }
      }
    } else {
      this.messageService.add({ severity: 'warn', summary: 'Non Autorizzato', detail: 'Non hai i permessi per eliminare questo ticket.' });
    }
  }

  /**
   * Metodo per aggiornare lo stato del ticket.
   */
  updateTicketStatus(): void {
    if (!this.ticket || !this.ticket.id || !this.selectedStatus) {
      this.messageService.add({ severity: 'error', summary: 'Errore', detail: 'Dati del ticket o stato non validi.' });
      return;
    }

    if (this.isFieldReadOnly('status')) {
      this.messageService.add({ severity: 'warn', summary: 'Non Autorizzato', detail: 'Non puoi modificare lo stato di questo ticket.' });
      return;
    }

    if (this.selectedStatus === this.ticket.status) {
      this.messageService.add({ severity: 'info', summary: 'Info', detail: 'Lo stato è già quello selezionato.' });
      return;
    }

    this.ticketService.updateTicketStatus({ ticketId: this.ticket.id, newStatus: this.selectedStatus }).subscribe({
      next: (updatedTicket) => {
        this.ticket = updatedTicket;
        this.messageService.add({ severity: 'success', summary: 'Successo', detail: 'Stato ticket aggiornato con successo!' });
        this.ref.close('StatusUpdated');
      },
      error: (err) => {
              console.error('Errore durante l\'aggiornamento dello stato:', err);
        this.messageService.add({ severity: 'error', summary: 'Errore', detail: 'Errore durante l\'aggiornamento dello stato: ' + (err.error?.message || err.message) });
      }
    });
  }

  /**
   * Metodo per aprire la modale di creazione di un nuovo ticket.
   * Questo metodo emette un evento al componente padre (dashboard)
   * che sarà responsabile di aprire la nuova modale.
   */
  createNewTicket(): void {
    this.ref.close('OpenNewTicket');
    this.openNewTicketModal.emit();
  }

  /**
   * Metodo per chiudere la modale.
   */
  closeModal(): void {
    this.ref.close('Close click');
  }
}
