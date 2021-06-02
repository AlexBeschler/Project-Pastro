(function ($) {
	var utils = new ProjectPastroUtils();
	$(document).ready(function () {
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

		new Vue({
			el: '#appContent',
			data: {
				cookbook: payload,

				displayTags: '',
				displayTime: '',
				displayIngredients: '',

				tagsArray: null,
				ingredientsArray: null,
				totalRecipeTimeInput: null,
				finishByTimeInput: null,

				checkedTagsArray: null,
				checkedIngredientsArray: null
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
				var self = this;

				this.tagsArray = [];
				this.displayTime = 'takes any time';
				this.ingredientsArray = [];

				this.checkedTagsArray = [];
				this.checkedIngredientsArray = [];

				//TODO: Use underscore's sortBy function
				payload.forEach(recipe => {
					//Tags
					self.tagsArray = _.uniq(_.union(self.tagsArray, recipe.tags), false);

					//Ingredients
					self.ingredientsArray = _.uniq(_.union(self.ingredientsArray, _.reject(recipe.ingredients, {
						parent: null
					})), false, function (item, key, text) {
						return item.text;
					});
				});
				//this.fetchData();
				//*/
			},
			watch: {
				checkedTagsArray: function (b, a) {
					if (this.checkedTagsArray.length < 1) {
						this.displayTags = 'any';
					} else if (this.checkedTagsArray.length === 2) {
						var t = '';
						t += this.checkedTagsArray[0];
						t += ' and ';
						t += this.checkedTagsArray[1];
						this.displayTags = t;
					} else {
						var t = '';
						this.checkedTagsArray.forEach(element => {
							t += element;
							t += ', ';
						});
						this.displayTags = t.slice(0, -2);
					}
				},
				totalRecipeTimeInput: function (b, a) {
					//TODO: Check if both boxes have been filled
					if ((this.finishByTimeInput === null || this.finishByTimeInput === '') && (this.totalRecipeTimeInput == null || this.totalRecipeTimeInput == '')) {
						this.displayTime = 'takes any time';
						//if total recipe time is inputted
					} else if (this.totalRecipeTimeInput != null || this.totalRecipeTimeInput != '') {
						//Convert input number to hour & minute
						var input = parseInt(this.totalRecipeTimeInput);
						var hours = Math.floor(input / 60);
						var minutes = input % 60;
						var t = 'takes ';
						if (hours !== 0) {
							t += hours;
							if (hours === 1) {
								t += ' hour ';
							} else {
								t += ' hours ';
							}
						}
						if (hours !== 0 && minutes !== 0) {
							t += ' and ';
						}
						if (minutes !== 0) {
							t += minutes;
							if (minutes === 1) {
								t += ' minute';
							} else {
								t += ' minutes'
							}
						}
						t += ' or less';
						this.displayTime = t;
					}
				},
				finishByTimeInput: function (b, a) {
					//TODO: Check if both boxes have been filled
					if ((this.finishByTimeInput === null || this.finishByTimeInput === '') && (this.totalRecipeTimeInput == null || this.totalRecipeTimeInput == '')) {
						this.displayTime = 'takes any time';
						//if total recipe time is inputted
					} else if (this.totalRecipeTimeInput != null || this.totalRecipeTimeInput != '') {
						try {
							var input = this.finishByTimeInput;
							var inputHours = parseInt(input.split(':')[0]);
							var inputMinutes = parseInt(input.split(':')[1]);
							var now = new Date(Date.now());
							var nowHours = parseInt(now.getHours());
							var nowMinutes = parseInt(now.getMinutes());

							this.displayTime = this.getFilterTimeDuration(nowHours, nowMinutes, inputHours, inputMinutes);
						} catch (e) {
							console.error(e);
						}
					}
				},
				checkedIngredientsArray: function (b, a) {
					if (this.checkedIngredientsArray.length < 1) {
						this.displayIngredients = 'any ingredients';
					} else if (this.checkedIngredientsArray.length === 2) {
						var t = '';
						t += this.checkedIngredientsArray[0];
						t += ' and ';
						t += this.checkedIngredientsArray[1];
						this.displayIngredients = t;
					} else {
						var t = '';
						this.checkedIngredientsArray.forEach(element => {
							t += element;
							t += ', ';
						});
						this.displayIngredients = t.slice(0, -2);
					}
				}
			},
			methods: {
				updateFilters: function () {
					//Scan all tags
					//Find which times to filter by
					//Scan all ingredients
					console.log('Update filters');
				},
				getFilterTimeDuration: function (currentHours, currentMinutes, inputHours, inputMinutes) {
					var currentTotalMinutes = (currentHours * 60) + currentMinutes;
					var inputTotalMinutes = (inputHours * 60) + inputMinutes;

					var currentRemainderMinutes = 1440 - currentTotalMinutes;
					var etaTotalMinutes = currentRemainderMinutes + inputTotalMinutes;

					var hours = Math.floor(etaTotalMinutes / 60) % 24;
					var minutes = etaTotalMinutes % 60;

					var t = 'takes ';
					if (hours !== 0) {
						t += hours.toString() + ' hour';
						if (hours > 1) {
							t += 's';
						}
						if (minutes !== 0) {
							t += ' and ';
						}
					}
					if (minutes !== 0) {
						t += minutes.toString() + ' minute';
						if (minutes > 1) {
							t += 's';
						}
					}
					t += ' or less'; 
					if (t === 'takes or less') {
						return 'takes any time';
					}
					return t;
				},
				clickedAddRecipe: function() {
					console.log('Clicked Add Recipe');
				}
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