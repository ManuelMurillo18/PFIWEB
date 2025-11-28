/////////////////////////////////////////////////////////////////////
// This class provide a model scheme
/////////////////////////////////////////////////////////////////////
// Author : Nicolas Chourot
// Lionel-Groulx College
/////////////////////////////////////////////////////////////////////
import * as utilities from '../utilities.js';
import Repository from './repository.js';
import * as AssetsRepository from './assetsManager.js';
export default class Model {
    constructor(securedId = false) {
        this.fields = [];
        if (securedId)
            this.addField('Id', 'string');
        else
            this.addField('Id', 'integer');
        this.key = null;
        this.securedId = securedId;
        this.state = { isValid: true, inConflict: false, notFound: false, errors: [] };
    }
    addField(propertyName, propertyType) {
        if (!this.isMember(propertyName))
            this.fields.push({ name: propertyName, type: propertyType });
    }
    isMember(propertyName) {
        let exist = false;
        this.fields.forEach(field => {
            if (field.name == propertyName)
                exist = true;
        })
        return exist;
    }
    setKey(key) {
        this.key = key;
    }
    getClassName() {
        return this.constructor.name;
    }
    valueValid(value, type) {
        if (value !== null) {
            switch (type) {
                case "string": return true;
                case "stringNotEmpty": return value != "";
                case "integer": return utilities.tryParseInt(value) != NaN;
                case "float": return utilities.tryParseInt(value) != NaN;
                case "boolean": return value === false || value === true;
                case "alpha": return /^[a-zA-Z\- 'ààâäæáãåāèéêëęėēîïīįíìôōøõóòöœùûüūúÿçćčńñÀÂÄÆÁÃÅĀÈÉÊËĘĖĒÎÏĪĮÍÌÔŌØÕÓÒÖŒÙÛÜŪÚŸÇĆČŃÑ]*$/.test(value);
                case "phone": return /^\(\d\d\d\) \d\d\d-\d\d\d\d$/.test(value);
                case "email": return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/.test(value);
                case "url": return /(http|https):\/\/(\w+:{0,1}\w*)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%!\-\/]))?/.test(value);
                case "zipcode": return /^[a-zA-Z][0-9]+[a-zA-Z]\s[0-9]+[a-zA-Z][0-9]+$/.test(value);
                case "object": return true;
                case "date": return true; // todo make some syntax check
                case "array": return true; // todo make validity check
                case "asset": return true; // todo make validity check
                default: return false;
            }
        }
        return false;
    }
    addError(message) {
        this.state.isValid = false;
        this.state.errors.push(message);
    }
    validate(instance) {
        this.fields.forEach(field => {
            if (!(field.name in instance)) {
                this.addError(`The property [${field.name}] is missing...`);
            } else {
                if (!this.valueValid(instance[field.name], field.type))
                    this.addError(`The property [${field.name}] value must be a valid ${field.type} ...`);
            }
            if (this.state.isValid)
                this.stringToType(instance, field.name, field.type);
        });
    }
    stringToType(instance, fieldName, type) {
        if (instance[fieldName] !== null) {
            switch (type) {
                case "integer": instance[fieldName] = parseInt(instance[fieldName]); break;
                case "float": instance[fieldName] = parseFloat(instance[fieldName]); break;
            }
        }
    }
    join(instance, jointName, jointModel, targetModel, selectedMembers = "") {
        let jointModelRepository = new Repository(new jointModel());
        let targetModelRepository = new Repository(new targetModel());
        let joints = jointModelRepository.findByFilter(j => j[this.getClassName() + "Id"] == instance.Id);
        let jointRecords = [];
        for (let joint of joints) {
            let jointRecord = targetModelRepository.get(joint[targetModelRepository.model.getClassName() + "Id"], true /*do not bind extra data / prevent from infinite loop */);
            if (jointRecord) {
                if (selectedMembers == "") {
                    jointRecords.push(jointRecord);
                } else {
                    let jr = {};
                    selectedMembers.split(',').forEach(member => {
                        member = member.trim();
                        jr[member] = jointRecord[member];
                    });
                    jointRecords.push(jr);
                }
            }
        }
        instance[jointName] = jointRecords;
    }

    async bind(instance, foreignKeyName, sourceModel, selectedMembers = "") {
        let sourceModelRepository = new Repository(new sourceModel());
        let sourceModelRecord = sourceModelRepository.get(instance[foreignKeyName]);
        foreignKeyName = foreignKeyName.slice(0, -2); // remove Id caracters
        if (selectedMembers == "") {
            if (sourceModelRecord != null)
                instance[foreignKeyName] = sourceModelRecord;
            else
                instance[foreignKeyName] = {};
        } else {
            if (sourceModelRecord != null) {
                selectedMembers.split(',').forEach(member => {
                    member = member.trim();
                    instance[foreignKeyName + member] = sourceModelRecord[member];
                });
            } else {
                selectedMembers.split(',').forEach(member => {
                    member = member.trim();
                    instance[foreignKeyName + member] = "Unknown";
                });
            }
        }
    }

    handleAssets(instance, storedInstance = null) {
        this.fields.forEach(field => {
            if ((field.name in instance) && (field.type == "asset")) {
                if (instance[field.name] == '') {
                    if (storedInstance != null) {
                        instance[field.name] = storedInstance[field.name];
                    }
                } else {
                    instance[field.name] = AssetsRepository.save(instance[field.name]);
                    if (storedInstance != null) {
                        AssetsRepository.remove(storedInstance[field.name]);
                    }
                }
            }
        });
    }
    removeAssets(instance) {
        this.fields.forEach(field => {
            if ((field.name in instance) && (field.type == "asset")) {
                AssetsRepository.remove(instance[field.name]);
            }
        });
    }
    addHostReferenceToAssetFileNames(instance) {
        this.fields.forEach(field => {
            if ((field.name in instance) && (field.type == "asset")) {
                instance[field.name] = AssetsRepository.addHostReference(instance[field.name]);
            }
        });
    }
    completeAssetsPath(instance) {
        let instanceCopy = { ...instance };
        this.addHostReferenceToAssetFileNames(instanceCopy);
        return instanceCopy;
    }
    bindExtraData(instance) { return instance; }
}