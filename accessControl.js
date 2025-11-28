export default class AccessControl {
    // 0 anonymous, 1 user, 2 admin
    static anonymous()      { return { readAccess: 0, writeAccess: 0 }; }
    static userReadOnly()   { return { readAccess: 0, writeAccess: 1 }; }
    static user()           { return { readAccess: 1, writeAccess: 1 }; }
    static superUser()      { return { readAccess: 2, writeAccess: 2 }; }
    static admin()          { return { readAccess: 3, writeAccess: 3 }; }
    static readGranted(authorizations, requiredAccess) {
        if (requiredAccess) {
            if (requiredAccess.readAccess == 0) return true;
            if (authorizations)
                return (authorizations.readAccess >= requiredAccess.readAccess);
            else
                return false;
        }
        return true;
    }
    static writeGranted(authorizations, requiredAccess) {
        if (requiredAccess) {
            if (requiredAccess.writeAccess == 0) return true;
            if (authorizations != null)
                return (authorizations.writeAccess >= requiredAccess.writeAccess);
            else
                return false;
        }
        return true;
    }
    static granted(authorizations, requiredAccess) {
        if (requiredAccess) {
            if (requiredAccess.readAccess == 0 && requiredAccess.writeAccess == 0) return true;
            if (authorizations)
                return (authorizations.readAccess >= requiredAccess.readAccess &&
                    authorizations.writeAccess >= requiredAccess.writeAccess);
            else
                return false;
        }
        return true; // no authorization needed
    }
    static writeGrantedAdminOrOwner(HttpContext, requiredAccess, id) {
        if (requiredAccess) {
            if (requiredAccess.writeAccess == 0) return true;
            if (HttpContext.user && HttpContext.authorizations)
                return (
                    authorizations.writeAccess >= requiredAccess.writeAccess ||
                    HttpContext.user.Id == id
                );
            else
                return false;
        }
        return true;
    }
}