import { Component, OnInit, HostListener, ViewChild } from '@angular/core';
import { fabric } from 'fabric';
import html2canvas from 'html2canvas';
import {DataService} from '../service/data.service'
import {DatabaseService} from '../service/database.service'
import {ToastService} from  '../service/toast-service.service'
import { initializeApp } from "firebase/app";
// import { Observable, map } from 'rxjs';
// import { HttpClient } from '@angular/common/http';
import { IonInput } from '@ionic/angular';
import * as map_marker from '../../assets/maps/map_marker.json'



interface pos_marker {
  timestamp: string;
  markers: [
    marker: number[]
  ];
}

@Component({
  selector: 'app-canvas',
  templateUrl: './canvas.page.html',
  styleUrls: ['./canvas.page.scss'],
})


export class CanvasPage implements OnInit {

  canvas?:fabric.Canvas
  canvas_control?:fabric.Canvas
  wrapper= document.getElementById('canvasWrapper')
  imageUrl:any

  protected _points: Array<fabric.Circle>;
  protected _polylines: Record<string, fabric.Polyline>;

  constructor(
    public dataService: DataService,
    public databaseService: DatabaseService,
    // public http: HttpClient,
    public toastService: ToastService) {

    this._points    = new Array<fabric.Circle>();
    this._polylines = {}
  }

  // draw polygons
  poly_mode = false
  selected_obj:any
  polyline:any;
  mouseDown=false
  pts=[]
  lastPt=1
  polyType='Polyline'
  polyBtn:any
  bgColor='green';
  id=-1;

  // station mode
  station_mode = false
  station_list = []

  // mouse action
  current_zoom = 1
  current_pan:any
  isDragging = false;
  selection = false;
  lastPosX = 0;
  lastPosY = 0;

  //mTransform
  mInverse:any
  acum_offset_x = 0
  acum_offset_y = 0

  //gradient
  grad_angle = 0
  is_all_angle = false

  ngOnInit() {

    // this.show_marker()

    var options = {
      backgroundColor: 'transparent',
      opacity: 0,
      preserveObjectStacking: true
    }
    this.canvas = new fabric.Canvas('canvas_1', options);
    this.canvas_control = new fabric.Canvas('canvas_2', options);

    /* PAN */
    this.canvas.on('mouse:down', (opt)=> {
      var evt = opt.e;
      if (evt.shiftKey === true) {
        if (this.canvas){
          this.canvas.selection = false;
          this.isDragging = true;
          this.selection = false;
          this.lastPosX = evt.clientX;
          this.lastPosY = evt.clientY;
        }
      }
    });
    this.canvas.on('mouse:move', (opt)=> {
      if (this.canvas && this.isDragging) {
        var e = opt.e;
        var vpt = this.canvas.viewportTransform;
        if (vpt){
          vpt[4] += e.clientX - this.lastPosX;
          vpt[5] += e.clientY - this.lastPosY;
        }
        this.canvas.requestRenderAll();
        this.lastPosX = e.clientX;
        this.lastPosY = e.clientY;
      }
    });
    this.canvas.on('mouse:up', (opt)=> {
      // on mouse up we want to recalculate new interaction
      // for all objects, so we call setViewportTransform
      if (this.canvas?.viewportTransform){
        this.canvas?.setViewportTransform(this.canvas.viewportTransform);
        var mCanvas:any = this.canvas?.viewportTransform; // obtain the canvas transformation matrix after pan
        this.mInverse = fabric.util.invertTransform(mCanvas); // and then update the reverse
        this.canvas.selection = true;
      }
      this.isDragging = false;
      this.selection = true;
      this.current_pan = this.canvas?.viewportTransform;

    });

    /* ZOOM */
    this.canvas.on('mouse:wheel', (opt)=> {
      var delta = opt.e.deltaY;
      if (this.canvas){
        var zoom = this.canvas.getZoom();
        if (zoom){
          zoom *= 0.999 ** delta;
          if (zoom > 20) zoom = 20;
          if (zoom < 0.01) zoom = 0.01;
          this.canvas?.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
          this.current_zoom = zoom
          this.current_pan = this.canvas?.viewportTransform;
          opt.e.preventDefault();
          opt.e.stopPropagation();

          var mCanvas:any = this.canvas?.viewportTransform; // obtain the canvas transformation matrix after zoom
          this.mInverse = fabric.util.invertTransform(mCanvas); // and then update the reverse
        }
      }
    });


    /**
     * Draw polygon
     */

    this.canvas.on('mouse:down', (opt)=> {
      var evt = opt.e;
      // Transform the mouse click by the inverse matrix
      if (this.mInverse){
        console.log('transformed down');
        var new_mouse_pos = fabric.util.transformPoint(({x: evt.clientX - 150, y: evt.clientY - 160 } as fabric.Point), this.mInverse);

      }
      else
      {
        var new_mouse_pos = ({x: evt.clientX - 150 , y: evt.clientY - 160} as fabric.Point);
      }
      if (this.poly_mode == true) {
        if (this.pts.length > 1) {
          this.pts.splice(-1,1);
        } //remove duplicate start points
        var fill_color = "rgb(150, 150, 150)" //color for the drawing tool
        var stroke_color = "rgb(50, 50, 50)"
        this.polyline = new fabric.Polyline(this.pts,{objectCaching:false, name:'temp',fill: fill_color, stroke: stroke_color,
          originX:'center',originY:'center',selectable:true});
          this.canvas?.add(this.polyline);
          // this.polyline.points[this.pts.length] = {x: (evt.clientX+150), y: (evt.clientY+160)};
          this.polyline.points[this.pts.length] = new_mouse_pos;
          this.lastPt++;
          this.mouseDown=true;
        // console.log('pt : ', JSON.stringify(this.pts) );
      }
      console.log(' new_mouse_pos : ', new_mouse_pos );
    });
    this.canvas.on('mouse:move', (opt)=> {
      if (this.canvas && this.mouseDown){
        var evt = opt.e;
        if (this.mInverse){
          console.log('transformed move');
          var new_mouse_pos = fabric.util.transformPoint(({x: evt.clientX - 150 , y: evt.clientY - 160} as fabric.Point), this.mInverse);
        }
        else
        {
          var new_mouse_pos = ({x: evt.clientX - 150 , y: evt.clientY - 160} as fabric.Point);
        }
        let mouse = this.canvas?.getPointer(opt.e);
        if (this.poly_mode == true && this.mouseDown) {
          // this.polyline.points[this.lastPt-1] = {x: (evt.clientX+150)*this.current_zoom, y: (evt.clientY+160)*this.current_zoom};
          this.polyline.points[this.lastPt-1] = new_mouse_pos;
          this.canvas?.renderAll();
        }
      }
    });
    this.canvas.on('mouse:dblclick', (opt)=> {
      this.canvas?.forEachObject((obj)=> {
        if (obj.name=='temp') {
           this.canvas?.remove(obj);
          }
      });
      let polyObj = new fabric.Polygon(this.pts,
        {
          objectCaching:false,
          // id:this.id++,
          fill: this.active_color,
          stroke: this.active_stroke_color,
          originX:'center',
          originY:'center',
          selectable:true,
        });
      this.polyObject = polyObj


      this.poly_mode=false;
      this.polyBtn='';
      this.lastPt=1;
      this.mouseDown=false;
      this.pts=[];

      var type_id = 0
      for (const key of Object.keys(this.activeMode)) {
        // console.log(' key : ', key, type_id);
        if ( (this.activeMode as any)[key]){

          if (key.startsWith('zone')){
            if (key === "zone_cross_road" ){ // !!! hardcoded that only zone_red has no gradient
              this.setGradient(polyObj, 0, this.active_color);
            }
            this.dataService.zone_obj.push(polyObj)
          }
          else if (key.startsWith('map')){
            this.dataService.map_fix_obj.push(polyObj)
          }
          else if (key.startsWith('station')){
            this.dataService.station_obj.push(polyObj)
          }
          polyObj.set('strokeWidth', type_id) //obseleted
          this.add_custom_obj_type(key) // add a custom attribute object_type to the polygon obj
        }
        type_id++ //obseleted
      }
      this.dataService.is_saved = false

    }); //end dblclick

    /* select and deselect obj */
    this.canvas.on('selection:created', () => {
      this.selected_obj = this.canvas?.getActiveObject();
      console.log(' selected : ', this.selected_obj );
      if (this.selected_obj.fill && this.selected_obj.fill.type==='linear'){
        // Show deg editor UI
        this.grad_angle = this.calculateDegreeFromCoords(this.selected_obj.fill.coords)
        this.toggleDegEditor(true)
      }
    });
    this.canvas.on('selection:cleared', ()=> {
      this.selected_obj = '';
      this.toggleDegEditor(false)
    });


    /* Add station */
    this.canvas.on('mouse:dblclick', (opt)=> {
      var evt = opt.e;
      // Transform the mouse click by the inverse matrix
      if (this.mInverse){
        var new_mouse_pos = fabric.util.transformPoint(({x: evt.clientX - 150, y: evt.clientY - 160 } as fabric.Point), this.mInverse); // 150 and 160 pixel are adjustment observe by eyes
      }
      else
      {
        var new_mouse_pos = ({x: evt.clientX - 150 , y: evt.clientY - 160} as fabric.Point);
      }
      if (this.station_mode == true) {
        console.log('Put station at ', new_mouse_pos);

        // Hardcoded strokeWidth as 2
        var station = new fabric.Circle({radius: 10, fill:"rgb(100, 200, 255, 0.7)", strokeWidth: 2, top:new_mouse_pos.y - 15, left: new_mouse_pos.x - 15, lockScalingX: true, lockScalingY: true}) // adjust was added by trial and error
        var station_text = new fabric.IText('', { fill:"rgb(0, 0, 0, 0.7)", strokeWidth: 2, top:new_mouse_pos.y + 10, left: new_mouse_pos.x + 10, fontFamily: 'Arial', fontSize: 25})
        this.launch_floating_UI(evt.clientX, evt.clientY, station, station_text)
      }
    });
  }
  screen_x:number = 0
  screen_y:number = 0
  show_screen = false
  station_name = ""
  station_holder:any;
  station_text_holder:any;
  connect_to_map = false;

  @ViewChild('station_input') station_input!: IonInput;

  launch_floating_UI(x:number, y:number, station_obj:any, text_obj:any){
    this.screen_x = x
    this.screen_y = y
    this.show_screen = true
    this.station_holder = station_obj
    this.station_text_holder = text_obj

    setTimeout(() =>
    { this.station_input.setFocus(); // trigger setfocus on the input field
    },500)
  }
  close_floating_UI(is_connect_to_map:boolean){
    this.show_screen = false
    this.station_text_holder.set('text', this.station_name)

    // the custom attribute "name" needs to be added manually, otherwise it would not be saved into json
    this.station_holder.toObject = (function (toObject) {
      return function (this: fabric.Object) {
        return fabric.util.object.extend(toObject.call(this), {
          name: this.name,
          object_type: 'station'
        });
      };
    })(this.station_holder.toObject);
    this.station_holder.name = this.station_name // set custom attribute name
    this.station_holder.object_type = 'station' // set custom attribute object_type

    // add the same custom object_type to the station label text
    this.station_text_holder.toObject = (function (toObject) {
      return function (this: fabric.Object) {
        return fabric.util.object.extend(toObject.call(this), {
          name: this.name,
          object_type: 'station_text'
        });
      };
    })(this.station_text_holder.toObject);
    this.station_text_holder.object_type = 'station_text' // set custom attribute object_type


    if (is_connect_to_map){
      this.station_holder.set('radius', 12)
      this.station_holder.set('fill', 'rgb(100, 100, 255, 0.7)')
    }
    this.canvas?.add(this.station_holder)
    this.canvas?.add(this.station_text_holder)
    this.canvas?.renderAll();
    this.dataService.is_saved = false
  }




  /**
   * Keyboard input
   */
  is_hide_zone = false;
  is_hide_map_fix = false;
  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    console.log('  event.key : ',  event.key );
    if (event.key === 'Backspace'){
      if (this.canvas && this.canvas.getActiveObject() !== null) {
        // console.log(' this.canvas.getActiveObject() : ', this.canvas.getActiveObject() );
        if (this.canvas.getActiveObject() !== null){
          this.canvas?.remove(this.canvas.getActiveObject()!)
        }
      }
    }
    if (event.key === 'Enter'){
      // do something on enter key
    }
    if (event.key === ')'){
      // reset zoom
      if (this.start_zoom && this.start_pan){
        this.canvas?.setZoom(this.start_zoom)
        // this.canvas?.setViewportTransform(this.start_pan);
      }
    }
    if (event.key === '!'){
      this.dataService.headerMode= this.dataService.headerModeList[0]
    }
    if (event.key === '@'){
      this.dataService.headerMode= this.dataService.headerModeList[1]
    }
    if (event.key === '#'){
      this.dataService.headerMode= this.dataService.headerModeList[2]
    }
    if ((event.metaKey || event.ctrlKey) && event.key === 's') {
      this.save();
      event.preventDefault();
    }
    if ((event.ctrlKey) && event.key === '2') {
      if(this.is_hide_zone){
        this.togglePolygonVisibility('zone', true)
        this.is_hide_zone = false
      }
      else{
        this.togglePolygonVisibility('zone', false)
        this.is_hide_zone = true
      }
    }
    if ((event.ctrlKey ) && event.key === '1') {
      if(this.is_hide_map_fix){
        this.togglePolygonVisibility('map_fix', true)
        this.is_hide_map_fix = false
      }
      else{
        this.togglePolygonVisibility('map_fix', false)
        this.is_hide_map_fix = true
      }
    }

    if (event.key === ' ') {
      // event.preventDefault();
      // if (this.use_prox){
      //   console.log('Use full res');
      //   this.use_prox = false
      //   this.canvas?.setBackgroundImage(this.full_size_map, this.canvas.renderAll.bind(this.canvas))
      // }
      // else{
      //   console.log('Use prox');
      //   this.use_prox = true
      //   this.canvas?.setBackgroundImage(this.scaled_map, this.canvas.renderAll.bind(this.canvas))
      // }
    }

  }

  polyObject: any
  add_custom_obj_type(polyObjType:string){
    /* add custom item type */
    this.polyObject.toObject = (function (toObject) {
      return function (this: fabric.Object) {
        return fabric.util.object.extend(toObject.call(this), {
          object_type: polyObjType
        });
      };
    })(this.polyObject.toObject);

    this.polyObject.object_type = polyObjType

    this.canvas?.add(this.polyObject)
    this.canvas?.renderAll();
  }



  /**
   * IO
   */


  start_zoom:any
  start_pan:any;
  map_w = 0
  map_h = 0

  use_prox = false;
  /* Create a new map project */
  new_map(){
      this.canvas?.clear()
      this.canvas_control?.clear()

      var ext = '.png'
      var full_map_path = `${this.dataService.map_preflix}${this.dataService.current_map}/${this.dataService.current_map}${ext}`
      fabric.Image.fromURL(full_map_path, img => {
        // console.log('w & h: ', img.width, img.height );
        if (this.canvas && img.width && img.height){
          this.map_w = img.width
          this.map_h = img.height
          this.canvas?.setWidth(this.map_w)
          this.canvas?.setHeight(this.map_h)
          this.start_zoom = this.canvas?.getZoom();
          this.current_zoom = this.canvas.getZoom();
          this.start_pan = this.canvas?.viewportTransform;
          this.current_pan = this.canvas?.viewportTransform;
          img.set({ selectable: false });
          this.canvas?.setBackgroundImage(img, this.canvas.renderAll.bind(this.canvas));
          // initize the mInverse for mouse position calculation of poly draw mouse event
          var mCanvas:any = this.canvas?.viewportTransform;
          this.mInverse = fabric.util.invertTransform(mCanvas);
        }
      });

  }

  /* Export snapshot of the current map */
  isExporting = false
  export(canvas_name:string, scale:number, file_name:string){
    setTimeout(() =>
    {
        html2canvas(document.getElementById(canvas_name) as HTMLElement, {scale: scale, backgroundColor:null}).then(canvas => {
          const link = document.createElement('a');
          link.href = canvas.toDataURL('image/png', {format: 'png'});
          link.download = `${file_name}.png`;
          link.click();
          this.isExporting = false
        });
    },
    1000);
  }
  export2DB(canvas_name:string, scale:number, file_name:string){
    setTimeout(() =>
    {
        html2canvas(document.getElementById(canvas_name) as HTMLElement, {scale: scale, backgroundColor:null}).then(canvas => {
          const dataURL = canvas.toDataURL('image/png');

          // Create a reference to the file in Firebase Storage
          var fileRef = this.databaseService.get_ref_for_storage(file_name)

          // Upload the canvas data URL as a blob to Firebase Storage
          fileRef
            .putString(dataURL, 'data_url')
            .then(() => {
              console.log('Canvas uploaded successfully!');
              this.toastService.simpleToast('Control map export successfully', 2000)
              this.isExporting = false
            })
            .catch((error) => {
              console.error('Error uploading canvas:', error);
              this.toastService.simpleAlertToast('Failed to export control map', 2000)
              this.isExporting = false
            });

        });
    },
    1000);
  }


  /* Save a new ver of the current map to DB */
  save(){
    // // reset the zoom and pan
    // this.canvas?.setZoom(this.start_zoom)
    // this.canvas?.setViewportTransform(this.start_pan);
    if (this.dataService.current_map){
      setTimeout(() =>
      {
         // save data to DB
         this.databaseService.save_map_to_DB(JSON.stringify(this.canvas?.toJSON(["object_type", "name"])), this.dataService.current_map, this.map_w, this.map_h)
         this.dataService.is_saved = true
      },
      500);
    }
  }

  async load($event:any){
    console.log('Load from map  : ', $event.detail.value );
    // var data = $event.detail.value
    try {

      this.canvas?.loadFromJSON($event.detail.value.data, this.canvas.renderAll);
      this.dataService.current_map = $event.detail.value.map_name
      // Setting width and height
      // Setting current map
      this.map_w = $event.detail.value.width
      this.map_h = $event.detail.value.height
      this.canvas?.setWidth(this.map_w)
      this.canvas?.setHeight(this.map_h)
      this.canvas_control?.setWidth(this.map_w)
      this.canvas_control?.setHeight(this.map_h)


    } catch (error) {
      console.error('Error downloading JSON file:', error);
      throw error;
    }

  }

  export_base_map(){
    if (this.dataService.current_map){

      this.canvas_control?.loadFromJSON(JSON.stringify(this.canvas?.toJSON(["object_type", "name"])), function(){});
      this.canvas_control?.setWidth(this.map_w)
      this.canvas_control?.setHeight(this.map_h)
      setTimeout(() =>
      {
        this.canvas_control?.getObjects().forEach( item  =>{
          console.log('check object_type', (item as any).object_type);

          // if (item.strokeWidth === 4 || item.strokeWidth === 3 || item.strokeWidth === 2){
          //   item.set('fill', 'transparent')
          //   item.set('stroke', 'transparent')
          // }
          if ((item as any).object_type.includes('station')|| (item as any).object_type.includes('zone') ){
            item.set('fill', 'transparent')
            item.set('stroke', 'transparent')
          }
          else{
            item.set('stroke', 'transparent')
          }
        })
        this.canvas_control?.renderAll()
        // export the base map
        this.export('canvas_2', 1, `${this.dataService.current_map}_base_map`)

      }, 500)
    }
  }

  save_station(){
    if (this.dataService.current_map){
      var map_name = this.dataService.current_map
      var station_list:any = []

      this.canvas?.getObjects().forEach( item  =>{
        // if (item.strokeWidth === 2 && item instanceof fabric.Circle){ // 4 => station
        if ((item as any).object_type.includes('station') && item instanceof fabric.Circle){

          var connect_to_map = false;
          if (item.radius === 12){
            connect_to_map = true;
          }


          station_list.push({
            station_name : item.name,
            pos : [item.left, item.top],
            connect_to_map : connect_to_map
          })
        }
      })
      var data = {
        'map_name' : this.dataService.current_map,
        'station_list' : station_list
      }
      this.databaseService.updateMapData(data)
    }
  }






  /**
   * UI UX
   */
  active_color = 'white'
  active_stroke_color= 'white'
  activeMode = {
    map_fix_black: false,
    map_fix_white: false,
    station_add: false,
    zone_red: false,
    zone_cross_road: false,
    zone_slow: false,
    zone_pause: false,
  }
  polygon_color = {
    map_fix_black: 'black',
    map_fix_white: 'white',
    zone_red: "rgb(255, 0, 0, 0.7)",
    zone_slow: "rgb(0, 200, 0, 0.7)",
    zone_pause: "rgb(0, 0, 150, 0.7)",
    zone_cross_road: [
      { offset: 0, color: "rgb(255, 0, 0, 0.7)" },
      { offset: 1, color: "rgb(0, 0, 0, 0.7)"},
    ],
  }
  // control_map_color = {
  //   map_fix_black: 'black',
  //   map_fix_white: 'white',
  //   zone_red: "rgb(255, 11, 0)", // R -> unused, G -> type, B -> padding_id
  //   zone_slow: "rgb(255, 11, 0)", // R -> unused, G -> type, B -> padding_id
  //   zone_pause: "rgb(255, 11, 0)", // R -> unused, G -> type, B -> padding_id
  //   zone_cross_road: "rgb(0, 12, 0)", // R -> angle, G -> type, B -> padding_id
  // }
  stroke_color = {
    map_fix_white: "rgb(240, 240, 240)",
    map_fix_black: "transparent",
    zone_red: "transparent",
    zone_slow: "transparent",
    zone_pause: "transparent",
    zone_cross_road: "transparent",
  }
  editMode = false
  showDegEditor = false

  unlock(){
    // WIP - allow user to lock and unlock existing objects
    if (this.editMode === true){
      this.editMode = false;
    }
    else{
      this.editMode = true;
    }
  }

  // turn on different editor mode
  toggleActiveMode(mode_key:string){

    if (mode_key.startsWith('zone') || mode_key.startsWith('map')){
      this.poly_mode = true;
      this.station_mode = false
    }
    else if (mode_key.startsWith('station') ){
      this.poly_mode = false;
      this.station_mode = true
    }

    for (const key of Object.keys(this.activeMode)) {
      let value = (this.activeMode as any)[key];
      console.log(key, value );
      if (key === mode_key){
        (this.activeMode as any)[key] = true;
        this.active_color = (this.polygon_color as any)[key]
        this.active_stroke_color = (this.stroke_color as any)[key]
      }
      else{
        (this.activeMode as any)[key] = false;
      }
    }
    // console.log(' activeMode : ', this.activeMode );
  }

  toggleDegEditor(turn_on:boolean){
    if( turn_on){
      this.showDegEditor = true

    }
    else{
      this.showDegEditor = false
    }
  }

  // use slider to adjust polygon's gradient direction
  set_zone_deg(){
    console.log('set deg', this.grad_angle, this.selected_obj.fill.colorStops);

    this.setGradient(this.selected_obj, this.grad_angle, this.selected_obj.fill.colorStops);
    // this.selected_obj.set('fill', 'green')
    this.canvas?.renderAll();
  }

  set_header_mode(mode:string){
    console.log(' mode : ', mode );
    this.dataService.headerMode = mode
  }

  // toggle 255(means all angles) and zero
  toggle_all_angle(){
    if (this.is_all_angle){
      this.setGradient(this.selected_obj, 358, this.selected_obj.fill.colorStops);
      this.canvas?.renderAll();
    }
    else{
      this.setGradient(this.selected_obj, 0, this.selected_obj.fill.colorStops);
      this.canvas?.renderAll();
    }
  }

  // bring polygon to front
  bring_to_front(){
    const selectedObject = this.canvas?.getActiveObject();
    if (selectedObject) {
      this.canvas?.bringToFront(selectedObject);
      this.canvas?.setActiveObject(selectedObject);
      setTimeout(() => {
        this.canvas?.renderAll();
      }, 100);
    }
  }
  // bring polygon forward
  bring_forward(){
    const selectedObject = this.canvas?.getActiveObject();
    if (selectedObject) {
      this.canvas?.bringForward(selectedObject, true);
      this.canvas?.setActiveObject(selectedObject);
      setTimeout(() => {
        this.canvas?.renderAll();
      }, 100);
    }
  }
  // bring polygon to front
  bring_backward(){
    let selectedObject = this.canvas?.getActiveObject();
    if (selectedObject && this.canvas) {
      console.log(' selectedObject : ', selectedObject );
      let r = this.canvas.sendBackwards(selectedObject, true);
      setTimeout(() => {
        if (selectedObject && this.canvas) {
          this.canvas?.setActiveObject(selectedObject);
          this.canvas?.requestRenderAll();
        }
      }, 1000);
    }

  }

  //toggle object visibility
  allObjects:any
  togglePolygonVisibility(type:string, to_show:boolean) {
    if (type === 'zone'){
      var target_obj_type = 'zone'
    }
    else if (type === 'map_fix'){
      var target_obj_type = 'map_fix'
    }

    this.allObjects = this.canvas?.getObjects();
    this.allObjects.forEach((polygon: any) => {
      if ((polygon as any).object_type.includes(target_obj_type)) {
        if (to_show){
          polygon.set('opacity', 1);
        }
        else{
          polygon.set('opacity', 0);
        }
      }
    });
    this.canvas?.renderAll();
  }



  /**
   * Control map functions
   */
  /* config the color of polygon for control map, or reverse it back for editor */
  process_and_export_control_map(){

    this.canvas_control?.loadFromJSON(JSON.stringify(this.canvas?.toJSON(["object_type", "name"])), function(){});
    this.canvas_control?.setWidth(this.map_w)
    this.canvas_control?.setHeight(this.map_h)
    this.isExporting = true
    setTimeout(() =>
    {
      var zone_id = 1
      this.canvas_control?.getObjects().forEach( item  =>{

        /*
        Process each obj by its type(strokeWidth)
        strokeWidth is like an item ID - refer to 'activeMode' for more details
        */

        console.log('item object_type : ', (item as any).object_type );
        // if (item.strokeWidth && item.strokeWidth > 2){ // for zone obj
        if ((item as any).object_type && (item as any).object_type.includes('zone')){ // for zone obj

          /* zone cross road */
          // if (item.strokeWidth === 4 && item.fill instanceof fabric.Gradient){
          if ((item as any).object_type.includes('zone_cross_road') && item.fill instanceof fabric.Gradient){
            // calculate angle from coord
            var deg = this.calculateDegreeFromCoords(item.fill.coords)
            console.log('encoding color: ', deg, '110', zone_id);
            item.set('fill', `rgb(${deg/2}, 110, ${zone_id})`)
          }
          /* zone red */
          // else if (item.strokeWidth === 3 && item.fill){
          else if ((item as any).object_type.includes('zone_red') && item.fill){
            // calculate angle from coord
            var deg = 255 // 255 degree means all angles
            console.log('encoding color: ', deg, '120', zone_id);
            item.set('fill', `rgb(${deg}, 120, ${zone_id})`)
          }
          /* zone slow */
          // else if (item.strokeWidth === 5 && item.fill){
          else if ((item as any).object_type.includes('zone_slow') && item.fill){
            // calculate angle from coord
            var deg = 255 // 255 degree means all angles
            console.log('encoding color: ', deg, '130', zone_id);
            item.set('fill', `rgb(${deg}, 130, ${zone_id})`)
          }
          /* zone pause */
          else if ((item as any).object_type.includes('zone_pause') && item.fill){
            // calculate angle from coord
            var deg = 255 // 255 degree means all angles
            console.log('encoding color: ', deg, '140', zone_id);
            item.set('fill', `rgb(${deg}, 140, ${zone_id})`)
          }
          zone_id ++
        }
        // else if (item.strokeWidth === 2){ // station markers
        else if ((item as any).object_type && (item as any).object_type.includes('station')){ // station markers
          item.set('fill', 'transparent')
        }
        else{
          // do nothing for white and black
        }

      })
      this.canvas_control?.renderAll()
      // export the control map at 0.2 scale
      // this.export('canvas_2', 0.2, `${this.dataService.current_map}_control_map`)
      this.export2DB('canvas_2', 0.2, `${this.dataService.current_map}_control`)
    },
    1000);

  }




  convertDegreeToCoords(degree: number, width: number, height: number): fabric.IGradientOptions['coords'] {
    const angleInRadians = (degree - 180) * (Math.PI / 180);
    const radius = Math.sqrt((width * width) + (height * height)) / 2;

    const centerX = width / 2;
    const centerY = height / 2;

    const x1 = centerX + Math.cos(angleInRadians) * (radius / 2);
    const y1 = centerY + Math.sin(angleInRadians) * (radius / 2);
    const x2 = centerX - Math.cos(angleInRadians) * (radius / 2);
    const y2 = centerY - Math.sin(angleInRadians) * (radius / 2);

    return { x1, y1, x2, y2 };
  }

  calculateDegreeFromCoords(coords: fabric.IGradientOptions['coords']): number {
    const x1 = coords?.x1;
    const y1 = coords?.y1;
    const x2 = coords?.x2;
    const y2 = coords?.y2;
    if (x1 && x2 && y1 && y2){
      const dx = x2 - x1;
      const dy = y2 - y1;
      const angleInRadians = Math.atan2(dy, dx);
      let degree = (angleInRadians * 180) / Math.PI;
      // degree += 90;
      degree = (degree + 360) % 360;

      return degree;
    }
    else{
      return 0
    }
  }

  setGradient(obj:any, angle:any, colors:any){

    if (angle === 358){ //special case 358 represent all angles in Bot BRAIN
      console.log('A', this.convertDegreeToCoords(angle, obj.width, obj.height ), this.calculateDegreeFromCoords( this.convertDegreeToCoords(angle, obj.width, obj.height )));
      console.log('B', this.convertDegreeToCoords(angle, obj.width*10, obj.height*10), this.calculateDegreeFromCoords( this.convertDegreeToCoords(angle, obj.width*10, obj.height*10 )));
      var w = obj.width*10
      var h = obj.height*10
    }
    else{
      w = obj.width
      h = obj.height
    }
    obj.set('fill', new fabric.Gradient({
      //gradient options
      type: 'linear',
      gradientUnits: 'pixels', // or 'percentage'
      coords: this.convertDegreeToCoords(angle, w, h ),
      colorStops:colors
    }));
  }
  test = [{'a': 1, 'b':101}, {'a': 2, 'b':102}, {'a': 3, 'b':103}]


  timestamp_list:any[] = []
  markers_list:any[] = []
  is_show_markers = false
  toggle_marker(){
    if(this.is_show_markers){
      this.is_show_markers = false
      this.show_marker_map(false)
    }
    else{
      this.is_show_markers = true
      this.show_marker_map(true)
    }
  }

  /* Load and show marker map - currently it require a pre-rendered marker map PNG*/
  originalBackgroundImage:any
  show_marker_map(show:boolean){
    if (show){
      this.originalBackgroundImage = this.canvas?.backgroundImage;
      try{
        var ext = '_marker.png'
        var full_marker_map_path = `${this.dataService.map_preflix}${this.dataService.current_map}/${this.dataService.current_map}${ext}`
          fabric.Image.fromURL(full_marker_map_path, img => {
            img.set({ selectable: false });
            this.canvas?.setBackgroundImage(img, this.canvas.renderAll.bind(this.canvas));
          });
      }
      catch(err){
        console.log('Faile to load marker map', err);
      }
    }
    else{
      this.canvas?.setBackgroundImage(this.originalBackgroundImage, this.canvas.renderAll.bind(this.canvas));
    }
  }



  // show_marker(){
  //   const dataArray = Object.values(map_marker);

  //   for (let index = 0; index < dataArray.length; index++) {
  //     if(dataArray[index]['timestamp']){
  //       this.timestamp_list.push(dataArray[index]['timestamp']);
  //       this.markers_list.push(dataArray[index]['markers']);
  //     }
  //   }
  //   console.log('timestamp_list', this.timestamp_list);
  //   console.log('markers_list', this.markers_list);

  //   var resolution =  0.050000
  //   var origin = [-116.405265, -409.977855, 0.000000]

  //   var marker = new fabric.Circle({radius: 3, fill:"rgb(50, 200, 100, 0.7)", strokeWidth: 4, top:100, left: 100, lockScalingX: true, lockScalingY: true})


  // }


  // drawMarkersOnCanvas(mapImgPath: string, markerJsonPath: string, resolution: number, origin: [number, number, number]): void {
  //   this.canvas?.clear();

  //   // Load map image and get its size
  //   this.getImageSize(mapImgPath).then((imgSize:any) => {
  //     const gridWidth = imgSize.width;
  //     const gridHeight = imgSize.height;

  //     // Load marker JSON data
  //     this.http.get(markerJsonPath).subscribe((markers: any[]) => {
  //       markers.forEach((group) => {
  //         group.markers.forEach((point, idx) => {
  //           const pngPos = this.convertMapToPngPos(point, gridWidth, gridHeight, resolution, origin);
  //           const radius = 1;

  //           if (pngPos) {
  //             const box = [pngPos[0] - radius, pngPos[1] - radius, pngPos[0] + radius, pngPos[1] + radius];
  //             const circle = new fabric.Circle({
  //               left: box[0],
  //               top: box[1],
  //               radius: radius,
  //               fill: 'green',
  //               selectable: false
  //             });
  //             this.canvas.add(circle);

  //             if (idx < group.markers.length - 1) {
  //               const nextPngPos = this.convertMapToPngPos(group.markers[idx + 1], gridWidth, gridHeight, resolution, origin);
  //               if (nextPngPos) {
  //                 const line = [pngPos[0], pngPos[1], nextPngPos[0], nextPngPos[1]];
  //                 const lineObj = new fabric.Line(line, {
  //                   fill: 'green',
  //                   stroke: 'green',
  //                   strokeWidth: 1,
  //                   selectable: false
  //                 });
  //                 this.canvas.add(lineObj);
  //               }
  //             }
  //           }
  //         });
  //       });

  //       this.canvas.renderAll();
  //     });
  //   });
  // }


  // ROOT_PATH = "/Users/hammerchu/Desktop/DEV/OBB/bot"
  // convertMapToPngPos(mapName: string, position: [number, number], gridWidth: number = 0, gridHeight: number = 0): Observable<[number, number]> {
  //   try {
  //     const yamlPath = `${this.ROOT_PATH}/data/maps/${mapName}/${mapName}.yaml`;
  //     return this.http.get(yamlPath).pipe(
  //       map((mapYaml: any) => {
  //         if (gridWidth === 0 || gridHeight === 0) {
  //           const mapImgPath = `${this.ROOT_PATH}/data/maps/${mapName}/${mapName}.png`;
  //           const imgSize = this.getImageSize(mapImgPath);
  //           gridWidth = imgSize.width;
  //           gridHeight = imgSize.height;
  //         }

  //         const poseX = position[0];
  //         const poseY = position[1];
  //         const originX = mapYaml.origin[0];
  //         const originY = mapYaml.origin[1];
  //         const resolution = mapYaml.resolution;

  //         const pngX = (poseX - originX) / resolution;
  //         const pngY = gridHeight - (poseY - originY) / resolution;

  //         return [Math.floor(pngX), Math.floor(pngY)];
  //       })
  //     );
  //   } catch (error) {
  //     console.error(error);
  //     throw error;
  //   }
  // }

  // private getImageSize(imagePath: string): { width: number, height: number } {
  //   const image = new Image();
  //   image.src = imagePath;
  //   return { width: image.naturalWidth, height: image.naturalHeight };
  // }



}
