import { Routes } from '@angular/router';
import { authGuard } from './utils/guard/auth.guard';
import { MainComponent } from './modules/ticket/pages/main/main.component';
import { TicketListComponent } from './modules/ticket/components/ticket-list/ticket-list.component';
import { NewTicketComponent } from './modules/ticket/components/new-ticket/new-ticket.component';
import { CategoryListComponent } from './modules/ticket/components/category-list/category-list.component';
import { ServiceListComponent } from './modules/ticket/components/service-list/service-list.component';
import { TicketDashboardComponent } from './modules/ticket/components/ticket-dashboard/ticket-dashboard.component';


export const routes: Routes = [
  {
    path: '',
    component: MainComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        component: TicketDashboardComponent,
        canActivate: [authGuard],
      },
      {
        path: 'my-tickets',
        component: TicketListComponent,
        canActivate: [authGuard],
      },
      {
        path: 'categories',
        component: CategoryListComponent,
        canActivate: [authGuard],
      },
      {
        path: 'new-ticket',
        component: NewTicketComponent,
        canActivate: [authGuard],
      },
      {
        path: 'services',
        component: ServiceListComponent,
        canActivate: [authGuard],
      },
      {
        path: '**',
        redirectTo: '',
      },
    ],
  },
];
