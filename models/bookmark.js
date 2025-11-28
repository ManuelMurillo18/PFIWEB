import Model from './model.js';

export default class Bookmark extends Model {
    constructor() {
        super(false /* secured Id */);

        this.addField('Title', 'string');
        this.addField('Url', 'url');
        this.addField('Category', 'string');
              
        this.setKey("Title");
    }
}