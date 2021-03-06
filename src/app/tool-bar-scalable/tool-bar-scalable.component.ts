import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../auth/auth.service';
import { ModalService } from '../modal.service';

import { PageLoginComponent } from '../page-login/page-login.component';
import { PageUpdateProfileComponent } from '../page-update-profile/page-update-profile.component';

@Component({
  selector: 'app-tool-bar-scalable',
  templateUrl: './tool-bar-scalable.component.html',
  styleUrls: ['./tool-bar-scalable.component.scss']
})
export class ToolBarScalableComponent implements OnInit {

  constructor(private router:Router, private authService: AuthService, private modalService: ModalService) { }

  ngOnInit() {
  }
  
  initLoginModal() {
    let inputs = {
      isMobile: false
    }
    this.modalService.init(PageLoginComponent, inputs, {});
  }
  
  initUpdateProfileModal() {
    let inputs = {
      isMobile: false
    }
    this.modalService.init(PageUpdateProfileComponent, inputs, {});
  }
  
  logout() {
      this.authService.logout();
      this.router.navigate(["/"]); // redirect home
  }

}
