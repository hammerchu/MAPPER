import { Component, OnInit, HostListener } from '@angular/core';
import { fabric } from 'fabric';
import html2canvas from 'html2canvas';
import {DataService} from '../service/data.service'
import {ToastService} from  '../service/toast-service.service'

@Component({
  selector: 'app-sandbox',
  templateUrl: './sandbox.page.html',
  styleUrls: ['./sandbox.page.scss'],
})
export class SandboxPage implements OnInit {

  canvas?:fabric.Canvas

  imgPath = 'https://cdn.sstatic.net/Sites/stackoverflow/company/img/logos/so/so-icon.png'
  imgColor = 'grey'
  pattern?:fabric.Pattern
  angle = 1
  obj:any

  circle?:fabric.Circle
  square?:fabric.Rect
  text?:fabric.Textbox;

  constructor() { }

  ngOnInit() {
    this.canvas = new fabric.Canvas('myCanvas', {backgroundColor: 'pink'})


    this.canvas.on('selection:created', () => {
      this.obj = this.canvas?.getActiveObject();
      console.log(' selected : ', this.obj );

    });


    this.text = new fabric.Textbox('Hello World', {
      width: 200,
      height: 100,
      fontSize: 24,
      cursorColor: 'blue',
      left: 200,
      top: 200
    });



    var grad = new fabric.Gradient({
      //gradient options
      type: 'linear',
      gradientUnits: 'percentage', // or 'percentage'
      coords: { x1: 0, y1: 0, x2: 0.8, y2: 0 },
      colorStops:[
        { offset: 0, color: 'red' },
        { offset: 1, color: 'black'}
      ]
    })

    this.circle = new fabric.Circle({
      left: 100,
      top: 100,
      radius: 50,
      fill: grad
    });

    this.square = new fabric.Rect({
      width: 500,
      height: 500,
      // fill: grad,
      left: 600,
      top: 100
    });


    this.canvas.add(this.circle);
    this.canvas.add(this.square);
    this.canvas.add(this.text);

    this.ffy()

  }

  angle2rect(angle:any,sx:any, sy:any){
    while(angle < 0) angle += 360; angle %= 360;

    var a = sy, b = a+sx, c = b+sy, p = (sx+sy)*2, rp = p/360;
    var pp = Math.round( ( (angle*rp)+(sy/2) )%p);

    if(pp <= a) return { x:0,  y:sy - pp };
    if(pp <= b) return { y:0,  x:pp - a  };
    if(pp <= c) return { x:sx, y:pp - b  };


    return { y:sy, x:sx - ( pp - c ) };
  }

  angle2circle(angle:any,radius:any){

    var deg2rad = Math.PI/180;
    var rad2deg = 180/Math.PI;

    var a = (angle + 180) * deg2rad;
    return { x: Math.round( (Math.cos(a)+1)*radius ),
             y: Math.round( (Math.sin(a)+1)*radius )
    };
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
    if (coords){
      const x1 = coords.x1;
      const y1 = coords.y1;
      const x2 = coords.x2;
      const y2 = coords.y2;
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
    else{
      return 0
    }

  }

  setGradient(obj:any, angle:any, colors:any){
    var odx = obj.width  >> 1, /* object center */
    ody = obj.height >> 1,
    gradient;

    // console.log(' obj.width : ', obj.width );
    // console.log(' obj.center : ', odx, ody );

    obj.set('fill', new fabric.Gradient({
      //gradient options
      type: 'linear',
      gradientUnits: 'pixels', // or 'percentage'
      coords: this.convertDegreeToCoords(angle,obj.width, obj.height ),
      colorStops:colors
    }));

    // this.canvas?.renderAll();

    console.log(' coords : ',this.angle, this.convertDegreeToCoords(this.angle,obj.width, obj.height ));

    return gradient; // for debug re-use
  }



  ffy(){
    console.log('process gradient');

    var colors = [
      { offset: 0, color: 'red' },
      { offset: 1, color: 'black'},

    ]
    // var grd = this.setGradient(this.circle, this.angle, colors);
    var grd = this.setGradient(this.square, this.angle, colors);

    if (this.square && this.square.width && this.square.height){

      var coord = this.convertDegreeToCoords(this.angle, this.square.width, this.square.height)
      var deg = this.calculateDegreeFromCoords(coord)
      this.text?.set('text', String(deg) )
      this.canvas?.renderAll();
    }
  }

}
