import Model from './model.js';
import RegistrationModel from './registration.js';
import CourseModel from './course.js';
export default class Student extends Model {
    constructor() {
        super();

        this.addField('Name', 'string');
        this.addField('AC', 'string');
        this.setKey("Name");
    }

    bindExtraData(student) {
        this.join(student, "Courses", RegistrationModel, CourseModel);
        return student;
    }
}