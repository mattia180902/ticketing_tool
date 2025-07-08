import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TicketFilterComponent } from './ticket-filter.component';

describe('TicketFilterComponent', () => {
  let component: TicketFilterComponent;
  let fixture: ComponentFixture<TicketFilterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TicketFilterComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(TicketFilterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
