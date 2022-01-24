(function () {
    window.addEventListener("load", function (event) {
        new Vue({
            el: '#appContent',
            data: {
                inputBox: ''
            },
            methods: {
                getLink: function () {
                    axios.post('http://localhost:5001/project-pastro-c95b1/us-central1/embercleave', {
                        url: this.inputBox
                    }).then(function (response) {
                        if (response.status === 201) {
                            console.log(response.data.error);
                        } else {
                            console.log(response.data.response);
                        }
                    }).catch(function (error) {
                        console.log(error);
                    });
                }
            }
        });
    });
})();