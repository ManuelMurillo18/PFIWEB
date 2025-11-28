let search = "";
let endOfData = false;
let pageManager;
Init_UI();

function Init_UI() {
    pageManager = new PageManager('scrollPanel', 'wordsPanel', 'sample', renderWords);
    $("#actionTitle").text("Mots");
    $("#search").show();
    $("#abort").hide();
    $('#aboutContainer').hide();
    $("#errorContainer").hide();

    $('#abort').on("click", async function () {
        $("#aboutContainer").hide();
        $("#errorContainer").hide();
        $("#abort").hide();
        $("#search").show();
        $("#scrollPanel").show();
        $("#actionTitle").text("Mots");
    });
    $('#aboutCmd').on("click", function () {
        renderAbout();
    });
    $("#searchKey").on("change", () => {
        doSearch();
    })
    $('#doSearch').on('click', () => {
        doSearch();
    })
    pageManager.reset();
}
function doSearch() {
    search = $("#searchKey").val().replace(' ', ',');
    pageManager.reset();
}
function renderAbout() {
    $("#scrollPanel").hide();
    $("#abort").show();
    $("#search").hide();
    $("#actionTitle").text("À propos...");
    $("#aboutContainer").show();
}
function renderError(message) {
    removeWaitingGif();
    $("#scrollPanel").hide();
    $("#abort").show();
    $("#search").hide();
    $("#actionTitle").text("Erreur du serveur...");
    $("#errorContainer").show();
    $("#errorContainer").empty();
    $("#errorContainer").append(
        $(`
            <span class="errorContainer">
                ${message}
            </span>
        `)
    );
}
async function renderWords(container, queryString) {
    if (search != "") queryString += "&keywords=" + search;
    addWaitingGif();
    let endOfData = true;
    let words = await API.getWords(queryString);
    if (API.error)
        renderError(API.currentHttpError);
    else
        if (words.length > 0) {
            words.forEach(word => { container.append(renderWord(word)); });
            endOfData = false;
        } else console.log('end of data')
    removeWaitingGif();
    return endOfData;
}
function addWaitingGif() {
    $("#wordsPanel").append($("<div id='waitingGif' class='waitingGifcontainer'><img class='waitingGif' src='Loading_icon.gif' /></div>'"));
}
function removeWaitingGif() {
    $("#waitingGif").remove();
}

function renderWord(word) {
    return $(`
     <div class="wordRow" word_id=${word.Id}">
        <div class="wordContainer ">
            <div class="wordLayout">
                 <div></div>
                 <div class="wordInfo">
                    <span class="word">${word.Val}</span>
                    <span class="wordDef">${word.Def}</span>                   
                </div>
            </div>      
        </div>
    </div>           
    `);
}