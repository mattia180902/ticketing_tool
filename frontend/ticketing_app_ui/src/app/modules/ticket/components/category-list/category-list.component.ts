import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { CategoryResponse } from '../../../../services/models';
import { CategoryService } from '../../../../services/services';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { SidebarModule } from 'primeng/sidebar';
import { Router } from '@angular/router';
import { KeycloakService } from '../../../../utils/keycloak/keycloak.service';
import { FormsModule } from '@angular/forms';
import { MessageModule } from 'primeng/message';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { InputTextModule } from 'primeng/inputtext';
import { DividerModule } from 'primeng/divider';
import { RippleModule } from 'primeng/ripple';

@Component({
  selector: 'app-category-list',
  standalone: true,
  imports: [
    CommonModule,
    CardModule,
    ButtonModule,
    ConfirmDialogModule,
    DialogModule,
    SidebarModule,
    FormsModule,
    MessageModule,
    InputTextModule,
    InputTextareaModule,
    CheckboxModule,
    DividerModule,
    RippleModule,
  ],
  templateUrl: './category-list.component.html',
  styleUrl: './category-list.component.scss',
  providers: [MessageService, ConfirmationService],
})
export class CategoryListComponent implements OnInit {
  categories: CategoryResponse[] = [];
  roles: string[] = [];
  displayCreateDialog = false;
  displayEditDialog = false;

  selectedCategory: CategoryResponse | null = null;

  newCategoryName = '';
  newCategoryDesc = '';

  constructor(
    private categoryService: CategoryService,
    private keycloak: KeycloakService,
    private router: Router,
    private msg: MessageService
  ) {}

  ngOnInit(): void {
    this.roles = this.keycloak.getUserRoles();
    this.loadCategories();
  }

  hasRole(role: string): boolean {
    return this.roles.includes(role);
  }

  loadCategories(): void {
    this.categoryService.getAllCategories().subscribe({
      next: (data) => (this.categories = data),
      error: (err) => console.error('Errore caricamento categorie', err),
    });
  }

  goToServices(categoryId: number): void {
    this.router.navigate(['/services'], { queryParams: { categoryId } });
  }

  openCreateDialog(): void {
    this.newCategoryName = '';
    this.newCategoryDesc = '';
    this.displayCreateDialog = true;
  }

  openEditDialog(category: CategoryResponse): void {
    this.selectedCategory = category;
    this.newCategoryName = category.name ?? '';
    this.newCategoryDesc = category.description ?? '';
    this.displayEditDialog = true;
  }

  closeDialogs(): void {
    this.displayCreateDialog = false;
    this.displayEditDialog = false;
    this.selectedCategory = null;
  }

  createCategory(): void {
    if (!this.newCategoryName.trim()) {
      this.msg.add({
        severity: 'warn',
        summary: 'Attenzione',
        detail: 'Nome categoria obbligatorio',
      });
      return;
    }

    this.categoryService
      .createCategory({
        body: { name: this.newCategoryName, description: this.newCategoryDesc },
      })
      .subscribe({
        next: () => {
          this.msg.add({ severity: 'success', summary: 'Categoria creata' });
          this.loadCategories();
          this.closeDialogs();
        },
        error: () =>
          this.msg.add({
            severity: 'error',
            summary: 'Errore creazione categoria',
          }),
      });
  }

  updateCategory(): void {
    if (!this.selectedCategory) return;

    this.categoryService
      .update1({
        id: this.selectedCategory.id!,
        body: { name: this.newCategoryName, description: this.newCategoryDesc },
      })
      .subscribe({
        next: () => {
          this.msg.add({
            severity: 'success',
            summary: 'Categoria aggiornata',
          });
          this.loadCategories();
          this.closeDialogs();
        },
        error: () =>
          this.msg.add({
            severity: 'error',
            summary: 'Errore modifica categoria',
          }),
      });
  }
}
