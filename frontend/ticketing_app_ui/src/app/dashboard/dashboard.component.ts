
import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faList, faPlus, faTags, faUser, faSignOutAlt } from '@fortawesome/free-solid-svg-icons';
import { KeycloakService } from '../utils/keycloak/keycloak.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterModule, FontAwesomeModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit{

  constructor(private keycloakService: KeycloakService) {}

  fullName:string = "";
  faList = faList;
  faPlus = faPlus;
  faTags = faTags;
  faUser = faUser;
  faSignOutAlt = faSignOutAlt;

  ngOnInit(): void {
      this.fullName = this.keycloakService.fullName;
  }
  logout() {
    this.keycloakService.logout();
  }
}
