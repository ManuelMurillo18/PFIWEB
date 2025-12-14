import Model from './model.js';
import UserModel from './user.js';
import PostLikeModel from './postlike.js';

export default class Post extends Model {
    constructor() {
        super(true /* secured Id */);

        this.addField('Title', 'string');
        this.addField('Text', 'string');
        this.addField('Category', 'string');
        this.addField('Image', 'asset');
        this.addField('Date', 'integer');
        this.addField('OwnerId', 'string');

        this.setKey("Title");

        /* Add a dynamic Likes field with junction between post.Id and UserModel via PostLikes table */
        this.addJoint('Likes', PostLikeModel, UserModel, "Name");

        /* Add Owner field binding to get Name and Avatar of the post creator */
        this.addBind('OwnerId', UserModel, 'Name, Avatar');

        /* When deleting a Post, delete all associated PostLikes */
        this.addDeleteCascades(PostLikeModel, "PostId");
    }
}