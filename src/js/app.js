(function ($) {
    var utils = new ProjectPastroUtils();
    $(document).ready(function() {
        console.log('Loading...');
        utils.init();
        //Add login container to body class
        //$('body').addClass('body-login-container');

        function toggleSignIn() {
            if (!firebase.auth().currentUser) {
                var provider = new firebase.auth.GoogleAuthProvider();
                firebase.auth().signInWithRedirect(provider);
            } else {
                firebase.auth().signOut().then(function () {
                    window.location.replace('index.html');
                });
            }
        }
        var paywallVM = new Vue({
            el: '#login-container',
            data: {
                signin: true,
                paysubscription: false
            },
            components: {
                'sign-in-layout': {
                    template: '#sign-in-layout-template',
                    methods: {
                        signIn: function () {
                            console.log('Sign in clicked');
                            toggleSignIn();
                        }
                    }
                },
                'purchase-subscription-layout': {
                    template: '#purchase-subscription-layout-template',
                    data() {
                        return {
                            firstname: utils._FIRSTNAME
                        }
                    },
                    methods: {
                        paySubscription: function () {
                            console.log('User clicked make payment');
                            //Disable button
                            $('#paySubscriptionButton').prop('disabled', true);
                            $('#paySubscriptionButton').text('Loading...');
                            firebase.firestore().collection('customers').doc(utils._UID).collection('checkout_sessions').add({
                                price: utils._PRICE,
                                allow_promotion_codes: false,
                                tax_rates: utils._TAX_RATES,
                                success_url: utils._SUCCESS_URL,
                                cancel_url: utils._CANCEL_URL
                            }).then(function (docRef) {
                                // Wait for the CheckoutSession to get attached by the extension
                                docRef.onSnapshot((snap) => {
                                    const {
                                        error,
                                        sessionId
                                    } = snap.data();
                                    if (error) {
                                        alert(`An error occurred: ${error.message}`);
                                    }
                                    if (sessionId) {
                                        const stripe = Stripe(utils._STRIPE_CODE);
                                        stripe.redirectToCheckout({
                                            sessionId
                                        });
                                    }
                                });
                            });
                        },
                        logOut: function () {
                            console.log('User clicked sign out');
                            toggleSignIn();
                        }
                    }
                }
            }
        });

        function initApp() {
            firebase.firestore().enablePersistence().then(function () {
                //Get user auth
                firebase.auth().getRedirectResult().then(function (result) {
                    if (result.credential) {
                        var token = result.credential.accessToken;
                    }
                }).catch(function (error) {
                    var errorCode = error.code;
                    var errorMessage = error.message;
                    var email = error.email;
                    var credential = error.credential;
                    if (errorCode === 'auth/account-exists-with-different-credential') {
                        alert('You have already signed up with a different auth provider for that email.');
                    } else {
                        console.error(error);
                    }
                });

                //When authstate changes
                firebase.auth().onAuthStateChanged(function (user) {
                    if (user) { //user is signed in
                        console.log('User is signed in');
                        utils._USER = user;
                        utils._UID = user.uid;
                        utils._FIRSTNAME = utils._USER.displayName.substr(0, utils._USER.displayName.indexOf(' '));
                        $('#loading-text').text('Hi ' + utils._FIRSTNAME);
                        $('#loading-subtext').text('Loading your cookbook...');
                        //Check if user is paying customer
                        firebase.firestore().collection('customers').doc(user.uid).collection('subscriptions').where('status', '==', 'active').get().then(function (snapshot) {
                            if (snapshot.empty) { //Customer is not actively subscribed
                                paywallVM.signin = false;
                                paywallVM.paysubscription = true;
                                utils.showLoginContainer();
                            } else {
                                //Customer is actively subscribed
                                //Get dyslexic font
                                var dys_font = new FontFace('OpenDyslexic', 'url(../assets/fonts/OpenDyslexic-Regular.woff)');
                                dys_font.load().then(function (loaded_face) {
                                    document.fonts.add(loaded_face);
                                    dyslexicFont = loaded_face;
                                    if (utils.getLocalStorage(utils._IS_DYSLEXIC_FONT_SET) == 'true') {
                                        document.body.style.fontFamily = '"OpenDyslexic", sans-serif';
                                        //Update settings to reflect this
                                        $('#pills-normal-font').removeClass('active');
                                        $('#pills-dyslexic-font').addClass('active');
                                    }
                                }).catch(function (error) {
                                    /*
                                    $.toast({
                                        title: 'Error. Check console for more details',
                                        type: 'error',
                                        delay: 5000
                                    });
                                    */
                                    console.log(error);
                                });
                                getCookbook();
                            }
                        });
                    } else { //User is not signed in 
                        utils.showLoginContainer();
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

    function getCookbook() {
        //utils._NANOBAR.go(75);
        var payload = [];

        ///*
        firebase.firestore().collection("users/" + utils._UID + "/recipes").onSnapshot({
            includeMetadataChanges: true
        }, function (snapshot) {
            snapshot.docChanges().forEach(function (change) {
                var source = snapshot.metadata.fromCache ? "local cache" : "server";
                console.log("recipe came from " + source);
            })
        });
        firebase.firestore().collection("users/" + utils._UID + "/recipes").get().then(function (querySnapshot) {
            querySnapshot.forEach(function (doc) {
                payload.push(doc.data());
            });
        }).then(function () {
            //utils.showCookbook();
            //utils._NANOBAR.go(100);
            appFunctionality(payload);
        });
        //*/
    }

    function appFunctionality(payload) {
        function toggleSignIn() {
            if (!firebase.auth().currentUser) {
                var provider = new firebase.auth.GoogleAuthProvider();
                firebase.auth().signInWithRedirect(provider);
            } else {
                firebase.auth().signOut().then(function () {
                    window.location.replace('index.html');
                });
            }
        }

        //Load vue dependencies 
        //Vue.use('infinite-loading', { /* options */ });

        utils.showCookbook();

        var appVM = new Vue({
            el: '#appContent',
            data: {
                cookbook: payload,
                //page: 1
            },
            computed: {
                /*
                url() {
                    return ["Hello World", "Hello World", "Hello World", "Hello World", "Hello World", "Hello World", "Hello World", "Hello World", "Hello World", "Hello World", "Hello World", "Hello World", "Hello World", "Hello World", "Hello World", "Hello World", "Hello World", "Hello World", "Hello World"];
                }
                */
            },
            created() {
                //this.fetchData();
            },
            methods: {
                /*
                async fetchData() {  
                    //const response = await axios.get(this.url);
                    //this.titles = response.data;
                    const response = this.url;
                    this.cookbook = response;
                },
                infiniteScroll($state) {
                    this.page++;
                    //Do axios call
                    this.cookbook.push(["Hello World"]);
                    $state.loaded();
                }
                */
            }
        });
    }
})(jQuery);