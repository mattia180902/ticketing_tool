import { Component, OnInit, OnDestroy, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';

import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';

import { TicketStatus } from '../../../../shared/enums/TicketStatus';
import { TicketPriority } from '../../../../shared/enums/TicketPriority';

export interface TicketFilterParams {
  status: 'ALL' | TicketStatus;
  priority: 'ALL' | TicketPriority;
  search: string;
}

@Component({
  selector: 'app-ticket-filter',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    DropdownModule,
    InputTextModule,
    ButtonModule,
    CardModule 
  ],
  templateUrl: './ticket-filter.component.html',
  styleUrl: './ticket-filter.component.scss'
})
export class TicketFilterComponent implements OnInit, OnDestroy {

  // Input properties 
  @Input() initialStatusFilter: 'ALL' | TicketStatus = 'ALL';
  @Input() initialPriorityFilter: 'ALL' | TicketPriority = 'ALL';
  @Input() initialSearchTerm = ''; 
  @Input() disableStatusFilter = false; 

  // Output events
  @Output() filtersChanged = new EventEmitter<TicketFilterParams>();
  @Output() clearFiltersEvent = new EventEmitter<void>();

  // Filter models
  selectedStatusFilter: 'ALL' | TicketStatus = 'ALL';
  selectedPriorityFilter: 'ALL' | TicketPriority = 'ALL';
  searchTerm = ''; 
  searchFormControl = new FormControl<string>(''); 

  // Options for dropdowns
  statusOptions: { label: string; value: 'ALL' | TicketStatus }[] = [];
  priorityOptions: { label: string; value: 'ALL' | TicketPriority }[] = [];

  private destroy$ = new Subject<void>();

  constructor() {
    this.initializeFilterOptions();
  }

  ngOnInit(): void {
    // Applica i valori iniziali dagli input
    this.selectedStatusFilter = this.initialStatusFilter;
    this.selectedPriorityFilter = this.initialPriorityFilter;
    this.searchTerm = this.initialSearchTerm;
    this.searchFormControl.setValue(this.initialSearchTerm, { emitEvent: false }); // Imposta il valore senza innescare l'evento

    // Sottoscrizione al campo di ricerca con debounce
    this.searchFormControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe((value) => {
      this.searchTerm = value || '';
      this.emitFilters();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Inizializza le opzioni per i filtri di stato e priorità.
   */
  private initializeFilterOptions(): void {
    this.statusOptions = [
      { label: 'Tutti gli Stati', value: 'ALL' },
      ...Object.values(TicketStatus).map(status => ({ label: status.replace('_', ' '), value: status }))
    ];
    this.priorityOptions = [
      { label: 'Tutte le Priorità', value: 'ALL' },
      ...Object.values(TicketPriority).map(priority => ({ label: priority.replace('_', ' '), value: priority }))
    ];
  }

  /**
   * Emette l'evento filtersChanged con i parametri di filtro attuali.
   */
  emitFilters(): void {
    this.filtersChanged.emit({
      status: this.selectedStatusFilter,
      priority: this.selectedPriorityFilter,
      search: this.searchTerm
    });
  }

  /**
   * Gestisce il cambio di stato del filtro.
   */
  onStatusFilterChange(): void {
    this.emitFilters();
  }

  /**
   * Gestisce il cambio di priorità del filtro.
   */
  onPriorityFilterChange(): void {
    this.emitFilters();
  }

  /**
   * Gestisce la ricerca testuale (chiamata da searchFormControl.valueChanges).
   */
  onSearchInput(): void {
    // Questo metodo è qui per essere chiamato dall'input (input)="onSearchInput()"
    // e per attivare il debounce tramite searchFormControl.valueChanges.
    // L'emissione dei filtri avviene nella sottoscrizione di searchFormControl.valueChanges.
  }

  /**
   * Resetta tutti i filtri e notifica il componente padre.
   */
  clearFilters(): void {
    // Se il filtro di stato è disabilitato, mantiene il suo valore iniziale.
    // Altrimenti, lo resetta a 'ALL'.
    if (this.disableStatusFilter) {
      this.selectedStatusFilter = this.initialStatusFilter;
    } else {
      this.selectedStatusFilter = 'ALL';
    }
    this.selectedPriorityFilter = 'ALL';
    this.searchTerm = '';
    this.searchFormControl.setValue('', { emitEvent: false }); // Resetta FormControl senza innescare l'evento
    this.emitFilters(); // Emette i filtri resettati
    this.clearFiltersEvent.emit(); // Emette un evento separato per il reset completo
  }
}
