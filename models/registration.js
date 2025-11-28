import Model from './model.js';

export default class Registration extends Model {
    constructor() {
        super();

        this.addField('StudentId', 'integer');
        this.addField('CourseId', 'integer');
        this.addField('Year', 'integer');
    }
}