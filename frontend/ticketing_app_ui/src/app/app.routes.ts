import { Routes } from '@angular/router';
import { authGuard } from './utils/guard/auth.guard';
import { MainComponent } from './modules/ticket/pages/main/main.component';
import { TicketListComponent } from './modules/ticket/components/ticket-list/ticket-list.component';
import { TicketCardComponent } from './modules/ticket/components/ticket-card/ticket-card.component';
import { TicketCategoryComponent } from './modules/ticket/components/ticket-category/ticket-category.component';
import { NewTicketComponent } from './modules/ticket/components/new-ticket/new-ticket.component';

export const routes: Routes = [
  {
    path: '',
    component: MainComponent,
    canActivate: [authGuard],
    children: [
      { path: '', component: TicketCardComponent, canActivate: [authGuard] },
      {
        path: 'my-tickets',
        component: TicketListComponent,
        canActivate: [authGuard],
      },
      {
        path: 'categories',
        component: TicketCategoryComponent,
        canActivate: [authGuard],
      },
      {
        path: 'new-ticket/:categoryId',
        component: NewTicketComponent,
        canActivate: [authGuard],
      },
    ],
  },
];
