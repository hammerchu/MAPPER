import { Injectable } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Observable, Subscriber } from 'rxjs';
import { map, finalize, tap } from 'rxjs/operators';
import {ToastService} from  '../service/toast-service.service'
import {DataService} from  '../service/data.service'
import { initializeApp } from "firebase/app";
import { AngularFirestore, AngularFirestoreDocument } from '@angular/fire/compat/firestore';
import { AngularFireStorage, AngularFireUploadTask } from '@angular/fire/compat/storage';
import { AngularFireAuth } from '@angular/fire/compat/auth';




@Injectable(
  { providedIn: 'root'}
)
export class DatabaseService {

  public storageFileList: any[] = []
  afTask?: AngularFireUploadTask;

  constructor(
    public afStore: AngularFirestore,
    public afStorage: AngularFireStorage,

    public toastService: ToastService,
    public dataService: DataService,
    // public afTask: AngularFireUploadTask,
    public angularFireAuth: AngularFireAuth,
    public datepipe: DatePipe,) {
      //
      this.get_saved_map_list().subscribe((result:any)=>{
        this.dataService.all_save_map_list = result
        console.log(' this.dataService.save_map_list : ', this.dataService.all_save_map_list );
      })
     }

  /* GET SAVED FILES */
  get_saved_map_list(){
    return this.afStore.collection(
      'map_save_record',
      ref => ref.where('type', '==', 'save').orderBy('timestamp', 'desc')//.limit(30)
    ).valueChanges();
  }


  /* Upload control map to firestorage */
  get_ref_for_storage(filename:string){
    const storageRef = this.afStorage.ref('/control_maps');
    const fileRef = storageRef.child(filename);

    return fileRef
  }

  /* Save data to DB */
  save_map_to_DB(json:any, map_name:string, width:number, height:number){
    var time_stamp = this.datepipe.transform((new Date), 'yyyy-MM-dd_HH-mm-ss')
    var id =`${map_name}_${this.datepipe.transform((new Date), 'yyyy-MM-dd_HH-mm-ss')}`

    this.update_record(map_name, 'save', time_stamp, json, width, height).then(()=>{
      this.toastService.simpleToast(`${map_name} saved successfully`, 3000)
    }).catch((err)=>{
      this.toastService.simpleAlertToast(`Unable to save ${map_name}`, 3000)
    })
  }
  /* Update record on DB */
  update_record(map_name:string, type:string, timestamp:any, data:any, width:number, height:number, collectionName="map_save_record"){

    return new Promise(async (resolve, reject) => {
      var id =`${map_name}_${this.datepipe.transform((new Date), 'yyyy-MM-dd_HH-mm-ss')}`
    this.afStore.doc(`${collectionName}/${id}`).set(
      {
      map_name: map_name,
      type: type,
      timestamp: timestamp,
      data: data,
      width: width,
      height: height

      }
      ).then(result => {
        resolve(result);
      }).catch(err => {
        reject(err);
      });
    })
  }

  progressNum:any[] = [];
  isFileUploading = false;
  isFileUploaded = false;
  progressSnapshot:any;
  fileUploadedPath: Observable<any>[] = [];
  /* Upload file to a specific location at the storage */
  uploadfileToStorage(file: File, fileStoragePath: string){
    return new Promise(resolve => {
    this.progressNum = [];
    // for (const file of files) {
    // for (let i = 0; i < files.length; i++) {

    this.isFileUploading = true;
    this.isFileUploaded = false;
    const fileRef = this.afStorage.ref(fileStoragePath);
    this.afTask = this.afStorage.upload(fileStoragePath, file);

    this.progressNum.push(this.afTask.percentageChanges());

        this.progressSnapshot = this.afTask.snapshotChanges().pipe(
          finalize(() => {
            const filepath = fileRef.getDownloadURL();
            this.fileUploadedPath.push(filepath);
            this.isFileUploading = false;
            this.isFileUploaded = true;

            filepath.subscribe({
              next:(path) => {
              console.log('uploaded to filepath : ', path);
              resolve(path);
              },
              error:(error) => {
              console.log('ERROR', error);
              }
            });

          }),
          tap(snap => {
            console.log('snap', snap);
          })
        );
        this.progressSnapshot.subscribe((resp:any) => {
    })
    })
  }


  map_station_data_list:any[] = [] //storing map station data
  /* Update map_data on DB */
  updateMapData(data:any, ){
    return new Promise(async (resolve, reject) => {

      var already_run = false // prevent the infiniti trigger loop

      // download all the map data
      var records = this.afStore.collection('map_data',ref => ref).valueChanges()
      .subscribe((record:any)=>{
      console.log('A record[0].map_data : ', record, record[0].map_data );
      this.map_station_data_list = record[0].map_data;

      // add our new data into it
      // if (!already_run && this.map_station_data_list.length < 5){
      if (!already_run){
        already_run = true

        let index = this.map_station_data_list.findIndex((item) => item.map_name === data.map_name);
        // Check if the object with the specified property value exists in the array
        if (index === -1) {
          // If not found, push a new object with the desired properties
          console.log("Adding new record");
          this.map_station_data_list.push(data);
        } else {
          // If found, log a message indicating that the object already exists
          console.log("Replace existing record");
          this.map_station_data_list[index] = data
        }

        console.log(already_run, 'B this.map_station_data_list : ', this.map_station_data_list );
        this.afStore.doc(`map_data/all_maps`).set(
          {
          map_data : this.map_station_data_list
          },
          {merge: true})
        .catch(err => {
          reject(err);
        }).finally(()=>{
          resolve(true)
        });
      }

      })

    })
  }






}
