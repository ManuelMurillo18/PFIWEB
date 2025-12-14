import Model from './model.js';

export default class Postlike extends Model {
    constructor() {
        super();
        this.addField('PostId', 'string');
        this.addField('UserId', 'string');
    }
}
