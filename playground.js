module.exports = {
    logRequest: logRequest,
    logResponse: logResponse,
    setPalindromRemoteUri: setPalindromRemoteUri,
    setInsertItemPatch: setInsertItemPatch,
    setEditItemUri: setEditItemUri,
    setEditItemPatch: setEditItemPatch,
    setSaveItemPatch: setSaveItemPatch
};

function logRequest(requestParams, context, ee, next) {
    console.log("-- logRequest --");
    console.log(context.vars);
    console.log(requestParams);
    return next();
}

function logResponse(requestParams, response, context, ee, next) {
    console.log("response.body = " + response.body);
    return next();
}

function setPalindromRemoteUri(requestParams, response, context, ee, next) {
    const regex = /[<]palindrom-client .*?remote-url=["](.*?)["].*?[<][/]palindrom-client[>]/gi;
    const palindrom = regex.exec(response.body);
    const remoteUrl = palindrom[1];
    
    context.vars["remoteUri"] = remoteUrl;
    console.log("context.vars.remoteUri = " + remoteUrl);
    
    return next();
}

function setInsertItemPatch(requestParams, response, context, ee, next) {
    // [{"op":"replace","path":"/_ver#c$","value":1},{"op":"test","path":"/_ver#s","value":0},{"op":"replace","path":"/Playground_0/InsertTrigger$","value":"1"}]
    const patch = [
        { "op": "replace", "path": "/_ver#c$", "value": 1 },
        { "op": "test", "path": "/_ver#s", "value": 0 },
        { "op": "replace", "path": "/Playground_0/InsertTrigger$", "value": "1" }
    ];
    
    context.vars["patchData"] = patch;
    
    return next();
}

function setEditItemUri(requestParams, response, context, ee, next) {
    // [{"op":"replace","path":"/_ver#s","value":1},{"op":"test","path":"/_ver#c$","value":1},{"op":"add","path":"/Playground_0/Items/5","value":{"Id":"G","ObjectNo":6,"Guid$":"27a2eef3-5972-451d-b97e-33feb20c0633","Date$":"2019-01-24 01:30:51Z","Thread$":0,"Index$":0,"Notes":null,"DeleteTrigger$":0,"UpdateTrigger$":0}},{"op":"replace","path":"/Playground_0/InsertTrigger$","value":0}]
    const patches = response.body;
    let id = "";
    
    for (let i = 0; i < patches.length; i++) {
        const p = patches[i];
        
        if (p.op == "add") {
            id = p.value.Id;
            break;
        }
    }
    
    if (!id) {
        throw "New item id was not found!";
    }
    
    const newUri = "/items/" + id;
    
    context.vars["newUri"] = newUri;
    console.log("context.vars.newUri = " + newUri);
    
    return next();
}

function setEditItemPatch(requestParams, response, context, ee, next) {
    // [{"op":"replace","path":"/_ver#c$","value":2},{"op":"test","path":"/_ver#s","value":2},{"op":"replace","path":"/Playground_0/Item/Guid$","value":"Artillery!"}]
    const patch = [
        { "op": "replace", "path": "/_ver#c$", "value": 2 },
        { "op": "test", "path": "/_ver#s", "value": 2 },
        { "op": "replace", "path": "/Playground_0/Item/Guid$", "value": "Artillery - " + new Date().toString() } 
    ];
    
    context.vars["patchData"] = patch;
    
    return next();
}

function setSaveItemPatch(requestParams, response, context, ee, next) {
    // [{"op":"replace","path":"/_ver#c$","value":3},{"op":"test","path":"/_ver#s","value":3},{"op":"replace","path":"/Playground_0/SaveTrigger$","value":"1"}]
    const patch = [
        { "op": "replace", "path": "/_ver#c$", "value": 3 },
        { "op": "test", "path": "/_ver#s", "value": 3 },
        { "op": "replace", "path": "/Playground_0/SaveTrigger$", "value":"1" }
    ];
    
    context.vars["patchData"] = patch;
    
    return next();
}