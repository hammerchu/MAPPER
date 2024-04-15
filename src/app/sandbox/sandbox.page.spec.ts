import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SandboxPage } from './sandbox.page';

describe('SandboxPage', () => {
  let component: SandboxPage;
  let fixture: ComponentFixture<SandboxPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(SandboxPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
