 /* eslint-disable @typescript-eslint/no-unused-vars */
import { Component, Inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MessageService } from 'primeng/api';
import { SupportServiceResponse } from '../../../../services/models';
import { KeycloakService } from '../../../../utils/keycloak/keycloak.service';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { InputTextModule } from 'primeng/inputtext';
import { DividerModule } from 'primeng/divider';
import { RippleModule } from 'primeng/ripple';
import { DialogModule } from 'primeng/dialog'; //  DialogModule per la modale
import { SupportServicesService } from '../../../../services/services';

@Component({
  selector: 'app-service-list',
  templateUrl: './service-list.component.html',
  styleUrls: ['./service-list.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    FormsModule,
    InputTextModule,
    InputTextareaModule,
    CheckboxModule,
    ButtonModule,
    MessageModule,
    CardModule,
    DividerModule,
    RippleModule,
    DialogModule, 
  ],
  providers: [MessageService],
})
export class ServiceListComponent implements OnInit {
  categoryId!: number;
  services: SupportServiceResponse[] = [];
  roles: string[] = [];

  displayCreateDialog = false;
  displayEditDialog = false;

  newServiceName = '';
  newServiceDesc = '';

  selectedService: SupportServiceResponse | null = null;

  constructor(
    private route: ActivatedRoute,
    private serviceApi: SupportServicesService,
    private keycloak: KeycloakService,
    private messageService: MessageService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      const catId = params.get('categoryId');
      this.categoryId = Number(catId);

      if (isNaN(this.categoryId) || this.categoryId <= 0) {
        this.messageService.add({
          severity: 'error',
          summary: 'Errore di navigazione',
          detail: 'ID Categoria non valido. Torna alla lista categorie.'
        });
        this.router.navigate(['/categories']);
        return;
      }

      this.roles = this.keycloak.getUserRoles();
      this.loadServices();
    });
  }

  hasRole(role: string): boolean {
    return this.roles.includes(role);
  }

  loadServices(): void {
    this.serviceApi.getByCategory({ categoryId: this.categoryId }).subscribe({
      next: (data) => this.services = data,
      error: () => this.messageService.add({
        severity: 'error',
        summary: 'Errore',
        detail: 'Caricamento servizi fallito'
      })
    });
  }

  goCreateTicket(service: SupportServiceResponse): void {
    console.log("Tentativo di navigazione per creare ticket con serviceId:", service.id, " e categoryId:", this.categoryId);
    this.router.navigate(
      ['/new-ticket'],
      {
        queryParams: {
          categoryId: this.categoryId,
          serviceId: service.id
        }
      }
    );
  }

  openCreateDialog(): void {
    this.newServiceName = '';
    this.newServiceDesc = '';
    this.displayCreateDialog = true;
  }

  openEditDialog(service: SupportServiceResponse): void {
    this.selectedService = service;
    this.newServiceName = service.title?? "";
    this.newServiceDesc = service.description ?? '';
    this.displayEditDialog = true;
  }

  closeDialogs(): void {
    this.displayCreateDialog = false;
    this.displayEditDialog = false;
    this.selectedService = null;
  }

  createService(): void {
    if (!this.newServiceName.trim()) {
      this.messageService.add({ severity: 'warn', summary: 'Attenzione', detail: 'Nome obbligatorio' });
      return;
    }

    this.serviceApi.create({
      body: {
        title: this.newServiceName,
        description: this.newServiceDesc,
        categoryId: this.categoryId
      }
    }).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Creato', detail: 'Servizio creato' });
        this.loadServices();
        this.closeDialogs();
      },
      error: () => this.messageService.add({ severity: 'error', summary: 'Errore', detail: 'Creazione fallita' })
    });
  }

  updateService(): void {
    if (!this.selectedService) return;

    this.serviceApi.update({
      id: this.selectedService.id!,
      body: {
        title: this.newServiceName,
        description: this.newServiceDesc
      }
    }).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Aggiornato', detail: 'Servizio aggiornato' });
        this.loadServices();
        this.closeDialogs();
      },
      error: () => this.messageService.add({ severity: 'error', summary: 'Errore', detail: 'Aggiornamento fallito' })
    });
  }
}