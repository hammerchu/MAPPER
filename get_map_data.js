//
// Run this script to down firebase map_data to JSON and save it as nao_data.json
//
//

const {writeFileSync} = require('fs')

const { initializeFirebaseApp, backup } = require("firestore-export-import");
const serviceAccount = require("./src/environments/onbotbot-61640-firebase-adminsdk-6ldni-5d4e40d22a.json");

const JSONToFile = (obj, filename) =>
  writeFileSync(`${filename}.json`, JSON.stringify(obj, null, 2));



// OPTIONS
// const queryByName = (collectionRef) =>
//   collectionRef.where("isSubscribed", "==", true).get();
// const options = {
//   // for query
//   queryCollection: queryByName,
// };

// Initiate Firebase App
const firestore = initializeFirebaseApp(serviceAccount);

// EXPORTING

// normal
backup(firestore, "map_data").then((data) =>
  // console.log(JSON.stringify(data['map_data']['all_maps']))
  JSONToFile(data['map_data']['all_maps'], 'map_data')
);





// writes the object to 'testJsonFile.json'


// with query
// backup(firestore, "users", options).then((data) =>
//   console.log(JSON.stringify(data))
// );


/* run "node src/index.js" */
