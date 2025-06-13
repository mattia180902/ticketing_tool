/* eslint-disable @typescript-eslint/no-explicit-any */
import { Component, OnInit } from '@angular/core';
import { CategoryService } from '../../../../services/services';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';

@Component({
  selector: 'app-ticket-category',
  standalone: true,
  imports: [CommonModule, FormsModule, CardModule],
  templateUrl: './ticket-category.component.html',
  styleUrl: './ticket-category.component.scss'
})
export class TicketCategoryComponent implements OnInit{
categories: any = [];

  constructor(private categoryService: CategoryService, private router: Router) {}

  ngOnInit() {
    this.categoryService.getAllCategories().subscribe(data => this.categories = data);
  }

  createTicket(categoryId: number) {
    this.router.navigate(['/new-ticket', categoryId]);
  }
}
