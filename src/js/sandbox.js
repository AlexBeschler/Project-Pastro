(function () {
    window.addEventListener("load", function (event) {
        new Vue({
            el: '#appContent',
            data: {
                inputBox: ''
            },
            methods: {
                getLink: function () {
                    axios.post('http://localhost:5001/project-pastro-c95b1/us-central1/autoParseURL', {
                        url: this.inputBox
                    }).then(function (response) {
                        console.log(response);
                    }).catch(function (error) {
                        console.log(error);
                    });
                }
            }
        });
    });
})();