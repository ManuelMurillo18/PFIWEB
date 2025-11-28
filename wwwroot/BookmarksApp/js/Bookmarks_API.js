class Bookmarks_API {
    static API_URL() { return "http://localhost:5000/api/bookmarks" };
    static initHttpState() {
        this.currentHttpError = "";
        this.currentStatus = 0;
        this.error = false;
        this.Etag = "";
    }
    static setHttpErrorState(xhr) {
        if (xhr.responseJSON)
            this.currentHttpError = xhr.responseJSON.error_description;
        else
            this.currentHttpError = xhr.statusText == 'error' ? "Service introuvable" : xhr.statusText;
        this.currentStatus = xhr.status;
        this.error = true;
    }
    static async Head() {
        Bookmarks_API.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.API_URL(),
                type: 'HEAD',
                contentType: 'text/plain',
                complete: data => {
                    Bookmarks_API.Etag = data.getResponseHeader('ETag');
                    resolve(Bookmarks_API.Etag);
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
                    Bookmarks_API.Etag = data.getResponseHeader('ETag');
                    resolve(data);
                },
                error: (xhr) => { Bookmarks_API.setHttpErrorState(xhr); resolve(null); }
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
                success: (/*data*/) => { resolve(true); },
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
                success: () => { resolve(true); },
                error: (xhr) => { Bookmarks_API.setHttpErrorState(xhr); resolve(null); }
            });
        });
    }
}