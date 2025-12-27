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
        console.log('database service all_save_map_list : ', this.dataService.all_save_map_list );
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
  /* 
  Update map_data on DB - which will eventually be dowloaded to each BOT and used for navigation
  */
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
  
  
  /**
   * Get download URL from Firebase Storage path
   * @param storagePath Path in Firebase Storage (e.g., 'assets/maps/map_name/map_name.png')
   * @returns Promise with download URL string
   */
  getDownloadURL(storagePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const ref = this.afStorage.ref(storagePath);
      ref.getDownloadURL().subscribe({
        next: (url) => resolve(url),
        error: (err) => reject(err)
      });
    });
  }

  /**
   * Get map list from Firebase Storage (map_list.json)
   * @returns Observable of string array with map names
   */
  getMapListFromStorage(): Observable<string[]> {
    return new Observable((observer) => {
      const ref = this.afStorage.ref('assets/maps/map_list.json');
      ref.getDownloadURL().subscribe({
        next: (url) => {
          // Fetch the JSON file from the download URL
          fetch(url)
            .then(response => response.json())
            .then(data => {
              observer.next(data);
              observer.complete();
            })
            .catch(err => {
              console.error('Error fetching map_list.json:', err);
              // Return empty array if file doesn't exist
              observer.next([]);
              observer.complete();
            });
        },
        error: (err) => {
          console.error('Error getting map_list.json URL:', err);
          // Return empty array if file doesn't exist
          observer.next([]);
          observer.complete();
        }
      });
    });
  }

  /**
   * Update map_list.json in Firebase Storage
   * @param mapList Array of map names
   * @returns Promise that resolves when update is complete
   */
  updateMapListInStorage(mapList: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const jsonContent = JSON.stringify(mapList);
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const ref = this.afStorage.ref('assets/maps/map_list.json');
      
      ref.put(blob).then(() => {
        console.log('map_list.json updated in Firebase Storage');
        resolve();
      }).catch((err) => {
        console.error('Error updating map_list.json:', err);
        reject(err);
      });
    });
  }

  map_virtual_obstacles_data_list:any[] = [] //storing map virtual obstacles data
  /* 
  Update map_data on DB - which will eventually be dowloaded to each BOT and used for navigation
  */
  updateVirtualObstaclesData(data:any, ){
    return new Promise(async (resolve, reject) => {

      var already_run = false // prevent the infiniti trigger loop

      // download all the map data
      var records = this.afStore.collection('virtual_obstacles_data',ref => ref).valueChanges()
      .subscribe((record:any)=>{
      this.map_virtual_obstacles_data_list = record[0].virtual_obstacles_data;

      // add our new data into it
      // if (!already_run && this.map_station_data_list.length < 5){
      if (!already_run){
        already_run = true

        let index = this.map_virtual_obstacles_data_list.findIndex((item) => item.map_name === data.map_name);
        // Check if the object with the specified property value exists in the array
        if (index === -1) {
          // If not found, push a new object with the desired properties
          console.log("Adding new record");
          this.map_virtual_obstacles_data_list.push(data);
        } else {
          // If found, log a message indicating that the object already exists
          console.log("Replace existing record");
          this.map_virtual_obstacles_data_list[index] = data
        }        
        // Convert nested arrays to objects with numeric keys
        const processedData = this.map_virtual_obstacles_data_list.map(mapData => {
          return {
            ...mapData, // copy the mapData
            obstacles_list: mapData.obstacles_list.map((points: any[]) => {
              // Check if points is an array before using reduce
              if (!Array.isArray(points)) {
                return points;
              }

              // Convert array of points to object with numeric keys
              const pointsObj: { [key: string]: any } = {};
              points.forEach((point, index) => {

                // pointsObj[index.toString()] = point;
                pointsObj[index.toString()] = {x: point['x'], y: point['y']};
              });
              return pointsObj;
            })
          };
        });
        this.afStore.doc(`virtual_obstacles_data/all_maps`).set(
          {
            virtual_obstacles_data: processedData
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
