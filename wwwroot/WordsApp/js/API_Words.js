//const API_URL = "https://api-server-2025.azurewebsites.net/api/words";
const API_URL = "http://localhost:5000/api/words";
class API {
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

    static getWords(query = "") {
        API.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: API_URL + query,
                success: words => { resolve(words); },
                error: (xhr) => { API.setHttpErrorState(xhr); resolve(null); }
            });
        });
    }
    static getWord(wordId) {
        API.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: API_URL + "/" + wordId,
                success: word => { resolve(word); },
                error: (xhr) => { API.setHttpErrorState(xhr); resolve(null); }
            });
        });
    }
    static saveWord(word, create) {
        API.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: create ? API_URL : API_URL + "/" + word.Id,
                type: create ? "POST" : "PUT",
                contentType: 'application/json',
                data: JSON.stringify(word),
                success: (/*data*/) => { resolve(true); },
                error: (xhr) => { API.setHttpErrorState(xhr); resolve(null); }
            });
        });
    }
    static deleteWord(id) {
        API.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: API_URL + "/" + id,
                type: "DELETE",
                success: () => { resolve(true); },
                error: (xhr) => { API.setHttpErrorState(xhr); resolve(null); }
            });
        });
    }
}