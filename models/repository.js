/////////////////////////////////////////////////////////////////////
// Class Repository
/////////////////////////////////////////////////////////////////////
// Provide CRUD operations on JSON file of data of a specific model
/////////////////////////////////////////////////////////////////////
// Author : Nicolas Chourot
// Lionel-Groulx College
// 2025
/////////////////////////////////////////////////////////////////////
import fs from "fs";
import * as utilities from "../utilities.js";
import { v1 as uuidv1 } from "uuid";
import CollectionFilter from "./collectionFilter.js";
import RepositoryCachesManager from "./repositoryCachesManager.js";
global.repositoryEtags = {};
global.jsonFilesPath = "jsonFiles";

export default class Repository {
    constructor(ModelClass, cached = true) {
        if (ModelClass == null) {
            throw new Error("Cannot instantiate a repository with a null model.");
        }
        this.objectsList = null;
        this.model = ModelClass;
        this.objectsName = ModelClass.getClassName() + "s";
        this.objectsFile = `./jsonFiles/${this.objectsName}.json`;
        this.errorMessages = [];
        this.cached = cached;
        this.initEtag();
    }
    valid() {
        return this.errorMessages.length == 0;
    }
    initEtag() {
        if (this.objectsName in global.repositoryEtags)
            this.ETag = global.repositoryEtags[this.objectsName];
        else this.newETag();
    }
    static getETag(modelName) {
        if (modelName in global.repositoryEtags)
            return global.repositoryEtags[modelName];
        else null;
    }
    newETag() {
        // include objects count in the returned Etag.
        // this is usefull when client want to check if 
        // the count of items has changed
        this.ETag = this.count() + "-" + uuidv1();
        global.repositoryEtags[this.objectsName] = this.ETag;
    }
    objects() {
        // Check if data is not already in memory
        if (this.objectsList == null)
            this.read();
        return this.objectsList;
    }
    count() {
        return this.objects().length;
    }
    read() {
        this.objectsList = null;
        if (this.cached) {
            this.objectsList = RepositoryCachesManager.find(this.objectsName);
        }
        if (this.objectsList == null) {
            try {
                let rawdata = fs.readFileSync(this.objectsFile);
                // we assume here that the json data is formatted correctly
                this.objectsList = JSON.parse(rawdata);
                if (this.cached)
                    RepositoryCachesManager.add(this.objectsName, this.objectsList);
            } catch (error) {
                if (error.code === 'ENOENT') {
                    // file does not exist, it will be created on demand
                    console.log(FgYellow, `Warning ${this.objectsName} repository does not exist. It will be created on demand`);
                    this.objectsList = [];
                } else {
                    console.log(FgRed, `Error while reading ${this.objectsName} repository`);
                    console.log(FgRed, '--------------------------------------------------');
                    console.log(FgRed, error);
                }
            }
        }
    }
    write() {
        this.newETag();
        fs.writeFileSync(this.objectsFile, JSON.stringify(this.objectsList));
        if (this.cached) {
            RepositoryCachesManager.add(this.objectsName, this.objectsList);
        }
    }
    createId() {
        if (this.model.securedId) {
            let newId = '';
            do { newId = uuidv1(); } while (this.indexOf(newId) > -1);
            return newId;
        } else {
            let maxId = 0;
            for (let object of this.objects()) {
                if (object.Id > maxId) {
                    maxId = object.Id;
                }
            }
            return maxId + 1;
        }
    }

    checkConflict(instance) {
        let conflict = false;
        if (this.model.key)
            conflict = this.findByField(this.model.key, instance[this.model.key], instance.Id) != null;
        if (conflict) {
            this.model.addError(`Unicity conflict on [${this.model.key}]...`);
            this.model.state.inConflict = true;
        }
        return conflict;
    }
    add(object) {
        delete object.Id;
        if (this.model.securedId)
            object = { "Id": '', ...object };
        else
            object = { "Id": 0, ...object };
        this.model.validate(object);
        if (this.model.state.isValid) {
            this.checkConflict(object);
            if (!this.model.state.inConflict) {
                object.Id = this.createId();
                this.model.handleAssets(object);
                this.objectsList.push(object);
                this.write();
            }
        }
        return object;
    }
    update(id, object, handleAssets = true) {
        let objectToModify = { ...object };
        delete objectToModify.Id;
        if (!this.model.securedId)
            id = parseInt(id);
        objectToModify.Id = id;
        this.model.validate(objectToModify);
        if (this.model.state.isValid) {
            let index = this.indexOf(objectToModify.Id);
            if (index > -1) {
                this.checkConflict(objectToModify);
                if (!this.model.state.inConflict) {
                    if (handleAssets)
                        this.model.handleAssets(objectToModify, this.objectsList[index]);
                    this.objectsList[index] = objectToModify;
                    this.write();
                }
            } else {
                this.model.addError(`The resource [${objectToModify.Id}] does not exist.`);
                this.model.state.notFound = true;
            }
        }
        return this.get(objectToModify.Id);
    }
    remove(id) {
        let index = 0;
        if (!this.model.securedId)
            id = parseInt(id);
        for (let object of this.objects()) {
            if (object.Id === id) {
                this.objectsList.splice(index, 1);
                this.write();
                return true;
            }
            index++;
        }
        return false;
    }
    getAll(params = null, dontBind = false) {
        let objectsList = this.objects();
        let bindedDatas = [];
        if (objectsList)
            for (let data of objectsList) {
                if (dontBind)
                    bindedDatas.push(this.model.completeAssetsPath(data));
                else
                    bindedDatas.push(this.model.bindExtraData(this.model.completeAssetsPath(data)));
            }
        let collectionFilter = new CollectionFilter(bindedDatas, params, this.model);
        if (collectionFilter.valid())
            return collectionFilter.get();
        else {
            this.errorMessages = collectionFilter.errorMessages;
            return null;
        }
    }
    get(id, dontBind = false) {
        if (!this.model.securedId)
            id = parseInt(id);
        for (let object of this.objects()) {
            if (object.Id === id) {

                if (dontBind)
                    return this.model.completeAssetsPath(object);
                else
                    return this.model.bindExtraData(this.model.completeAssetsPath(object));
            }
        }
        return null;
    }
    removeByIndex(indexToDelete) {
        if (indexToDelete.length > 0) {
            utilities.deleteByIndex(this.objects(), indexToDelete);
            this.write();
        }
    }
    keepByFilter(filterFunc) {
        let objectsList = this.objects();
        if (objectsList) {
            this.objectsList = objectsList.filter(filterFunc);
            this.write();
        }
    }
    findByFilter(filterFunc) {
        let objectsList = this.objects();
        if (objectsList) {
            return objectsList.filter(filterFunc);
        }
        return null;
    }
    findByField(fieldName, value, excludedId = 0) {
        if (!this.model.securedId && excludedId != 0)
            excludedId = parseInt(excludedId);
        if (fieldName) {
            let index = 0;
            for (let object of this.objects()) {
                try {
                    if (object[fieldName] === value) {
                        if (object.Id !== excludedId) return this.objectsList[index];
                    }
                    index++;
                } catch (error) { break; }
            }
        }
        return null;
    }
    indexOf(id) {
        if (!this.model.securedId)
            id = parseInt(id);
        let index = 0;
        for (let object of this.objects()) {
            if (object.Id == id) return index;
            index++;
        }
        return -1;
    }
}
