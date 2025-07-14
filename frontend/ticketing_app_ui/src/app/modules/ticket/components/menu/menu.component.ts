/* eslint-disable @typescript-eslint/no-inferrable-types */
import { KeycloakService } from '../../../../utils/keycloak/keycloak.service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MenubarModule } from 'primeng/menubar';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { SidebarModule } from 'primeng/sidebar';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { AvatarModule } from 'primeng/avatar';
import { ToolbarModule } from 'primeng/toolbar'; // Per la p-toolbar
import { InputTextModule } from 'primeng/inputtext'; // Per pInputText
import { StyleClassModule } from 'primeng/styleclass';
import { ToastModule } from "primeng/toast";
import { SupportServicesService } from '../../../../services/services';
import { MessageService } from 'primeng/api';
import { SupportServiceResponse } from '../../../../services/models';
import { catchError, of, Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MenubarModule,
    SidebarModule,
    ButtonModule,
    RippleModule,
    AvatarModule,
    ToolbarModule,
    InputTextModule,
    StyleClassModule,
    ToastModule
],
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.scss',
  providers: [MessageService]
})
export class MenuComponent implements OnInit, OnDestroy { 
  username: string;
  sidebarVisible: boolean = false;
  roles: string[] = [];
  searchTerm: string = ''; 
  currentYear: number = new Date().getFullYear(); 

  private allServices: SupportServiceResponse[] = []; 
  private destroy$ = new Subject<void>(); 

  constructor(
    private keycloakService: KeycloakService,
    private router: Router,
    private supportServiceService: SupportServicesService, 
    private messageService: MessageService 
  ) {
    this.username = this.keycloakService.fullName || 'User';
  }

  ngOnInit() {
    this.roles = this.keycloakService.getUserRoles();
    this.loadAllServices(); // Carica tutti i servizi all'inizializzazione
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  openSidebar(): void {
    this.sidebarVisible = true;
  }

  closeSidebar(): void {
    this.sidebarVisible = false;
  }

  manageAccount() {
    this.keycloakService.accountManagement();
  }

  logout() {
    this.keycloakService.logout();
  }

  hasRole(role: string): boolean {
    return this.roles.includes(role);
  }

  /**
   * Carica tutti i servizi disponibili dal backend.
   */
  private loadAllServices(): void {
    this.supportServiceService.getAll().pipe(
      takeUntil(this.destroy$),
      catchError(err => {
        console.error('Errore nel caricamento di tutti i servizi:', err);
        this.messageService.add({ severity: 'error', summary: 'Errore', detail: 'Impossibile caricare i servizi per la ricerca.' });
        return of([]); // Restituisce un Observable vuoto in caso di errore
      })
    ).subscribe(services => {
      this.allServices = services;
    });
  }

  /**
   * Gestisce la ricerca di un servizio.
   * Reindirizza solo se un servizio corrispondente viene trovato.
   */
  searchService(): void {
    const trimmedSearchTerm = this.searchTerm.trim();

    if (!trimmedSearchTerm) {
      this.messageService.add({ severity: 'info', summary: 'Ricerca Vuota', detail: 'Inserisci un termine di ricerca per il servizio.' });
      return;
    }

    // Filtra i servizi in base al termine di ricerca (case-insensitive, parziale)
    const matchingServices = this.allServices.filter(service => 
      service.title?.toLowerCase().includes(trimmedSearchTerm.toLowerCase())
    );

    if (matchingServices.length > 0) {
      // Se ci sono servizi corrispondenti, reindirizza alla pagina service-list
      // con il termine di ricerca come query parameter
      this.router.navigate(['/services'], { queryParams: { search: trimmedSearchTerm } })
        .then(() => {
          this.searchTerm = ''; // Pulisci il campo di ricerca dopo la navigazione
        })
        .catch(err => {
          console.error("Errore durante la navigazione per la ricerca:", err);
          this.messageService.add({ severity: 'error', summary: 'Errore', detail: 'Errore durante il reindirizzamento alla pagina dei servizi.' });
        });
    } else {
      // Se nessun servizio corrisponde, mostra un avviso e NON reindirizzare
      this.messageService.add({ severity: 'warn', summary: 'Nessun Servizio Trovato', detail: 'Non esiste alcun servizio con il nome specificato.' });
    }
  }
}