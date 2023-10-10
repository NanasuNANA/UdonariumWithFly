/* 
Porting from Udonarium Lily
Copyright (c) 2020 entyu

MIT License
https://opensource.org/licenses/mit-license.php
*/
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { RengeComponent } from './renge.component';

describe('RengeComponent', () => {
  let component: RengeComponent;
  let fixture: ComponentFixture<RengeComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ RengeComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(RengeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
