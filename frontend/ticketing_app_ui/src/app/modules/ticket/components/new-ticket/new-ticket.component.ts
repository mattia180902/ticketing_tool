import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ActivatedRoute, Router } from '@angular/router';
import {
  TicketControllerService,
  UserService,
} from '../../../../services/services';
import { DropdownModule } from 'primeng/dropdown';
import { ButtonModule } from 'primeng/button';
import { UserDto } from '../../../../services/models';
import { AuthService } from '../../service/auth.service';

@Component({
  selector: 'app-new-ticket',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DropdownModule,
    ButtonModule,
    ReactiveFormsModule,
  ],
  templateUrl: './new-ticket.component.html',
  styleUrl: './new-ticket.component.scss',
  providers: [MessageService],
})
export class NewTicketComponent implements OnInit {
  ticketForm!: FormGroup;
  helpers: UserDto[] = [];
  categoryId!: number;
  serviceId!: number;
  isUserRole = false;

  constructor(
    private fb: FormBuilder,
    private ticketService: TicketControllerService,
    private userService: UserService,
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.isUserRole = this.auth.isUser();
    this.categoryId = Number(this.route.snapshot.queryParamMap.get('categoryId'));
    this.serviceId = Number(this.route.snapshot.queryParamMap.get('serviceId'));
    this.initForm();
    this.loadHelpers();
    this.loadDraftIfPresent();
    this.ticketForm.valueChanges.subscribe(() => this.saveDraft());
  }

  initForm() {
    const userEmail = this.auth.getUserEmail();
    this.ticketForm = this.fb.group({
      title: ['', Validators.required],
      description: ['', [Validators.required, Validators.minLength(10)]],
      email: [{ value: userEmail, disabled: this.isUserRole }, [Validators.required, Validators.email]],
      phoneNumber: ['', [Validators.required, Validators.pattern(/^\d{9,15}$/)]],
      fiscalCode: ['', [Validators.required, Validators.pattern(/^[A-Z0-9]{16}$/i)]],
      priority: ['MEDIUM', Validators.required],
      assignedToId: [null, Validators.required]
    });
  }

  loadHelpers() {
    this.userService.getHelpersAndAdmins().subscribe(helpers => {
      const currentUser = {
        id: this.auth.getUserId(),
        fullName: this.auth.getUserFullName()
      };
      const filteredHelpers = helpers.filter(h => h.id !== currentUser.id);
      this.helpers = [currentUser, ...filteredHelpers];
    });
  }

  submitTicket() {
    if (this.ticketForm.invalid) return;

    const payload = {
      ...this.ticketForm.getRawValue(),
      categoryId: this.categoryId,
      supportServiceId: this.serviceId,
      status: 'OPEN'
    };

    this.ticketService.createTicket(payload).subscribe(() => {
      localStorage.removeItem('draft_ticket');
      this.updateDraftCount(-1);
      this.router.navigate(['']);
    });
  }

  clearForm() {
    this.ticketForm.reset({
      title: '',
      description: '',
      email: this.auth.getUserEmail(),
      phoneNumber: '',
      fiscalCode: '',
      priority: 'MEDIUM',
      assignedToId: null
    });
    localStorage.removeItem('draft_ticket');
    this.updateDraftCount(-1);
  }

  saveDraft() {
    const draft = {
      ...this.ticketForm.getRawValue(),
      categoryId: this.categoryId,
      supportServiceId: this.serviceId
    };
    localStorage.setItem('draft_ticket', JSON.stringify(draft));
    window.dispatchEvent(new Event('draftCountUpdated'));
  }

  loadDraftIfPresent() {
    const draft = localStorage.getItem('draft_ticket');
    if (draft) {
      const data = JSON.parse(draft);
      this.ticketForm.patchValue(data);
    }
  }

  hasDraft(): boolean {
    return !!localStorage.getItem('draft_ticket');
  }

  recoverDraft() {
    this.loadDraftIfPresent();
  }

  private checkDraftOnLoad() {
    if (this.hasDraft()) {
      this.updateDraftCount(1);
    }
  }

  private updateDraftCount(change: number) {
    const currentCount = Number(localStorage.getItem('draft_count')) || 0;
    const newCount = Math.max(0, currentCount + change);
    localStorage.setItem('draft_count', String(newCount));

    // Facoltativo: triggerare un evento custom se vuoi notificare la dashboard in tempo reale
    window.dispatchEvent(new Event('draftCountUpdated'));
  }
}