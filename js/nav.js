define(["axios", "vue.min"], function (axios, Vue) {
    let nav = new Vue({
        el: "#held",
        data: {
            spon: {},
            friends: {},
            nav:{}
        },
    });

    axios.get("/webconfigs/friends.json").then(function (response) {
        nav.friends = response.data;
    });

    axios.get("/webconfigs/nav.json").then(function (response) {
        nav.nav = response.data;
    });

    axios.get("/webconfigs/for-spon.json").then(function (response) {
        nav.spon = response.data;
    });

});
