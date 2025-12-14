import Model from './model.js';
import PostModel from './post.js';
import PostLikeModel from './postlike.js';

export default class User extends Model {
    constructor()
    {
        super(true);
        this.addField('Name', 'string');
        this.addField('Email', 'email');
        this.addField('Password', 'string');
        this.addField('Avatar', 'asset');
        this.addField('Created','integer');
        this.addField('VerifyCode','string');
        this.addField('Authorizations','object');

        this.setKey("Email");

        /* When deleting a User, delete all their Posts
           which will also delete all their PostLikes
           See in the Post model constructor */
        this.addDeleteCascades(PostModel, "OwnerId");

        /* When deleting a User, delete all their PostLikes */
        this.addDeleteCascades(PostLikeModel, "UserId");
    }

    bindExtraData(user) {
        // Call parent to execute joints and binds
        super.bindExtraData(user);

        // Add custom user-specific bindings
        user.Password = "************";
        if (user.VerifyCode !== "verified") user.VerifyCode = "unverified";
        user.isBlocked = user.Authorizations.readAccess < 0;
        user.isSuper = user.Authorizations.readAccess == 2 && user.Authorizations.writeAccess == 2;
        user.isAdmin = user.Authorizations.readAccess == 3 && user.Authorizations.writeAccess == 3;
        return user;
    }
}