
class IDB {
    constructor(dbName, version) {
        this.dbName = dbName;
        let openDBRequest = indexedDB.open(dbName, version);
        return new Promise((resolve, reject) => {
            openDBRequest.onerror = (e) => { this.__handleNonSuccess(e, reject); };
            openDBRequest.onsuccess = (e) => {
                this.db = e.target.result;
                this.db.close();
                // console.log('db initiated successfully', e);
                return resolve(this);
            };
        });
    }


    /* -------------------------------------------- Private Methods ----------------------------------------------- */
    __handleNonSuccess(evt, reject) {
        evt.preventDefault();
        const err = evt.target.error;
        this.db.close();
        reject(err.message);
    }

    __openDB(reject) {
        let request = indexedDB.open(this.dbName);
        request.onerror = (e) => { this.__handleNonSuccess(e, reject); };
        request.onabort = (e) => { this.__handleNonSuccess(e, reject); };
        return request;
    }

    __openDBWithNexVersion() {
        return new Promise((resolve, reject) => {
            const Oreq = this.__openDB(this.dbName);
            Oreq.onsuccess = (e) => {
                let db = event.target.result;
                let newVersion = parseInt(db.version) + 1;
                db.close();
                let sr = indexedDB.open(this.dbName, newVersion);
                sr.onerror = (e) => { this.__handleNonSuccess(e, reject); };
                sr.onabort = (e) => { this.__handleNonSuccess(e, reject); };
                return resolve(sr);
            };
        });
    }

    __createTrans(storeNames, e, type) {
        const db = e.target.result;
        const transaction = db.transaction(storeNames, type);
        transaction.oncomplete = (event) => {
            db.close();
        };
        transaction.onabort = (e) => { throw (e); };
        transaction.onerror = (e) => { throw (e); };
        return transaction;
    }

    /* -------------------------------------------- Public Methods ------------------------------------------------ */
    addNewStore(storeName, keyPath, options = {
        index: '',
        indexKeyPath: '',
        unique: undefined
    }) {
        return new Promise(async (resolve, reject) => {
            let sr = await this.__openDBWithNexVersion(reject);
            /* Register Event handlers */
            sr.onupgradeneeded = (evt) => {
                let db2 = evt.target.result;
                let objectStore;
                try {
                    objectStore = db2.createObjectStore(storeName, { keyPath: keyPath, autoIncrement: true });
                    if (options.index) {
                        if (options.index instanceof Array) {
                            options.index.forEach(index => objectStore.createIndex(index, options.indexKeyPath || options.index, {
                                unique: options.unique
                            })
                            );
                        } else {
                            objectStore.createIndex(options.index, options.indexKeyPath || options.index, { unique: options.unique });
                        }
                    }
                } catch (e) {
                    return reject(e);
                }
                db2.transaction.onabort = (e) => { this.__handleNonSuccess(e, reject); };
                db2.transaction.onerror = (e) => { this.__handleNonSuccess(e, reject); };
                objectStore.transaction.oncomplete = (evt) => {
                    return resolve(evt.target);
                };
            };
            sr.onsuccess = (e) => {
                console.log('closing db...');
                e.target.result.close();
            };
        });
    }

    addRecords(records, stores = '') {
        return new Promise((resolve, reject) => {
            let request = this.__openDB(reject);
            request.onsuccess = (e) => {
                let objStore;
                let transaction;
                let db = e.target.result;
                try {
                    transaction = this.__createTrans(stores, e, 'readwrite');
                } catch (err) {
                    db.close();
                    reject(err);
                }
                objStore = transaction.objectStore(stores);
                records = (records instanceof Array) ? records : [records];
                records.forEach(record => {
                    let osReq = objStore.add(record);
                    osReq.onerror = (e) => { this.__handleNonSuccess(e, reject); };
                    osReq.onsuccess = (e) => {
                        // console.log('Added ' + JSON.stringify(e.target.result) + ' Successfully');
                        return resolve(e.target.result);
                    };
                });

            };
        });

    }

    get(storeNames, options = {
        value: null, // considered as primary key value if 'index' is not provided... else, considered as index value.
        index: null
    }) {
        return new Promise((resolve, reject) => {
            let request = this.__openDB(reject);
            request.onsuccess = (e) => {
                let osReq;
                try {
                    const os = this.__createTrans(storeNames, e, 'readonly').objectStore(storeNames);
                    if (options.index) {
                        osReq = os.index(options.index).get(options.value);
                    } else {
                        osReq = os.get(options.value);
                    }
                } catch (e) {
                    return reject(e);
                }
                osReq.onerror = (e) => { this.__handleNonSuccess(e, reject); };
                osReq.onsuccess = function (e) {
                    resolve(osReq.result);
                };
            };
        });
    }

    getAll(storeNames, options = {
        value: null, // primery Key Value
        index: null,
        onlyKeys: false,
        keyRange: {
            lowerBound: null,
            upperBound: null
        }
    }) {
        return new Promise((resolve, reject) => {
            let req = this.__openDB(reject);
            req.onsuccess = (e) => {
                const db = e.target.result;
                let resArr = [];
                let id;
                let os;
                try {
                    os = this.__createTrans(storeNames, e, 'readonly').objectStore(storeNames);
                    if (options.index) {
                        id = os.index(options.index);
                    }
                } catch (e) {
                    return reject(e);
                }
                let kr;
                if (options.keyRange) {
                    if (options.keyRange.lowerBound && options.keyRange.upperBound) {
                        kr = IDBKeyRange.bound(options.keyRange.lowerBound, options.keyRange.upperBound);
                    } else if (options.keyRange.lowerBound || options.keyRange.upperBound) {
                        let b = Object.keys(options.keyRange).filter(k => !!options.keyRange[k])[0];
                        kr = IDBKeyRange[b](options.keyRange[b]);
                    }
                }
                (id || os).openCursor(kr).onsuccess = (e) => {
                    let cursor = e.target.result;
                    if (cursor) {
                        resArr.push(options.onlyKeys ? cursor.key : cursor.value);
                        cursor.continue();
                    } else {
                        db.close();
                        return resolve(resArr);
                    }
                };
            };
        });
    }

    deleteRecords(storeNames, kpValue, index) {
        // remove records implementation.
        return new Promise((resolve, reject) => {
            let request = this.__openDB(reject);
            request.onsuccess = (e) => {
                let osReq;
                try {
                    const tx = this.__createTrans(storeNames, e, 'readwrite');
                    osReq = index ? tx.index(index).delete(kpValue) : tx.delete(kpValue);
                } catch (e) {
                    return reject(e);
                }
                osReq.onerror = function (e) { reject(e.target.error.message); };
                osReq.onsuccess = function (e) {
                    resolve(osReq.result);
                };
            };

        });
    }

    getObjStore(storeName, type) {
        return new Promise((resolve, reject) => {
            let Oreq = this.__openDB(reject);
            Oreq.onsuccess = (e) => {
                return resolve(this.__createTrans(storeName, e, type).objectStore(storeName));
            };
        });
    }

    deleteIndex(storeName, index) {
        return new Promise((resolve, reject) => {
            const r = this.__openDB(reject);
            r.onupgradeneeded = (e) => {
                const db = e.target.result;
                const tx = this.__createTrans(storeName, e, 'readwrite');
                tx.onsuccess = (e) => {
                    return resolve(e.target.result);
                };
                tx.objectStore(storeName).deleteIndex(index).onsuccess = (e) => {
                    resolve(e.target.result);
                };
            };
        });
    }

    createIndex(storeName, index, options = {
        indexKeyPath: null,
        unique: false
    }) {
        return new Promise(async (resolve, reject) => {
            const r = await this.__openDBWithNexVersion(reject);
            r.onupgradeneeded = (e) => {
                const tx = e.target.transaction;
                tx.objectStore(storeName).createIndex(index, options.indexKeyPath || index, {
                    unique: options.unique
                });
            };
            r.onsuccess = (e) => {
                e.target.result.close();
                return resolve(e.target);
            };
            r.onblocked = (e) => {
                console.log('blocked', e);
            };
        });
    }

    clearStore(storeName) {
        // delete Store implementation
        return new Promise(async (resolve, reject) => {
            resolve((await this.getObjStore(storeName, 'readwrite')).clear());
        });
    }

    deleteStore(storeName) {
        return new Promise(async (resolve, reject) => {
            let req;
            try {
                req = await this.__openDBWithNexVersion(reject);
            } catch (e) {
                return reject(e);
            }
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                db.deleteObjectStore(storeName);
            };
            req.onsuccess = (e) => {
                console.log('closing db...');
                e.target.result.close();
                return resolve(storeName + ' deleted.');
            };
        });
    }

    deleteBD() {
        // delete DB implementation
    }


    get currentVersion() {
        return new Promise((res, rej) => {
            const r = indexedDB.open(this.dbName);
            r.onsuccess = (e) => {
                res(e.target.result.version);
            };
        });
    }

    getLength(store) {
        return new Promise(async (res, rej) => {
            (await this.getObjStore(store)).count().onsuccess = (e) => { res(e.target.result); };
        });
    }
}

async function initDB(name) {
    return (await new IDB(name));
}