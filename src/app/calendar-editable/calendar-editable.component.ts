// import { EventManager } from '@angular/platform-browser'; -- investigate using eventManager to manage changes to login status
import { Component, OnInit, TemplateRef, ViewChild, Inject, LOCALE_ID } from '@angular/core';
import { formatDate } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';

import { Observable, Subject, Subscription, of } from 'rxjs';
import { map } from 'rxjs/operators'; 
// not sure about the import below for map ... but I needed to add it to get the map in processColorScheme to work
// import 'rxjs/add/operator/map'; -- pre-version 6 import of map

import { CalEvent } from '../model/CalEvent';
import { CalEventService } from '../cal-event.service';

import { AuthService } from '../auth/auth.service';

import { CalendarEvent, CalendarEventAction, CalendarView, CalendarEventTimesChangedEvent } from 'angular-calendar';
import { collapseAnimation } from 'angular-calendar'; /* refer to 
    https://github.com/mattlewis92/angular-calendar/issues/747 */

import { BsModalService } from 'ngx-bootstrap/modal';
import { BsModalRef } from 'ngx-bootstrap/modal/bs-modal-ref.service';

import { ColorScheme } from '../model/ColorScheme';

import {
  compareAsc,
  isSameYear,
  isSameMonth,
  isSameDay,
  isSameHour,
  isSameMinute,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
  subDays,
  addDays,
  addHours,
  format
} from 'date-fns';


/* Matt Lewis uses this approach in his code here 
   https://mattlewis92.github.io/angular-calendar/#/additional-event-properties */
interface ExtraEventData {  
   description? : string;
   location?: string;
   address?: string;
   contact?: string;
   link?: URL;
   cost?: string;
   colorScheme?: ColorScheme;
   slug?: string; 
}

import modalTemplate from "../modal-views/modal.template.html";
import editEventTemplate from "../modal-views/edit-event.template.html";
import deleteEventTemplate from "../modal-views/delete-event.template.html";
import clickEventTemplate from "../modal-views/click-event.template.html";
import mainTemplate from "./calendar-editable.component.html";

@Component({
  selector: 'app-calendar-editable',
 // templateUrl: './calendar-editable.component.html',
  template: modalTemplate+mainTemplate+editEventTemplate+deleteEventTemplate+clickEventTemplate,
  animations: [collapseAnimation],
  styleUrls: ['./calendar-editable.component.scss']
})

export class MyCalendarEditableComponent implements OnInit {
  
  @ViewChild('modalContent')
  private modalContent: TemplateRef<any>;
  
  @ViewChild('dayEventsTemplate')
  private dayEventsTemplate: TemplateRef<any>;
  
  @ViewChild('editEventContent')
  private editEventContent: TemplateRef<any>;
  
  @ViewChild('deleteEventContent')
  private deleteEventContent: TemplateRef<any>;
  
  @ViewChild('clickEventContent')
  private clickEventContent: TemplateRef<any>;
  
  // Some default color schemes -- now setup on server side
  
 
  private sampleColorScheme: ColorScheme = {
    name: '',
    primary: '#ff7d04',
    secondary: '#ffcf9b'
  }
  
  /*
  redColorScheme : ColorScheme = {
      id: 1,
      name: 'Red',
      primary: '#ad2121',
      secondary: '#FAE3E3'
  };

  yellowColorScheme : ColorScheme = {
      id: 2,
      name: 'Yellow',
      primary: '#e3bc08',
      secondary: '#FDF1BA'
  };
 
  blueColorScheme : ColorScheme = {
      id: 3,
      name: 'Blue',
      primary: '#1e90ff',
      secondary: '#D1E8FF'
  };
  */

  private colorSchemes: ColorScheme[]; // color schemes to be displayed in view  
  private customColorScheme: ColorScheme; // used in view for custom color scheme values

  // Controls refresh of display after changes have been made to events
  private refresh: Subject<any> = new Subject();
  
  // Subscription to loginStatus subject
  private loginStatusSubscription: Subscription;
  
  private formError: string = ""; // used in modal forms
  // formInfo: string = ""; // used in modal forms
  
  private modalRef: BsModalRef;
  
 // locale: string = 'en';
 private dateClicked: Date;
  
  private vwMonth: string = 'month';
  private vwWeek: string = 'week';
  private vwDay: string = 'day';
  
  /* vwClicked is generally the same as vw except when there are multiple variations
  of a specific view. In this case, vw would identify the acutual view (either 'month', 'week' or 'day') and vwClicked would identify the particular variation (for ex 'weekdays') */
  private vwClicked: string = CalendarView.Month; /* default view */
  private vw: string = this.vwMonth; /* default view */
  private vwDate: Date = new Date();

  // An empty event used when adding a new event
  private emptyTemplateEvent: CalendarEvent<ExtraEventData> = { 
                                                                start: undefined,
                                                                title: "",
                                                                meta: {} 
                                                              };

  
  private curEvent: CalendarEvent<ExtraEventData>; // currently selected event
  //events$: Observable<Array<CalendarEvent<ExtraEventData>>>;
  //private evnts: Array<CalendarEvent<ExtraEventData>>;

  private activeDayIsOpen: boolean = false; /* need to set to false initially since
                                        you don't know if any events exist 
                                        for "today" */
  
  private modalData: {
    bodyTemplate: TemplateRef<any>;
    header: string;
    button1Text: string;
    button2Text?: string;
    button3Text?: string;
    action: string;
    event: CalendarEvent<ExtraEventData>;
  };

  // initially no actions available for an event because don't know if logged in
  private actions: CalendarEventAction[]=[];
  // available actions when logged in
  private actionsLoggedIn: CalendarEventAction[] = [
    {
      label: '<i class="fa-fw fas fa-pencil-alt"></i>',
      onClick: ({ event }: { event: CalendarEvent<ExtraEventData> }): void => {
        this.handleEvent('Edited', event, "Edit Event", this.editEventContent, "Submit", "Next", "Cancel");
      }
    },
    {
      label: '<i class="fa-fw fa fa-times"></i>',
      onClick: ({ event }: { event: CalendarEvent<ExtraEventData> }): void => {
       // this.events$ = this.events$.filter(iEvent => iEvent !== event);
        this.activeDayIsOpen=false; // may have deleted all events for current day
        this.handleEvent('Deleted', event, "Delete Event", this.deleteEventContent, "Delete", "Cancel");
      }
    },
    {
      label: '<i class="fa-fw fas fa-clone" aria-hidden="true">',
      onClick: ({ event }: { event: CalendarEvent<ExtraEventData> }): void => {
        this.handleEvent('Cloned', event, "Clone Event", this.editEventContent, "Submit", "Next", "Cancel");
      }
    }
  ];
 
  private curAction: string;
    
  private events$: CalendarEvent[];

  constructor(private calEventService: CalEventService, private authService: AuthService, @Inject('Window') private window: Window,
               private modalService: BsModalService, private http: HttpClient, @Inject(LOCALE_ID) private locale: string) {}

  private openModal(template: TemplateRef<any>) {
    //this.modalRef = this.modalService.show(template, { class: 'modal-sm' });
    this.modalRef = this.modalService.show(template);
  }

  private logoutHandler = this.authService.handleLogoutEvent(this.authService);
  private loginHandler = this.authService.handleLoginEvent(this.authService);
  
  ngOnInit() {
    /*this.fetchEvents();*/
    window.addEventListener('storage', this.logoutHandler);
    window.addEventListener('storage', this.loginHandler);
    this.loadColorSchemes();
    this.getCalendarEvents();
    // Schedule a refresh of the display if the user logs in or logs out
    // Unfortunately can't control logout that happens outside the scope of
    // the app -- for example when the login token expires
    // Note, however, the authentication service when checking login status
    // will detect an expired token and would then simulate a logout which
    // would cause the loginStatus subject to fire an event.
    // So the  window when the app would have an expired token with the view
    // reflecting a "logged in" status could be very small since the check 
    // whether you are logged in is triggered frequently from the templates in the 
    // view with checks such as the following
    // <ul class="navbar-nav" [hidden]="authService.isLoggedIn()">
    let self=this;
    this.loginStatusSubscription = this.authService.loginStatus.subscribe(() => {
        self.colorSchemes=[];
        self.events$=[];
        self.loadColorSchemes();
        self.getCalendarEvents();        
    });
  }
  
  ngOnDestroy(): void {
    window.removeEventListener('storage', this.logoutHandler);
    window.removeEventListener('storage', this.loginHandler);
    if (this.loginStatusSubscription) {
      this.loginStatusSubscription.unsubscribe();
    }
  }
  
  private modalButton3Clicked() {
    this.modalRef.hide();
  }
  
  private modalButton2Clicked() {
    if (this.curAction=="Edited"||this.curAction=="Cloned") {
      this.onNextForEdit();
    } else if (this.curAction!=="AddedNext"&&this.curAction!=="AddedNextNext"&&this.curAction!=="EditedNext"&&this.curAction!=="EditedNextNext"&&
        this.curAction!=="ClonedNext"&&this.curAction!=="ClonedNextNext") {
      this.modalRef.hide();
    } else if (this.curAction=="AddedNext"||this.curAction=="EditedNext"||this.curAction=="ClonedNext") {
      this.onPrevForEditNext();       
    } else if (this.curAction=="AddedNextNext"||this.curAction=="EditedNextNext"||this.curAction=="ClonedNextNext") {
      // the previous view from the 3rd view is same as the next view on the first
      this.onNextForEdit(); 
    }
  }
  
  // button 1 on modal is treated as submit button
  private onSubmit() {
    if (this.curAction=="Added") {
      this.onNextForEdit();
    } else if (this.curAction=="Edited") {
      if (this.formFirstInputGroupValid()) {
        this.onSubmitForEdit();
      }
    } else if (this.curAction=="Cloned") {
      if (this.formFirstInputGroupValid()) {
        this.onSubmitForClone();
      }
    } else if (this.curAction=="AddedNext"||this.curAction=="EditedNext"||this.curAction=="ClonedNext") {
      this.onNextForEditNext();
    } else if (this.curAction=="EditedNextNext") {
      this.onSubmitForEdit();
    } else if (this.curAction=="ClonedNextNext") {
      this.onSubmitForClone();
    } else if (this.curAction=="AddedNextNext") {
      this.onSubmitForAdd();
    } else if (this.curAction=="Deleted") {
      this.onSubmitForDelete();
    } else if (this.curAction=="Clicked") {
      this.onMoreForClick();
    } else if (this.curAction=="ClickedMore") {
      this.onSubmitForClick();     
    } else {
      // should not get here
    }
  }
  
  // set up first view in the sequence of modal views when adding a new event
  private addEvent() : void {
    this.handleEvent('Added', this.emptyTemplateEvent, "Add Event", this.editEventContent, "Next", "Cancel");
  }
  
  private onNextForEdit() {
    if (this.curAction=="AddedNextNext"||this.curAction=="EditedNextNext"||this.curAction=="ClonedNextNext"|| // no verification needed on 3rd modal view
        this.formFirstInputGroupValid()) {
      // Simulate the "Next" edit view in the modal window
      this.formError = ""; // reset in case of prior error
      if (this.curAction=="Edited"||this.curAction=="EditedNextNext")
        this.curAction='EditedNext';
      else if (this.curAction=="Cloned"||this.curAction=="ClonedNextNext")
        this.curAction='ClonedNext';
      else
        this.curAction='AddedNext';
      this.modalData.button1Text="Next";
      this.modalData.button2Text="Prev";
      this.modalData.button3Text="";
    }
  }

   private onNextForEditNext() {
    if (this.formColorInputGroupValid()) {
      // Simulate the "Next" edit view in the modal window
      this.formError = ""; // reset in case of prior error
      if (this.curAction=="EditedNext")
        this.curAction='EditedNextNext'; // third and last view in chain
      else if (this.curAction=="ClonedNext")
        this.curAction='ClonedNextNext'; // third and last view in chain
      else
        this.curAction='AddedNextNext'; // third and last view in chain
      this.modalData.button1Text="Submit";
      this.modalData.button2Text="Prev";
      this.modalData.button3Text="Cancel";
    }
  }
  
  private onPrevForEditNext() {
    if (this.formColorInputGroupValid()) {
      // Simulate the "Prev" edit view in the modal window
      this.formError = ""; // reset in case of prior error
      if (this.curAction=="EditedNext")
        this.curAction='Edited';
      else if (this.curAction=="ClonedNext")
        this.curAction='Cloned';
      else
        this.curAction='Added';
      if (this.curAction=='Added') {
        this.modalData.button1Text="Next";
        this.modalData.button2Text="Cancel";
      } else {
        this.modalData.button1Text="Submit";
        this.modalData.button2Text="Next";
        this.modalData.button3Text="Cancel";
      }
    }
  }

  private onSubmitForEdit() {
    //console.log("submitted..."+this.curEvent.title+" "+this.curEvent.meta.description+" "+this.curEvent.start);
    
    //  no form fields to validate on third view in the sequence
    //  if (this.formFirstInputGroupValid()&&this.formColorInputGroupValid()) {        
        this.updateCalendarEvent(this.curEvent);
        this.modalRef.hide();
    //}   
  }
  
  private onSubmitForClone() {
    //console.log("submitted..."+this.curEvent.title+" "+this.curEvent.meta.description+" "+this.curEvent.start);
    
    //  no form fields to validate on third view in the sequence
    //  if (this.formFirstInputGroupValid()&&this.formColorInputGroupValid()) {        
        this.addCalendarEvent(this.curEvent);
        this.modalRef.hide();
    //}   
  }
  
  private onSubmitForAdd() {
    //console.log("submitted..."+this.curEvent.title+" "+this.curEvent.meta.description+" "+this.curEvent.start);
    
    //  no form fields to validate on third view in the sequence
    //  if (this.formFirstInputGroupValid()&&this.formColorInputGroupValid()) {        
        this.addCalendarEvent(this.curEvent);
        this.modalRef.hide();
    //}   
  }
  
  private onMoreForClick() {
    // Simulate the "More" view in the modal window
    this.curAction='ClickedMore';
    this.modalData.button1Text="Return";
    this.modalData.button2Text="";
  }
  
  private onSubmitForClick() {
    this.modalRef.hide(); // just close the modal view since it is handling the "Return" button   
  }

  private formFirstInputGroupValid() : boolean {    
    if (!this.curEvent.start || !this.curEvent.title || this.curEvent.title.trim() == "") {
        this.formError = "Start and title required";
        return false;
    } else if (this.curEvent.end&&
                compareAsc(this.curEvent.start,this.curEvent.end)!==-1
                // the and condition is for the case where the end datetime is after the start because of the "seconds" portion
                // but in reality the two times are the same when least significant part of the time being
                // considered is minutes
                && !(isSameDay(this.curEvent.start,this.curEvent.end)&&
                    isSameHour(this.curEvent.start,this.curEvent.end)&&
                    isSameMinute(this.curEvent.start,this.curEvent.end)) 
                ) {
        this.formError = "End date must be after start date";
        return false;    
    } else {
      return true;
    }

  }

  private formColorInputGroupValid() : boolean {
    if (this.curEvent.meta.colorScheme&&this.curEvent.meta.colorScheme.name&&this.customColorScheme.name&&this.customColorScheme.name.trim()!=="") {
    //if (this.curEvent.color&&this.curEvent.color.name&&this.customColorScheme.name&&this.customColorScheme.name.trim()!=="") {
        this.formError = "Choose an existing color scheme or specify a custom one, but not both";
        return false;
    } else if ((!this.curEvent.meta.colorScheme||!this.curEvent.meta.colorScheme.name)&&(!this.customColorScheme.name||this.customColorScheme.name.trim()=="")) {
    //} else if ((!this.curEvent.color||!this.curEvent.color.name)&&(!this.customColorScheme.name||this.customColorScheme.name.trim()=="")) {
        this.formError = "A color scheme is required. Choose an existing color scheme or specify a custom one";
        return false;
    } else if (this.customColorScheme.name&&this.colorSchemes.some(x=>{
                  return x.name&&x.name.trim().toLowerCase()==this.customColorScheme.name.trim().toLowerCase();
                })
              ){
        this.formError = "Name of custom color scheme cannot match that of an existing color scheme";
        return false;
    } else {
      return true;
    }
  }
  
  private onSubmitForDelete() {
     this.deleteCalendarEvent(this.curEvent);
     this.modalRef.hide();     
  }
  
  private createCalendarEvent(cevent : CalEvent) : CalendarEvent<ExtraEventData> {
      let result: CalendarEvent<ExtraEventData>= {
        start: cevent.start,
        title: cevent.title,
        meta: {}
      };
      if (this.authService.isLoggedIn()&&cevent.owner==this.authService.authPayload.id) {
        result.actions=this.actionsLoggedIn;
        // Only allow the event to be dragged or resized if the currently logged in user
        // owns the event
        if (cevent.draggable) 
          result.draggable=cevent.draggable;        
        if (cevent.resizable)
          result.resizable=cevent.resizable;
      }     
      
      if (cevent.id)
        result.id=cevent.id;
      if (cevent.color) {
        //result.color=cevent.color;       
        result.meta.colorScheme=cevent.color;
        // set result.color so that he calendar utility works
        // note: this information is duplicated in result.meta.colorScheme which is set for the UI
        result.color = {
                         primary: cevent.color.primary,
                         secondary: cevent.color.secondary
                       };
      }
      if (cevent.slug)
        result.meta.slug = cevent.slug;
      if (cevent.description)
        result.meta.description = cevent.description;
      if (cevent.location)
        result.meta.location = cevent.location;
      if (cevent.address)
        result.meta.address = cevent.address;
      if (cevent.contact)
        result.meta.contact = cevent.contact;
      if (cevent.cost)
        result.meta.cost = cevent.cost;
      if (cevent.link)
        result.meta.link = cevent.link;
      if (cevent.end)
        result.end=cevent.end;
      if (cevent.allDay)
        result.allDay=cevent.allDay;
      return result;
  }
  
  private loadColorSchemes(): void {    
    //this.colorSchemes=[this.sampleColorScheme, this.redColorScheme, this.blueColorScheme, this.yellowColorScheme]
    this.getColorSchemes();
  }

  private compareColorSchemes = (a: ColorScheme, b: ColorScheme) => this._compareColorSchemes(a, b);

  _compareColorSchemes(a: ColorScheme, b: ColorScheme) {
    // Handle compare logic (eg check if unique ids are the same)
    return a && b ? a.name === b.name : a === b;
  }
  
  private addColorScheme(colorScheme: ColorScheme) : void {
    let self=this;    
    this.calEventService.addColorScheme(colorScheme)
      // make color scheme available as a selectable option on the view by pushing it to the colorSchemes array
      .subscribe(colorScheme => self.colorSchemes.push(colorScheme));
  }
  
  private getColorSchemes(): void {
    let self=this;
    let myId=this.authService.isLoggedIn() ? this.authService.authPayload.id : null;
    this.calEventService.getColorSchemes(myId)
    .subscribe(colorSchemes => {
                                  self.colorSchemes = colorSchemes;
                                  self.colorSchemes.unshift(self.sampleColorScheme); // add colorscheme with blank name
                                });
  }
  
  private getCalendarEvents(): void {
    let self=this;
    this.calEventService.getCalendarEvents()
    .subscribe(calEvents => self.events$ = calEvents.map(x=>self.createCalendarEvent(x)));
  }
  
  private processColorScheme(event: CalendarEvent<ExtraEventData>): Observable<ColorScheme> {
    if (this.customColorScheme.name) {
      this.customColorScheme.name=this.customColorScheme.name.trim();
      
           
      let self=this;
      return this.calEventService.addColorScheme(this.customColorScheme)
      // make color scheme available as a selectable option on the view by pushing it to the colorSchemes array
      .pipe(map(colorScheme => { 
                           if (colorScheme&&colorScheme.slug) { // add was ok
                              self.colorSchemes.push(colorScheme)
                              // save current color scheme in calendarEvent   
                              event.meta.colorScheme = colorScheme;
                           }                           
                           return colorScheme;
                          })); 
    } else
      return of<ColorScheme>(event.meta.colorScheme);
  }
  
  private updateCalendarEvent(event: CalendarEvent<ExtraEventData>): void {
    this.trimFields(event);
    let self=this;
     
    // keep the events color field up to date
    this.processColorScheme(event).subscribe({
        next(colorScheme) {
          if (colorScheme&&colorScheme.slug) { // ensure no errors -- the colorScheme is returned on success 
            // keep the events color field up to date
            event.color = {
                    primary: event.meta.colorScheme.primary,
                    secondary: event.meta.colorScheme.secondary
            };

            // now update the calendar event           
            self.calEventService.updateCalendarEvent(self.transformToCalEvent(event))
            .subscribe({
                  next(calEvent) { /*console.log('data: ', x);*/   
                       if(calEvent&&calEvent.slug) {  // ensure no errors -- the event is returned on success
                            // self.formInfo= "Event has been updated updated successfully";
                    
                            // update the events array so that it reflects the latest info 
                            // since the views are dependent on this array                            
                            let tgtIndex=self.events$.findIndex(x=>x.id==event.id);                            
                            if (tgtIndex!==-1) {                              
                              self.events$[tgtIndex]=event;                              
                            }
                            self.refresh.next();
                       }
                  },
                  error(err) { self.formError = err.message;
                                console.log('Some error '+err.message); 
                             }
              });
          }
        },
        error(err) { self.formError = err.message;
                      console.log('Some error '+err.message); 
                   }
    });
    
  }
  
  // Use for both adding as well as cloning an event
  private addCalendarEvent(event: CalendarEvent<ExtraEventData>): void {
    event.id=""; //remove id from event to be added; a new id will be generated
    event.meta.slug=""; //remove slug from event to be added; a new slug will be generated
    event.actions=this.actionsLoggedIn; // give the new event the update actions
    
    // for now there is no UI support for draggable and resizable so
    // just set draggable and resizable to true for any added events
    event.draggable=true;
    event.resizable = {
      "beforeStart" : true,
      "afterEnd" : true
    };

    this.trimFields(event);  
    let self=this;
     
    // keep the events color field up to date
    this.processColorScheme(event).subscribe({
        next(colorScheme) {
          if (colorScheme&&colorScheme.slug) { // ensure no errors -- the colorScheme is returned on success 
            // keep the events color field up to date
            event.color = {
                    primary: event.meta.colorScheme.primary,
                    secondary: event.meta.colorScheme.secondary
            };

            // now update the calendar event           
            self.calEventService.addCalendarEvent(self.transformToCalEvent(event))
            .subscribe({
                  next(calEvent) { /*console.log('data: ', x);*/
                        if(calEvent&&calEvent.slug) {  // ensure no errors -- the event is returned on success
                            // self.formInfo= "Event has been updated updated successfully";
                    
                            // update the events array so that it reflects the latest info 
                            // since the views are dependent on this array 
                            event.id=calEvent.id;
                            event.meta.slug=calEvent.slug;
                            self.events$.push(event);
                            self.refresh.next();
                        }
                  },
                  error(err) { self.formError = err.message;
                                console.log('Some error '+err.message); 
                             }
              });
          }
        },
        error(err) { self.formError = err.message;
                      console.log('Some error '+err.message); 
                   }
    });
   
  }
  
    
  private trimFields(event: CalendarEvent<ExtraEventData>): void {
    event.title=event.title.trim();
    if (event.meta.description) {
       event.meta.description=event.meta.description.trim();
    }
    if (event.meta.location) {
       event.meta.location=event.meta.location.trim();
    }
    if (event.meta.address) {
       event.meta.address=event.meta.address.trim();
    }
    if (event.meta.contact) {
       event.meta.contact=event.meta.contact.trim();
    }
    if (event.meta.cost) {
       event.meta.cost=event.meta.cost.trim();
    }
   // if (event.meta.link) {
   //    event.meta.link=event.meta.link.trim();
   // }
  }
  
  private deleteCalendarEvent(event: CalendarEvent<ExtraEventData>): void {
    let self=this;
    this.calEventService.deleteCalendarEvent(this.transformToCalEvent(event))
    .subscribe({
                  next(x) { //console.log(x)
                            if(x&&x.slug) {  // ensure no errors -- the deleted event is returned on success                           
                            
                              // update the events array so that it reflects the latest info 
                              // since the views are dependent on this array
                              self.events$ = self.events$.filter(e => e.id !== event.id);                           
                              self.refresh.next();
                            }
                  },
                  error(err) { self.formError = err.message;
                                console.log('Some error '+err.message); 
                             }
              });
  }

  private transformToCalEvent(event: CalendarEvent<ExtraEventData>): CalEvent {
    let result: CalEvent= {
        start: event.start,
        title: event.title,
        color: this.sampleColorScheme
      };
      
      if (event.meta.colorScheme) {
        result.color=event.meta.colorScheme;       
      }
      if (event.id)
        result.id=event.id; 
      if (event.meta.slug)
        result.slug=event.meta.slug;
      if (event.meta.description)
        result.description=event.meta.description;
      if (event.meta.location)
        result.location=event.meta.location;
      if (event.meta.address)
        result.address=event.meta.address;
      if (event.meta.contact)
        result.contact=event.meta.contact;
      if (event.meta.cost)
        result.cost=event.meta.cost;
      if (event.meta.link)
        result.link=event.meta.link;
      if (event.end)
        result.end=event.end;
      if (event.allDay)
        result.allDay=event.allDay;
      if (event.resizable)
        result.resizable=event.resizable;
      if (event.draggable)
        result.draggable=event.draggable;
      return result;

  } 
  
  private handleEvent(action: string, event: CalendarEvent<ExtraEventData>, header: string, 
               bodyTemplate: TemplateRef<any>, button1Text: string, button2Text?: string, button3Text?: string): void {
    this.curAction=action; // save action so that you know what to do on submit
    
    // The events array always represent the truth (i.e. it is a reflection of the server).  Therefore if
    // the event (i.e. curEvents) is changed in the modal, this does not corrupt the truth (i.e. the events array)
    
    // A duplicate copy (i.e. deep copy) of the event is needed if the event properties can be updated in the modal view
    if (this.curAction=="Edited" || this.curAction=="Cloned" || this.curAction=="Added") { 
      // Note: deep copy gotten from https://stackoverflow.com/questions/47413003/how-can-i-deep-copy-in-typescript  
      this.curEvent=JSON.parse(JSON.stringify(event)); // make deep copy of current event available to templates
      if (this.curAction=="Added") {
        // Note start and end dates should already be cleared since
        // we are using the templateEvent which is more or less empty
        if (this.authService.isLoggedIn()) {
          this.curEvent.actions=this.actionsLoggedIn;
        }    
      } else { // not "Added" action
        if (this.curAction=="Cloned") {
          this.curEvent.start=undefined; // clear start date for cloned event 
        } else {
          this.curEvent.start=new Date(this.curEvent.start); // recast as date field
        }
        if (this.curEvent.end) {
          this.curEvent.end=new Date(this.curEvent.end); // recast as date field
        }
      } // end not "Added" action
    } else {
      this.curEvent=event; // shallow copy is sufficient
    }
    if (this.curAction!=="Added")
      this.curEvent.actions=event.actions; // share the actions since they are not modified in the forms
    
    // make fresh copy of sample color available to templates
    this.customColorScheme = {...this.sampleColorScheme};
    
    if (button3Text)
      this.modalData = { bodyTemplate, header, button1Text, button2Text, button3Text, event, action };
    else if (button2Text)
      this.modalData = { bodyTemplate, header, button1Text, button2Text, event, action };
    else
       this.modalData = { bodyTemplate, header, button1Text, event, action };
    this.formError = ""; // reset in case of prior error
    this.openModal(this.modalContent);   
  }
  
  /*
  private fetchEvents(): void {
    const getStart: any = {
      month: startOfMonth,
      week: startOfWeek,
      day: startOfDay
    }[this.vw];

    const getEnd: any = {
      month: endOfMonth,
      week: endOfWeek,
      day: endOfDay
    }[this.vw];

    const params = new HttpParams()
      .set(
        'primary_release_date.gte',
        format(getStart(this.vwDate), 'YYYY-MM-DD')
      )
      .set(
        'primary_release_date.lte',
        format(getEnd(this.vwDate), 'YYYY-MM-DD')
      )
      .set('api_key', '0ec33936a68018857d727958dca1424f');

    this.events$ = this.http
      .get('https://api.themoviedb.org/3/discover/movie', { params })
      .pipe(
        map(({ results }: { results: Film[] }) => {
          return results.map((film: Film) => {
            return {
              title: film.title,
              start: new Date(film.release_date + this.getOffset(this.vwDate)),
              color: colors.yellow,
              meta: {
                film
              }
            };
          });
        })
      );
  }
  */
  
  eventTimesChanged({
    event,
    newStart,
    newEnd
  }: CalendarEventTimesChangedEvent): void {
    event.start = newStart;
    event.end = newEnd;
    // updateCalendarEvent needs customColorScheme to be set.
    // Nothing would be done in this case for the custom "fake" color scheme because
    // the name field is not set in the sampleColorScheme.  Typically when the name
    // is defined in the custom color scheme, a new color scheme would be added with that
    // name before the event is updated to reference the custom color scheme.  But in this
    // case, we are only updating the start and end times of the event so nothing needs to
    // be done for the color scheme.
    this.customColorScheme = {...this.sampleColorScheme};
    this.updateCalendarEvent(event);
    this.refresh.next();
  }
  
  private dayClicked({
    date,
    events
  }: {
    date: Date;
    events: Array<CalendarEvent<ExtraEventData>>;
  }): void {
    this.dateClicked=date;
    if (isSameMonth(date, this.vwDate)) {
      if (
        (isSameDay(this.vwDate, date) && this.activeDayIsOpen === true) ||
        events.length === 0
      ) {
        this.activeDayIsOpen = false;
      } else {
        this.activeDayIsOpen = true;
        this.vwDate = date;
      }
    }
  }
  
  /*
  private eventClicked(event: CalendarEvent<{ film: Film }>): void {
    window.open(
      `https://www.themoviedb.org/movie/${event.meta.film.id}`,
      '_blank'
    );
  }
  */
  
  /*
  // This sample copied from https://stackoverflow.com/questions/44808882/create-a-clone-of-an-array-in-typescript
  private deepCloneArray (inArr:Array<any>[]):  Array<any> {     
    const myClonedArray = [];   
    // refer to link https://googlechrome.github.io/samples/object-assign-es6/ for shallow copy (also {...obj} works as well)
    // deep copy gotten from https://stackoverflow.com/questions/47413003/how-can-i-deep-copy-in-typescript  
    inArr.map(val => myClonedArray.push(JSON.parse(JSON.stringify(val))));
    return myClonedArray;
  }
  */
  
  // Refer to https://stackoverflow.com/questions/35144821/angular-use-pipes-in-services-and-components
  private formatDateField(start: Date, allDay : boolean, end?: Date) : string { 
    // for usage of formatDate refer to https://angular.io/api/common/formatDate and     https://angular.io/api/common/DatePipe for the various formats
    if (!end||isSameDay(start, end))   
      return formatDate(start, 'fullDate', this.locale);
    else if (isSameMonth(start, end))
      return formatDate(start, 'EEE, d - ', this.locale)+formatDate(end, 'EEE, d, LLLL, yyyy', this.locale);
    else if (isSameYear(start, end))
      return formatDate(start, 'EEE, LLL d - ', this.locale)+formatDate(end, 'EEE, LLL d, yyyy', this.locale);
    else if (!isSameYear(start, end))
      return formatDate(start, 'EEE, LLL d, yyyy - ', this.locale)+formatDate(end, 'EEE, LLL d, yyyy', this.locale);
    else
      return 'xxxx'; // should not get here
  }
  
   private formatTimeField(start: Date, allDay : boolean, end?: Date) : string { 
    // for usage of formatDate refer to https://angular.io/api/common/formatDate and     https://angular.io/api/common/DatePipe for the various formats
    if (allDay)   
      return "All Day"
    else if (!end)
      return formatDate(start, 'shortTime', this.locale);
    else {
      let endTimeQualifier="";    
      if (isSameDay(start,end)) {
        // same day -- no special qualifier
      } else if (isSameDay(addDays(start,1),end)) {
          endTimeQualifier=" (Next day)";
      } else {
          endTimeQualifier=" (Across days)";
      } 

      return formatDate(start, 'shortTime', this.locale) + " - " + formatDate(end, 'shortTime', this.locale) + endTimeQualifier;
    }

  }
  
}
