const periodicRefreshPeriod = 10;
let categories = [];
let selectedCategory = "";
let pageManager;
let itemLayout;

let waiting = null;
let waitingGifTrigger = 2000;

function addWaitingGif() {
    clearTimeout(waiting);
    waiting = setTimeout(() => {
        $("#itemsPanel").append($("<div id='waitingGif' class='waitingGifcontainer'><img class='waitingGif' src='Loading_icon.gif' /></div>'"));
    }, waitingGifTrigger)
}
function removeWaitingGif() {
    clearTimeout(waiting);
    $("#waitingGif").remove();
}

Init_UI();

async function Init_UI() {
    pageManager = new PageManager('scrollPanel', 'itemsPanel', 'sample', renderBookmarks);

    $('#createBookmark').on("click", async function () {
        renderCreateBookmarkForm();
    });
    $('#abort').on("click", async function () {
        showBookmarks();
        deleteError();
    });
    $('#aboutCmd').on("click", function () {
        renderAbout();
    });
    showBookmarks();

    Bookmarks_API.start_Periodic_Refresh(async () => { await pageManager.update(); });
}
function showBookmarks() {
    $("#actionTitle").text("Liste des favoris");
    $("#scrollPanel").show();
    $('#abort').hide();
    $('#bookmarkForm').hide();
    $('#aboutContainer').hide();
    $("#createBookmark").show();
    $('#categoriesMenu').show()
    Bookmarks_API.resume_Periodic_Refresh();
}
function hideBookmarks() {
    $("#scrollPanel").hide();
    $("#createBookmark").hide();
    $('#categoriesMenu').hide();
    $("#abort").show();
    Bookmarks_API.stop_Periodic_Refresh();
}

function renderAbout() {
    hideBookmarks();
    $("#actionTitle").text("À propos...");
    $("#aboutContainer").show();
}
function updateDropDownMenu() {
    let DDMenu = $("#DDMenu");
    let selectClass = selectedCategory === "" ? "fa-check" : "fa-fw";
    DDMenu.empty();
    DDMenu.append($(`
        <div class="dropdown-item menuItemLayout" id="allCatCmd">
            <i class="menuIcon fa ${selectClass} mx-2"></i> Toutes les catégories
        </div>
        `));
    DDMenu.append($(`<div class="dropdown-divider"></div>`));
    categories.forEach(category => {
        selectClass = selectedCategory === category ? "fa-check" : "fa-fw";
        DDMenu.append($(`
            <div class="dropdown-item menuItemLayout category" id="allCatCmd">
                <i class="menuIcon fa ${selectClass} mx-2"></i> ${category}
            </div>
        `));
    })
    DDMenu.append($(`<div class="dropdown-divider"></div> `));
    DDMenu.append($(`
        <div class="dropdown-item menuItemLayout" id="aboutCmd">
            <i class="menuIcon fa fa-info-circle mx-2"></i> À propos...
        </div>
        `));
    $('#aboutCmd').on("click", function () {
        renderAbout();
    });
    $('#allCatCmd').on("click", function () {
        showBookmarks();
        selectedCategory = "";
        updateDropDownMenu();
        pageManager.reset();
    });
    $('.category').on("click", function () {
        showBookmarks();
        selectedCategory = $(this).text().trim();
        updateDropDownMenu();
        pageManager.reset();
    });
}
async function compileCategories() {
    categories = [];
    let response = await Bookmarks_API.GetQuery("?select=category&sort=category");
    if (!Bookmarks_API.error) {
        let items = response.data;
        if (items != null) {
            items.forEach(item => {
                if (!categories.includes(item.Category))
                    categories.push(item.Category);
            })
            updateDropDownMenu();
        }
    }
}
async function renderBookmarks(container, queryString) {
    deleteError();
    let endOfData = false;
    queryString += "&sort=category,title";
    if (selectedCategory != "") queryString += "&category=" + selectedCategory;
    addWaitingGif();
    compileCategories();
    let response = await Bookmarks_API.Get(queryString);
    if (!Bookmarks_API.error) {
        let Bookmarks = response.data;
        if (Bookmarks.length > 0) {
            Bookmarks.forEach(Bookmark => {
                container.append(renderBookmark(Bookmark));
            });
            $(".editCmd").off();
            $(".editCmd").on("click", function () {
                renderEditBookmarkForm($(this).attr("editBookmarkId"));
            });
            $(".deleteCmd").off();
            $(".deleteCmd").on("click", function () {
                renderDeleteBookmarkForm($(this).attr("deleteBookmarkId"));
            });
        } else
            endOfData = true;
    } else {
        renderError(Bookmarks_API.currentHttpError);
    }
    removeWaitingGif();
    return endOfData;
}

function renderError(message) {
    hideBookmarks();
    $("#actionTitle").text("Erreur du serveur...");
    $("#errorContainer").show();
    $("#errorContainer").append($(`<div>${message}</div>`));
}
function deleteError() {
    $("#errorContainer").empty();
}
function renderCreateBookmarkForm() {
    renderBookmarkForm();
}
async function renderEditBookmarkForm(id) {
    addWaitingGif();
    let response = await Bookmarks_API.Get(id)
    if (!Bookmarks_API.error) {
        let Bookmark = response.data;
        if (Bookmark !== null)
            renderBookmarkForm(Bookmark);
        else
            renderError("Bookmark introuvable!");
    } else {
        renderError(Bookmarks_API.currentHttpError);
    }
    removeWaitingGif();
}
async function renderDeleteBookmarkForm(id) {
    hideBookmarks();
    $("#actionTitle").text("Retrait");
    $('#bookmarkForm').show();
    $('#bookmarkForm').empty();
    let response = await Bookmarks_API.Get(id)
    if (!Bookmarks_API.error) {
        let Bookmark = response.data;
        let favicon = makeFavicon(Bookmark.Url);
        if (Bookmark !== null) {
            $("#bookmarkForm").append(`
            <div class="BookmarkdeleteForm">
                <h4>Effacer le favori suivant?</h4>
                <br>
                <div class="BookmarkRow" id=${Bookmark.Id}">
                    <div class="BookmarkContainer noselect">
                        <div class="BookmarkLayout">
                            <div class="Bookmark">
                                <a href="${Bookmark.Url}" target="_blank"> ${favicon} </a>
                                <span class="BookmarkTitle">${Bookmark.Title}</span>
                            </div>
                            <span class="BookmarkCategory">${Bookmark.Category}</span>
                        </div>
                     </div>
                </div>   
                <br>
                <input type="button" value="Effacer" id="deleteBookmark" class="btn btn-primary">
                <input type="button" value="Annuler" id="cancel" class="btn btn-secondary">
            </div>    
            `);
            $('#deleteBookmark').on("click", async function () {
                await Bookmarks_API.Delete(Bookmark.Id);
                if (!Bookmarks_API.error) {
                    showBookmarks();
                    await pageManager.update();
                    compileCategories();
                }
                else {
                    console.log(Bookmarks_API.currentHttpError)
                    renderError("Une erreur est survenue!");
                }
            });
            $('#cancel').on("click", function () {
                showBookmarks();
            });

        } else {
            renderError("Bookmark introuvable!");
        }
    } else
        renderError(Bookmarks_API.currentHttpError);
}
function getFormData($form) {
    const removeTag = new RegExp("(<[a-zA-Z0-9]+>)|(</[a-zA-Z0-9]+>)", "g");
    var jsonObject = {};
    $.each($form.serializeArray(), (index, control) => {
        jsonObject[control.name] = control.value.replace(removeTag, "");
    });
    return jsonObject;
}
function newBookmark() {
    Bookmark = {};
    Bookmark.Id = 0;
    Bookmark.Title = "";
    Bookmark.Url = "";
    Bookmark.Category = "";
    return Bookmark;
}
function renderBookmarkForm(Bookmark = null) {
    hideBookmarks();
    let create = Bookmark == null;
    let favicon = `<div class="big-favicon"></div>`;
    if (create)
        Bookmark = newBookmark();
    else
        favicon = makeFavicon(Bookmark.Url, true);
    $("#actionTitle").text(create ? "Création" : "Modification");
    $("#bookmarkForm").show();
    $("#bookmarkForm").empty();
    $("#bookmarkForm").append(`
        <form class="form" id="BookmarkForm">
            <a href="${Bookmark.Url}" target="_blank" id="faviconLink" class="big-favicon" > ${favicon} </a>
            <br>
            <input type="hidden" name="Id" value="${Bookmark.Id}"/>

            <label for="Title" class="form-label">Titre </label>
            <input 
                class="form-control Alpha"
                name="Title" 
                id="Title" 
                placeholder="Titre"
                required
                RequireMessage="Veuillez entrer un titre"
                InvalidMessage="Le titre comporte un caractère illégal"
                value="${Bookmark.Title}"
            />
            <label for="Url" class="form-label">Url </label>
            <input
                class="form-control URL"
                name="Url"
                id="Url"
                placeholder="Url"
                required
                value="${Bookmark.Url}" 
            />
            <label for="Category" class="form-label">Catégorie </label>
            <input 
                class="form-control"
                name="Category"
                id="Category"
                placeholder="Catégorie"
                required
                value="${Bookmark.Category}"
            />
            <br>
            <input type="submit" value="Enregistrer" id="saveBookmark" class="btn btn-primary">
            <input type="button" value="Annuler" id="cancel" class="btn btn-secondary">
        </form>
    `);
    initFormValidation();
    $("#Url").on("change", function () {
        let favicon = makeFavicon($("#Url").val(), true);
        $("#faviconLink").empty();
        $("#faviconLink").attr("href", $("#Url").val());
        $("#faviconLink").append(favicon);
    })
    $('#BookmarkForm').on("submit", async function (event) {
        event.preventDefault();
        let Bookmark = getFormData($("#BookmarkForm"));
        Bookmark = await Bookmarks_API.Save(Bookmark, create);
        if (!Bookmarks_API.error) {
            showBookmarks();
            await pageManager.update();
            compileCategories();
            pageManager.scrollToElem(Bookmark.Id);
        }
        else
            renderError("Une erreur est survenue!");
    });
    $('#cancel').on("click", function () {
        showBookmarks();
    });
}
function makeFavicon(url, big = false) {
    // Utiliser l'API de google pour extraire le favicon du site pointé par url
    // retourne un élément div comportant le favicon en tant qu'image de fond
    ///////////////////////////////////////////////////////////////////////////
    if (url.slice(-1) != "/") url += "/";
    let faviconClass = "favicon";
    if (big) faviconClass = "big-favicon";
    url = "http://www.google.com/s2/favicons?sz=64&domain=" + url;
    return `<div class="${faviconClass}" style="background-image: url('${url}');"></div>`;
}
function renderBookmark(Bookmark) {
    let favicon = makeFavicon(Bookmark.Url);
    return $(`
     <div class="BookmarkRow" id='${Bookmark.Id}'>
        <div class="BookmarkContainer noselect">
            <div class="BookmarkLayout">
                <div class="Bookmark">
                    <a href="${Bookmark.Url}" target="_blank"> ${favicon} </a>
                    <span class="BookmarkTitle">${Bookmark.Title}</span>
                </div>
                <span class="BookmarkCategory">${Bookmark.Category}</span>
            </div>
            <div class="BookmarkCommandPanel">
                <span class="editCmd cmdIcon fa fa-pencil" editBookmarkId="${Bookmark.Id}" title="Modifier ${Bookmark.Title}"></span>
                <span class="deleteCmd cmdIcon fa fa-trash" deleteBookmarkId="${Bookmark.Id}" title="Effacer ${Bookmark.Title}"></span>
            </div>
        </div>
    </div>           
    `);
}
