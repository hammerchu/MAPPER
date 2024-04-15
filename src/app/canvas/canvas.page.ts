import { Component, OnInit, HostListener } from '@angular/core';
import { fabric } from 'fabric';
import html2canvas from 'html2canvas';
import {DataService} from '../service/data.service'
import {ToastService} from  '../service/toast-service.service'

@Component({
  selector: 'app-canvas',
  templateUrl: './canvas.page.html',
  styleUrls: ['./canvas.page.scss'],
})
export class CanvasPage implements OnInit {




  canvas?:fabric.Canvas
  wrapper= document.getElementById('canvasWrapper')
  imageUrl:any

  protected _points: Array<fabric.Circle>;
  protected _polylines: Record<string, fabric.Polyline>;

  constructor(public dataService: DataService,
    public toastService: ToastService) {

    this._points    = new Array<fabric.Circle>();
    this._polylines = {}
  }

  // draw polygons
  poly = false
  selected_obj:any
  polyline:any;
  mouseDown=false
  pts=[]
  lastPt=1
  polyType='Polyline'
  polyBtn:any
  bgColor='green';
  id=-1;

  // mouse action
  current_zoom:any
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

  ngOnInit() {
    var options = {
      backgroundColor: 'transparent',
      opacity: 0
    }
    this.canvas = new fabric.Canvas('myCanvas', options);

    // const text = new fabric.Textbox('Hello World', {
    //   width: 200,
    //   height: 100,
    //   fontSize: 24,
    //   cursorColor: 'blue',
    //   left: 200,
    //   top: 200
    // });

    // this.canvas.add(text);

    // const square = new fabric.Rect({
    //   width: 500,
    //   height: 500,
    //   fill: 'rgba(0, 0, 0, 0.5)',
    //   left: 100,
    //   top: 100
    // });

    // this.canvas.add(square);

    // const square2 = new fabric.Rect({
    //   width: 500,
    //   height: 500,
    //   fill: 'rgba(0, 0, 0, 1)',
    //   left: 600,
    //   top: 100
    // });

    // this.canvas.add(square2);


    // const circle = new fabric.Circle({
    //   radius: 250,
    //   fill: 'rgba(255, 0, 0, 0.4)',
    //   left: 100,
    //   top: 100
    // });

    // this.canvas.add(circle);


    // const rectangle = new fabric.Rect({
    //   width: 300,
    //   height: 50,
    //   fill: 'rgba(0,0 , 255, 0.4)',
    //   left: 200,
    //   top: 200
    // });

    // rectangle.set({
    //   fill: 'rgba(0, 255, 0, 0.4)',
    //   width: 250,
    //   height: 75
    // });

    // this.canvas.add(rectangle);
    // this.canvas.moveTo(text, 19);
    // this.canvas.moveTo(rectangle, 60);
    // this.canvas.moveTo(circle, 20);

    // this.canvas.on('object:selected', (event) => {
    //   const selectedObject = event.target;
    //   console.log('Selected object:', selectedObject);
    //   selectedObject?.set({
    //     fill: 'blue',
    //   });
    // });

    /* PAN */
    this.canvas.on('mouse:down', (opt)=> {
      var evt = opt.e;
      if (evt.shiftKey === true) {
        if (this.canvas){
          this.isDragging = true;
          this.selection = false;
          this.lastPosX = evt.clientX;
          this.lastPosY = evt.clientY;
        }
      }
    });
    this.canvas.on('mouse:move', (opt)=> {
      if (this.isDragging) {
        var e = opt.e;
        var vpt = this.canvas?.viewportTransform;
        if (vpt){
          vpt[4] += e.clientX - this.lastPosX;
          vpt[5] += e.clientY - this.lastPosY;
        }
        this.canvas?.requestRenderAll();
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
      }
      this.isDragging = false;
      this.selection = true;
    });

    /* ZOOM */
    this.canvas.on('mouse:wheel', (opt)=> {
      var delta = opt.e.deltaY;
      var zoom = this.canvas?.getZoom();
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
    });


    /**
     * Draw polygon
     */

    this.canvas.on('mouse:down', (opt)=> {
      var evt = opt.e;
      // Transform the mouse click by the inverse matrix
      var new_mouse_pos = fabric.util.transformPoint(({x: evt.clientX - 150, y: evt.clientY - 160 } as fabric.Point), this.mInverse);
      if (this.poly == true) {
        if (this.pts.length > 1) {
          this.pts.splice(-1,1);
        } //remove duplicate start points
        var fill_color = "rgb(150, 150, 150)"
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
    });
    this.canvas.on('mouse:move', (opt)=> {
      var evt = opt.e;
      var new_mouse_pos = fabric.util.transformPoint(({x: evt.clientX - 150 , y: evt.clientY - 160} as fabric.Point), this.mInverse);

      let mouse = this.canvas?.getPointer(opt.e);
      if (this.poly == true && this.mouseDown) {
        // this.polyline.points[this.lastPt-1] = {x: (evt.clientX+150)*this.current_zoom, y: (evt.clientY+160)*this.current_zoom};
        this.polyline.points[this.lastPt-1] = new_mouse_pos;
        this.canvas?.renderAll();
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
          strokeWidth:1,
          originX:'center',
          originY:'center',
          selectable:true
        });
      this.canvas?.add(polyObj);
      this.poly=false;
      this.polyBtn='';
      this.lastPt=1;
      this.mouseDown=false;
      this.pts=[];

      for (const key of Object.keys(this.activeMode)) {
        // console.log(' key : ', key, (this.activeMode as any)[key] );
        if ( (this.activeMode as any)[key]){
          if (key.startsWith('zone')){
            if (key !== "zone_red"){ // !!! hardcord that only zone_red has no gradient
              this.setGradient(polyObj, 0, this.active_color);
              console.log(' polyObj : ', polyObj );
            }
            this.dataService.zone_obj.push(polyObj) // zone_item has additional param of deg
          }
          else if (key.startsWith('map')){
            this.dataService.map_fix_obj.push(polyObj)
          }
          else if (key.startsWith('station')){
            this.dataService.station_obj.push(polyObj)
          }
        }
      }
    }); //end dblclick

    /* select and deselect obj */
    this.canvas.on('selection:created', () => {
      this.selected_obj = this.canvas?.getActiveObject();
      // console.log(' selected : ', this.selected_obj );
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

  }


  /**
   * Keyboard input
   */
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
  }





  /**
   * IO
   */


  start_zoom:any
  start_pan:any;
  map_w = 0
  map_h = 0
  /* Load map from DB */
  load_map(){
    if (this.dataService.current_map){
      const canvasElement: HTMLCanvasElement = document.getElementById('myCanvas') as HTMLCanvasElement;
      const full_map_path = `${this.dataService.map_preflix}${this.dataService.current_map}`
      fabric.Image.fromURL(full_map_path, img => {
        // console.log('w & h: ', img.width, img.height );
        if (img.width && img.height){
          this.map_w = img.width
          this.map_h = img.height
          this.canvas?.setWidth(this.map_w)
          this.canvas?.setHeight(this.map_h)
          this.start_zoom = this.current_zoom = this.canvas?.getZoom();
          this.start_pan = this.current_pan = this.canvas?.viewportTransform;
          img.set({ selectable: false });
          this.canvas?.setBackgroundImage(img, this.canvas.renderAll.bind(this.canvas));
        }
      });
    }
  }

  /* Export snapshot of the current map */
  export(){
    // reset the zoom and pan
    if (this.start_zoom && this.start_pan){
      this.canvas?.setZoom(this.start_zoom)
      this.canvas?.setViewportTransform(this.start_pan);
    }
    if (this.canvas?.backgroundImage){
      this.canvas?.setBackgroundImage(this.canvas?.backgroundImage, this.canvas.renderAll.bind(this.canvas), {
        opacity: 0
      });
    }

    setTimeout(() =>
    {
        html2canvas(document.getElementById('myCanvas') as HTMLElement, {backgroundColor:null}).then(canvas => {
          const link = document.createElement('a');
          link.href = canvas.toDataURL('image/png', {format: 'png'});
          link.download = 'result.png';
          link.click();
        });
    },
    1000);

    if (this.canvas?.backgroundImage){
      this.canvas?.setBackgroundImage(this.canvas?.backgroundImage, this.canvas.renderAll.bind(this.canvas), {
        opacity: 1
      });
    }
  }


  /* Save a new ver of the current map to DB */
  save(){
    // reset the zoom and pan
    // this.canvas?.setZoom(this.start_zoom)
    // this.canvas?.setViewportTransform(this.start_pan);
    // setTimeout(() =>
    // {
    //    // save data to DB
    // },
    // 1000);
  }

  load(){
    // this.canvas.loadFromJSON(json, function() {
    //   canvas.renderAll();
    // });
  }


  /**
   * UI UX
   */
  active_color = 'white'
  active_stroke_color= 'white'
  activeMode = {
    map_fix_white: false,
    map_fix_black: false,
    zone_red: false,
    zone_cross_road: false,
    station_add: false,
  }
  polygon_color = {
    map_fix_white: 'white',
    map_fix_black: 'black',
    zone_red: "rgb(255, 0, 0, 0.7)",
    // zone_cross_road: "rgb(150, 0, 0, 0.7)",
    zone_cross_road: [
      { offset: 0, color: "rgb(255, 0, 0, 0.7)" },
      { offset: 1, color: "rgb(0, 0, 0, 0.7)"},
    ],
  }
  stroke_color = {
    map_fix_white: "rgb(240, 240, 240)",
    map_fix_black: "transparent",
    zone_red: "transparent",
    zone_cross_road: "transparent",
  }
  editMode = false
  showDegEditor = false

  unlock(){
    if (this.editMode === true){
      this.editMode = false;
    }
    else{
      this.editMode = true;
    }
  }

  // turn on different editor mode
  toggleActiveMode(mode_index:string){
    if (this.poly === true){
      this.poly = false;
    }
    else{
      this.poly = true;
    }
    for (const key of Object.keys(this.activeMode)) {
      let value = (this.activeMode as any)[key];
      console.log(key, value );
      if (key === mode_index){
        (this.activeMode as any)[key] = true;
        this.active_color = (this.polygon_color as any)[key]
        this.active_stroke_color = (this.stroke_color as any)[key]
      }
      else{
        (this.activeMode as any)[key] = false;
      }
    }
    console.log(' activeMode : ', this.activeMode );
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




  /**
   * Control map functions
   */
  /* config the color of polygon for control map, or reverse it back for editor */
  process_map(for_control=true){
    if(for_control){

    }
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
    obj.set('fill', new fabric.Gradient({
      //gradient options
      type: 'linear',
      gradientUnits: 'pixels', // or 'percentage'
      coords: this.convertDegreeToCoords(angle, obj.width, obj.height ),
      colorStops:colors
    }));
  }


}
