import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CategoryDto } from '../../../../services/models';
import { CategoryService } from '../../../../services/services';

@Component({
  selector: 'app-service-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './service-list.component.html',
  styleUrl: './service-list.component.scss'
})
export class ServiceListComponent implements OnInit{
  services: CategoryDto[] = [];

  constructor(
    private categoryService: CategoryService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadServices();
  }

  loadServices() {
    this.categoryService.getAllCategories().subscribe({
      next: (data) => {
        this.services = data;
      },
      error: (err) => {
        console.error('Errore nel recupero dei servizi', err);
      }
    });
  }

  goToTickets(serviceId: number | undefined) {
    this.router.navigate(['/services', serviceId, 'tickets']);
  }
}
