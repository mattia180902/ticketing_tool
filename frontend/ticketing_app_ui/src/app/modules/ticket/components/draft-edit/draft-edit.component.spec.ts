import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DraftEditComponent } from './draft-edit.component';

describe('DraftEditComponent', () => {
  let component: DraftEditComponent;
  let fixture: ComponentFixture<DraftEditComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DraftEditComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(DraftEditComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
