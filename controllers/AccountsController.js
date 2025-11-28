import UserModel from '../models/user.js';
import Repository from '../models/repository.js';
import TokenManager from '../tokensManager.js';
import * as utilities from "../utilities.js";
import Gmail from "../gmail.js";
import Controller from './Controller.js';
import AccessControl from '../accessControl.js';

export default class AccountsController extends Controller {
    constructor(HttpContext) {
        super(HttpContext, new Repository(new UserModel()), AccessControl.admin());
    }
    // POST: /token body payload[{"Email": "...", "Password": "..."}]
    login(loginInfo) {
        if (loginInfo) {
            if (this.repository != null) {
                let user = this.repository.findByField("Email", loginInfo.Email);
                if (user != null) {
                    if (user.Password == loginInfo.Password) {
                        user = this.repository.get(user.Id);
                        let newToken = TokenManager.create(user);
                        this.HttpContext.response.created(newToken);
                    } else 
                        this.HttpContext.response.wrongPassword("Wrong password.");
                } else
                    this.HttpContext.response.userNotFound("This user email is not found.");
            } else
                this.HttpContext.response.notImplemented();
        } else
            this.HttpContext.response.badRequest("Credential Email and password are missing.");
    }
    logout() {
        let userId = this.HttpContext.path.params.userId;
        if (userId) {
            TokenManager.logout(userId);
            this.HttpContext.response.ok();
        } else {
            this.HttpContext.response.badRequest("UserId is not specified.")
        }
    }
    sendVerificationEmail(user) {
        // bypass model bindeExtraData wich hide the user verifyCode
        let html = `
                Bonjour ${user.Name}, <br /> <br />
                Voici votre code pour confirmer votre adresse de courriel
                <br />
                <h3>${user.VerifyCode}</h3>
            `;
        const gmail = new Gmail();
        gmail.send(user.Email, 'Vérification de courriel...', html);
    }

    sendConfirmedEmail(user) {
        let html = `
                Bonjour ${user.Name}, <br /> <br />
                Votre courriel a été confirmé.
            `;
        const gmail = new Gmail();
        gmail.send(user.Email, 'Courriel confirmé...', html);
    }

    //GET : /accounts/verify?id=...&code=.....
    verify() {
        if (this.repository != null) {
            let id = this.HttpContext.path.params.id;
            let code = parseInt(this.HttpContext.path.params.code);
            let userFound = this.repository.findByField('Id', id);
            if (userFound) {
                if (userFound.VerifyCode == code) {
                    userFound.VerifyCode = "verified";
                    this.repository.update(userFound.Id, userFound, false);
                    if (this.repository.model.state.isValid) {
                        userFound = this.repository.get(userFound.Id); // get data binded record
                        this.HttpContext.response.JSON(userFound);
                        this.sendConfirmedEmail(userFound);
                    } else {
                        this.HttpContext.response.unprocessable();
                    }
                } else {
                    this.HttpContext.response.unverifiedUser("Verification code does not matched.");
                }
            } else {
                this.HttpContext.response.unprocessable();
            }
        } else
            this.HttpContext.response.notImplemented();
    }
    //GET : /accounts/conflict?Id=...&Email=.....
    conflict() {
        if (this.repository != null) {
            let id = this.HttpContext.path.params.Id;
            let email = this.HttpContext.path.params.Email;
            if (id && email) {
                let prototype = { Id: id, Email: email };
                this.HttpContext.response.JSON(this.repository.checkConflict(prototype));
            } else
                this.HttpContext.response.JSON(false);
        } else
            this.HttpContext.response.JSON(false);
    }

    // POST: account/register body payload[{"Id": 0, "Name": "...", "Email": "...", "Password": "..."}]
    register(user) {
        if (this.repository != null) {
            user.Created = utilities.nowInSeconds();
            let verifyCode = utilities.makeVerifyCode(6);
            user.VerifyCode = verifyCode;
            user.Authorizations = AccessControl.user();
            let newUser = this.repository.add(user);
            if (this.repository.model.state.isValid) {
                this.HttpContext.response.created(newUser);
                this.sendVerificationEmail(newUser);
            } else {
                if (this.repository.model.state.inConflict)
                    this.HttpContext.response.conflict(this.repository.model.state.errors);
                else
                    this.HttpContext.response.badRequest(this.repository.model.state.errors);
            }
        } else
            this.HttpContext.response.notImplemented();
    }
    promote(user) {
        if (AccessControl.writeGranted(this.HttpContext.authorizations, AccessControl.admin())) {
            if (this.repository != null) {
                let foundUser = this.repository.findByField("Id", user.Id);
                foundUser.Authorizations.readAccess++;
                if (foundUser.Authorizations.readAccess > 3) foundUser.Authorizations.readAccess = 1;
                foundUser.Authorizations.writeAccess++;
                if (foundUser.Authorizations.writeAccess > 3) foundUser.Authorizations.writeAccess = 1;
                this.repository.update(user.Id, foundUser, false);
                if (this.repository.model.state.isValid) {
                    let userFound = this.repository.get(foundUser.Id); // get data binded record
                    this.HttpContext.response.JSON(userFound);
                }
                else
                    this.HttpContext.response.badRequest(this.repository.model.state.errors);
            } else
                this.HttpContext.response.notImplemented();
        } else
            this.HttpContext.response.unAuthorized("Unauthorized access");

    }
    block(user) {
        if (AccessControl.writeGranted(this.HttpContext.authorizations, AccessControl.admin())) {
            if (this.repository != null) {
                let foundUser = this.repository.findByField("Id", user.Id);
                foundUser.Authorizations.readAccess = foundUser.Authorizations.readAccess == 1 ? -1 : 1;
                foundUser.Authorizations.writeAccess = foundUser.Authorizations.writeAccess == 1 ? -1 : 1;
                this.repository.update(user.Id, foundUser, false);
                if (this.repository.model.state.isValid) {
                    let userFound = this.repository.get(foundUser.Id); // get data binded record
                    this.HttpContext.response.JSON(userFound);
                }
                else
                    this.HttpContext.response.badRequest(this.repository.model.state.errors);
            } else
                this.HttpContext.response.notImplemented();
        } else
            this.HttpContext.response.unAuthorized("Unauthorized access");
    }
    // PUT:account/modify body payload[{"Id": 0, "Name": "...", "Email": "...", "Password": "..."}]
    modify(user) {
        // empty asset members imply no change and there values will be taken from the stored record
        if (AccessControl.writeGranted(this.HttpContext.authorizations, AccessControl.user())) {
            if (this.repository != null) {
                user.Created = utilities.nowInSeconds();
                let foundedUser = this.repository.findByField("Id", user.Id);
                if (foundedUser != null) {
                    if (user.Password == '') { // password not changed
                        user.Password = foundedUser.Password;
                    }
                    user.Authorizations = foundedUser.Authorizations; // user cannot change its own authorizations
                    if (user.Email != foundedUser.Email) {
                        user.VerifyCode = utilities.makeVerifyCode(6);
                        this.sendVerificationEmail(user);
                    } else {
                        user.VerifyCode = foundedUser.VerifyCode;
                    }
                    let updatedUser = this.repository.update(user.Id, user);
                    if (this.repository.model.state.isValid) {
                        this.HttpContext.response.accepted(updatedUser);
                        // todo : renew etag of all user related repositories
                    }
                    else {
                        if (this.repository.model.state.inConflict)
                            this.HttpContext.response.conflict(this.repository.model.state.errors);
                        else
                            this.HttpContext.response.badRequest(this.repository.model.state.errors);
                    }
                } else
                    this.HttpContext.response.notFound();
            } else
                this.HttpContext.response.notImplemented();
        } else
            this.HttpContext.response.unAuthorized();
    }

    // GET:account/remove/id
    remove(id) { // warning! this is not an API endpoint 
        // todo make sure that the requester has legitimity to delete ethier itself or its an admin
        if (AccessControl.writeGrantedAdminOrOwner(this.HttpContext.authorizations, this.requiredAuthorizations, id)) {
            // todo
        }
    }
}
