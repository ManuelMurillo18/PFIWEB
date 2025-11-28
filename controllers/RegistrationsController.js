
import Repository from '../models/repository.js';
import Controller from './Controller.js';
import Students_courseModel from '../models/registration.js';

export default class Students_coursesController extends Controller {
    constructor(HttpContext) {
        super(HttpContext, new Repository(new Students_courseModel()));
    }
}