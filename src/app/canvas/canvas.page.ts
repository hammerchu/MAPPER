import { Component, OnInit, HostListener } from '@angular/core';
import { fabric } from 'fabric';
import html2canvas from 'html2canvas';
import {DataService} from '../service/data.service'

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

  constructor(public dataService: DataService) {
    this._points    = new Array<fabric.Circle>();
    this._polylines = {}
  }


  poly = false
  obj:any
  polyline:any;
  mouseDown=false
  pts=[]
  lastPt=1
  polyType='Polyline'
  polyBtn:any
  bgColor='green';
  id=-1;

  isDragging = false;
  selection = false;
  lastPosX = 0;
  lastPosY = 0;
  ngOnInit() {

    // const canvas = new fabric.Canvas('myCanvas');
    this.canvas = new fabric.Canvas('myCanvas');

    const text = new fabric.Textbox('Hello World', {
      width: 200,
      height: 100,
      fontSize: 24,
      cursorColor: 'blue',
      left: 50,
      top: 50
    });

    this.canvas.add(text);

    const circle = new fabric.Circle({
      radius: 50,
      fill: 'red',
      left: 100,
      top: 100
    });

    this.canvas.add(circle);

    const rectangle = new fabric.Rect({
      width: 100,
      height: 50,
      fill: 'blue',
      left: 200,
      top: 200
    });

    rectangle.set({
      fill: 'green',
      width: 250,
      height: 75
    });

    this.canvas.add(rectangle);

    this.canvas.on('object:selected', (event) => {
      const selectedObject = event.target;
      console.log('Selected object:', selectedObject);
      selectedObject?.set({
        fill: 'blue',
      });
    });

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
      }
      this.isDragging = false;
      this.selection = true;
    });
    this.canvas.on('mouse:wheel', (opt)=> {
      var delta = opt.e.deltaY;
      var zoom = this.canvas?.getZoom();
      if (zoom){
        zoom *= 0.999 ** delta;
        if (zoom > 20) zoom = 20;
        if (zoom < 0.01) zoom = 0.01;
        this.canvas?.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
        opt.e.preventDefault();
        opt.e.stopPropagation();
      }
    });


    /**
     * Draw polygon
     */

    this.canvas.on('mouse:down', (opt)=> {
      var evt = opt.e;
      // console.log(evt.clientX, evt.clientY );
      if (this.poly == true) {
        if (this.pts.length > 1) {
          this.pts.splice(-1,1);
        } //remove duplicate start points
        this.polyline = new fabric.Polyline(this.pts,{objectCaching:false, name:'temp',fill:'blue',stroke:'black',
          originX:'center',originY:'center',selectable:true});
          this.canvas?.add(this.polyline);
          this.polyline.points[this.pts.length] = {x: evt.clientX -150, y: evt.clientY-160};
          this.lastPt++;
          this.mouseDown=true;
        console.log('pt : ', JSON.stringify(this.pts) );
      }
    });

    this.canvas.on('mouse:move', (opt)=> {
      var evt = opt.e;
      let mouse = this.canvas?.getPointer(opt.e);
      if (this.poly == true && this.mouseDown) {
        this.polyline.points[this.lastPt-1] = {x: evt.clientX-150, y: evt.clientY-160};
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
          fill:this.bgColor,
          stroke:'black',
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
      // $('.toolBarTable td').removeClass('active');

    }); //end dblclick

    this.canvas.on('selection:created', () => {
      this.obj = this.canvas?.getActiveObject();
      console.log(' selected : ', this.obj );
    });
    this.canvas.on('selection:cleared', ()=> {
      this.obj = '';
    });




    //  //Remove using keyboard events
    // this.wrapper?.addEventListener('keyup', e => {
    //   if (
    //     // e.keyCode == 46 ||
    //     e.key == 'Delete' ||
    //     e.code == 'Delete' ||
    //     e.key == 'Backspace'
    //   ) {
    //     if (this.canvas && this.canvas.getActiveObject() !== null) {
    //       // if (this.canvas?.getActiveObject().isEditing) {
    //       //   return
    //       // }
    //       console.log(' this.canvas.getActiveObject() : ', this.canvas.getActiveObject() );
    //       if (this.canvas.getActiveObject() !== null){
    //         this.canvas?.remove(this.canvas.getActiveObject()!)
    //       }
    //     }
    //   }
    // })
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    console.log('  event.key : ',  event.key );
    if (event.key === 'Backspace'){
      if (this.canvas && this.canvas.getActiveObject() !== null) {
        // if (this.canvas?.getActiveObject().isEditing) {
        //   return
        // }
        console.log(' this.canvas.getActiveObject() : ', this.canvas.getActiveObject() );
        if (this.canvas.getActiveObject() !== null){
          this.canvas?.remove(this.canvas.getActiveObject()!)
        }
      }
    }
  }








  start_zoom:any
  start_pan:any;
  map_w = 0
  map_h = 0
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
          this.start_zoom = this.canvas?.getZoom();
          this.start_pan = this.canvas?.viewportTransform;
          // console.log(' start_pan : ', this.start_pan );
          // console.log(' start_zoom : ', this.start_zoom );
          img.set({ selectable: false });
          this.canvas?.setBackgroundImage(img, this.canvas.renderAll.bind(this.canvas));
        }
      });
    }
  }

  export(){
    // reset the zoom and pan
    this.canvas?.setZoom(this.start_zoom)
    this.canvas?.setViewportTransform(this.start_pan);
    setTimeout(() =>
    {
        html2canvas(document.getElementById('myCanvas') as HTMLElement).then(canvas => {
          const link = document.createElement('a');
          link.href = canvas.toDataURL('image/png');
          link.download = 'result.png';
          link.click();
        });
    },
    1000);
  }

  /**
   * For uploading map image
   */

  import(event: any) {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = (e: any) => {

      this.imageUrl = e.target.result;
      this.imageUrl
      this.loadImage();
    };
    reader.readAsDataURL(file);
  }

  loadImage() {
    if (this.imageUrl) {
      const canvasElement: HTMLCanvasElement = document.getElementById('canvas') as HTMLCanvasElement;
      fabric.Image.fromURL(this.imageUrl, img => {
        img.set({ selectable: false });
        this.canvas?.setBackgroundImage(img, this.canvas.renderAll.bind(this.canvas));
      });
    }
  }

  /**
   * Mode status
   */

  active_cross_road(){
    if (this.poly === true){
      this.poly = false;
    }
    else{
      this.poly = true;
    }
  }

  /**
   * keyboard input
   */



}
