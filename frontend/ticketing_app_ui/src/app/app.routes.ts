import { Routes } from '@angular/router';
import { DashboardComponent } from './dashboard/dashboard.component';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent },
  // future: { path: 'tickets', component: TicketListComponent },
  // future: { path: 'users', component: UserListComponent },
  { path: '**', redirectTo: 'dashboard' }
];
