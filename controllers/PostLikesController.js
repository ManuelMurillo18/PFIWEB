import PostLikeModel from '../models/postlike.js';
import Repository from '../models/repository.js';
import Controller from './Controller.js';

export default class PostLikesController extends Controller {
    constructor(HttpContext) {
        super(HttpContext, new Repository(new PostLikeModel()));
    }
}
