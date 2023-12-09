$(document).ready(function () {
    (function () {
        ret = {};
        $("div#content")
            .children()
            .each(function (index, element) {
                let tagName = $(this).get(0).tagName;
            if (tagName.substr(0, 1).toUpperCase() == "H") {
                    let contentH = $(this).html();
                    let markid = "mark-" + tagName + "-" + index.toString();
                    $(this).attr("id", markid);
                    if (tagName === "H1") {
                        $("div.menu").append(`<ul class=H1><li><a href="#${markid}">${contentH}</a></li></ul>`);
                    } else {
                        $(`div.menu ul.H${tagName[1]-1}:last`).append(`<li><ul class=${tagName}><li><a href="#${markid}">${contentH}</a></li></ul></li>`)
                    }
                    
                }
            });
    })();
});