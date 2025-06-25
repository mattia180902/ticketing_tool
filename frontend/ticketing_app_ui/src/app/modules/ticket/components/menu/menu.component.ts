/* eslint-disable @typescript-eslint/no-inferrable-types */
import { KeycloakService } from '../../../../utils/keycloak/keycloak.service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MenubarModule } from 'primeng/menubar';
import { Component, OnInit } from '@angular/core';
import { SidebarModule } from 'primeng/sidebar';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { AvatarModule } from 'primeng/avatar';
import { ToolbarModule } from 'primeng/toolbar'; // Per la p-toolbar
import { InputTextModule } from 'primeng/inputtext'; // Per pInputText
import { StyleClassModule } from 'primeng/styleclass';
import { HttpClientModule } from '@angular/common/http';

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
    ToolbarModule,
    InputTextModule,
    StyleClassModule,
    HttpClientModule
  ],
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.scss',
})
export class MenuComponent implements OnInit {
  username: string;
  sidebarVisible: boolean = false;
  roles: string[] = [];

  constructor(
    private keycloakService: KeycloakService,
    private router: Router
  ) {
    this.username = this.keycloakService.fullName || 'User';
  }

  ngOnInit() {
    this.roles = this.keycloakService.getUserRoles();
    console.log('Ruoli utente:', this.roles);
  }

  openSidebar(): void {
    this.sidebarVisible = true;
  }

  closeSidebar(): void {
    this.sidebarVisible = false;
  }

  manageAccount() {
    this.keycloakService.accountManagement();
  }

  logout() {
    this.keycloakService.logout();
  }

  hasRole(role: string): boolean {
    return this.roles.includes(role);
  }
}
