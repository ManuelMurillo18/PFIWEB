class Bookmarks_API {
    // static API_URL() { return "https://linuxapiserver.azurewebsites.net/api/bookmarks" };
    static API_URL() { return "http://localhost:5000/api/bookmarks" };
    static initHttpState() {
        this.currentHttpError = "";
        this.currentStatus = 0;
        this.error = false;
    }

    static currentETag = '';
    static hold_Periodic_Refresh = false;
    static periodicRefreshPeriod = 5; // seconds

    static setHttpErrorState(xhr) {
        if (xhr.responseJSON)
            this.currentHttpError = xhr.responseJSON.error_description;
        else
            this.currentHttpError = xhr.statusText == 'error' ? "Service introuvable" : xhr.statusText;
        this.currentStatus = xhr.status;
        this.error = true;
    }
    static start_Periodic_Refresh(callback) {
        callback();
        setInterval(async () => {
            if (!this.hold_Periodic_Refresh) {
                let etag = await this.HEAD();
                console.log(this.currentETag)
                if (this.currentETag != etag) {
                    this.currentETag = etag;
                    console.log('refresh')
                    callback();
                }
            }
        }, this.periodicRefreshPeriod * 1000);
    }
    static resume_Periodic_Refresh() {
        this.hold_Periodic_Refresh = false;
    }
    static stop_Periodic_Refresh() {
        this.hold_Periodic_Refresh = true;
    }
    static async HEAD() {
        Bookmarks_API.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.API_URL(),
                type: 'HEAD',
                contentType: 'text/plain',
                complete: data => {
                    resolve(data.getResponseHeader('ETag'));
                },
                error: (xhr) => { Bookmarks_API.setHttpErrorState(xhr); resolve(null); }
            });
        });
    }
    static async Get(id = null) {
        Bookmarks_API.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.API_URL() + (id != null ? "/" + id : ""),
                complete: data => {
                    this.currentETag = data.getResponseHeader('ETag');
                    resolve({ ETag: this.currentETag, data: data.responseJSON });
                },
                error: (xhr) => { Bookmarks_API.setHttpErrorState(xhr); resolve(null); }
            });
        });
    }
    static async GetQuery(queryString = "") {
        Bookmarks_API.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.API_URL() + queryString,
                complete: data => {
                    resolve({ ETag: data.getResponseHeader('ETag'), data: data.responseJSON });
                },
                error: (xhr) => {
                    Bookmarks_API.setHttpErrorState(xhr); resolve(null);
                }
            });
        });
    }
    static async Save(data, create = true) {
        Bookmarks_API.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: create ? this.API_URL() : this.API_URL() + "/" + data.Id,
                type: create ? "POST" : "PUT",
                contentType: 'application/json',
                data: JSON.stringify(data),
                success: (data) => { resolve(data); },
                error: (xhr) => { Bookmarks_API.setHttpErrorState(xhr); resolve(null); }
            });
        });
    }
    static async Delete(id) {
        Bookmarks_API.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.API_URL() + "/" + id,
                type: "DELETE",
                complete: () => { resolve(true); },
                error: (xhr) => { Bookmarks_API.setHttpErrorState(xhr); resolve(null); }
            });
        });
    }
}