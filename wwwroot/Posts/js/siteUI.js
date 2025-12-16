////// Author: Nicolas Chourot
////// 2024
//////////////////////////////

let periodicTickRunning = false;

const periodicRefreshPeriod = 10;
const waitingGifTrigger = 2000;
const minKeywordLenth = 3;
const keywordsOnchangeDelay = 500;

let categories = [];
let selectedCategory = "";
let currentETag = "";
let periodic_Refresh_paused = false;
let postsPanel;
let itemLayout;
let waiting = null;
let showKeywords = false;
let keywordsOnchangeTimger = null;

const sessionDurationLimit = 2; // in minutes



Init_UI();
async function Init_UI() {
    postsPanel = new PageManager('postsScrollPanel', 'postsPanel', 'postSample', renderPosts);

    // Check if user is logged in on page load
    if (Accounts_API.isLoggedIn()) {
        let user = Accounts_API.getLoggedUser();
        updateMenuForUser(user);
        initTimeout(60 * sessionDurationLimit, () => { renderLoginForm("Votre session est expirée. Veuillez vous reconnecter."); });
    } else {
        updateMenuForAnonymous();
    }

    $('#createPost').on("click", async function () {
        if (!Accounts_API.isLoggedIn()) {
            renderLoginForm();
            return;
        }
        let user = Accounts_API.getLoggedUser();
        if (!canCreatePost(user)) {
            popupMessage("Vous n'avez pas les droits pour créer des nouvelles.");
            return;
        }
        showCreatePostForm();
    });
    $('#abort').on("click", async function () {
        showPosts();
    });
    $('#aboutCmd').on("click", function () {
        showAbout();
    });
    $("#showSearch").on('click', function () {
        toggleShowKeywords();
        showPosts();
    });

    installKeywordsOnkeyupEvent();
    await showPosts();
    start_Periodic_Refresh();

    $.fn.isInViewport = function () { /* insert a new method to jquery sizzle */
        var elementTop = $(this).offset().top;
        var elementBottom = elementTop + $(this).outerHeight();

        var viewportTop = $(window).scrollTop();
        var viewportBottom = viewportTop + $(window).height();

        return elementBottom > viewportTop && elementTop < viewportBottom;
    };
}

/////////////////////////// User permissions ////////////////////////////////////////////////////////////
function canCreatePost(user) {
    if (!user) return false;
    if (user.isAdmin) return false;
    if (user.isBlocked) return false;
    const wa = user.Authorizations?.writeAccess ?? 0;
    return user.isSuper || wa >= 2;
}

function canEditPost(user, post) {
    if (!user || !post) return false;
    if (user.isAdmin) return false;
    if (user.isBlocked) return false;
    const wa = user.Authorizations?.writeAccess ?? 0;
    return post.OwnerId === user.Id && (user.isSuper || wa >= 2);
}

function canDeletePost(user, post) {
    if (!user || !post) return false;
    if (user.isAdmin) return true;
    if (user.isBlocked) return false;
    const wa = user.Authorizations?.writeAccess ?? 0;
    return post.OwnerId === user.Id && (user.isSuper || wa >= 2);
}

function canLikePost(user) {
    return user != null && !user.isBlocked;
}

function canManageUsers(user) {
    return user != null && user.isAdmin;
}


/////////////////////////// Menu management ////////////////////////////////////////////////////////////

function updateMenuForAnonymous() {
    $('#createPost').hide();
    updateDropDownMenu();
}

function updateMenuForUser(user) {
    if (canCreatePost(user)) {
        $('#createPost').show();
    } else {
        $('#createPost').hide();
    }
    updateDropDownMenu();
}

/////////////////////////// Search keywords UI //////////////////////////////////////////////////////////

function installKeywordsOnkeyupEvent() {
    $("#searchKeys").on('keyup', function () {
        clearTimeout(keywordsOnchangeTimger);
        keywordsOnchangeTimger = setTimeout(() => {
            cleanSearchKeywords();
            showPosts(true);
        }, keywordsOnchangeDelay);
    });
    $("#searchKeys").on('search', function () {
        showPosts(true);
    });
}
function cleanSearchKeywords() {
    let keywords = $("#searchKeys").val().trim().split(' ');
    let cleanedKeywords = "";
    keywords.forEach(keyword => {
        if (keyword.length >= minKeywordLenth) cleanedKeywords += keyword + " ";
    });
    $("#searchKeys").val(cleanedKeywords.trim());
}
function showSearchIcon() {
    $("#showSearch").show();
    if (showKeywords)
        $("#searchKeys").show();
    else
        $("#searchKeys").hide();
}
function hideSearchIcon() {
    $("#showSearch").hide();
    $("#searchKeys").hide();
}
function toggleShowKeywords() {
    showKeywords = !showKeywords;
    if (showKeywords) {
        $("#searchKeys").show();
        $("#searchKeys").focus();
    }
    else {
        $("#searchKeys").hide();
        showPosts(true);
    }
}

/////////////////////////// Views management ////////////////////////////////////////////////////////////

function intialView() {
    $("#createPost").show();
    $('#menu').show();
    $('#commit').hide();
    $('#abort').hide();
    $('#form').hide();
    $('#form').empty();
    $('#aboutContainer').hide();
    $('#errorContainer').hide();

    let user = Accounts_API.getLoggedUser();
    if (user && canCreatePost(user)) {
        $("#createPost").show();
    } else {
        $("#createPost").hide();
    }

    showSearchIcon();
}
async function showPosts(reset = false) {
    intialView();
    $("#viewTitle").text("Fil de nouvelles");
    periodic_Refresh_paused = false;
    await postsPanel.show(reset);
}
function hidePosts() {
    postsPanel.hide();
    hideSearchIcon();
    $("#createPost").hide();
    $('#menu').hide();
    periodic_Refresh_paused = true;
}
function showForm() {
    hidePosts();
    $('#form').show();
    $('#commit').show();
    $('#abort').show();
}
function showError(message, details = "") {
    periodic_Refresh_paused = true;
    popupMessage(message);
}
function showCreatePostForm() {
    showForm();
    $("#viewTitle").text("Ajout");
    renderPostForm();
}
function showEditPostForm(id) {
    showForm();
    $("#viewTitle").text("Modification");
    renderEditPostForm(id);
}
function showDeletePostForm(id) {
    showForm();
    $("#viewTitle").text("Retrait");
    renderDeletePostForm(id);
}
function showAbout() {
    hidePosts();
    $('#commit').hide();
    $('#abort').show();
    $("#viewTitle").text("À propos...");
    $("#aboutContainer").show();
}

//////////////////////////// Posts rendering /////////////////////////////////////////////////////////////

let periodicRefreshHandle = null;
let refreshInProgress = false;

function start_Periodic_Refresh() {
    if (periodicRefreshHandle) clearInterval(periodicRefreshHandle);

    periodicRefreshHandle = setInterval(async () => {
        if (refreshInProgress) return;
        refreshInProgress = true;

        try {
            const stillValid = await validateSessionStillValid();
            if (!stillValid) return;

            if (typeof syncLoggedUserPermissions === "function") {
                await syncLoggedUserPermissions();
                if (!Accounts_API.isLoggedIn()) return; 
            }

            if (periodic_Refresh_paused) return;


            const etag = await Posts_API.HEAD();
            if (Posts_API.error || !etag) return;

            if (currentETag !== "" && currentETag !== etag) {
                currentETag = etag;
                await postsPanel.update(false);
            } else if (currentETag === "") {
                currentETag = etag;
            }
            
            updateVisiblePosts();
        } finally {
            refreshInProgress = false;
        }
    }, periodicRefreshPeriod * 1000);
}

async function updateVisiblePosts() {
    const jobs = [];

    $('.post').each(function () {
        if ($(this).isInViewport()) {
            const id = $(this).attr('id');
            if (id) jobs.push(updatePost(id));
        }
    });

    await Promise.allSettled(jobs);
}

async function updatePost(postId) {
    
    const postElem = $(`.post[id="${postId}"]`);

    const response = await Posts_API.Get(postId);

    
    if (Posts_API.error || !response) {
        if (Posts_API.currentStatus === 404) {
            postElem.remove();
        }
        return;
    }

    const post = response.data;
    if (!post) {
        postElem.remove();
        return;
    }

    const wasExtended = $(`.postTextContainer[postid="${postId}"]`).hasClass("showExtra");
    postElem.replaceWith(renderPost(post));

    if (wasExtended) {
        $(`.postTextContainer[postid="${postId}"]`).addClass('showExtra').removeClass('hideExtra');
        $(`.moreText[postid="${postId}"]`).hide();
        $(`.lessText[postid="${postId}"]`).show();
    }

    linefeeds_to_Html_br(".postText");
    highlightKeywords();
    attach_Posts_UI_Events_Callback();
}


async function renderPosts(container, queryString) {
    addWaitingGif();

    let endOfData = false;
    queryString += "&sort=-date";
    compileCategories();
    if (selectedCategory != "") queryString += "&category=" + selectedCategory;
    if (showKeywords) {
        let keys = $("#searchKeys").val().replace(/[ ]/g, ',');
        if (keys !== "")
            queryString += "&keywords=" + $("#searchKeys").val().replace(/[ ]/g, ',')
    }
    let response = await Posts_API.GetQuery(queryString);
    if (!Posts_API.error) {
        currentETag = response.ETag;
        let Posts = response.data;
        if (Posts.length > 0) {
            Posts.forEach(Post => {
                container.append(renderPost(Post));
            });
        } else
            endOfData = true;
        linefeeds_to_Html_br(".postText");
        highlightKeywords();
        attach_Posts_UI_Events_Callback();
    } else {
        showError(Posts_API.currentHttpError);
    }
    removeWaitingGif();
    return endOfData;
}

function renderPost(post) {
    let date = convertToFrenchDate(UTC_To_Local(post.Date));
    let user = Accounts_API.getLoggedUser();

    let editButton = '';
    let deleteButton = '';

    if (user && canEditPost(user, post)) {
        editButton = `<span class="editCmd cmdIconSmall fa fa-pencil" postId="${post.Id}" title="Modifier nouvelle"></span>`;
    }
    if (user && canDeletePost(user, post)) {
        deleteButton = `<span class="deleteCmd cmdIconSmall fa fa-trash" postId="${post.Id}" title="Effacer nouvelle"></span>`;
    }

    let ownerInfo = '';
    if (post.OwnerName && post.OwnerAvatar) {
        ownerInfo = `
            <div class="postOwner">
                <img src="${post.OwnerAvatar}" class="ownerAvatar" alt="${post.OwnerName}">
                <span class="ownerName">${post.OwnerName}</span>
            </div>`;
    }

    let likesHtml = renderLikes(post, user);

    return $(`
        <div class="post" id="${post.Id}" etag="${currentETag}">
            <div class="postHeader">
                ${post.Category}
                ${editButton}
                ${deleteButton}
            </div>
            ${ownerInfo}
            <div class="postTitle"> ${post.Title} </div>
            <img class="postImage" src='${post.Image}'/>
            <div class="postDate"> ${date} </div>
            <div postId="${post.Id}" class="postTextContainer hideExtra">
                <div class="postText" >${post.Text}</div>
            </div>
            ${likesHtml}
            <div class="postfooter">
                <span postId="${post.Id}" class="moreText cmdIconXSmall fa fa-angle-double-down" title="Afficher la suite"></span>
                <span postId="${post.Id}" class="lessText cmdIconXSmall fa fa-angle-double-up" title="Réduire..."></span>
            </div>
        </div>
    `);
}

function renderLikes(post, user) {
    if (!user) {
        return '';
    }

    let likesCount = post.Likes ? post.Likes.length : 0;
    let userLiked = false;
    let likesNames = [];

    if (post.Likes && post.Likes.length > 0) {
        likesNames = post.Likes.map(like => like.Name);
        if (user) {
            userLiked = post.Likes.some(like => like.Name === user.Name);
        }
    }

    let likeIcon = userLiked ? 'fa-solid fa-thumbs-up liked' : 'fa-regular fa-thumbs-up';
    let likeAction = canLikePost(user) ? (userLiked ? 'unlikeCmd' : 'likeCmd') : '';
    let likeTitle = userLiked ? 'Retirer votre like' : 'Ajouter un like';
    let likesNamesText = likesNames.join(', ');

    return `
        <div class="likesContainer" postId="${post.Id}">
            <span class="${likeAction} likeIcon ${likeIcon}" postId="${post.Id}" title="${likeTitle}"></span>
            <span class="likesCount" title="${likesNamesText}">${likesCount}</span>
        </div>
    `;
}

async function updateLikesUI(postId) {
    let response = await Posts_API.Get(postId);
    if (!Posts_API.error && response.data) {
        let post = response.data;
        let user = Accounts_API.getLoggedUser();
        let likesHtml = renderLikes(post, user);
        $(`.likesContainer[postId="${postId}"]`).replaceWith(likesHtml);
        attachLikesEvents();
    }
}

function attachLikesEvents() {
    $(".likeCmd").off();
    $(".likeCmd").on("click", async function (event) {
        event.preventDefault();
        event.stopPropagation();
        timeout();
        let postId = $(this).attr("postId");
        let user = Accounts_API.getLoggedUser();

        if (!user) {
            renderLoginForm();
            return false;
        }

        let result = await PostLikes_API.addLike(postId, user.Id);
        if (result) {
            await updateLikesUI(postId);
        } else {
            popupMessage("Erreur lors de l'ajout du like");
        }
        return false;
    });

    $(".unlikeCmd").off();
    $(".unlikeCmd").on("click", async function (event) {
        event.preventDefault();
        event.stopPropagation();
        timeout();
        let postId = $(this).attr("postId");
        let user = Accounts_API.getLoggedUser();

        if (!user) {
            renderLoginForm();
            return false;
        }

        let result = await PostLikes_API.removeLike(postId, user.Id);
        if (result) {
            await updateLikesUI(postId);
        } else {
            popupMessage("Erreur lors du retrait du like");
        }
        return false;
    });
}

async function compileCategories() {
    categories = [];
    let response = await Posts_API.GetQuery("?fields=category&sort=category");
    if (!Posts_API.error) {
        let items = response.data;
        if (items != null) {
            items.forEach(item => {
                if (!categories.includes(item.Category))
                    categories.push(item.Category);
            })
            if (!categories.includes(selectedCategory))
                selectedCategory = "";
            updateDropDownMenu(categories);
        }
    }
}

function updateDropDownMenu() {
    let DDMenu = $("#DDMenu");
    let user = Accounts_API.getLoggedUser();
    DDMenu.empty();

    if (user) {
        DDMenu.append($(`
            <div class="dropdown-item menuItemLayout userHeader">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <img src="${user.Avatar}" class="menuUserAvatar" alt="${user.Name}">
                    <span>${user.Name}</span>
                </div>
            </div>
        `));
        DDMenu.append($(`<div class="dropdown-divider"></div>`));

        if (canManageUsers(user)) {
            DDMenu.append($(`
                <div class="dropdown-item menuItemLayout" id="manageUsersCmd">
                    <i class="menuIcon fa fa-users mx-2"></i> Gestion des usagers
                </div>
            `));
        }

        DDMenu.append($(`
            <div class="dropdown-item menuItemLayout" id="modifyProfileCmd">
                <i class="menuIcon fa fa-user-edit mx-2"></i> Modifier votre profil
            </div>
        `));

        DDMenu.append($(`
            <div class="dropdown-item menuItemLayout" id="logoutCmd">
                <i class="menuIcon fa fa-sign-out-alt mx-2"></i> Déconnexion
            </div>
        `));
        DDMenu.append($(`<div class="dropdown-divider"></div>`));
    } else {
        DDMenu.append($(`
            <div class="dropdown-item menuItemLayout" id="loginCmd">
                <i class="menuIcon fa fa-sign-in-alt mx-2"></i> Connexion
            </div>
        `));
        DDMenu.append($(`<div class="dropdown-divider"></div>`));
    }

    // Categories section
    let selectClass = selectedCategory === "" ? "fa-check" : "fa-fw";
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

    // Attach events
    $('#aboutCmd').on("click", function () {
        showAbout();
    });
    $('#allCatCmd').on("click", async function () {
        selectedCategory = "";
        await showPosts(true);
        updateDropDownMenu();
    });
    $('.category').on("click", async function () {
        selectedCategory = $(this).text().trim();
        await showPosts(true);
        updateDropDownMenu();
    });

    if (user) {
        $('#logoutCmd').on("click", async function () {
            await Accounts_API.logout(user.Id);
            noTimeout();
            updateMenuForAnonymous();
            await showPosts(true);
        });
        $('#modifyProfileCmd').on("click", function () {
            renderModifyProfileForm();
        });
        if (canManageUsers(user)) {
            $('#manageUsersCmd').on("click", function () {
                renderUserManagementForm();
            });
        }
    } else {
        $('#loginCmd').on("click", function () {
            renderLoginForm();
        });
    }
}

function attach_Posts_UI_Events_Callback() {

    linefeeds_to_Html_br(".postText");

    $(".editCmd").off();
    $(".editCmd").on("click", function () {
        timeout();
        showEditPostForm($(this).attr("postId"));
    });
    $(".deleteCmd").off();
    $(".deleteCmd").on("click", function () {
        timeout();
        showDeletePostForm($(this).attr("postId"));
    });
    $(".moreText").off();
    $(".moreText").click(function () {
        $(`.lessText[postId=${$(this).attr("postId")}]`).show();
        $(this).hide();
        $(`.postTextContainer[postId=${$(this).attr("postId")}]`).addClass('showExtra');
        $(`.postTextContainer[postId=${$(this).attr("postId")}]`).removeClass('hideExtra');
    })
    $(".lessText").off();
    $(".lessText").click(function () {
        $(`.moreText[postId=${$(this).attr("postId")}]`).show();
        $(this).hide();
        postsPanel.scrollToElem($(this).attr("postId"));
        $(`.postTextContainer[postId=${$(this).attr("postId")}]`).addClass('hideExtra');
        $(`.postTextContainer[postId=${$(this).attr("postId")}]`).removeClass('showExtra');
    })

    attachLikesEvents();
}

function addWaitingGif() {
    clearTimeout(waiting);
    waiting = setTimeout(() => {
        postsPanel.itemsPanel.append($("<div id='waitingGif' class='waitingGifcontainer'><img class='waitingGif' src='Loading_icon.gif' /></div>'"));
    }, waitingGifTrigger)
}
function removeWaitingGif() {
    clearTimeout(waiting);
    $("#waitingGif").remove();
}

/////////////////////// Posts content manipulation ///////////////////////////////////////////////////////

function linefeeds_to_Html_br(selector) {
    $.each($(selector), function () {
        let postText = $(this);
        var str = postText.html();
        var regex = /[\r\n]/g;
        postText.html(str.replace(regex, "<br>"));
    })
}

function highlight(text, elem) {
    text = text.trim();
    if (text.length >= minKeywordLenth) {
        var innerHTML = elem.innerHTML;
        let startIndex = 0;
        while (startIndex < innerHTML.length) {
            var normalizedHtml = innerHTML.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            var index = normalizedHtml.indexOf(text, startIndex);
            let highLightedText = "";
            if (index >= startIndex) {
                highLightedText = "<span class='highlight'>" + innerHTML.substring(index, index + text.length) + "</span>";
                innerHTML = innerHTML.substring(0, index) + highLightedText + innerHTML.substring(index + text.length);
                startIndex = index + highLightedText.length + 1;
            } else
                startIndex = innerHTML.length + 1;
        }
        elem.innerHTML = innerHTML;
    }
}
function highlightKeywords() {
    if (showKeywords) {
        let keywords = $("#searchKeys").val().split(' ');
        if (keywords.length > 0) {
            keywords.forEach(key => {
                let titles = document.getElementsByClassName('postTitle');
                Array.from(titles).forEach(title => {
                    highlight(key, title);
                })
                let texts = document.getElementsByClassName('postText');
                Array.from(texts).forEach(text => {
                    highlight(key, text);
                })
            })
        }
    }
}

async function purgeUserPostsAndLikes(userId) {
    let userLikes = await PostLikes_API.GetQuery("?UserId=" + userId);
    if (userLikes) {
        for (const like of userLikes) {
            await PostLikes_API.Delete(like.Id);
        }
    }

    while (true) {
        let resp = await Posts_API.GetQuery(`?OwnerId=${userId}&limit=50&offset=0`);
        if (!resp || !resp.data || resp.data.length === 0) break;

        for (const post of resp.data) {
            let postLikes = await PostLikes_API.getPostLikes(post.Id);
            if (postLikes) {
                for (const pl of postLikes) {
                    await PostLikes_API.Delete(pl.Id);
                }
            }
            await Posts_API.Delete(post.Id);
        }
    }
}

//////////////////////// Authentication Forms /////////////////////////////////////////////////////////////////

function renderLoginForm(message = "") {
    timeout();
    hidePosts();
    $("#viewTitle").text("Connexion");
    $('#commit').hide();
    $('#abort').show();
    $("#form").show();
    $("#form").empty();

    let errorMessage = message ? `<div class="errorMessage">${message}</div>` : '';

    $("#form").append(`
        <div class="loginForm">
            <h3>Connexion</h3>
            ${errorMessage}
            <form id="loginFormElement">
                <input type="email" id="loginEmail" class="form-control" placeholder="Courriel" required>
                <div id="emailError" class="errorField"></div>

                <input type="password" id="loginPassword" class="form-control" placeholder="Mot de passe" required>
                <div id="passwordError" class="errorField"></div>

                <button type="submit" class="btn btn-primary">Entrer</button>
                <button type="button" id="registerBtn" class="btn btn-info">Nouveau compte</button>
            </form>
        </div>
    `);

    $('#loginFormElement').on("submit", async function (event) {
        event.preventDefault();
        $('#emailError').text('');
        $('#passwordError').text('');

        let email = $('#loginEmail').val();
        let password = $('#loginPassword').val();

        let result = await Accounts_API.login(email, password);

        if (result && result.Access_token) {
            Accounts_API.setBearerToken(result.Access_token);
            result.User.Password = password;
            Accounts_API.setLoggedUser(result.User);

            if (result.User.VerifyCode !== "verified") {
                renderVerifyEmailForm(result.User);
            } else {
                updateMenuForUser(result.User);
                initTimeout(600, () => { renderLoginForm("Votre session est expirée. Veuillez vous reconnecter."); });
                await showPosts(true);
            }
        } else {
            if (Accounts_API.currentStatus === 481) {
                $('#emailError').text('Courriel d\'utilisateur introuvable');
            } else if (Accounts_API.currentStatus === 482) {
                $('#passwordError').text('Mot de passe incorrecte');
            } else if (Accounts_API.currentStatus === 403 || Accounts_API.currentStatus === 405) {
                sessionStorage.removeItem("bearerToken");
                sessionStorage.removeItem("user");
                renderLoginForm("Compte bloqué par l'administrateur");
            } else if (Accounts_API.currentStatus === 0) {
                renderLoginForm('Le serveur ne répond pas');
            } else {
                renderLoginForm(Accounts_API.currentHttpError);
            }
        }
    });

    $('#registerBtn').on("click", function () {
        renderRegisterForm();
    });
}

function renderRegisterForm() {
    timeout();
    hidePosts();
    $("#viewTitle").text("Inscription");
    $('#commit').hide();
    $('#abort').show();
    $("#form").show();
    $("#form").empty();

    $("#form").append(`
        <div class="registerForm">
            <h3>Inscription</h3>
            <form id="registerFormElement">
                <label>Adresse de courriel</label>
                <input type="email" id="registerEmail" class="form-control Email"
                    placeholder="Courriel" required
                    RequireMessage="Veuillez entrer votre courriel"
                    InvalidMessage="Veuillez entrer un courriel valide"
                    CustomErrorMessage="Ce courriel est déjà utilisé">

                <input type="email" id="registerEmailVerify" class="form-control MatchedInput"
                    matchedInputId="registerEmail"
                    placeholder="Vérification" required
                    RequireMessage="Veuillez entrer votre courriel"
                    InvalidMessage="Les courriels ne correspondent pas">

                <label>Mot de passe</label>
                <input type="password" id="registerPassword" class="form-control"
                    placeholder="Mot de passe" required
                    RequireMessage="Veuillez entrer un mot de passe"
                    InvalidMessage="Le mot de passe doit contenir au moins 6 caractères">

                <input type="password" id="registerPasswordVerify" class="form-control MatchedInput"
                    matchedInputId="registerPassword"
                    placeholder="Vérification" required
                    RequireMessage="Veuillez entrer votre mot de passe"
                    InvalidMessage="Les mots de passe ne correspondent pas">

                <label>Nom</label>
                <input type="text" id="registerName" class="form-control"
                    placeholder="Nom" required>

                <label>Avatar</label>
                <div class='imageUploader'
                     newImage='true'
                     controlId='registerAvatar'
                     imageSrc='news-logo-upload.png'
                     waitingImage="Loading_icon.gif">
                </div>

                <button type="submit" id="registerSubmitBtn" class="btn btn-primary">Enregistrer</button>
                <button type="button" id="cancelRegisterBtn" class="btn btn-secondary">Annuler</button>
            </form>
        </div>
    `);

    initImageUploaders();
    initFormValidation();
    addConflictValidation(Accounts_API.serverHost() + "/accounts/conflict", "registerEmail", "registerSubmitBtn");

    $('#registerFormElement').on("submit", async function (event) {
        event.preventDefault();

        let userData = {
            Email: $('#registerEmail').val(),
            Password: $('#registerPassword').val(),
            Name: $('#registerName').val(),
            Avatar: $('#registerAvatar').val()
        };

        let result = await Accounts_API.register(userData);

        if (result) {
            popupMessage("Votre compte a été créé. Veuillez prendre vos courriels pour récupérer votre code de vérification qui vous sera demandé lors de votre prochaine connexion.");
            renderLoginForm();
        } else {
            popupMessage("Erreur lors de la création du compte: " + Accounts_API.currentHttpError);
        }
    });

    $('#cancelRegisterBtn').on("click", function () {
        renderLoginForm();
    });
}

function renderVerifyEmailForm(user) {
    timeout();
    hidePosts();
    $("#viewTitle").text("Vérification");
    $('#commit').hide();
    $('#abort').show();
    $("#form").show();
    $("#form").empty();

    $("#form").append(`
        <div class="verifyForm">
            <h3>Veuillez entrer le code de vérification de que vous avez reçu par courriel</h3>
            <form id="verifyFormElement">
                <input type="text" id="verifyCode" class="form-control"
                    placeholder="Code de vérification de courriel" required>

                <button type="submit" class="btn btn-primary">Vérifier</button>
            </form>
        </div>
    `);

    $('#verifyFormElement').on("submit", async function (event) {
        event.preventDefault();

        let code = $('#verifyCode').val();
        let result = await Accounts_API.verify(user.Id, code);

        if (result) {
            user.VerifyCode = "verified";
            Accounts_API.setLoggedUser(user);
            updateMenuForUser(user);
            initTimeout(600, () => { renderLoginForm("Votre session est expirée. Veuillez vous reconnecter."); });
            await showPosts(true);
        } else {
            popupMessage("Code de vérification invalide");
        }
    });
}

function renderModifyProfileForm() {
    timeout();
    hidePosts();
    $("#viewTitle").text("Modification");
    $('#commit').hide();
    $('#abort').show();
    $("#form").show();
    $("#form").empty();

    let user = Accounts_API.getLoggedUser();

    $("#form").append(`
        <div class="modifyProfileForm">
            <h3>Modification</h3>
            <form id="modifyProfileFormElement">
                <input type="hidden" id="userId" value="${user.Id}">

                <label>Adresse de courriel</label>
                <input type="email" id="modifyEmail" class="form-control Email"
                    value="${user.Email}" required>

                <input type="email" id="modifyEmailVerify" class="form-control MatchedInput"
                    matchedInputId="modifyEmail"
                    value="${user.Email}"
                    placeholder="Vérification" required>

                <label>Mot de passe</label>
                <input type="password" id="modifyPassword" class="form-control"
                    placeholder="Mot de passe" required
                        RequireMessage="Veuillez entrer votre mot de passe"
                        InvalidMessage="Le mot de passe doit contenir au moins 6 caractères">

                <input type="password" id="modifyPasswordVerify" class="form-control MatchedInput"
                        matchedInputId="modifyPassword"
                        placeholder="Vérification" required
                        RequireMessage="Veuillez vérifier votre mot de passe"
                         InvalidMessage="Les mots de passe ne correspondent pas">


                <label>Nom</label>
                <input type="text" id="modifyName" class="form-control"
                    value="${user.Name}" required>

                <label>Avatar</label>
                <div class='imageUploader'
                     newImage='false'
                     controlId='modifyAvatar'
                     imageSrc='${user.Avatar}'
                     waitingImage="Loading_icon.gif">
                </div>

                <button type="submit" class="btn btn-primary">Enregistrer</button>
                <button type="button" id="deleteAccountBtn" class="btn btn-warning">Effacer le compte</button>
                <button type="button" id="cancelModifyBtn" class="btn btn-secondary">Annuler</button>
            </form>
        </div>
    `);

    initImageUploaders();
    initFormValidation();

    $('#modifyProfileFormElement').on("submit", async function (event) {
        event.preventDefault();

        let userData = {
            Id: user.Id,
            Email: $('#modifyEmail').val(),
            Name: $('#modifyName').val(),
            Avatar: $('#modifyAvatar').val()
        };
        userData.Password = $('#modifyPassword').val();

        let emailChanged = userData.Email !== user.Email;

        let result = await Accounts_API.modify(userData);

        if (result) {
            result.Password = userData.Password ?? user.Password; 
            if (emailChanged) {
                popupMessage("Votre profil a été modifié. Veuillez vérifier votre nouveau courriel.");
                Accounts_API.setLoggedUser(result);
                renderVerifyEmailForm(result);
            } else {
                Accounts_API.setLoggedUser(result);
                updateMenuForUser(result);
                await showPosts(true);
            }
        } else {
            popupMessage("Erreur lors de la modification: " + Accounts_API.currentHttpError);
        }
    });

    $('#deleteAccountBtn').on("click", function () {
        renderDeleteAccountConfirm(user);
    });

    $('#cancelModifyBtn').on("click", async function () {
        await showPosts();
    });
}

function renderDeleteAccountConfirm(user) {
    timeout();
    $("#form").empty();

    $("#form").append(`
        <div class="deleteAccountConfirm">
            <h3>Voulez-vous vraiment effacer votre compte?</h3>
            <p>Cette action est irréversible. Toutes vos nouvelles et likes seront effacés.</p>
            <button id="confirmDeleteBtn" class="btn btn-danger">Effacer mon compte</button>
            <button id="cancelDeleteBtn" class="btn btn-secondary">Annuler</button>
        </div>
    `);

    $('#confirmDeleteBtn').on("click", async function () {
        await purgeUserPostsAndLikes(user.Id);

        let result = await Accounts_API.remove(user.Id);
        if (result) {
            noTimeout();
            updateMenuForAnonymous();
            await showPosts(true);
        } else {
            popupMessage("Erreur lors de la suppression du compte");
        }
    });


    $('#cancelDeleteBtn').on("click", function () {
        renderModifyProfileForm();
    });
}

async function renderUserManagementForm() {
    timeout();
    hidePosts();
    $("#viewTitle").text("Gestion des usagers");
    $('#commit').hide();
    $('#abort').show();
    $("#form").show().empty();

    if (typeof syncLoggedUserPermissions === "function") {
        await syncLoggedUserPermissions();
    }

    const response = await authFetch(Accounts_API.serverHost() + "/api/accounts");

    if (!response) return;

    if (response.status === 401 || response.status === 403) {
        await forceLocalLogout("Accès refusé. Veuillez vous reconnecter.");
        return;
    }

    if (!response.ok) {
        popupMessage("Erreur lors du chargement des usagers");
        return;
    }

    const users = await response.json();

    $("#form").append(`
        <div class="userManagementForm">
            <h3>Gestion des usagers</h3>
            <div id="usersList"></div>
        </div>
    `);

    users.forEach(user => {
        $("#usersList").append(renderUserManagementRow(user));
    });

    attachUserManagementEvents();
}


function renderUserManagementRow(user) {
    let userTypeLabel = '';
    let userTypeClass = '';

    if (user.isAdmin) {
        userTypeLabel = 'Administrateur';
        userTypeClass = 'badge-danger';
    } else if (user.isSuper) {
        userTypeLabel = 'Super Usager';
        userTypeClass = 'badge-warning';
    } else {
        userTypeLabel = 'Usager de base';
        userTypeClass = 'badge-info';
    }

    let blockLabel = user.isBlocked ? 'Débloquer' : 'Bloquer';
    let blockIcon = user.isBlocked ? 'fa-unlock' : 'fa-lock';
    let blockedBadge = user.isBlocked ? '<span class="badge badge-secondary">Bloqué</span>' : '';

    return `
        <div class="userRow" userId="${user.Id}">
            <div class="userInfo">
                <img src="${user.Avatar}" class="userRowAvatar" alt="${user.Name}">
                <div class="userDetails">
                    <div class="userName">${user.Name}</div>
                    <div class="userEmail">${user.Email}</div>
                    <span class="badge ${userTypeClass}">${userTypeLabel}</span>
                    ${blockedBadge}
                </div>
            </div>
            <div class="userActions">
                <button class="btn btn-sm btn-primary changePermissionBtn" userId="${user.Id}" title="Changer les permissions">
                     Permissions
                </button>
                <button class="btn btn-sm btn-warning blockUserBtn" userId="${user.Id}" title="${blockLabel}">
                     ${blockLabel}
                </button>
                <button class="btn btn-sm btn-danger deleteUserBtn" userId="${user.Id}" title="Effacer">
                     Effacer
                </button>
            </div>
        </div>
    `;
}

function attachUserManagementEvents() {
    $('.changePermissionBtn').off();
    $('.changePermissionBtn').on("click", async function (event) {
        event.preventDefault();
        event.stopPropagation();
        let userId = $(this).attr("userId");
        await changeUserPermissions(userId);
        return false;
    });

    $('.blockUserBtn').off();
    $('.blockUserBtn').on("click", async function (event) {
        event.preventDefault();
        event.stopPropagation();
        let userId = $(this).attr("userId");
        await toggleBlockUser(userId);
        return false;
    });

    $('.deleteUserBtn').off();
    $('.deleteUserBtn').on("click", async function (event) {
        event.preventDefault();
        event.stopPropagation();
        let userId = $(this).attr("userId");
        await confirmDeleteUser(userId);
        return false;
    });
}

async function changeUserPermissions(userId) {
    timeout();

    let response = await fetch(Accounts_API.serverHost() + "/api/accounts/" + userId, {
        headers: { "Authorization": "Bearer " + sessionStorage.getItem("bearerToken") }
    });

    if (!response.ok) {
        popupMessage("Erreur lors du chargement de l'usager");
        return;
    }

    let user = await response.json();

    let promoteResponse = await fetch(Accounts_API.serverHost() + "/accounts/promote", {
        method: "POST",
        headers: {
            "Authorization": "Bearer " + sessionStorage.getItem("bearerToken"),
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ Id: user.Id })
    });

    if (promoteResponse.ok) {
        let updatedUser = await promoteResponse.json();

        let userRowHtml = renderUserManagementRow(updatedUser);
        $(`.userRow[userId="${userId}"]`).replaceWith(userRowHtml);

        attachUserManagementEvents();
    } else {
        popupMessage("Erreur lors de la modification des permissions");
    }
}

async function toggleBlockUser(userId) {
    timeout();

    let response = await fetch(Accounts_API.serverHost() + "/api/accounts/" + userId, {
        headers: { "Authorization": "Bearer " + sessionStorage.getItem("bearerToken") }
    });

    if (!response.ok) {
        popupMessage("Erreur lors du chargement de l'usager");
        return;
    }

    let user = await response.json();

    let toggleResponse = await fetch(Accounts_API.serverHost() + "/accounts/toggleblock", {
        method: "POST",
        headers: {
            "Authorization": "Bearer " + sessionStorage.getItem("bearerToken"),
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ Id: user.Id })
    });

    if (toggleResponse.ok) {
        let updatedUser = await toggleResponse.json();

        let userRowHtml = renderUserManagementRow(updatedUser);
        $(`.userRow[userId="${userId}"]`).replaceWith(userRowHtml);

        attachUserManagementEvents();
    } else {
        popupMessage("Erreur lors du blocage/déblocage");
    }
}

async function confirmDeleteUser(userId) {
    let response = await fetch(Accounts_API.serverHost() + "/api/accounts/" + userId, {
        headers: { "Authorization": "Bearer " + sessionStorage.getItem("bearerToken") }
    });

    if (!response.ok) {
        popupMessage("Erreur lors du chargement de l'usager");
        return;
    }

    let user = await response.json();

    timeout();
    $("#form").empty();

    $("#form").append(`
        <div class="deleteUserConfirm">
            <h3>Confirmer la suppression</h3>
            <div class="userToDelete">
                <img src="${user.Avatar}" class="userRowAvatar" alt="${user.Name}">
                <div>
                    <div class="userName">${user.Name}</div>
                    <div class="userEmail">${user.Email}</div>
                </div>
            </div>
            <p>Voulez-vous vraiment effacer cet usager?</p>
            <p class="text-danger">Toutes ses nouvelles et likes seront également effacés.</p>
            <button id="confirmDeleteUserBtn" class="btn btn-danger">Effacer l'usager</button>
            <button id="cancelDeleteUserBtn" class="btn btn-secondary">Annuler</button>
        </div>
    `);

$('#confirmDeleteUserBtn').one("click", async function () {
    await purgeUserPostsAndLikes(userId);

    let deleteResponse = await fetch(Accounts_API.serverHost() + "/api/accounts/" + userId, {
        method: "DELETE",
        headers: { "Authorization": "Bearer " + sessionStorage.getItem("bearerToken") }
    });

    if (deleteResponse.ok) {
        await renderUserManagementForm();
    } else {
        popupMessage("Erreur lors de la suppression de l'usager");
    }
});
    $('#cancelDeleteUserBtn').on("click", async function () {
        await renderUserManagementForm();
    });
}

//////////////////////// Post Forms rendering /////////////////////////////////////////////////////////////////

async function renderEditPostForm(id) {
    $('#commit').show();
    addWaitingGif();
    let response = await Posts_API.Get(id)
    if (!Posts_API.error) {
        let Post = response.data;

        if (Post !== null)
            renderPostForm(Post);
        else
            showError("Post introuvable!");
    } else {
        showError(Posts_API.currentHttpError);
    }
    removeWaitingGif();
}
async function renderDeletePostForm(id) {
    $("#form").empty();

    $('#commit').off('click');
    $('#abort').off('click');

    let response = await Posts_API.Get(id);
    if (Posts_API.error) {
        showError(Posts_API.currentHttpError);
        return;
    }

    let post = response.data;


    if (!post) {
        showError("Post introuvable!");
        return;
    }

    let date = convertToFrenchDate(UTC_To_Local(post.Date));

    $("#form").append(`
        <div class="post" id="${post.Id}">
            <div class="postHeader">${post.Category}</div>
            <div class="postTitle ellipsis">${post.Title}</div>
            <img class="postImage" src="${post.Image}"/>
            <div class="postDate">${date}</div>
            <div class="postTextContainer showExtra">
                <div class="postText">${post.Text}</div>
            </div>
        </div>
        <div class="formHint">Clique ✔ pour confirmer la suppression.</div>
    `);

    linefeeds_to_Html_br("#form .postText");

    $('#commit').one("click", async function () {
        await Posts_API.Delete(post.Id);
        if (!Posts_API.error) {
            await showPosts(true);
        } else {
            showError(Posts_API.currentHttpError);
        }
    });

    $('#abort').one("click", async function () {
        await showPosts();
    });
}

function newPost() {
    let Post = {};
    Post.Id = 0;
    Post.Title = "";
    Post.Text = "";
    Post.Image = "news-logo-upload.png";
    Post.Category = "";
    let user = Accounts_API.getLoggedUser();
    if (user) {
        Post.OwnerId = user.Id;
    }
    return Post;
}
function renderPostForm(post = null) {
    timeout();
    let create = post == null;
    if (create) post = newPost();
    $("#form").show();
    $("#form").empty();
    $("#form").append(`
        <form class="form" id="postForm">
            <input type="hidden" name="Id" value="${post.Id}"/>
            <input type="hidden" name="Date" value="${post.Date}"/>
            <input type="hidden" name="OwnerId" value="${post.OwnerId}"/>
            <label for="Category" class="form-label">Catégorie </label>
            <input
                class="form-control"
                name="Category"
                id="Category"
                placeholder="Catégorie"
                required
                value="${post.Category}"
            />
            <label for="Title" class="form-label">Titre </label>
            <input
                class="form-control"
                name="Title"
                id="Title"
                placeholder="Titre"
                required
                RequireMessage="Veuillez entrer un titre"
                InvalidMessage="Le titre comporte un caractère illégal"
                value="${post.Title}"
            />
            <label for="Url" class="form-label">Texte</label>
             <textarea class="form-control"
                          name="Text"
                          id="Text"
                          placeholder="Texte"
                          rows="9"
                          required
                          RequireMessage = 'Veuillez entrer une Description'>${post.Text}</textarea>

            <label class="form-label">Image </label>
            <div class='imageUploaderContainer'>
                <div class='imageUploader'
                     newImage='${create}'
                     controlId='Image'
                     imageSrc='${post.Image}'
                     waitingImage="Loading_icon.gif">
                </div>
            </div>
            <div id="keepDateControl">
                <input type="checkbox" name="keepDate" id="keepDate" class="checkbox" checked>
                <label for="keepDate"> Conserver la date de création </label>
            </div>
            <input type="submit" value="Enregistrer" id="savePost" class="btn btn-primary displayNone">
        </form>
    `);
    if (create) $("#keepDateControl").hide();

    initImageUploaders();
    initFormValidation();

    $("#commit").off("click").on("click", function (e) {
        e.preventDefault();
        document.getElementById("savePost").click(); 
    });

    $('#postForm').on("submit", async function (event) {
        event.preventDefault();
        let post = getFormData($("#postForm"));
        if (post.Category != selectedCategory)
            selectedCategory = "";
        if (create || !('keepDate' in post))
            post.Date = Local_to_UTC(Date.now());
        delete post.keepDate;
        post = await Posts_API.Save(post, create);
        if (!Posts_API.error) {
            await showPosts();
            postsPanel.scrollToElem(post.Id);
        }
        else
            showError(Posts_API.currentHttpError);
    });
    $('#cancel').on("click", async function () {
        await showPosts();
    });
}
function getFormData($form) {
    const removeTag = new RegExp("(<[a-zA-Z0-9]+>)|(</[a-zA-Z0-9]+>)", "g");
    var jsonObject = {};
    $.each($form.serializeArray(), (index, control) => {
        jsonObject[control.name] = control.value.replace(removeTag, "");
    });
    return jsonObject;
}


async function renderError(message) {
    await Posts_API.logout();
    updateDropDownMenu();
    switch (Posts_API.currentStatus) {
        case 401:
        case 403:
        case 405:
            message = "Accès refusé...Expiration de votre session. Veuillez vous reconnecter.";

            renderLoginForm();
            break;
        case 404: message = "Ressource introuvable..."; break;
        case 409: message = "Ressource conflictuelle..."; break;
        default: if (!message) message = "Un problème est survenu...";
    }

    $("#form").empty();
    $("#form").append(
        $(`
             <fieldset>
                <legend><b>Une erreur est survenue</b></legend>
                <div class="errorContainer">
                    ${message}
                </div>
                <hr>
                <div class="form">
                    <button id="connectCmd" class="form-control btn-primary">Connexion</button>
                </div>
            </fieldset>
        `)
    );

    $('#connectCmd').on("click", function () {
        renderLoginForm();
    });
}

async function forceLocalLogout(message = "Votre compte a été supprimé par un administrateur.") {
    sessionStorage.removeItem("bearerToken");
    sessionStorage.removeItem("user");

    noTimeout();
    updateMenuForAnonymous();
    await showPosts(true);

    popupMessage(message);
}

let missingUserCount = 0;

async function validateSessionStillValid() {
    if (!Accounts_API.isLoggedIn()) return true;

    const user = Accounts_API.getLoggedUser();
    if (!user?.Email) return true;

    const checkExists = async () => {
        const res = await Accounts_API.conflict(user.Email, 0);
        if (res === null || Accounts_API.error) return null;
        return (res === true) || (res?.conflict === true) || (res?.Conflict === true);
    };

    const exists1 = await checkExists();
    if (exists1 === null) return true;
    if (exists1 === true) return true;

    await new Promise(r => setTimeout(r, 200));
    const exists2 = await checkExists();
    if (exists2 === null) return true;

    if (exists2 === false) {
        await forceLocalLogout("Votre compte a été supprimé par un administrateur.");
        return false;
    }
    return true;
}




let permissionPollLast = 0;
const permissionPollMs = 8000;
let permissionSyncRunning = false;

function permissionSignature(u) {
    if (!u) return "";
    return JSON.stringify({
        Id: u.Id,
        wa: u.Authorizations?.writeAccess ?? 0,
        ra: u.Authorizations?.readAccess ?? 0,
        isAdmin: !!u.isAdmin,
        isSuper: !!u.isSuper,
        isBlocked: !!u.isBlocked
    });
}

async function syncLoggedUserPermissions() {
    if (!Accounts_API.isLoggedIn() || permissionSyncRunning) return;

    const now = Date.now();
    if (now - permissionPollLast < permissionPollMs) return;
    permissionPollLast = now;

    const current = Accounts_API.getLoggedUser();
    if (!current?.Email || !current?.Password) return;

    permissionSyncRunning = true;
    try {
        const res = await Accounts_API.login(current.Email, current.Password);

        if (!res?.Access_token || !res?.User) {
            const err = (Accounts_API.currentHttpError || "").toLowerCase();

            if (Accounts_API.currentStatus === 481 || err.includes("not found")) {
                await forceLocalLogout("Votre compte a été supprimé par un administrateur.");
                return;
            }

            if (Accounts_API.currentStatus === 403||Accounts_API.currentStatus === 405 || err.includes("blocked") || err.includes("bloqu")) {
                await forceLocalLogout("Votre compte a été bloqué par un administrateur.");
                return;
            }

            if (Accounts_API.currentStatus === 482) {
                await forceLocalLogout("Session invalide. Veuillez vous reconnecter.");
                return;
            }

            return;
        }

        res.User.Password = current.Password;
        if (!res.User.Avatar) res.User.Avatar = current.Avatar;

        Accounts_API.setBearerToken(res.Access_token);

        if (permissionSignature(res.User) !== permissionSignature(current)) {
            Accounts_API.setLoggedUser(res.User);
            updateMenuForUser(res.User);
            updateVisiblePosts(); 
        }
    } finally {
        permissionSyncRunning = false;
    }
}

async function authFetch(url, options = {}) {
    const token = Accounts_API.getBearerToken(); // mieux que sessionStorage direct
    if (!token) {
        renderLoginForm("Session invalide. Veuillez vous reconnecter.");
        return null;
    }

    const headers = new Headers(options.headers || {});
    headers.set("Authorization", "Bearer " + token);

    return fetch(url, { ...options, headers });
}









