import Model from './model.js';

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
    }

    bindExtraData(user) {
        user.Password = "************";
        if (user.VerifyCode !== "verified") user.VerifyCode = "unverified";
        user.isBlocked = user.Authorizations.readAccess == -1;
        user.isSuper = user.Authorizations.readAccess == 2 && user.Authorizations.writeAccess == 2;
        user.isAdmin = user.Authorizations.readAccess == 3 && user.Authorizations.writeAccess == 3;
        return user;
    }
}