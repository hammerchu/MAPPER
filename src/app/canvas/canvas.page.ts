import { Component, OnInit, HostListener, ViewChild, AfterViewInit } from '@angular/core';
import { fabric } from 'fabric';
import html2canvas from 'html2canvas';
import * as download from 'downloadjs';
import * as htmlToImage from 'html-to-image';
import { toPng, toJpeg, toBlob, toPixelData, toSvg } from 'html-to-image';
import { firstValueFrom } from 'rxjs'; // for Promise conversion

import {DataService} from '../service/data.service'
import {DatabaseService} from '../service/database.service'
import {ToastService} from  '../service/toast-service.service'
import { initializeApp } from "firebase/app";
// import { Observable, map } from 'rxjs';
// import { HttpClient } from '@angular/common/http';
import { IonInput } from '@ionic/angular';
// import * as map_marker from '../../assets/maps/map_marker.json'


/* 
require jszip, ionic, angular, html2canvas, fabricjs, downloadjs, html-to-image

*/


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


export class CanvasPage implements OnInit, AfterViewInit {

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

    this.example_test_convex_polygon()

    var options = {
      backgroundColor: 'transparent',
      opacity: 0,
      preserveObjectStacking: true,
      renderOnAddRemove: false // prevent the canvas from rendering all objects when adding or removing objects
    }
    // this.canvas = new fabric.StaticCanvas('canvas_1', options);
    this.canvas = new fabric.Canvas('canvas_1', options);
    this.canvas_control = new fabric.Canvas('canvas_2', options);

    /* PAN now with plain mouse; select with Shift + mouse */
    this.canvas.on('mouse:down', (opt)=> {
      var evt = opt.e;
      if (evt.shiftKey === true) {
        // selection mode with Shift key
        this.isDragging = false;
        if (this.canvas){
          this.canvas.selection = true;
        }
      } else {
        // pan by default with mouse drag (no Shift)
        if (this.canvas){
          this.canvas.selection = false;
          this.isDragging = true;
          this.selection = false;
          this.lastPosX = evt.clientX;
          this.lastPosY = evt.clientY;
        }
      }

      if (this.is_measure_mode) {
        this.addCrossMark(evt.clientX, evt.clientY)
        console.log("evt.clientX, evt.clientY", evt.clientX, evt.clientY);
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
        this.updateMiniMapView();
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
        this.canvas.selection = opt.e.shiftKey === true; // keep selection enabled only when Shift is held
      }
      this.isDragging = false;
      this.selection = opt.e.shiftKey === true;
      this.current_pan = this.canvas?.viewportTransform;
      this.updateMiniMapView();

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
          this.canvas.requestRenderAll();
          this.updateMiniMapView();
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
      this.canvas?.renderAll();
      let polyObj = new fabric.Polygon(this.pts,
        {
          objectCaching:false,
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
          // polyObj.set('strokeWidth', type_id) //obseleted
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
      // if (this.mInverse){
      //   var new_mouse_pos = fabric.util.transformPoint(({x: evt.clientX - 150, y: evt.clientY - 160 } as fabric.Point), this.mInverse); // 150 and 160 pixel are adjustment observe by eyes
      // }
      // else
      // {
      //   var new_mouse_pos = ({x: evt.clientX - 150 , y: evt.clientY - 160} as fabric.Point);
      // }
      if (this.station_mode == true) {
        console.log('Put station at ', new_mouse_pos);

        // 根据当前激活的模式确定站点类型
        var station_type = 'station_add'; // 默认类型
        for (const key of Object.keys(this.activeMode)) {
          if (key.startsWith('station') && (this.activeMode as any)[key]) {
            station_type = key;
            break;
          }
        }
        this.current_station_type = station_type;

        // 根据站点类型设置不同颜色
        var station:any;
        if (station_type === 'station_add') {
          var fill_color = "rgb(100, 200, 255, 0.7)"; // 默认蓝色
          station = new fabric.Circle({radius: 10, fill: fill_color, strokeWidth: 2, top:new_mouse_pos.y - 15, left: new_mouse_pos.x - 15, lockScalingX: true, lockScalingY: true}) // adjust was added by trial and error
        }
        else if (station_type === 'station_unload') {
          fill_color = "rgb(255, 165, 0, 0.7)"; // 橙色
          // Create two circles and a thin vertical line
          var cir1_radius = 10; // size of the circle1
          var circle1 = new fabric.Circle({
            name: 'pre-pose',
            radius: cir1_radius,
            fill: fill_color,
            strokeWidth: 2,
            top: new_mouse_pos.y,
            left: new_mouse_pos.x,
            lockScalingX: true,
            lockScalingY: true
          });
          var cir2_radius = 10; // size of the circle2
          var cir2_offset_y = 30; // offset of the circle2
          var circle2 = new fabric.Circle({
            name: 'target-pose',
            radius: cir2_radius,
            fill: "rgb(255, 255, 255, 0.8)",
            stroke: "rgb(100, 60, 0, 0.7)",
            strokeWidth: 1,
            top: new_mouse_pos.y + cir2_offset_y, //
            left: new_mouse_pos.x,
            lockScalingX: true,
            lockScalingY: true
          });

          console.log('circle1.left: ', circle1.left, 'circle1.top: ', circle1.top);
          console.log('circle2.left: ', circle2.left, 'circle2.top: ', circle2.top);

          // Start and end at the center of each circle, calculated by radius, top, and left
          var line = new fabric.Line([
            circle1.left!+cir1_radius, circle1.top!+cir1_radius, // Center of the lower circle
            circle2.left!+cir2_radius, circle2.top!+cir2_radius  // Center of the upper circle
          ], {
            stroke: "rgba(100, 60, 0, 0.7)",
            strokeWidth: 2,
            selectable: false
          });

          station = new fabric.Group([circle1, circle2, line], {
            lockScalingX: true,
            lockScalingY: true
          });
          console.log('station.left: ', station.left, 'station.top: ', station.top);
        } else if (station_type === 'station_charging') {
          fill_color = "rgb(0, 255, 0, 0.7)"; // 绿色
          // Transform charging station to have the same structure as loading (unload) station: two circles (pre and target), connected by a line
          var cir1_radius = 10; // size of the circle1
          var circle1 = new fabric.Circle({
            name: 'pre-pose',
            radius: cir1_radius,
            fill: fill_color,
            strokeWidth: 2,
            top: new_mouse_pos.y,
            left: new_mouse_pos.x,
            lockScalingX: true,
            lockScalingY: true
          });
          var cir2_radius = 10; // size of the circle2
          var cir2_offset_y = 30; // offset of the circle2
          var circle2 = new fabric.Circle({
            name: 'target-pose',
            radius: cir2_radius,
            fill: "rgb(255,255,255,0.8)",
            stroke: "rgba(0, 100, 0, 0.7)",
            strokeWidth: 1,
            top: new_mouse_pos.y + cir2_offset_y,
            left: new_mouse_pos.x,
            lockScalingX: true,
            lockScalingY: true
          });

          // Start and end at the center of each circle
          var line = new fabric.Line([
            circle1.left! + cir1_radius, circle1.top! + cir1_radius,
            circle2.left! + cir2_radius, circle2.top! + cir2_radius
          ], {
            stroke: "rgba(0, 100, 0, 0.7)",
            strokeWidth: 2,
            selectable: false
          });

          station = new fabric.Group([circle1, circle2, line], {
            lockScalingX: true,
            lockScalingY: true
          });
          // station = new fabric.Circle({radius: 30, fill: fill_color, strokeWidth: 2, top:new_mouse_pos.y - 15, left: new_mouse_pos.x - 15, lockScalingX: true, lockScalingY: true}) // adjust was added by trial and error
        } else if (station_type === 'station_lift') {
          fill_color = "rgb(255, 0, 255, 0.7)"; // 紫色
          station = new fabric.Circle({radius: 40, fill: fill_color, strokeWidth: 2, top:new_mouse_pos.y - 15, left: new_mouse_pos.x - 15, lockScalingX: true, lockScalingY: true}) // adjust was added by trial and error
        }

        // Hardcoded strokeWidth as 2
        var station_text = new fabric.IText('', { fill:"rgb(0, 0, 0, 0.7)", strokeWidth: 2, top:new_mouse_pos.y + 10, left: new_mouse_pos.x + 30, fontFamily: 'Arial', fontSize: 20})
        this.launch_floating_UI(evt.clientX, evt.clientY, station, station_text)
      }
    });
  }

  ngAfterViewInit() {
    this.initMiniMapCanvas();
    this.ensureMiniMapFrame();
  }

  /**
   * Ensure minimap canvas is initialized after view is ready
   */
  initMiniMapCanvas(){
    if (!this.canvas_minimap){
      const miniEl = document.getElementById('canvas_minimap');
      if (!miniEl){
        console.warn('canvas_minimap element not found');
        return;
      }
      this.canvas_minimap = new fabric.Canvas(miniEl as HTMLCanvasElement, {
        selection: false,
        hoverCursor: 'default',
        backgroundColor: 'transparent',
        renderOnAddRemove: false
      });
      console.log('minimap initialized');
    }
  }

  /**
   * Draw a minimal frame so user can see minimap even before map load
   */
  ensureMiniMapFrame(){
    this.initMiniMapCanvas();
    if (!this.canvas_minimap){ return; }
    if (this.canvas_minimap.getObjects().length === 0){
      const frame = new fabric.Rect({
        left: 0,
        top: 0,
        width: this.canvas_minimap.getWidth(),
        height: this.canvas_minimap.getHeight(),
        fill: 'rgba(255,255,255,0.9)',
        stroke: '#999',
        strokeWidth: 1,
        selectable: false,
        evented: false
      });
      this.canvas_minimap.add(frame);
      this.canvas_minimap.sendToBack(frame);
      this.canvas_minimap.renderAll();
    }
  }
  screen_x:number = 0
  screen_y:number = 0
  show_screen = false
  station_name = ""
  station_holder:any;
  station_text_holder:any;
  connect_to_map = false;
  current_station_type = "station_add"; // 追踪当前选择的站点类型

  @ViewChild('station_input') station_input!: IonInput;

  launch_floating_UI(x:number, y:number, station_obj:any, text_obj:any){
    this.screen_x = x
    this.screen_y = y
    this.show_screen = true
    this.station_holder = station_obj // station_obj means the circle object
    this.station_text_holder = text_obj // text_obj means the text object

    setTimeout(() =>
    { this.station_input.setFocus(); // trigger setfocus on the input field
    },500)
  }
  /**
   * 关闭浮动UI并保存站点信息
   * @param is_connect_to_map 是否连接到地图
   */
  close_floating_UI(is_connect_to_map:boolean){
    this.show_screen = false
    this.station_text_holder.set('text', this.station_name)

    // the custom attribute "name" and "station_type" need to be added manually, otherwise they would not be saved into json
    this.station_holder.toObject = (function (toObject) {
      return function (this: fabric.Object) {
        return fabric.util.object.extend(toObject.call(this), {
          name: this.name,
          object_type: 'station',
          station_type: (this as any).station_type // 保存站点类型，类型断言以避免TS属性错误
        });
      };
    })(this.station_holder.toObject);
    this.station_holder.name = this.station_name // set custom attribute name
    this.station_holder.object_type = 'station' // set custom attribute object_type
    this.station_holder.station_type = this.current_station_type // 设置站点类型

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
      // 根据站点类型设置连接到地图时的颜色
      var connected_color = 'rgb(100, 100, 255, 0.7)'; // 默认深蓝色
      if (this.current_station_type === 'station_unload') {
        connected_color = 'rgb(200, 100, 0, 0.7)'; // 深橙色
      } else if (this.current_station_type === 'station_charging') {
        connected_color = 'rgb(0, 200, 0, 0.7)'; // 深绿色
      } else if (this.current_station_type === 'station_lift') {
        connected_color = 'rgb(200, 0, 200, 0.7)'; // 深紫色
      }
      this.station_holder.set('fill', connected_color)
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
          this.canvas?.renderAll();
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
      this.save_map();
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


  /** Upload a zip file */
  selectedZipFile:any;
  isUploading = false;
  uploadMessage:any;
  uploadSuccess = false;
  uploadZipFile(){
    console.log('uploading zip file');
    setTimeout(() => {
      const zipFileInput = document.querySelector('#zip_file_input input[type="file"]') as HTMLInputElement;
      if (zipFileInput) {
        zipFileInput.value = ''; // reset so change always triggers
        zipFileInput.click();
      } else {
        console.warn('ZIP file input not found.');
      }
    }, 0);
  }

  onZipFileSelected(event:any){
    console.log('zip file selected');
  // unzip the zip file and upload it to Firebase Storage (not local /assets/maps folder)
  // Note: Browser security prevents writing directly to local file system
  // Files are uploaded to Firebase Storage at path: assets/maps/...

  const file = event.target.files && event.target.files[0];
  if (!file) {
    this.toastService.simpleAlertToast('No zip file selected', 2000);
    return;
  }

  this.isUploading = true;
  this.uploadMessage = "Uploading...";

  // Dynamically import JSZip (assume JSZip is included in package)
  import('jszip').then((JSZipModule: any) => {
    // Ensure compatibility with both default and named exports
    const JSZip = JSZipModule.default ? JSZipModule.default : JSZipModule;
    const zip = new JSZip();

    zip.loadAsync(file).then(async (zipData: any) => {
      // Upload each file to Firebase Storage
      const filePromises: Promise<any>[] = [];
      const uploadedFiles: string[] = [];
      const mapFolders = new Set<string>(); // Track unique map folder names

      // For keeping track of folders and files in the zip
      zipData.forEach((relativePath: string, zipEntry: any) => {
        // Extract only files (ignore directories)
        if (!zipEntry.dir) {
          // Normalize the path: remove leading slashes and handle different ZIP structures
          let normalizedPath = relativePath.replace(/^\/+/, '').replace(/\\/g, '/');
          
          // If ZIP contains files at root, assume they should go into a folder structure
          // If ZIP already has folder structure (e.g., "map_name/map_name.png"), preserve it
          // If ZIP has "assets/maps/" prefix, remove it to avoid duplication
          if (normalizedPath.startsWith('assets/maps/')) {
            normalizedPath = normalizedPath.substring('assets/maps/'.length);
          }
          
          // Extract map folder name from path (e.g., "map_name/map_name.png" -> "map_name")
          const pathParts = normalizedPath.split('/');
          if (pathParts.length > 1) {
            const folderName = pathParts[0];
            mapFolders.add(folderName);
          }
          
          // Prepare for uploading the file to Firebase Storage/assets/maps/
          const filePath = `assets/maps/${normalizedPath}`;
          
          filePromises.push(
            zipEntry.async('blob').then((blob: Blob) => {
              const ref = this.databaseService.afStorage.ref(filePath);
              return ref.put(blob)
                .then(() => {
                  uploadedFiles.push(filePath);
                  return {file: filePath, success: true};
                })
                .catch(e => {
                  console.error(`Failed to upload ${filePath}:`, e);
                  return {file: filePath, success: false, error: e};
                });
            })
          );
        }
      });

      if (filePromises.length === 0) {
        this.isUploading = false;
        this.uploadSuccess = false;
        this.uploadMessage = "No files found in ZIP.";
        this.toastService.simpleAlertToast('ZIP file is empty or contains only directories', 3000);
        return;
      }

      Promise.all(filePromises)
        .then(async (results) => {
          const successCount = results.filter(r => r.success).length;
          const failCount = results.length - successCount;
          this.uploadSuccess = results.every(res => res.success);
          
          // Update map_list.json if upload was successful and we found map folders
          if (this.uploadSuccess && mapFolders.size > 0) {
            try {
              // Get current map list from Firebase Storage
              const currentMapList = await firstValueFrom(this.databaseService.getMapListFromStorage()) || [];
              
              // Merge new map folders with existing list (avoid duplicates)
              const updatedMapList = [...new Set([...currentMapList, ...Array.from(mapFolders)])].sort();
              
              // Update map_list.json in Firebase Storage
              await this.databaseService.updateMapListInStorage(updatedMapList);
              
              // Refresh map list in DataService
              this.dataService.getSubfolderNames().subscribe((result) => {
                this.dataService.map_header_list = result;
                this.dataService.map_list = result;
                console.log('Map list refreshed:', result);
              });
              
              this.uploadMessage = `Upload successful! ${successCount} file(s) uploaded. ${mapFolders.size} map(s) added.`;
              this.toastService.simpleToast(`ZIP extracted and uploaded successfully! ${successCount} file(s) uploaded. ${mapFolders.size} map(s) added.`, 3000);
              console.log('Uploaded files:', uploadedFiles);
              console.log('Map folders found:', Array.from(mapFolders));
            } catch (error) {
              console.error('Error updating map_list.json:', error);
              // Still show success for file uploads even if map_list update failed
              this.uploadMessage = `Upload successful! ${successCount} file(s) uploaded. (Map list update failed)`;
              this.toastService.simpleToast(`ZIP extracted and uploaded successfully! ${successCount} file(s) uploaded.`, 3000);
            }
          } else if (this.uploadSuccess) {
            this.uploadMessage = `Upload successful! ${successCount} file(s) uploaded to Firebase Storage.`;
            this.toastService.simpleToast(`ZIP extracted and uploaded successfully! ${successCount} file(s) uploaded to Firebase Storage.`, 3000);
            console.log('Uploaded files:', uploadedFiles);
          } else {
            this.uploadMessage = `${successCount} succeeded, ${failCount} failed.`;
            const failed = results.filter(res => !res.success).map(res => res.file).join(', ');
            this.toastService.simpleAlertToast(`Some files failed: ${failed}`, 4000);
            console.error('Failed files:', results.filter(r => !r.success));
          }
          
          this.isUploading = false;
        })
        .catch(e => {
          this.isUploading = false;
          this.uploadSuccess = false;
          this.uploadMessage = "Upload failed.";
          this.toastService.simpleAlertToast('Failed to extract/upload files', 2500);
          console.error('Upload error:', e);
        });

    }).catch((err:any) => {
      this.isUploading = false;
      this.uploadSuccess = false;
      this.uploadMessage = "Zip extraction failed.";
      this.toastService.simpleAlertToast('Failed to read zip file', 2500);
      console.error('ZIP read error:', err);
    });
  }).catch((err:any) => {
    this.isUploading = false;
    this.uploadSuccess = false;
    this.uploadMessage = "JSZip not available.";
    this.toastService.simpleAlertToast('JSZip library missing', 2500);
    console.error('JSZip import error:', err);
  });

  }


  /**
   * IO
   */


  start_zoom:any
  start_pan:any;
  map_w = 0
  map_h = 0
  scale_factor = 1;
  target_width = 1920;
  use_prox = false;
  originalImage?: fabric.Image;
  scaledImage?: fabric.Image;
  // minimap
  canvas_minimap?: fabric.Canvas;
  minimap_rect?: fabric.Rect;
  minimap_scale = 0.1;
  minimap_w = 220;
  minimap_h = 160;

  /**
   * Get Firebase Storage download URL for a map image
   * @param mapName Name of the map
   * @param extension File extension (default: '.png')
   * @returns Promise with download URL string
   */
  async getMapImageURL(mapName: string, extension: string = '.png'): Promise<string> {
    const storagePath = `${this.dataService.map_preflix}${mapName}/${mapName}${extension}`;
    return await this.databaseService.getDownloadURL(storagePath);
  }

  /* Create a new map project */
  new_map(){
      this.canvas?.clear()
      this.canvas_control?.clear()

      console.log('current map: ', this.dataService.current_map);

      /* Import a new map */
      if (this.dataService.current_map === 'new_map'){
        this.dataService.current_map = ''
        console.log('importing new map');
      }
      /* Import an existing map */
      else{
        var ext = '.png'
        // Get Firebase Storage URL instead of local path
        this.getMapImageURL(this.dataService.current_map, ext).then((imageURL) => {
          // Set crossOrigin to 'anonymous' to allow canvas export without CORS taint
          fabric.Image.fromURL(imageURL, (img: fabric.Image) => {
            // console.log('w & h: ', img.width, img.height );
            if (this.canvas && img.width && img.height){
              // img.scaleToWidth(img.width/2);
              // this.map_w = img.width/4
              // this.map_h = img.height/4
              this.scale_factor = this.target_width/img.width
              this.map_w = img.width
              this.map_h = img.height
              this.canvas?.setWidth(this.target_width)
              this.canvas?.setHeight(img.height*this.scale_factor)
              // this.map_w = img.width/4
              // this.map_h = img.height/4
              // this.canvas?.setWidth(this.map_w)
              // this.canvas?.setHeight(this.map_h)

              this.start_zoom = this.canvas?.getZoom();
              this.current_zoom = this.canvas.getZoom();
              this.start_pan = this.canvas?.viewportTransform;
              this.current_pan = this.canvas?.viewportTransform;
              // img.set({ selectable: false });
              this.canvas?.setBackgroundImage(img, this.canvas.renderAll.bind(this.canvas));
        
              // initize the mInverse for mouse position calculation of poly draw mouse event
              var mCanvas:any = this.canvas?.viewportTransform;
              this.mInverse = fabric.util.invertTransform(mCanvas);

              // init minimap with the full map URL
              this.initMiniMap(imageURL);
              this.updateMiniMapView();
            }
          }, { crossOrigin: 'anonymous' });
        }).catch((error) => {
          console.error('Error getting map image URL:', error);
          this.toastService.simpleAlertToast(`Failed to get map URL: ${this.dataService.current_map}`, 3000);
        });
      }

  }

  /* Toggle the scaled image */
  use_scaled_image = false;
  toggle_scaled_image(){
    if (this.scaledImage && this.originalImage){
      if (this.use_scaled_image){
        this.use_scaled_image = false;
        console.log('use original image');
        this.toastService.simpleToast('Use original image', 2000)
        this.canvas?.setBackgroundImage(this.originalImage , this.canvas.renderAll.bind(this.canvas));
      }
      else{
        this.use_scaled_image = true;
        console.log('use scaled image');
        this.toastService.simpleToast(`Use scaled image, w: ${this.scaledImage?.width}, h: ${this.scaledImage?.height}`, 2000)
        this.canvas?.setBackgroundImage(this.scaledImage, this.canvas.renderAll.bind(this.canvas));
      }
    }
    

  }

  /**
   * Init minimap and sync view rectangle
   * @param mapURL Firebase Storage download URL or local path for background image
   */
  initMiniMap(mapURL:string){
    this.initMiniMapCanvas();
    if (!this.canvas_minimap || !this.canvas){ return; }
    this.minimap_scale = Math.min(this.minimap_w / this.map_w, this.minimap_h / this.map_h);
    const miniW = this.map_w * this.minimap_scale;
    const miniH = this.map_h * this.minimap_scale;
    this.canvas_minimap.setWidth(miniW);
    this.canvas_minimap.setHeight(miniH);

    // Set crossOrigin to 'anonymous' to allow canvas export without CORS taint
    fabric.Image.fromURL(mapURL, (img: fabric.Image) => {
      img.set({ selectable: false });
      img.scaleToWidth(miniW);
      img.scaleToHeight(miniH);
      this.canvas_minimap?.setBackgroundImage(img, this.canvas_minimap.renderAll.bind(this.canvas_minimap));
    }, { crossOrigin: 'anonymous' });

    if (!this.minimap_rect){
      this.minimap_rect = new fabric.Rect({
        left: 0,
        top: 0,
        width: 40,
        height: 40,
        fill: 'rgba(255,0,0,0.1)',
        stroke: 'red',
        strokeWidth: 2,
        selectable: true,
        hasControls: false,
        lockScalingFlip: true,
        lockScalingX: true,
        lockScalingY: true,
        objectCaching: false,
        name: 'mini_view'
      });
      this.canvas_minimap.add(this.minimap_rect);
      this.canvas_minimap.on('object:moving', () => { this.handleMiniMapDrag(); });
    }
    this.updateMiniMapView();
  }

  /**
   * Update the minimap viewport rectangle based on main canvas transform
   */
  updateMiniMapView(){
    if (!this.canvas || !this.canvas_minimap || !this.minimap_rect || !this.canvas.viewportTransform){ return; }
    const vpt = this.canvas.viewportTransform;
    const scaleX = vpt[0];
    const scaleY = vpt[3];
    const offsetX = vpt[4];
    const offsetY = vpt[5];
    const viewW = this.canvas.getWidth() / scaleX;
    const viewH = this.canvas.getHeight() / scaleY;
    const mapX = -offsetX / scaleX;
    const mapY = -offsetY / scaleY;

    const miniX = mapX * this.minimap_scale;
    const miniY = mapY * this.minimap_scale;
    const miniW = viewW * this.minimap_scale;
    const miniH = viewH * this.minimap_scale;

    this.minimap_rect.set({
      left: miniX,
      top: miniY,
      width: miniW,
      height: miniH
    });
    this.minimap_rect.setCoords();
    this.canvas_minimap.requestRenderAll();
  }

  /**
   * Handle dragging the minimap viewport rectangle to pan main canvas
   */
  handleMiniMapDrag(){
    if (!this.canvas || !this.canvas_minimap || !this.minimap_rect || !this.canvas.viewportTransform){ return; }
    const vpt = this.canvas.viewportTransform;
    const scaleX = vpt[0];
    const scaleY = vpt[3];

    // Clamp rect inside minimap
    const maxX = this.canvas_minimap.getWidth() - this.minimap_rect.width!;
    const maxY = this.canvas_minimap.getHeight() - this.minimap_rect.height!;
    this.minimap_rect.left = Math.max(0, Math.min(this.minimap_rect.left || 0, maxX));
    this.minimap_rect.top = Math.max(0, Math.min(this.minimap_rect.top || 0, maxY));

    const mapX = (this.minimap_rect.left || 0) / this.minimap_scale;
    const mapY = (this.minimap_rect.top || 0) / this.minimap_scale;

    vpt[4] = -mapX * scaleX;
    vpt[5] = -mapY * scaleY;
    this.canvas.setViewportTransform(vpt);
    this.canvas.requestRenderAll();
    this.canvas_minimap.requestRenderAll();
  }

  /* Export snapshot of the current map */
  isExporting = false
  export(canvas_name:string, scale:number, file_name:string){
    setTimeout(() =>
    {
      // Use fabric.js canvas directly instead of html2canvas to avoid CORS issues
      const fabricCanvas = canvas_name === 'canvas_1' ? this.canvas : this.canvas_control;
      if (fabricCanvas) {
        // Export canvas directly using fabric.js toDataURL method
        const dataURL = fabricCanvas.toDataURL({
          format: 'png',
          quality: 1,
          multiplier: scale
        });
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = `${file_name}.png`;
        link.click();
        this.isExporting = false;
      } else {
        // Fallback to html2canvas if fabric canvas not available
        html2canvas(document.getElementById(canvas_name) as HTMLElement, {
          scale: scale, 
          backgroundColor: null,
          useCORS: true, // Enable CORS for cross-origin images
          allowTaint: false // Don't allow tainted canvas
        }).then(canvas => {
          const link = document.createElement('a');
          link.href = canvas.toDataURL('image/png');
          link.download = `${file_name}.png`;
          link.click();
          this.isExporting = false;
        }).catch((error) => {
          console.error('Error exporting with html2canvas:', error);
          this.toastService.simpleAlertToast('Failed to export: CORS issue with cross-origin images', 3000);
          this.isExporting = false;
        });
      }
    },
    3000);
  }
  export2DB(canvas_name:string, scale:number, file_name:string){
    setTimeout(() =>
    {
      // Use fabric.js canvas directly instead of html2canvas to avoid CORS issues
      const fabricCanvas = canvas_name === 'canvas_1' ? this.canvas : this.canvas_control;
      if (fabricCanvas) {
        // Export canvas directly using fabric.js toDataURL method
        const dataURL = fabricCanvas.toDataURL({
          format: 'png',
          quality: 1,
          multiplier: scale
        });

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
      } else {
        // Fallback to html2canvas if fabric canvas not available
        html2canvas(document.getElementById(canvas_name) as HTMLElement, {
          scale: scale, 
          backgroundColor: null,
          useCORS: true, // Enable CORS for cross-origin images
          allowTaint: false // Don't allow tainted canvas
        }).then(canvas => {
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
        }).catch((error) => {
          console.error('Error exporting with html2canvas:', error);
          this.toastService.simpleAlertToast('Failed to export: CORS issue with cross-origin images', 3000);
          this.isExporting = false;
        });
      }
    },
    1000);
  }


  /* Save a new ver of the current map to DB */
  save_map(){
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

      if (this.dataService.current_map){
        var ext = '.png'
        // Get Firebase Storage URL instead of local path
        this.getMapImageURL(this.dataService.current_map, ext).then((imageURL) => {
          this.initMiniMap(imageURL);
          this.updateMiniMapView();
        }).catch((error) => {
          console.error('Error getting map image URL in load():', error);
        });
      }

    } catch (error) {
      console.error('Error downloading JSON file:', error);
      throw error;
    }

  }

  export_base_map(){
    /*
    Export the base map
    */
    if (this.dataService.current_map){
      this.isExporting = true;

      // Get the background image URL to set it on canvas_control with proper CORS
      const ext = '.png';
      this.getMapImageURL(this.dataService.current_map, ext).then((imageURL) => {
        // Load background image with crossOrigin for canvas_control
        fabric.Image.fromURL(imageURL, (bgImg: fabric.Image) => {
          // Copy canvas content to canvas_control
          this.canvas_control?.loadFromJSON(JSON.stringify(this.canvas?.toJSON(["object_type", "name"])), () => {
            // Set background image with proper CORS handling
            this.canvas_control?.setBackgroundImage(bgImg, () => {
              this.canvas_control?.setWidth(this.map_w);
              this.canvas_control?.setHeight(this.map_h);
              
              setTimeout(() => {
                // hide the station and zone objects
                this.canvas_control?.getObjects().forEach(item => {
                  console.log('check object_type', (item as any).object_type);
                  if(item.hasOwnProperty('object_type')){
                    if ((item as any).object_type.includes('station') || (item as any).object_type.includes('zone')){
                      item.set('fill', 'transparent');
                      item.set('stroke', 'transparent');
                    }
                    else{
                      item.set('stroke', 'transparent');
                    }
                  }
                });
                this.canvas_control?.renderAll();
                
                // Export the base map using fabric.js toDataURL directly
                try {
                  if (this.canvas_control) {
                    const dataURL = this.canvas_control.toDataURL({
                      format: 'png',
                      quality: 1,
                      multiplier: 1
                    });
                    const link = document.createElement('a');
                    link.href = dataURL;
                    link.download = `${this.dataService.current_map}_base_map.png`;
                    link.click();
                    this.isExporting = false;
                  }
                } catch (error: any) {
                  console.error('Error exporting base map:', error);
                  if (error.message && error.message.includes('tainted')) {
                    this.toastService.simpleAlertToast('Export failed: Canvas is tainted. Please check Firebase Storage CORS settings.', 4000);
                  } else {
                    this.toastService.simpleAlertToast('Failed to export base map', 3000);
                  }
                  this.isExporting = false;
                }
              }, 500);
            });
          });
        }, { crossOrigin: 'anonymous' });
      }).catch((error) => {
        console.error('Error getting map image URL for export:', error);
        this.toastService.simpleAlertToast('Failed to load map image for export', 3000);
        this.isExporting = false;
      });
    }
  }

  /**
   * 保存站点信息到数据库
   */
  save_station(){
    if (this.dataService.current_map){
      var map_name = this.dataService.current_map
      var station_list:any = []

      this.canvas?.getObjects().forEach( item  =>{
        console.log("======== station item ========", item);
        // if (item.strokeWidth === 2 && item instanceof fabric.Circle){ // 4 => station
        // if ( item.hasOwnProperty('object_type') && (item as any).object_type.includes('station') && item instanceof fabric.Circle){
        if ( item.hasOwnProperty('object_type') && (item as any).object_type.includes('station') && (item as any).name !== undefined){

          var connect_to_map = false;
          // check if the station is connected to the map(some station may not be connected to another map)
          if ((item as any).radius === 12){ // 12 is the radius of the station on the map
            connect_to_map = true;
          }

          // 获取站点类型，如果没有则默认为'station_add'
          var station_type = (item as any).station_type || 'station_add';

          if (item.type === 'group'){
            console.log('******* station grp *******');

            var matrix = item.calcTransformMatrix();
            // Get the target and pre position of the station
            // Find circle1 (pre-pose) and circle2 (target-pose) from the group
            var circle1: any = null;
            var circle2: any = null;
            var cir1_radius = 10; // size of circle1
            var cir2_radius = 10; // size of circle2
            var cir2_offset_y = 30; // offset of circle2

            if (item instanceof fabric.Group) {
              item.getObjects().forEach((obj: any) => {
                if (obj.name === 'pre-pose' && obj instanceof fabric.Circle) {
                  circle1 = obj;
                  cir1_radius = obj.radius || 10;
                } else if (obj.name === 'target-pose' && obj instanceof fabric.Circle) {
                  circle2 = obj;
                  cir2_radius = obj.radius || 10;
                }
              });
            }

            // Calculate local coordinates of circle centers relative to group origin
            // In Fabric.js groups, objects have local coordinates relative to the group
            var pre_pos_local: fabric.Point;
            var target_pos_local: fabric.Point;

            if (circle1 && circle2) {
              // Circle center in local coordinates: left + radius, top + radius
              pre_pos_local = {
                x: (circle1.left || 0) + cir1_radius,
                y: (circle1.top || 0) + cir1_radius
              } as fabric.Point;

              target_pos_local = {
                x: (circle2.left || 0) + cir2_radius,
                y: (circle2.top || 0) + cir2_radius
              } as fabric.Point;
            } else {
              // Fallback: calculate based on known structure if circles not found
              // circle1 is at (0, 0) relative to group, circle2 is at (0, cir2_offset_y)
              pre_pos_local = {
                x: cir1_radius,
                y: cir1_radius
              } as fabric.Point;

              target_pos_local = {
                x: cir2_radius,
                y: cir2_offset_y + cir2_radius
              } as fabric.Point;
            }

            // Transform local coordinates to map coordinates using the group's transformation matrix
            var pre_cords = fabric.util.transformPoint(pre_pos_local, matrix);
            var target_cords = fabric.util.transformPoint(target_pos_local, matrix);

            console.log('pre_pos_local: ', pre_pos_local);
            console.log('target_pos_local: ', target_pos_local);
            console.log('pre_cords (map): ', pre_cords);
            console.log('target_cords (map): ', target_cords);

            station_list.push({
              station_name: item.name,
              target_pos: [target_cords.x, target_cords.y],
              pre_pos: [pre_cords.x, pre_cords.y],
              connect_to_map : connect_to_map,
              station_type : station_type // 保存站点类型
            })
            
          }
          else{
            console.log('******* station obj *******');
            console.log({
              'station_name': item.name, 
              'left': item.left,
              'top': item.top,
              'station_type': station_type,
              'connect_to_map': connect_to_map
            });
            // console.log('item to JSON', item.toJSON());
            // get the circle radius
            let cir_radius = 0;
            // Use type assertion to 'any' to avoid type errors about properties not existing on 'item'
            if ((item as any).radius !== undefined) {
              // Single circle, station_add, station_charging, or station_lift
              cir_radius = (item as any).radius;
            } else if ((item as any)._objects && (item as any)._objects.length > 0) {
              // If it's a group (e.g., station_unload group), try to find the first circle and get its radius
              for (const obj of (item as any)._objects) {
                if (obj.type === 'circle' && obj.radius !== undefined) {
                  cir_radius = obj.radius;
                  break;
                }
              }
            }
            station_list.push({
              station_name : item.name,
              pos : [(item.left || 0)+cir_radius, (item.top || 0)+cir_radius],
              connect_to_map : connect_to_map,
              station_type : station_type // 保存站点类型
            })
          }
        }
      })
      var data = {
        'map_name' : this.dataService.current_map,
        'station_list' : station_list
      }
      this.databaseService.updateMapData(data).then(()=>{
        this.toastService.simpleToast('Station list export successfully', 2000)
      })
    }
  }

  save_virtual_obstacles(is_check_convex:boolean=false){
    /*
    Export the virtual obstacles
    we only save the BLACK obstacles as list pf points, ideally they shall have less than 6 points
    */
    if (this.dataService.current_map){
      var map_name = this.dataService.current_map
      var obstacles_list:any = []
      var matrix_list:any = []
    
      this.canvas?.getObjects().forEach( item  =>{
        if (item.hasOwnProperty('object_type') && (item as any).object_type.includes('map_fix_black') && item instanceof fabric.Polygon){
        console.log('items', item.points);
        if (is_check_convex){  // check if the polygon is convex before saving
          if (this.dataService.check_convex_polygon(item.points as any[])){

            // transform the points (cover if user transformed the poly with fabric js UI)
            var matrix = item.calcTransformMatrix()
            var translatedPoints = item.points?.map(function(p) {
                return {
                    x: p.x - item.pathOffset.x,
                    y: p.y - item.pathOffset.y
                };
            });
            if (translatedPoints){
            for (var i = 0; i < translatedPoints.length; i++) {
                translatedPoints[i].x = matrix[0] * translatedPoints[i].x + matrix[2] * translatedPoints[i].y + matrix[4];
                translatedPoints[i].y = matrix[1] * translatedPoints[i].x + matrix[3] * translatedPoints[i].y + matrix[5];
            }

            obstacles_list.push(translatedPoints)
            // obstacles_list.push(item.points)
          }
          }
          else{
            console.log('The polygon with id ', item.name, ' is not a convex polygon');
            // Add a temporary red dot marker next to the non-convex polygon
            const markerDot = new fabric.Circle({
              radius: 12,
              fill: 'red',
              left: (item.left || 0) + 20,
              top: (item.top || 0),
              selectable: false,
              evented: false
            });
            this.canvas?.add(markerDot);
            this.canvas?.requestRenderAll();
            
            // Remove the marker after 20 seconds
            setTimeout(() => {
              this.canvas?.remove(markerDot);
              this.canvas?.requestRenderAll();
            }, 30000);
          }
        }
        else{
          var matrix = item.calcTransformMatrix()
          var translatedPoints = item.points?.map(function(p) {
              return {
                  x: p.x - item.pathOffset.x,
                  y: p.y - item.pathOffset.y
              };
          });
          if (translatedPoints){
          for (var i = 0; i < translatedPoints.length; i++) {
              translatedPoints[i].x = matrix[0] * translatedPoints[i].x + matrix[2] * translatedPoints[i].y + matrix[4];
              translatedPoints[i].y = matrix[1] * translatedPoints[i].x + matrix[3] * translatedPoints[i].y + matrix[5];
          }

          // obstacles_list.push(item.points)
          obstacles_list.push(translatedPoints)
          }}
        }
      })

      var data = {
        'map_name' : this.dataService.current_map,
        'obstacles_list' : obstacles_list,
        // 'matrix_list' : matrix_list
      }

      this.databaseService.updateVirtualObstaclesData(data).then(()=>{

        this.toastService.simpleToast('Virtual obstacles export successfully', 2000)
      })
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
    station_unload: false,
    station_charging: false,
    station_lift: false,
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
  is_lock_map_fix = false
  showDegEditor = false

  /* Lock map fix items */
  toggle_lock_map_fix(){
    // allow user to lock and unlock existing map-fix objects
    if (this.is_lock_map_fix === true){
      this.is_lock_map_fix = false;
      this.lock_map_fix_items(false)
    }
    else{
      this.is_lock_map_fix = true;
      this.lock_map_fix_items(true)
    }
  }
  lock_map_fix_items(isLock:boolean){
    console.log('object:', this.canvas?.getObjects())
    var all_items = this.canvas?.getObjects()
    if (isLock){
      // this.canvas?.discardActiveObject();
      if (all_items){
        for (let index = 0; index < all_items.length; index++) {
         if ((all_items[index] as any).object_type.includes('map_fix')){
          console.log('This is a map fix', all_items[index]);
          all_items[index].selectable = false; 
         }
        }
      }
    }
    else{
      if (all_items){
        for (let index = 0; index < all_items.length; index++) {
         if ((all_items[index] as any).object_type.includes('map_fix')){
          console.log('This is a map fix', all_items[index]);
          all_items[index].selectable = true; 
         }
        }
      }
    }
    this.canvas?.requestRenderAll();
  }

  crossMarks: fabric.Group[] = [];
  is_measure_mode = false;
  pixel_distance: number = 0;
  toggle_measure_mode(){
    // allow user to measure the distance btw 2 pins
    if (this.is_measure_mode === true){
      this.is_measure_mode = false;
    }
    else{
      this.is_measure_mode = true;
      this.pixel_distance = 0
    }
  }
  addCrossMark(x:any, y:any) {
    // add two transparent crossmark to calculate the distance between 2 pin on the canvas
    const crossMark = new fabric.Group([
      new fabric.Line([x - 10, y, x + 10, y], { stroke: 'black', strokeWidth: 0 }),
      new fabric.Line([x, y - 10, x, y + 10], { stroke: 'black', strokeWidth: 0 })
    ], {
      left: x,
      top: y,
      selectable: false
    });

    this.canvas?.add(crossMark);
    this.crossMarks.push(crossMark);

    if (this.crossMarks.length === 2) {
      this.calculateDistance();
      this.crossMarks = [] // reset the list
    }
  }
  calculateDistance() {
    const [firstMark, secondMark] = this.crossMarks;
    const dx = firstMark.left! - secondMark.left!;
    const dy = firstMark.top! - secondMark.top!;
    this.pixel_distance = Math.sqrt(dx * dx + dy * dy) * 5 / 100 ; // 5 is the res of 5 cm per pixel, 100 is to show meter as unit
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




  example_test_convex_polygon(){
    // test convex polygon
    console.log('test convex polygon');

    // var polygon = [{'x':0, 'y':1}, {'x':1, 'y':-1}, {'x':5, 'y':5}, {'x':3, 'y':5}] // convex
    // console.log(this.dataService.check_convex_polygon(polygon));
    // var polygon = [{'x':0, 'y':0}, {'x':1, 'y':0}, {'x':2, 'y':2}, {'x':0, 'y':2}] // convex
    // console.log(this.dataService.check_convex_polygon(polygon));
    // var polygon = [{'x':0, 'y':0}, {'x':1, 'y':0}, {'x':2, 'y':2}, {'x':1, 'y':1}, {'x':0, 'y':2}] // concave
    // console.log(this.dataService.check_convex_polygon(polygon));
    // var polygon = [{'x':0, 'y':0}, {'x':4, 'y':0}, {'x':4, 'y':4}, {'x':2, 'y':2}, {'x':0, 'y':4}] // concave
    // console.log(this.dataService.check_convex_polygon(polygon));
    // var polygon = [{'x':0, 'y':0}, {'x':1, 'y':0}, {'x':2, 'y':2}, {'x':0, 'y':2}]
    // console.log(this.dataService.check_convex_polygon(polygon));

    var test_points_ccw = [
      {
        x: 8047.473527889496,
        y: 4849.431887593557
      },
      {
        x: 8117.404403730849,
        y: 4758.612568319072
      },
      {
        x: 8101.056926261442,
        y: 4744.081477235155
      },
      {
        x: 8035.667016383813,
        y: 4839.441
      }
    ]
    var test_points_ccw_concave = [
      {
        x: 8047.473527889496,
        y: 4849.431887593557
      },
      {
        x: 8117.404403730849,
        y: 4758.612568319072
      },
      {
        x: 8217.404403730849,
        y: 4758.612568319072
      },
      {
        x: 8101.056926261442,
        y: 4744.081477235155
      },
      {
        x: 8035.667016383813,
        y: 4839.441
      }
    ]
    var test_points_cw = [
      {
        x: 8035.667016383813,
        y: 4839.441
      },
      {
        x: 8101.056926261442,
        y: 4744.081477235155
      },
      {
        x: 8117.404403730849,
        y: 4758.612568319072
      },
      {
        x: 8047.473527889496,
        y: 4849.431887593557
      }
    ]
    var test_points_concave_cw = [
      {
        x: 8035.667016383813,
        y: 4839.441
      },
      {
        x: 8101.056926261442,
        y: 4744.081477235155
      },
      {
        x: 8217.404403730849,
        y: 4758.612568319072
      },
      {
        x: 8117.404403730849,
        y: 4758.612568319072
      },
      {
        x: 8047.473527889496,
        y: 4849.431887593557
      }
    ]
    console.log('result ccw: ', this.dataService.check_convex_polygon(test_points_ccw));
    console.log('result cw: ', this.dataService.check_convex_polygon(test_points_cw));
    console.log('result ccw concave: ', this.dataService.check_convex_polygon(test_points_ccw_concave));
    console.log('result cw concave: ', this.dataService.check_convex_polygon(test_points_concave_cw));


  }





}
