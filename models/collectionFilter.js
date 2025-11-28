/////////////////////////////////////////////////////////////////////
// class collectionFilter 
/////////////////////////////////////////////////////////////////////
// This class use the query string parameter of the request to
// filfer data.
/////////////////////////////////////////////////////////////////////
// list of implemented parameters :
//
// fields/select = [-]<field name>[,[-]<field name>]
//      return only the enumeted field names
//
// <field name> = <value with wild cards>
//      return all data that match the criteria
//
// sort = [-]<field name>[,[-]<field name>]
//      return data sorted on the the enumeted field names
//
// limit = <integer> & offset = <integer>
//      return the amount of records specified in limit parameter data from 
//      an index calculated like this : offset*limit
//      you must provide both parameters
//
// keywords = string[,string]
//      return all data that a member that contains all the enumerated strings
//
// field.start = start-value & field.end = end-value
//      return all data with field >= start-value and field <= end-value
//      take note the data will be sorted on the specified field
// 
/////////////////////////////////////////////////////////////////////
// Author : Nicolas Chourot
// Lionel-Groulx College
// 2025
/////////////////////////////////////////////////////////////////////
import * as utilities from '../utilities.js';
// http://localhost:5000/api/contacts?fields=Name
// http://localhost:5000/api/bookmarks?fields=Category&limit=4&offset=1
// http://localhost:5000/api/bookmarks?fields=Category,Title&limit=3&offset=1&Category=c*&sort=Category,-Title
// http://localhost:5000/api/words?sort=-Val
// http://localhost:5000/api/words?sort=Val&limit=5&offset=20&Val=*z&fields=Val,Def,Gen
// http://localhost:5000/api/Hurricanes?sort=-Year&limit=3&offset=0
// http://localhost:5000/api/Hurricanes?Year.start=2020&Year.end=2024 

export default class collectionFilter {
    constructor(collection, filterParams, model = null) {
        this.model = model;
        this.collection = collection;
        this.filteredCollection = [];

        this.sortFields = [];
        this.searchKeys = [];
        this.keywords = [];
        this.fields = [];
        this.ranges = [];
        this.limit = undefined;
        this.offset = undefined;

        this.errorMessages = [];
        this.prepareFilter(filterParams);
    }
    error(message) {
        this.errorMessages.push(message);
    }
    valid() {
        return this.errorMessages.length == 0;
    }
    normalizeName(name) {
        return utilities.capitalizeFirstLetter(name).trim()
    }
    validFieldName(context, fieldName) {
        if (this.model)
            if (!this.model.isMember(fieldName)) {
                this.error(`${context} : ${fieldName} is not a member of ${this.model.getClassName()} or is an invalid parameter`)
                return false;
            }
        return true;
    }
    prepareFilter(filterParams) {
        let instance = this;
        if (filterParams != null) {
            try {
                Object.keys(filterParams).forEach(function (paramName) {
                    if (!Array.isArray(filterParams[paramName])) {
                        let paramValue = filterParams[paramName];
                        if (paramValue) {
                            switch (paramName) {
                                case "sort": instance.setSortFields(paramValue); break;
                                case "limit": instance.limit = utilities.tryParseInt(paramValue); break;
                                case "offset": instance.offset = utilities.tryParseInt(paramValue); break;
                                case "select":
                                case "fields": instance.fields = paramValue.split(','); break;
                                case "keywords": instance.keywords = paramValue.split(','); break;
                                default:
                                    let normalizedParamName = instance.normalizeName(paramName);
                                    if (normalizedParamName.indexOf(".start") > -1) {
                                        instance.addRange(normalizedParamName, paramValue);
                                    } else {
                                        if (normalizedParamName.indexOf(".end") > -1) {
                                            instance.addRange(normalizedParamName, paramValue);
                                        } else {
                                            instance.addSearchKey(normalizedParamName, paramValue);
                                        }
                                    }
                            }
                        } else {
                            instance.error(`${paramName} parameter has a undefined value.`);
                        }
                    }
                    else {
                        instance.error(`${paramName} cannot be used more than once.`);
                    }
                });
            }
            catch (error) { this.error(`null parameter.`); }
        }

        this.validateFieldsParam();
        this.validateLimitOffset();
    }
    validateFieldsParam() {
        for (let f = 0; f < this.fields.length; f++) {
            this.fields[f] = this.normalizeName(this.fields[f]);
            this.validFieldName("fields param", this.fields[f]);
        }
    }
    validateLimitOffset() {
        if (this.limit != undefined) {
            if (isNaN(this.limit))
                this.error(`limit parameter value must be a integer >=0`);
            else
                if (this.limit < 0)
                    this.error(`limit parameter value must be a integer >=0`);
            if (this.offset == undefined)
                this.error(`You must specify an offset parameter when using limit parameter`);
        }
        if (this.offset != undefined) {
            if (isNaN(this.offset))
                this.error(`offset parameter value must be a integer >=0`);
            else
                if (this.offset < 0)
                    this.error(`offset parameter value must be a integer >=0`);
            if (this.limit == undefined)
                this.error(`You must specify a limit parameter when using offset parameter`);
        }
    }
    makeSortField(fieldName) {
        let ascending = true;
        if (fieldName[0] == '-') {
            fieldName = fieldName.slice(1);
            ascending = false;
        }
        let name = this.normalizeName(fieldName);
        if (this.validFieldName("sort param", name))
            return { name, ascending };
        else
            return null;
    }
    makeSortFields(fieldNames) {
        let names = fieldNames.split(",");
        let sortField = null;
        for (let name of names) {
            sortField = this.makeSortField(name);
            if (sortField)
                this.sortFields.push(sortField);
        }
    }
    setSortFields(fieldNames) {
        if (Array.isArray(fieldNames)) {
            for (let fieldNamePart of fieldNames) {
                this.makeSortFields(fieldNamePart);
            }
        } else {
            this.makeSortFields(fieldNames);
        }
    }
    addSearchKey(keyName, value) {
        if (this.validFieldName("search param", keyName))
            this.searchKeys.push({ name: keyName, value: value });
    }
    addRange(paramName, value) {
        let name = paramName.split('.')[0];
        if (this.validFieldName("range param", name)) {
            if (!isNaN(value) && !isNaN(parseFloat(value))) {
                value = parseFloat(value);
            }
            let startValue = paramName.split('.')[1] == "start";
            let found = false;
            this.ranges.forEach(range => {
                if (range.field == name) {
                    found = true;
                    if (startValue)
                        range.start = value;
                    else
                        range.end = value;
                }
            });
            if (!found) {
                let range = { field: name, start: value, end: value };
                this.ranges.push(range);
            }
        }
    }
    valueMatch(value, searchValue) {
        try {
            let sv = '^' + searchValue.toString().toLowerCase().replace(/\*/g, '.*') + '$';
            let v = value.toString().replace(/(\r\n|\n|\r)/gm, "").toLowerCase();
            return new RegExp(sv).test(v);
        } catch (error) {
            console.log(error);
            return false;
        }
    }
    itemMatch(item) {
        if (item) {
            for (let key of this.searchKeys) {
                if (key.name in item) {
                    if (!Array.isArray(key.value)) {
                        if (!this.valueMatch(item[key.name], key.value))
                            return false;
                    } else {
                        let allMatch = true;
                        for (let value of key.value) {
                            if (!this.valueMatch(item[key.name], value))
                                allMatch = false;
                        }
                        return allMatch;
                    }
                } else
                    return false;
            }
            return true;
        }
        return false;
    }
    equal(ox, oy) {
        let equal = true;
        Object.keys(ox).forEach(function (member) {
            if (ox[member] != oy[member]) {
                equal = false;
                return false;
            }
        })
        return equal;
    }
    exist(collection, object) {
        if (collection.length > 0) {
            for (let item of collection) {
                if (this.equal(item, object)) return true;
            }
            return false;
        }
        return false;
    }
    keepFields(collection) {
        if (this.fields.length > 0) {
            let subCollection = [];
            for (let item of collection) {
                let subItem = {};
                for (let field of this.fields) {
                    subItem[field] = item[field];
                }
                subCollection.push(subItem);
            }
            return subCollection;
        } else
            return collection;
    }
    findByKeys(collection) {
        let filteredCollection = [];
        if (this.searchKeys.length > 0) {
            for (let item of collection) {
                if (this.itemMatch(item))
                    filteredCollection.push(item);
            }
        } else
            filteredCollection = [...collection];
        return filteredCollection;
    }
    findByKeywords(collection) {
        if (this.keywords.length > 0 && this.model != null) {
            let filteredCollection = [];
            for (let item of collection) {
                let record = "";
                for (let field of this.model.fields) {
                    console.log("item[field.name] = ", field.name, item[field.name])
                    if (field.type == "string") 
                        record += item[field.name].toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') + " ";
                }
                let keep = true;
                for (let keyword of this.keywords) {
                    console.log("keyword = ", keyword)
                    if (record.indexOf(keyword.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')) == -1) {
                        keep = false;
                        break;
                    }
                }
                if (keep)
                    filteredCollection.push(item);
            }
            return filteredCollection;
        } else
            return collection;
    }
    compareNum(x, y) {
        if (x === y) return 0;
        else if (x < y) return -1;
        return 1;
    }
    innerCompare(x, y) {
        if ((typeof x) === 'string')
            return x.localeCompare(y);
        else
            return this.compareNum(x, y);
    }
    compare(itemX, itemY) {
        let fieldIndex = 0;
        let max = this.sortFields.length;
        do {
            let result = 0;
            if (this.sortFields[fieldIndex].ascending)
                result = this.innerCompare(itemX[this.sortFields[fieldIndex].name], itemY[this.sortFields[fieldIndex].name]);
            else
                result = this.innerCompare(itemY[this.sortFields[fieldIndex].name], itemX[this.sortFields[fieldIndex].name]);
            if (result == 0)
                fieldIndex++;
            else
                return result;
        } while (fieldIndex < max);
        return 0;
    }
    sort() {
        this.filteredCollection.sort((a, b) => this.compare(a, b));
    }
    flushDuplicates(collection) {
        let index = 0;
        let lastObj = null;
        let filteredCollection = [];
        while (index < collection.length) {
            if (index == 0) {
                filteredCollection.push(collection[index]);
                lastObj = collection[index];
                index++;
            }
            while (index < collection.length && this.equal(collection[index], lastObj)) index++;
            if (index < collection.length) {
                filteredCollection.push(collection[index]);
                lastObj = collection[index];
                index++;
            }
        }
        return filteredCollection;
    }
    filterByRanges(collection) {
        let filteredCollection = [];
        this.ranges.forEach(range => {
            this.setSortFields(range.field);
            collection.sort((a, b) => this.compare(a, b));
            collection.forEach(item => {
                let keep = false;
                keep = this.innerCompare(range.start, item[range.field]) <= 0;
                keep = keep && (this.innerCompare(item[range.field], range.end) <= 0);
                if (keep)
                    filteredCollection.push(item);
            })
        })
        return filteredCollection;
    }
    get() {
        if (this.valid()) {
            this.filteredCollection = this.findByKeys(this.collection);
            this.filteredCollection = this.findByKeywords(this.filteredCollection);
            if (this.fields.length > 0) {
                this.filteredCollection = this.keepFields(this.filteredCollection);
                this.prevSortFields = [...this.sortFields];
                this.sortFields = [];
                this.fields.forEach(fields => { this.setSortFields(fields); });
                this.filteredCollection.sort((a, b) => this.compare(a, b));
                this.filteredCollection = this.flushDuplicates(this.filteredCollection);
                this.sortFields = this.prevSortFields;
            }
            if (this.ranges.length > 0) {
                // disable current sorted fields specification
                // in order to indepentally sort on the ranged field                
                this.prevSortFields = [...this.sortFields];
                this.filteredCollection = this.filterByRanges(this.filteredCollection);
                // restore current sorted fields specification
                this.sortFields = this.prevSortFields;
            }
            if (this.sortFields.length > 0)
                this.sort();
            if (this.limit != undefined) {
                return this.filteredCollection.slice(this.offset * this.limit, (this.offset + 1) * this.limit);
            }
            return this.filteredCollection;
        } else
            return null
    }
}
