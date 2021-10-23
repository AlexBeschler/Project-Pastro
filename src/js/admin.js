(function () {
    window.addEventListener("load", function (event) {

        function initApp() {
            firebase.firestore().enablePersistence().then(function () {
                //Get user auth
                firebase.auth().getRedirectResult().then(function (result) {
                    if (result.credential) {
                        var token = result.credential.accessToken;
                    }
                }).catch(function (error) {
                    var errorCode = error.code;
                    if (errorCode === 'auth/account-exists-with-different-credential') {
                        alert('You have already signed up with a different auth provider for that email.');
                    } else {
                        console.error(error);
                    }
                });

                //When authstate changes
                firebase.auth().onAuthStateChanged(function (user) {
                    if (user) { //user is signed in
                        loadAdmin();
                    }
                });
            }).catch((error) => {
                if (error.code == 'failed-precondition') {
                    //Multiple tabs open
                } else if (error.code == 'unimplemented') {
                    //Current browser doesn't support offline
                }
            });
        }

        initApp();
    });

    function loadAdmin() {
        new Vue({
            el: '#appContent',
            data: {
                errors: [],
                stripeBalance: 'Loading...'
            },
            mounted() {
                var self = this;
                firebase.firestore().collection('errors').where('type', '!=', 'test').get().then((querySnapshot) => {
                        querySnapshot.forEach((doc) => {
                            self.errors.push(doc.data());
                        });
                    })
                    .catch((error) => {
                        console.log("Error getting documents: ", error);
                    });
                axios.get('http://localhost:5001/project-pastro-c95b1/us-central1/getAdminMetrics').then(res => {
                    self.stripeBalance = (Math.round(res.data.stripeBalance.available[0].amount * 100) / 100).toFixed(2);
                    
                }).catch(err => console.log(err));
            },
            methods: {
                toggleSignIn: function () {
                    if (!firebase.auth().currentUser) {
                        var provider = new firebase.auth.GoogleAuthProvider();
                        firebase.auth().signInWithRedirect(provider);
                    } else {
                        firebase.auth().signOut().then(function () {
                            window.location.replace('../index.html');
                        });
                    }
                },
                getTime: function (ms) {
                    var date = new Date(ms);
                    var year = date.getFullYear();
                    var month = date.getMonth();
                    var day = date.getDate();

                    return moment([year, month, day]).fromNow();
                }
            }
        });
    }
})();