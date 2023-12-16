define(["js/jquary","js/vue.min"],function (_,Vue) {
    let friends = new Vue({
        el: "#friends-link",
        data: {
            friends: {},
        },
    });
    $.getJSON("/webconfigs/friends.json", function (data, status) {
        console.log(data);
        friends.friends = data;
    });
});
