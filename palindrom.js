module.exports = {
    logPalindromModel: logPalindromModel,
    logState: logState,
    emptyTrigger: emptyTrigger,
    insertItem: insertItem,
    setInsertedItemGuid: setInsertedItemGuid,
    saveInsertedItemInfo: saveInsertedItemInfo,
    updateInsertedItem: updateInsertedItem,
    deleteInsertedItem: deleteInsertedItem,
    setEditedItemGuid: setEditedItemGuid,
    setEditedItemIndex: setEditedItemIndex,
    saveEditedItem: saveEditedItem,
    deleteSavedItem: deleteSavedItem,
    saveRundomItemInfo: saveRundomItemInfo,
    logPatchReceived: logPatchReceived
};

function logPalindromModel(context, events, done) {
    console.log("Palindrom model: " + JSON.stringify(context.palindrom.obj));
    return done();
}

function logPatchReceived(context, patch) {
    console.log('----------------------------------new patch------------------------------------');
    console.table(context.vars["MyTestVar"]);
}

function logState(context, events, done) {
    console.log(new Date(), "Total number of item: ", context.palindrom.obj.Playground_0.Items.length);
    return done();
}

function emptyTrigger(context, events, obj) {
    obj.Playground_0.EmptyTrigger$++;
}

function insertItem(context, events, obj) {
    obj.Playground_0.InsertTrigger$++;
}

function saveInsertedItemInfo(context, events, done) {
    const obj = context.palindrom.obj;
    const no = obj.Playground_0.InsertedObjectNo;
    const item = obj.Playground_0.Items.find(x => x.ObjectNo == no);

    if (!item) {
        throw "Unable to find newly inserted item, InsertedObjectNo: " + no;
    }

    context.vars["InsertedItemNo"] = obj.Playground_0.InsertedObjectNo;
    context.vars["InsertedItemId"] = item.Id;
    context.vars["EditInsertedItemUri"] = "/items/" + item.Id;
    context.vars["MyTestVar"] = "A random value: "+Math.random();

    return done();
}

function setInsertedItemGuid(context, events, obj) {
    const no = obj.Playground_0.InsertedObjectNo;
    const item = obj.Playground_0.Items.find(x => x.ObjectNo == no);
    
    item.Guid$ = "Aritllery.io - " + new Date().toString();
}

function updateInsertedItem(context, events, obj) {
    const no = obj.Playground_0.InsertedObjectNo;
    const item = obj.Playground_0.Items.find(x => x.ObjectNo == no);
    
    item.UpdateTrigger$++;
}

function deleteInsertedItem(context, events, obj) {
    const no = obj.Playground_0.InsertedObjectNo;
    const item = obj.Playground_0.Items.find(x => x.ObjectNo == no);
    
    item.DeleteTrigger$++;
}

function setEditedItemGuid(context, events, obj) {
    obj.Playground_0.Item.Guid$ = "Artillery.io - " + new Date().toString();
}

function setEditedItemIndex(context, events, obj) {
    obj.Playground_0.Item.Index$ = new Date().getMilliseconds() + 1;
}

function saveEditedItem(context, events, obj) {
    obj.Playground_0.SaveTrigger$++;
}

function deleteSavedItem(context, events, obj) {
    const no = context.vars["InsertedItemNo"];
    const item = obj.Playground_0.Items.find(x => x.ObjectNo == no);

    item.DeleteTrigger$++;

    delete context.vars["InsertedItemNo"];
    delete context.vars["InsertedItemId"];
    delete context.vars["EditInsertedItemUri"];
}

function saveRundomItemInfo(context, events, done) {
    const obj = context.palindrom.obj;
    const items = obj.Playground_0.Items;

    if (!items.length) {
        // No items to view - refreshing page.
        context.vars["EditRandomItemUri"] = "/index";
        return done();
    }

    const i = Math.floor(Math.random() * items.length);
    const item = items[i];

    // This particular item might have been already deleted.
    // That's okay, the /items/{?} page will show "This item does not exist" message.
    context.vars["EditRandomItemUri"] = "/items/" + item.Id;

    return done();
}