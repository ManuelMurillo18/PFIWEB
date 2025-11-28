import StudentModel from '../models/student.js';
import Repository from '../models/repository.js';
import Controller from './Controller.js';

export default class ContactsController extends Controller {
    constructor(HttpContext) {
        super(HttpContext, new Repository(new StudentModel()));
    }
}