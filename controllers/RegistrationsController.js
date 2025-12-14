
import Repository from '../models/repository.js';
import Controller from './Controller.js';
import RegistrationModel from '../models/registration.js';

export default class RegistrationsController extends Controller {
    constructor(HttpContext) {
        super(HttpContext, new Repository(new RegistrationModel()));
    }
}