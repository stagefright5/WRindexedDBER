
function initiateIDB(dbName, version, objectStoreName, options) {
    let openDBRequest = indexedDB.open(dbName, version);
    let db;
    function handleNonSuccess(evt) {
        console.error('Operation on Db was unsuccessful', evt);
        // evt.target.result.close();
    }

    openDBRequest.onerror = handleNonSuccess;
    openDBRequest.onsuccess = function (e) {
        console.log('db opened successfully', e);
        db = event.target.result;
        db.close();
    };

    const addRecords = (arrayOfRecords = [], store = '') => {
        let request = indexedDB.open(dbName);
        request.onsuccess = function (e) {
            const objStore = e.target.result.transaction(store, 'readwrite').objectStore(store);
            arrayOfRecords.forEach(record => {
                objStore.add(record);
            });
        };
    };

    const addNewStore = (storeName, dbVersion = 0, keyPath) => {
        let request = indexedDB.open(dbName);
        request.onerror = handleNonSuccess;
        request.onabort = handleNonSuccess;
        request.onsuccess = function (event) {
            // Save the IDBDatabase interface 
            let db = event.target.result;
            let newVersion = parseInt(dbVersion) > parseInt(db.version) ? parseInt(dbVersion) : parseInt(db.version) + 1;
            db.close();
            console.log('v', newVersion);
            let sr = indexedDB.open(dbName, newVersion);
            /* Register Event handlers */
            sr.onerror = handleNonSuccess;
            sr.onupgradeneeded = function (evt) {
                let db2 = evt.target.result;
                let objectStore = db2.createObjectStore(storeName, keyPath ? {keyPath: keyPath} : { autoIncrement: true });
            };
            sr.onsuccess = function (e) {
                e.target.result.close();
            };
        };
    };
    return {
        // createObjStore: createObjStore,
        addRecords: addRecords,
        addNewStore: addNewStore,
        currentVersion: function () {
            return db.version;
        }
    };
}
let initiatedDB = initiateIDB('dbName');
// let dbName = document.querySelector('#dbName');
// let version = document.querySelector('#version');
// let btn = document.querySelector('#initiateDb').addEventListener('click', (e) => {
    //     initDB(dbName.value, version.value);
    // });
    // function initDB(dbName, value) {
        //     if (!initiatedDB) {
            //         initiatedDB = initiateIDB(dbName, value, 'store1', { keyPath: 'ssn' });
            //     }
            // }
            // function submitHandler(e) {
                //     let formData = {};
                //     Array.from((new FormData(e.target)).entries()).forEach(x => formData[x[0]] = x[1]);
//     initDB(formData);
// }
// function addRecs(obj) {
//     obj = [
//         { ssn: "444-44-4444", name: "Bill", age: 35, email: "bill@company.com" },
//         { ssn: "555-55-5555", name: "Donna", age: 32, email: "donna@home.org" }
//     ];
//     initiatedDB.addRecords(obj, 'store1');
// }

// openDBRequest.onupgradeneeded = (event) => {
//     console.log('onupgradeneeded', event);
//     db = event.target.result;
//     console.log('db created', db);
//     let objectStore = db.createObjectStore(objectStoreName, {
//         keyPath: options.keyPath
//     });
//     objectStore.transaction.oncomplete = function (event) {
//         console.log('objectStore creation complete', event);
//     };
// };