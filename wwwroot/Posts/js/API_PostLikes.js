class PostLikes_API {
    static serverHost() {
        return "http://localhost:5000";
    }
    static POSTLIKES_API_URL() { return this.serverHost() + "/api/postlikes" };

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

    static async addLike(postId, userId) {
        this.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.POSTLIKES_API_URL(),
                type: "POST",
                headers: { "Authorization": "Bearer " + sessionStorage.getItem("bearerToken") },
                contentType: 'application/json',
                data: JSON.stringify({ PostId: postId, UserId: userId }),
                success: (data) => { resolve(data); },
                error: (xhr) => {
                    this.setHttpErrorState(xhr);
                    resolve(null);
                }
            });
        });
    }

    static async removeLike(postId, userId) {
        this.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.POSTLIKES_API_URL() + "?PostId=" + postId + "&UserId=" + userId,
                type: "GET",
                headers: { "Authorization": "Bearer " + sessionStorage.getItem("bearerToken") },
                success: (likes) => {
                    if (likes && likes.length > 0) {
                        $.ajax({
                            url: this.POSTLIKES_API_URL() + "/" + likes[0].Id,
                            type: "DELETE",
                            headers: { "Authorization": "Bearer " + sessionStorage.getItem("bearerToken") },
                            success: () => { resolve(true); },
                            error: (xhr) => {
                                this.setHttpErrorState(xhr);
                                resolve(false);
                            }
                        });
                    } else {
                        resolve(false);
                    }
                },
                error: (xhr) => {
                    this.setHttpErrorState(xhr);
                    resolve(false);
                }
            });
        });
    }

    static async getPostLikes(postId) {
        this.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.POSTLIKES_API_URL() + "?PostId=" + postId,
                type: "GET",
                success: (data) => { resolve(data); },
                error: (xhr) => {
                    this.setHttpErrorState(xhr);
                    resolve(null);
                }
            });
        });
    }

    static async userLikedPost(postId, userId) {
        this.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.POSTLIKES_API_URL() + "?PostId=" + postId + "&UserId=" + userId,
                type: "GET",
                success: (likes) => {
                    resolve(likes && likes.length > 0);
                },
                error: (xhr) => {
                    this.setHttpErrorState(xhr);
                    resolve(false);
                }
            });
        });
    }
    static async GetQuery(queryString = "") {
    this.initHttpState();
    return new Promise(resolve => {
        $.ajax({
            url: this.POSTLIKES_API_URL() + queryString,
            type: "GET",
            headers: { "Authorization": "Bearer " + sessionStorage.getItem("bearerToken") },
            success: (data) => { resolve(data); },
            error: (xhr) => { this.setHttpErrorState(xhr); resolve(null); }
        });
    });
}

static async Delete(id) {
    this.initHttpState();
    return new Promise(resolve => {
        $.ajax({
            url: this.POSTLIKES_API_URL() + "/" + id,
            type: "DELETE",
            headers: { "Authorization": "Bearer " + sessionStorage.getItem("bearerToken") },
            success: () => { resolve(true); },
            error: (xhr) => { this.setHttpErrorState(xhr); resolve(false); }
        });
    });
}

}
