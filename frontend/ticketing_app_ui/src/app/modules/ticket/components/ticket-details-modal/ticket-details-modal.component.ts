/* eslint-disable @typescript-eslint/no-unused-vars */
import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { DynamicDialogRef, DynamicDialogConfig } from 'primeng/dynamicdialog';
import { TicketResponseDto } from '../../../../services/models';
import { AuthService } from '../../service/auth.service';
import { Router } from '@angular/router';
import { TicketManagementService } from '../../../../services/services';
import { MessageService } from 'primeng/api';

import { ToastModule } from 'primeng/toast';
import { CommonModule, DatePipe } from '@angular/common';
import { ButtonModule } from 'primeng/button'; // Per pButton
import { DropdownModule } from 'primeng/dropdown'; // Per pDropdown
import { TagModule } from 'primeng/tag'; // Per pTag 
import { FormsModule } from '@angular/forms'; // Cruciale per [(ngModel)]
import { TicketStatus } from '../../../../shared/enums/TicketStatus';
import { UserRole } from '../../../../shared/enums/UserRole';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-ticket-details-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule, 
    ToastModule,
    ButtonModule, 
    DropdownModule, 
    TagModule, 
    DatePipe 
  ],
  templateUrl: './ticket-details-modal.component.html',
  styleUrl: './ticket-details-modal.component.scss',
  providers: [MessageService]
})
export class TicketDetailsModalComponent implements OnInit {
  ticket!: TicketResponseDto;

  isUserRole = false;
  isAdminRole = false;
  isHelperOrPmRole = false;
  isAdminOrPmRole = false;

  isReadOnlyMode = false; 

  public TicketStatus = TicketStatus;
  public UserRole = UserRole;

  constructor(
    public ref: DynamicDialogRef,
    public config: DynamicDialogConfig,
    private authService: AuthService,
    private router: Router,
    private ticketService: TicketManagementService,
    private messageService: MessageService,
  ) {
  }

  ngOnInit(): void {
    if (this.config.data && this.config.data['ticket']) {
      this.ticket = this.config.data['ticket'];
      this.isReadOnlyMode = true; 
    } else {
      console.error("TicketDetailsModalComponent: Nessun dato ticket trovato nella configurazione della modale.");
      this.messageService.add({ severity: 'error', summary: 'Errore', detail: 'Dati ticket non disponibili.' });
      this.closeModal();
      return;
    }

    this.authService.currentUserRoles$.subscribe(roles => {
      this.isUserRole = this.authService.isUser();
      this.isAdminRole = this.authService.isAdmin();
      this.isHelperOrPmRole = this.authService.isHelperOrPm();
      this.isAdminOrPmRole = this.authService.isAdminOrPm();
    });
  }

  /**
   * Determina se un campo specifico del form deve essere disabilitato.
   * restituisce sempre true, rendendo tutti i campi di sola lettura.
   */
  isFieldReadOnly(fieldName: string): boolean {
    return true; // Tutti i campi del form sono sempre di sola lettura in questa modale
  }

  /**
   * Restituisce la severità del badge in base allo stato del ticket.
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
   * Il requisito principale è che i ticket SOLVED non possono essere eliminati da questa modale.
   * @returns true se il ticket può essere eliminato, false altrimenti.
   */
  canDeleteTicket(): boolean {
    if (!this.ticket || !this.ticket.status) {
        return false;
    }

    const currentUserId = this.authService.getUserId();
    const currentUserEmail = this.authService.getUserEmail();
    const isOwner = this.ticket.userId === currentUserId;
    const isDraft = this.ticket.status === TicketStatus.DRAFT;
    const isAssignedToMe = this.ticket.assignedToId === currentUserId;
    const isAssociatedByEmail = this.ticket.userEmail == currentUserEmail;
    const isSolved = this.ticket.status === TicketStatus.SOLVED;

    // Se il ticket è SOLVED, può essere eliminato da questa modale.
    if (isSolved) {
      return true;
    }

    // Altre regole per i ticket NON SOLVED:
    // Admin può eliminare qualsiasi ticket NON SOLVED
    if (this.isAdminRole) {
      return true;
    }
    // L'owner può eliminare le proprie bozze (che per definizione non sono SOLVED)
    if (isDraft && isOwner) {
      return true;
    }
    // Helper/PM/Admin possono eliminare ticket assegnati a loro e NON SOLVED
    if ((this.isHelperOrPmRole || this.isAdminOrPmRole) && isAssignedToMe) { 
      return true;
    }

    if (isAssociatedByEmail) {
      return true;
   }
    
    return false; // Default: non eliminabile
  }

  /**
   * Metodo per eliminare il ticket.
   */
  deleteTicket(): void {
    if (confirm('Sei sicuro di voler eliminare questo ticket? Questa azione è irreversibile.')) {
      if (this.ticket && this.ticket.id) {
        this.ticketService.deleteTicket({ ticketId: this.ticket.id }).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Successo', detail: 'Ticket eliminato con successo!' });
            this.ref.close('Deleted');
          },
          error: (err: HttpErrorResponse) => {
            console.error('Errore durante l\'eliminazione del ticket:', err);
            this.messageService.add({ severity: 'error', summary: 'Errore', detail: 'Errore durante l\'eliminazione del ticket: ' + (err.error?.message || err.message) });
          }
        });
      }
    }
  }

  /**
   * Metodo per aprire la modale di creazione di un nuovo ticket.
   * Questo metodo chiude la modale corrente e naviga alla pagina delle categorie.
   */
  createNewTicket(): void {
    this.ref.close('OpenNewTicket');
    this.router.navigate(['/categories']);
  }

  /**
   * Metodo per chiudere la modale.
   */
  closeModal(): void {
    this.ref.close('Close click');
  }
}
