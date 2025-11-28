class PageManager {
    // scrollPanelId represent the container that allow to scroll through itemsPanel
    // itemSampleId is used to find the size of items in pixels
    // getItemsCallBack is a function that collect and render all items in the itemsPanel
    // and must return true when there is no more data to collect
    constructor(scrollPanelId, itemsPanelId, itemSampleId, getItemsCallBack) {
        this.loadMoreTriggerMargin = 10;
        this.itemsPanelId = itemsPanelId;
        this.hidden = false;
        this.scrollPanel = $(`#${scrollPanelId}`);
        this.itemsPanel = $(`#${itemsPanelId}`);

        this.itemLayout = {
            width: $(`#${itemSampleId}`).outerWidth(),
            height: $(`#${itemSampleId}`).outerHeight()
        };

        this.itemsPanel.empty();

        this.itemsPanel_alt = this.itemsPanel.clone(true, true);
        this.itemsPanel_alt.attr('id', itemsPanelId + "-alt");
        this.itemsPanel_alt.hide();

        this.scrollPanel.append(this.itemsPanel_alt);

        this.currentPage = { limit: -1, offset: 0 };
        this.resizeTimer = null;
        this.resizeEndTriggerDelai = 300;
        this.getItems = getItemsCallBack;
        this.installViewportReziseEvent();
    }
    async show(reset = false) {
        this.scrollPanel.show();
        this.hidden = false;
        if (reset)
            this.reset();
        else
            await this.update(false);
    }
    hide() {
        this.storeScrollPosition();
        this.scrollPanel.hide();
        this.hidden = true;
    }
    async reset() {
        this.currentPage.offset = 0;
        this.resetScrollPosition();
        await this.update(false);
    }
    installViewportReziseEvent() {
        let instance = this;
        $(window).on('resize', function (e) {
            clearTimeout(instance.resizeTimer);
            instance.resizeTimer = setTimeout(() => { instance.update(false); }, instance.resizeEndTriggerDelai);
        });
    }
    setCurrentPageLimit() {
        let nbColumns = Math.trunc(this.scrollPanel.innerWidth() / this.itemLayout.width);
        if (nbColumns < 1) nbColumns = 1;
        let nbRows = Math.round(this.scrollPanel.innerHeight() / this.itemLayout.height);
        this.currentPage.limit = nbRows * nbColumns + nbColumns /* make sure to always have a content overflow */;
    }
    currentPageToQueryString(append = false) {
        this.setCurrentPageLimit();
        let limit = this.currentPage.limit;
        let offset = this.currentPage.offset;
        if (!append) {
            limit = limit * (offset + 1);
            offset = 0;
        }
        return `?limit=${limit}&offset=${offset}`;
    }
    scrollToElem(elemId) {
        let itemToReach = $("#" + elemId);
        if (itemToReach) {
            let itemsContainer = itemToReach.parent();
            this.scrollPanel.animate({
                scrollTop: itemToReach.offset().top - itemsContainer.offset().top
            }, 500);
        }
    }
    scrollPosition() {
        return this.scrollPanel.scrollTop();
    }
    storeScrollPosition() {
        this.scrollPanel.off();
        this.previousScrollPosition = this.scrollPosition();
    }
    resetScrollPosition() {
        this.currentPage.offset = 0;
        this.scrollPanel.off();
        this.scrollPanel.scrollTop(0);
    }
    restoreScrollPosition() {
        this.scrollPanel.off();
        this.scrollPanel.scrollTop(this.previousScrollPosition);
    }
   
    async update(append = true) {
        if (!this.hidden) this.storeScrollPosition();
        if (!append)
            this.itemsPanel_alt.empty();
        let endOfData = await this.getItems(this.itemsPanel_alt, this.currentPageToQueryString(append));

        // replace itemsPanel content with itemsPanel_Alt
        // in this manner we avoid client refresh blinks
        $(`#${this.itemsPanelId}`).replaceWith(this.itemsPanel_alt);
        $(`#${this.itemsPanelId}-alt`).attr('id', this.itemsPanelId);
        this.itemsPanel = $(`#${this.itemsPanelId}`);

        this.itemsPanel_alt = this.itemsPanel.clone(true, true);
        this.itemsPanel_alt.attr('id', this.itemsPanelId + "-alt");
        this.itemsPanel_alt.hide();
        this.itemsPanel.show();
        this.scrollPanel.append(this.itemsPanel_alt);

        if (!this.hidden) this.restoreScrollPosition();

        let instance = this;

        this.scrollPanel.scroll(async function () {
            if (!endOfData && (instance.scrollPanel.scrollTop() + instance.scrollPanel.outerHeight() >= instance.itemsPanel.outerHeight() - instance.loadMoreTriggerMargin)) {
                instance.scrollPanel.off();
                instance.currentPage.offset++;
                await instance.update(true);
            }
        });

    }
}