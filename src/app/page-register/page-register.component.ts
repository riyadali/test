import { Component, OnInit } from '@angular/core';
import {AuthService} from '../auth/auth.service';
import {ModalService} from '../modal.service';
import {PageLoginComponent} from "../page-login/page-login.component";

import {
  Router
 // CanActivate,
 // ActivatedRouteSnapshot,
 // RouterStateSnapshot,
 // CanActivateChild,
 // NavigationExtras,
 // CanLoad, Route
}  from '@angular/router';

@Component({
  selector: 'app-page-register',
  templateUrl: './page-register.component.html',
  styleUrls: ['./page-register.component.scss']
})
export class PageRegisterComponent implements OnInit {
  
  formError: string = "";
  credentials = {
    user: {
            username : "",
            email : "",
            password : "",
            bio : ""
          } 
  };
  
  // if you want to redirect to specific page after registering
  // For example you may want to a particular calendar entry.
  //returnPage = $location.search().page || '/';
  //returnPage='/'; // for now just redirect to home page
  // The above is from the getting mean site (it may still be useful)
  // However, for now I use the redirectURL in authService to control redirection.
  

  constructor(private authService: AuthService, private modalService: ModalService, public router: Router) { }

  ngOnInit() {
  }
  
  close() {
    this.modalService.destroy();
  }

  loadLoginModal() {
    this.close(); // close this modal dialog
    let inputs = {
      isMobile: false
    }
    this.modalService.init(PageLoginComponent, inputs, {});
  }
  
  onSubmit () {
      this.formError = "";
      if (!this.credentials.user.username || !this.credentials.user.email || !this.credentials.user.password) {
        this.formError = "All fields except bio required, please try again";
        return false;
      } else {
        this.doRegister();
      }
  }
  
  doRegister () {
      this.formError = "";
      let self=this;
      this.authService
        .register(this.credentials)
        .subscribe({
            next(x) { /*console.log('data: ', x);*/
                       if (self.authService.isLoggedIn()) {
                          // Get the redirect URL from our auth service
                          // If no redirect has been set, use the default
                          // let redirect = this.authService.redirectUrl ?      this.authService.redirectUrl : '/admin';
                          let redirect = self.authService.redirectUrl ? 
                                            self.authService.redirectUrl : '/home';

                          // Set our navigation extras object
                          // that passes on our global query params and fragment

                          // Notes on preserveFragment
                          // Preserve fragment from /results#top to /view#top
                          // this.router.navigate(['/view'], { preserveFragment: true });
                          // let navigationExtras: NavigationExtras = {
                          //  queryParamsHandling: 'preserve',
                          //  preserveFragment: true
                          // };

                          // Redirect the user
                          // self.router.navigate([redirect], navigationExtras);
                          self.router.navigate([redirect]);
                          self.close(); // close modal dialog
                        }
                    },
            error(err) { self.formError = err.message;
                          console.log('Some error '+err.message); 
                       }
        });
    }

}

