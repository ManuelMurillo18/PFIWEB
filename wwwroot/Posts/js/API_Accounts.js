class Accounts_API {
    static serverHost() {
        return "http://localhost:5000";
    }
    static ACCOUNTS_API_URL() { return this.serverHost() + "/accounts" };
    static TOKEN_API_URL() { return this.serverHost() + "/token" };

    static initHttpState() {
        this.currentHttpError = "";
        this.currentStatus = 0;
        this.error = false;
    }

    static setHttpErrorState(xhr) {
        if (xhr.responseJSON)
            this.currentHttpError = xhr.responseJSON.error_description;
        else
            this.currentHttpError = xhr.statusText == 'error' ? "Service introuvable" : xhr.statusText;
        this.currentStatus = xhr.status;
        this.error = true;
    }

    static async register(userData) {
        this.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.ACCOUNTS_API_URL() + "/register",
                type: "POST",
                contentType: 'application/json',
                data: JSON.stringify(userData),
                success: (data) => { resolve(data); },
                error: (xhr) => {
                    this.setHttpErrorState(xhr);
                    resolve(null);
                }
            });
        });
    }

    static async verify(id, code) {
        this.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.ACCOUNTS_API_URL() + "/verify?id=" + id + "&code=" + code,
                type: "GET",
                success: (data) => { resolve(data); },
                error: (xhr) => {
                    this.setHttpErrorState(xhr);
                    resolve(null);
                }
            });
        });
    }
static async login(email, password) {
    this.initHttpState();
    try {
        const resp = await fetch(this.TOKEN_API_URL(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ Email: email, Password: password })
        });

        const raw = await resp.text();
        let data = null;
        try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }

        if (resp.ok) return data;

        this.error = true;
        this.currentStatus = resp.status;
        this.currentHttpError =
            (data && (data.error_description || data.message || data.error)) ||
            resp.statusText;

        return null;
    } catch {
        this.error = true;
        this.currentStatus = 0;
        this.currentHttpError = "Service introuvable";
        return null;
    }
}



    static async logout(userId) {
        this.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.ACCOUNTS_API_URL() + "/logout?userId=" + userId,
                type: "GET",
                headers: { "Authorization": "Bearer " + sessionStorage.getItem("bearerToken") },
                success: () => {
                    sessionStorage.removeItem("bearerToken");
                    sessionStorage.removeItem("user");
                    resolve(true);
                },
                error: (xhr) => {
                    this.setHttpErrorState(xhr);
                    resolve(false);
                }
            });
        });
    }

    static async modify(userData) {
        this.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.ACCOUNTS_API_URL() + "/modify",
                type: "PUT",
                headers: { "Authorization": "Bearer " + sessionStorage.getItem("bearerToken") },
                contentType: 'application/json',
                data: JSON.stringify(userData),
                success: (data) => { resolve(data); },
                error: (xhr) => {
                    this.setHttpErrorState(xhr);
                    resolve(null);
                }
            });
        });
    }

    static async remove(userId) {
        this.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.ACCOUNTS_API_URL() + "/remove/" + userId,
                type: "GET",
                headers: { "Authorization": "Bearer " + sessionStorage.getItem("bearerToken") },
                success: () => {
                    sessionStorage.removeItem("bearerToken");
                    sessionStorage.removeItem("user");
                    resolve(true);
                },
                error: (xhr) => {
                    this.setHttpErrorState(xhr);
                    resolve(false);
                }
            });
        });
    }

static async conflict(email, id = 0) {
    this.initHttpState();
    const e = encodeURIComponent(email ?? "");
    return new Promise(resolve => {
        $.ajax({
            url: this.ACCOUNTS_API_URL() + `/conflict?Email=${e}&Id=${id}`,
            type: "GET",
            success: (data) => resolve(data),
            error: (xhr) => {
                this.setHttpErrorState(xhr);
                resolve(null);
            }
        });
    });
}


    static async getById(userId) {
        this.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.serverHost() + "/api/accounts/" + userId,
                type: "GET",
                headers: { "Authorization": "Bearer " + this.getBearerToken() },
                success: (data) => resolve(data),
                error: (xhr) => {
                    this.setHttpErrorState(xhr);
                    resolve(null);
                }
            });
        });
    }


    static getLoggedUser() {
        let user = sessionStorage.getItem("user");
        if (user)
            return JSON.parse(user);
        return null;
    }

    static setLoggedUser(user) {
        sessionStorage.setItem("user", JSON.stringify(user));
    }

    static getBearerToken() {
        return sessionStorage.getItem("bearerToken");
    }

    static setBearerToken(token) {
        sessionStorage.setItem("bearerToken", token);
    }

    static isLoggedIn() {
        return this.getLoggedUser() != null && this.getBearerToken() != null;
    }
}
