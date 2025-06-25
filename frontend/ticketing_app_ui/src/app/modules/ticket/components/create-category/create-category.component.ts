import { Component } from '@angular/core';
//import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms'; // Usa ReactiveFormsModule per i FormGroup
import { MessageService } from 'primeng/api';
//import { Router } from '@angular/router';
//import { CategoryService } from '../../../../services/services';
//import { KeycloakService } from '../../../../utils/keycloak/keycloak.service';
import { CommonModule } from '@angular/common';

import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { CheckboxModule } from 'primeng/checkbox';
import { ButtonModule } from 'primeng/button'; 
import { MessagesModule } from 'primeng/messages'; 
import { CardModule } from 'primeng/card'; 

@Component({
  selector: 'app-create-category',
  templateUrl: './create-category.component.html',
  styleUrl: './create-category.component.scss',
  standalone:true,
  imports: [
    CommonModule,
    //ReactiveFormsModule,
    InputTextModule,
    InputTextareaModule,
    CheckboxModule,
    ButtonModule,
    MessagesModule,
    CardModule 
  ],
  providers: [MessageService] // MessageService va nei providers perché è un servizio
})
export class CreateCategoryComponent //implements OnInit 
{
/*   categoryForm!: FormGroup;
  roles: string[] = [];

  constructor(
    private fb: FormBuilder,
    private categoryService: CategoryService,
    private keycloakService: KeycloakService,
    private messageService: MessageService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.roles = this.keycloakService.getUserRoles();
    if (!this.hasRole('ADMIN')) {
      this.router.navigate(['/']); // blocca accesso se non admin
    }

    this.categoryForm = this.fb.group({
      name: ['', Validators.required],
      description: [''],
      active: [true]
    });
  }

  hasRole(role: string): boolean {
    return this.roles.includes(role);
  }

  createCategory() {
    if (this.categoryForm.invalid) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Attenzione',
        detail: 'Compila tutti i campi richiesti'
      });
      return;
    }

    const categoryData = this.categoryForm.value;
    this.categoryService.create2({ body: categoryData }).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Categoria creata',
          detail: `Categoria "${categoryData.name}" aggiunta con successo`
        });
        this.router.navigate(['/categories']);
      },
      error: (err) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Errore',
          detail: 'Errore nella creazione categoria'
        });
        console.error('Errore nella creazione categoria:', err);
      }
    });
  } */
}