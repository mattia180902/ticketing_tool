/* eslint-disable @typescript-eslint/no-inferrable-types */
import { KeycloakService } from '../../../../utils/keycloak/keycloak.service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MenubarModule } from 'primeng/menubar';
import { Component } from '@angular/core';
import { SidebarModule } from 'primeng/sidebar';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { AvatarModule } from 'primeng/avatar';
import { StyleClassModule } from 'primeng/styleclass';

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
    StyleClassModule,
  ],
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.scss',
})
export class MenuComponent {
manageAccount() {
 this.keycloakService.accountManagement();
}
  username: string;
  constructor(
    private keycloakService: KeycloakService,
    private router: Router
  ) {
    this.username = this.keycloakService.fullName || 'User';
  }

  sidebarVisible: boolean = false;

  // Questo metodo ora apre la sidebar
  openSidebar(): void {
    this.sidebarVisible = true;
  }

  /* ngOnInit(): void {
    const linkColor = document.querySelectorAll('.nav-link');
    linkColor.forEach((link) => {
      if (window.location.href.endsWith(link.getAttribute('href') || '')) {
        link.classList.add('active');
      }
      link.addEventListener('click', () => {
        linkColor.forEach((l) => l.classList.remove('active'));
        link.classList.add('active');
      });
    });
  }
*/

  // Questo metodo chiude la sidebar e si lega a (onHide) della p-sidebar o al click del bottone interno
  // La chiusura del bottone 'X' all'interno della sidebar può anche semplicemente settare sidebarVisible = false
  closeSidebar(): void {
    this.sidebarVisible = false;
  }

  async logout() {
    this.keycloakService.logout();
  }
}
