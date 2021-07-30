(function ($) {
	var utils = new ProjectPastroUtils();
	window.addEventListener("load", function (event) {
		utils.init();

		//Prevent unintended back button clicking
		window.onbeforeunload = function () {
			return "Your work will be lost.";
		};

		function toggleSignIn() {
			if (!firebase.auth().currentUser) {
				var provider = new firebase.auth.GoogleAuthProvider();
				firebase.auth().signInWithRedirect(provider);
			} else {
				firebase.auth().signOut().then(function () {
					window.location.replace('../index.html');
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
						//Fix for when people's Google account name is all caps
						utils._FIRSTNAME = utils.capitalizeFirstLetter(utils._USER.displayName.substr(0, utils._USER.displayName.indexOf(' ')).toLowerCase());
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
									//Get cloud settings for default font
									firebase.firestore().collection('users').doc(utils._UID).get().then((doc) => {
										if (doc.data().dyslexicFontSet === 'true') {
											document.body.style.fontFamily = '"OpenDyslexic", sans-serif';
										}
									}).catch((error) => {
										//Couldn't get default font set, rely on local storage
										if (utils.getLocalStorage(utils.DYSLEXIC_FONT_SET) === 'true') {
											document.body.style.fontFamily = '"OpenDyslexic", sans-serif';
										}
									});
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
		var sortedTagsIndex = [];
		var sortedTimeIndex = [];
		var sortedIngredientsIndex = [];
		var sortedCalories = [];
		var sortedCarbohydrate = [];
		var sortedCholesterol = [];
		var sortedFat = [];
		var sortedFiber = [];
		var sortedProtein = [];
		var sortedSodium = [];
		var sortedSugars = [];

		var listOfIngredients = [];
		var listOfTags = [];

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
				var recipe = doc.data();
				var docID = recipe.docID;

				//Adds recipe to sorted position
				if (payload.length > 0) {
					payload.splice(_.sortedIndex(payload, recipe, 'docID'), 0, recipe);
				} else {
					payload.push(recipe);
				}

				///Build sorted indices and list of ingredients/tags
				//Tags
				recipe.tags.forEach(tag => {
					sortedTagsIndex = utils.insertSortedPosition(sortedTagsIndex, docID, tag.toLowerCase(), 'value');
					listOfTags = _.union(listOfTags, recipe.tags);
				});

				//Time
				sortedTimeIndex = utils.insertSortedPosition(sortedTimeIndex, docID, recipe.totalTime, 'value');

				recipe.blocks.forEach(block => {
					//Ingredients
					block.ingredients.forEach(ingredient => {
						sortedIngredientsIndex = utils.insertSortedPosition(sortedIngredientsIndex, docID, ingredient.value.toLowerCase(), 'value');
						listOfIngredients = _.union(listOfIngredients, [utils.capitalizeFirstLetter(ingredient.value)]);
					});
					//Nutrition Facts
					sortedCalories = utils.insertSortedPosition(sortedCalories, docID, block.nCalories, 'value');
					sortedCarbohydrate = utils.insertSortedPosition(sortedCarbohydrate, docID, block.nCarbohydrate, 'value');
					sortedCholesterol = utils.insertSortedPosition(sortedCholesterol, docID, block.nCholesterol, 'value');
					sortedFat = utils.insertSortedPosition(sortedFat, docID, block.nFat, 'value');
					sortedFiber = utils.insertSortedPosition(sortedFiber, docID, block.nFiber, 'value');
					sortedProtein = utils.insertSortedPosition(sortedProtein, docID, block.nProtein, 'value');
					sortedSodium = utils.insertSortedPosition(sortedSodium, docID, block.nSodium, 'value');
					sortedSugars = utils.insertSortedPosition(sortedSugars, docID, block.nSugars, 'value');
				});
			});
		}).then(function () {
			//utils.showCookbook();
			//utils._NANOBAR.go(100);
			appFunctionality(payload, sortedTagsIndex, sortedTimeIndex, sortedIngredientsIndex, sortedCalories, sortedCarbohydrate, sortedCholesterol, sortedFat, sortedFiber, sortedProtein, sortedSodium, sortedSugars, listOfIngredients, listOfTags);
		});
	}

	function appFunctionality(payload, sortedTagsIndex, sortedTimeIndex, sortedIngredientsIndex, sortedCalories, sortedCarbohydrate, sortedCholesterol, sortedFat, sortedFiber, sortedProtein, sortedSodium, sortedSugars, listOfIngredients, listOfTags) {
		//Load vue dependencies
		Vue.use('vue-slicksort');

		utils.showCookbook();

		//Manage tag component
		Vue.component('sortable-list', {
			mixins: [ContainerMixin],
			template: '#tag-draggable-list-template'
		});

		Vue.component('sortable-item', {
			mixins: [ElementMixin],
			props: ['tag'],
			template: '#tag-draggable-item-template'
		});

		//Manage ingredients component
		Vue.component('ingredients-draggable-list', {
			mixins: [ContainerMixin],
			template: '#ingredients-draggable-list-template'
		});

		Vue.component('ingredients-draggable-item', {
			mixins: [ElementMixin],
			props: ['ingredient'],
			template: '#ingredients-draggable-item-template'
		});

		//Manage steps component
		Vue.component('steps-draggable-list', {
			mixins: [ContainerMixin],
			template: '#steps-draggable-list-template'
		});

		Vue.component('steps-draggable-item', {
			mixins: [ElementMixin],
			props: ['step'],
			template: '#steps-draggable-item-template'
		});

		//Manage steps
		Vue.component('blocks-draggable-list', {
			mixins: [ContainerMixin],
			template: '#blocks-draggable-list-template'
		});

		Vue.component('blocks-draggable-item', {
			mixins: [ElementMixin],
			props: ['block'],
			template: '#blocks-draggable-item-template'
		});

		new Vue({
			el: '#appContent',
			vuetify: new Vuetify(),
			data: {
				//Utils
				db: null,
				cookbook: payload,
				filteredCookbook: payload,

				//Explore pane
				exploreOffcanvas: null,
				explorePaneOffcanvasType: '',
				displayTags: '',
				displayTime: '',
				displayIngredients: '',
				displayNutrition: '',

				//Recipe
				recipeOffcanvas: null,
				deleteRecipeOffcanvas: null,

				//All tags and ingredients in cookbook
				tagsArray: listOfTags,
				ingredientsArray: listOfIngredients,

				//Filters
				totalRecipeTimeInput: '',
				finishByTimeInput: '',
				finishByTimeInputInMinutes: '',

				checkedTagsArray: null,
				checkedIngredientsArray: null,

				nCalories: null,
				nFat: null,
				nCholesterol: null,
				nSodium: null,
				nCarbohydrate: null,
				nFiber: null,
				nSugars: null,
				nProtein: null,

				//Indices
				index_tags: sortedTagsIndex,
				index_times: sortedTimeIndex,
				index_ingredients: sortedIngredientsIndex,
				index_calories: sortedCalories,
				index_carbohydrate: sortedCarbohydrate,
				index_cholesterol: sortedCholesterol,
				index_fat: sortedFat,
				index_fiber: sortedFiber,
				index_protein: sortedProtein,
				index_sodium: sortedSodium,
				index_sugars: sortedSugars,

				proto_index: 0,
				proto_title: '',
				proto_description: '',
				proto_coverPhotoURL: '',
				proto_preptime: '',
				proto_cooktime: '',
				proto_totaltime: '',
				proto_activetime: '',
				proto_yield: '',
				proto_blocks: [],

				//For use in search queries
				model_search: '',

				//For use with manage recipes
				manageOffcanvas: null,
				isRecipeSubmitDisabled: false,
				//Step 2
				manage_recipeTitle: '',
				manage_recipeName: '',
				manage_recipeDescription: '',
				manage_recipeTagInput: '',
				manage_recipeTagHolder: [],
				//Step 3
				manage_recipePrepTime: '',
				manage_recipeCookTime: '',
				manage_recipeTotalTime: '',
				manage_recipeActiveTime: '',
				manage_recipeYield: '',
				//Step 4
				manage_recipeBlocks: [],
				manage_recipeBlockIngredients: [],
				manage_recipeBlockSteps: [],
				manage_recipeBlockHeader: '',
				manage_recipeBlockIngredientAmount: '',
				manage_recipeBlockIngredientValue: '',
				manage_recipeBlockStepValue: '',
				manage_nCalories: '',
				manage_nFat: '',
				manage_nCholesterol: '',
				manage_nSodium: '',
				manage_nCarbohydrate: '',
				manage_nFiber: '',
				manage_nSugars: '',
				manage_nProtein: '',
				nutritionFactsButtonExpandedText: 'Expand Nutrition Facts',
				//Quill
				quillInstance: null,
				quillContent: null,
				toolbarOptions: [
					['bold', 'italic'],
					[{
						'list': 'ordered'
					}, {
						'list': 'bullet'
					}, {
						'indent': '-1'
					}, {
						'indent': '+1'
					}],
					['clean']
				],
				isDyslexicFontSet: 'false',
				dyslexicFontClass: false
			},
			created() {
				this.db = firebase.firestore();

				this.displayTime = 'takes any time';

				this.checkedTagsArray = [];
				this.checkedIngredientsArray = [];
				this.nCalories = '';
				this.nFat = '';
				this.nCholesterol = '';
				this.nSodium = '';
				this.nCarbohydrate = '';
				this.nFiber = '';
				this.nSugars = '';
				this.nProtein = '';

				//Get dyslexic font value
				this.isDyslexicFontSet = utils.getLocalStorage(utils.DYSLEXIC_FONT_SET) === 'true' ? true : false;
				this.dyslexicFontClass = this.isDyslexicFontSet;
			},
			mounted() {
				this.initQuill();
				this.recipeOffcanvas = new bootstrap.Offcanvas(document.getElementById('recipeOffcanvas'));
				this.deleteRecipeOffcanvas = new bootstrap.Offcanvas(this.$refs.recipeDeleteOffcanvas);

				this.$refs.manageRecipeView.addEventListener('hidden.bs.offcanvas', this.checkForCancelRecipe);
			},
			beforeDestroy() {
				this.quillInstance.off('text-change');
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
					this.updateFilters();
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
					this.updateFilters();
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
					this.updateFilters();
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
					this.updateFilters();
				},
				nCalories: function (b, a) {
					this.checkNutritionInfo(b, a);
				},
				nFat: function (b, a) {
					this.checkNutritionInfo(b, a);
				},
				nCholesterol: function (b, a) {
					this.checkNutritionInfo(b, a);
				},
				nSodium: function (b, a) {
					this.checkNutritionInfo(b, a);
				},
				nCarbohydrate: function (b, a) {
					this.checkNutritionInfo(b, a);
				},
				nFiber: function (b, a) {
					this.checkNutritionInfo(b, a);
				},
				nSugars: function (b, a) {
					this.checkNutritionInfo(b, a);
				},
				nProtein: function (b, a) {
					this.checkNutritionInfo(b, a);
				},
				quillValue: function (newVal) {
					// Only update the content if it's changed from an external source
					// or else it'll act weird when you try to type anything
					if (newVal !== this.quillContent) {
						this.quillInstance.pasteHTML(newVal)
					}
				},
				isDyslexicFontSet: function (b, a) {
					this.dyslexicFontClass = (this.isDyslexicFontSet === 'true');
				}
			},
			methods: {
				checkNutritionInfo: function (b, a) {
					if ((utils.isBlank(this.nCalories)) &&
						(utils.isBlank(this.nFat)) &&
						(utils.isBlank(this.nCholesterol)) &&
						(utils.isBlank(this.nSodium)) &&
						(utils.isBlank(this.nCarbohydrate)) &&
						(utils.isBlank(this.nFiber)) &&
						(utils.isBlank(this.nSugars)) &&
						(utils.isBlank(this.nProtein))) {
						this.displayNutrition = 'has any nutritional value';
					} else {
						var t = '';
						//Update display text
						if (!utils.isBlank(this.nCalories)) {
							t += this.nCalories + ' calories;';
						}
						if (!utils.isBlank(this.nFat)) {
							t += this.nFat + 'g fat;';
						}
						if (!utils.isBlank(this.nCholesterol)) {
							t += this.nCholesterol + 'mg cholesterol;';
						}
						if (!utils.isBlank(this.nSodium)) {
							t += this.nSodium + 'mg sodium;';
						}
						if (!utils.isBlank(this.nCarbohydrate)) {
							t += this.nCarbohydrate + 'g carbs;';
						}
						if (!utils.isBlank(this.nFiber)) {
							t += this.nFiber + 'g fibers;';
						}
						if (!utils.isBlank(this.nSugars)) {
							t += this.nSugars + 'g sugars;';
						}
						if (!utils.isBlank(this.nProtein)) {
							t += this.nProtein + 'g proteins;';
						}
						var u = '';
						t.split(';').forEach(element => {
							element !== '' ? u += element + ', ' : '';
						});
						u = u.replace(/,\s*$/, '');
						this.displayNutrition = 'has ' + u + ' or less';
					}
					this.updateFilters();
				},
				initQuill: function () {
					this.quillInstance = new Quill('#editor', {
						modules: {
							toolbar: this.toolbarOptions
						},
						theme: 'snow'
					});
					this.quillInstance.on('text-change', this.onQuillContentChange);
					//Apply GKeyboard fix
					this.quillInstance.on('editor-change', this.applyGoogleKeyboardFix);
					this.setQuillContent();
				},
				onQuillContentChange: function () {
					this.setQuillContent();
					this.$emit('input', this.quillContent)
				},
				setQuillContent: function () {
					this.quillContent = this.quillInstance.getText().trim() ? this.quillInstance.root.innerHTML : ''
				},
				applyGoogleKeyboardFix: function (eventName, ...args) {
					var self = this;
					if (eventName === 'text-change') {
						var ops = args[0]['ops'];
						var oldSelection = self.quillInstance.getSelection();
						//Fix for #3
						if (oldSelection === null || typeof oldSelection === 'undefined') {
							return;
						}
						var oldPosition = oldSelection.index;
						var oldSelectionLength = oldSelection.length;

						if (ops[0]["retain"] === undefined || !ops[1] || !ops[1]["insert"] || !ops[1]["insert"] || ops[1]["insert"] != "\n" || oldSelectionLength > 0) {
							return;
						}

						setTimeout(function () {
							var newPosition = self.quillInstance.getSelection().index;
							if (newPosition === oldPosition) {
								self.quillInstance.setSelection(self.quillInstance.getSelection().index + 1, 0);
							}
						}, 15);
					}
				},
				/*==== Offcanvas helpers ====*/
				toggleExplorePaneOffcanvas: function (toggleType) {
					//Set v-if value
					if (typeof toggleType === 'string') {
						this.explorePaneOffcanvasType = toggleType;
					}
					//Create new offcanvas object if not already created
					if (this.exploreOffcanvas === null || typeof this.exploreOffcanvas === 'undefined') {
						this.exploreOffcanvas = new bootstrap.Offcanvas(document.getElementById('explore-pane-filter-offcanvas'));
					}
					this.exploreOffcanvas.toggle();
				},
				toggleRecipeOffcanvas: function (index) {
					this.proto_index = index;
					this.proto_title = this.filteredCookbook[index].title;
					this.proto_description = this.filteredCookbook[index].description;
					this.proto_blocks = this.filteredCookbook[index].blocks;
					this.proto_preptime = this.filteredCookbook[index].prepTime;
					this.proto_cooktime = this.filteredCookbook[index].cookTime;
					this.proto_totaltime = this.filteredCookbook[index].totalTime;
					this.proto_activetime = this.filteredCookbook[index].activeTime;
					this.proto_yield = this.filteredCookbook[index].yield;

					this.recipeOffcanvas.show();
				},
				updateFilters: function () {
					var self = this;
					var filterIDs = [];
					var filtersApplied = false;
					this.filteredCookbook = [];

					if (this.checkedTagsArray.length > 0) {
						filtersApplied = true;
						this.checkedTagsArray.forEach(checkedTag => {
							if (filterIDs.length < 1) {
								filterIDs = _.union(filterIDs, utils.getDocIDsFromSortedList_Exact(self.index_tags, checkedTag.toLowerCase()));
							} else {
								filterIDs = _.intersection(filterIDs, utils.getDocIDsFromSortedList_Exact(self.index_tags, checkedTag.toLowerCase()));
							}
						});
					}
					if (this.checkedIngredientsArray.length > 0) {
						filtersApplied = true;
						this.checkedIngredientsArray.forEach(checkedIngredient => {
							if (filterIDs.length < 1) {
								filterIDs = _.union(filterIDs, utils.getDocIDsFromSortedList_Exact(self.index_ingredients, checkedIngredient.toLowerCase()));
							} else {
								filterIDs = _.intersection(filterIDs, utils.getDocIDsFromSortedList_Exact(self.index_ingredients, checkedIngredient.toLowerCase()));
							}
						});
					}
					if (this.finishByTimeInput !== '') {
						filtersApplied = true;
						if (filterIDs.length < 1) {
							filterIDs = _.union(filterIDs, utils.getDocIDsFromSortedList_Range(this.index_times, parseInt(this.finishByTimeInputInMinutes)));
						} else {
							filterIDs = _.intersection(filterIDs, utils.getDocIDsFromSortedList_Range(this.index_times, parseInt(this.finishByTimeInputInMinutes)));
						}
					}
					if (this.totalRecipeTimeInput !== '') {
						filtersApplied = true;
						if (filterIDs.length < 1) {
							filterIDs = _.union(filterIDs, utils.getDocIDsFromSortedList_Range(this.index_times, parseInt(this.totalRecipeTimeInput)));
						} else {
							filterIDs = _.intersection(filterIDs, utils.getDocIDsFromSortedList_Range(this.index_times, parseInt(this.totalRecipeTimeInput)));
						}
					}
					//TODO: Add filtering by nutritional values
					if (this.nCalories != '' && parseInt(this.nCalories) !== 0) {
						filtersApplied = true;
					}
					if (this.nFat != '' && parseInt(this.nFat) !== 0) {
						filtersApplied = true;
					}
					if (this.nCholesterol != '' && parseInt(this.nCholesterol) !== 0) {
						filtersApplied = true;
					}
					if (this.nSodium != '' && parseInt(this.nSodium) !== 0) {
						filtersApplied = true;
					}
					if (this.nCarbohydrate != '' && parseInt(this.nCarbohydrate) !== 0) {
						filtersApplied = true;
					}
					if (this.nFiber != '' && parseInt(this.nFiber) !== 0) {
						filtersApplied = true;
					}
					if (this.nSugars != '' && parseInt(this.nSugars) !== 0) {
						filtersApplied = true;

					}
					if (this.nProtein != '' && parseInt(this.nProtein) !== 0) {
						filtersApplied = true;

					}
					if (!filtersApplied) {
						this.filteredCookbook = this.cookbook;
						return;
					};
					this.filteredCookbook = [];
					filterIDs.forEach(id => {
						self.filteredCookbook.push(utils.getRecipeFromID(self.cookbook, id));
					});
				},
				//Clear filters
				clearFilters: function () {
					var self = this;
					switch (this.explorePaneOffcanvasType) {
						case 'tag':
							self.checkedTagsArray = [];
							break;
						case 'time':
							self.totalRecipeTimeInput = '';
							self.finishByTimeInput = '';
							self.finishByTimeInputInMinutes = '';
							break;
						case 'ingredient':
							self.checkedIngredientsArray = [];
							break;
						case 'nutrition':
							self.nCalories = '';
							self.nFat = '';
							self.nCholesterol = '';
							self.nSodium = '';
							self.nCarbohydrate = '';
							self.nFiber = '';
							self.nSugars = '';
							self.nProtein = '';
							break;
						default:
							//
					}
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
					//Set time
					let x = (hours * 60) + minutes
					this.finishByTimeInputInMinutes = x.toString();
					return t;
				},
				//Recipe View methods
				getTimeFromNowUsingMinutes: function (sMinutes) {
					var minutes = parseInt(sMinutes);
					var now = new Date(Date.now());
					var nowHours = parseInt(now.getHours());
					var nowMinutes = parseInt(now.getMinutes());
					var hours = 0;

					var futureMinutes = nowMinutes + minutes;

					const zeroPad = (num) => String(num).padStart(2, '0');

					if (futureMinutes > 59) {
						hours += Math.floor(futureMinutes / 60);
						futureMinutes = futureMinutes % 60;
						return zeroPad((nowHours + hours) % 24).toString() + ':' + zeroPad(futureMinutes).toString();
					} else {
						return zeroPad(nowHours % 24).toString() + ':' + zeroPad(futureMinutes).toString();
					}
				},
				editRecipe: function () {
					//Populate Manage Recipe fields
					this.manage_recipeName = this.filteredCookbook[this.proto_index].title;

					this.manage_recipePrepTime = this.filteredCookbook[this.proto_index].prepTime;
					this.manage_recipeCookTime = this.filteredCookbook[this.proto_index].cookTime;
					this.manage_recipeTotalTime = this.filteredCookbook[this.proto_index].totalTime;
					this.manage_recipeActiveTime = this.filteredCookbook[this.proto_index].activeTime;
					this.manage_recipeYield = this.filteredCookbook[this.proto_index].yield;
					this.manage_recipeBlocks = this.filteredCookbook[this.proto_index].blocks;

					this.filteredCookbook[this.proto_index].tags.forEach(tag => {
						this.manage_recipeTagHolder.push({
							editMode: false,
							editModeButtonText: 'Edit',
							value: tag
						});
					});

					this.quillContent = this.filteredCookbook[this.proto_index].description;
					this.quillInstance.clipboard.dangerouslyPasteHTML(1, this.filteredCookbook[this.proto_index].description);
					//Remove newline character that shows up
					this.quillInstance.deleteText(0, 1);

					//Change DOM from Add to Edit
					$(this.$refs.refAddRecipeButton).attr('data-ps-button-type', 'manage');

					//Add listener
					this.$refs.recipeView.addEventListener('hidden.bs.offcanvas', this.recipeViewListener);

					this.recipeOffcanvas.hide();
				},
				checkForCancelRecipe: function () {
					//Check if the user closed out of an edit screen
					if ($('.add-recipe-button').attr('data-ps-button-type') == 'manage') {
						this.cleanupManageRecipe();
					}
				},
				deleteRecipe: function () {
					//Add listener
					this.$refs.recipeView.addEventListener('hidden.bs.offcanvas', this.deleteRecipeViewListener);
					this.recipeOffcanvas.hide();
				},
				deleteRecipeViewListener: function () {
					//Remove recipeView listener
					this.$refs.recipeView.removeEventListener('hidden.bs.offcanvas', this.deleteRecipeViewListener);
					this.deleteRecipeOffcanvas.show();
				},
				deleteRecipeHelper: function () {
					var self = this;
					var docIDToDelete = this.filteredCookbook[this.proto_index].docID;

					//Remove all references to this recipe from indices
					utils.removeIndices(this.index_times, this.filteredCookbook[this.proto_index].totalTime, docIDToDelete);
					this.filteredCookbook[this.proto_index].tags.forEach(tag => {
						utils.removeIndices(this.index_tags, tag.toLowerCase(), docIDToDelete);
					});
					this.filteredCookbook[this.proto_index].blocks.forEach(block => {
						block.ingredients.forEach(ingredient => {
							utils.removeIndices(this.index_ingredients, ingredient.value.toLowerCase(), docIDToDelete);
						});
						utils.removeIndices(this.index_calories, block.nCalories, docIDToDelete);
						utils.removeIndices(this.index_carbohydrate, block.nCarbohydrate, docIDToDelete);
						utils.removeIndices(this.index_cholesterol, block.nCholesterol, docIDToDelete);
						utils.removeIndices(this.index_fat, block.nFat, docIDToDelete);
						utils.removeIndices(this.index_fiber, block.nFiber, docIDToDelete);
						utils.removeIndices(this.index_protein, block.nProtein, docIDToDelete);
						utils.removeIndices(this.index_sodium, block.nSodium, docIDToDelete);
						utils.removeIndices(this.index_sugars, block.nSugars, docIDToDelete);
					});
					//Delete old recipe in cookbook
					this.cookbook.splice(_.sortedIndex(this.cookbook, this.filteredCookbook[this.proto_index], 'docID'), 1);

					//Rebuild tags and ingredients array by doing the thing I'm avoiding
					this.cookbook.forEach(recipe => {
						recipe.tags.forEach(tag => {
							self.tagsArray = _.union(self.tagsArray, recipe.tags);
						});
						recipe.blocks.forEach(block => {
							//Ingredients
							block.ingredients.forEach(ingredient => {
								self.ingredientsArray = _.union(self.ingredientsArray, [utils.capitalizeFirstLetter(ingredient.value)]);
							});
						});
					});

					//Execute cloud variables
					this.db.collection('users/' + utils._UID + '/recipes').doc(this.filteredCookbook[this.proto_index].docID).delete().then(() => {
						self.proto_index = 0;
						self.proto_title = '';
						self.proto_description = '';
						self.proto_coverPhotoURL = '';
						self.proto_preptime = '';
						self.proto_cooktime = '';
						self.proto_totaltime = '';
						self.proto_activetime = '';
						self.proto_yield = '';
						self.proto_blocks = [];

						//Update filters
						self.updateFilters();

						//Dismiss offcanvas
						self.deleteRecipeOffcanvas.hide();
					}).catch((error) => {
						console.error("Error removing document: ", error);
					});
				},
				recipeViewListener: function () {
					this.clickedAddRecipe();
				},
				clickedAddRecipe: function () {
					//Do button animation
					if ($('.add-recipe-button').attr('data-ps-button-type') == 'add') {
						this.manage_recipeTitle = 'Add Recipe';
					} else {
						this.manage_recipeTitle = 'Update Recipe';
						//Remove recipeView listener
						this.$refs.recipeView.removeEventListener('hidden.bs.offcanvas', this.recipeViewListener);
					}
					if (this.manageOffcanvas === null) {
						this.manageOffcanvas = new bootstrap.Offcanvas(document.getElementById('manage-recipe-offcanvas'));
					}
					this.manageOffcanvas.show();
				},
				pasteFromClipboard: function (pasteDestination) {
					var self = this;
					navigator.clipboard.readText()
						.then(text => {
							//Split by newline character
							var lines = text.split('\n');
							switch (pasteDestination) {
								case 'tags':
									lines.forEach(line => {
										if (!utils.isEmpty(line)) {
											try {
												self.manage_recipeTagHolder.push({
													value: utils.capitalizeFirstLetter(line.trim()),
													editMode: false,
													editModeButtonText: 'Edit'
												});
											} catch (e) {
												console.log(e);
											}
										}
									});
									break;
								case 'ingredients':
									lines.forEach(line => {
										if (!utils.isEmpty(line)) {
											var words = line.split(' ');
											if (words.length <= 2 && words.length > 0) {
												self.manage_recipeBlockIngredients.push({
													amount: '',
													value: line.trim(),
													editMode: false,
													editModeButtonText: 'Edit'
												});
											} else if (words.length > 2) {
												var t = '';
												for (var i = 2; i < words.length; i++) {
													t += words[i] + ' ';
												}
												self.manage_recipeBlockIngredients.push({
													amount: words[0].trim() + ' ' + words[1].trim(),
													value: t.trim(),
													editMode: false,
													editModeButtonText: 'Edit'
												});
											}
										}
									});
									break;
								case 'steps':
									lines.forEach(line => {
										if (!utils.isEmpty(line)) {
											try {
												self.manage_recipeBlockSteps.push({
													value: utils.capitalizeFirstLetter(line.trim()),
													editMode: false,
													editModeButtonText: 'Edit'
												});
											} catch (e) {
												console.log(e);
											}
										}
									});
									break;
								default:
									break;
							}
						})
						.catch(err => {
							console.error('Failed to read clipboard contents: ', err);
						});
				},
				//Manage recipe methods
				pushToTagArray: function () {
					if (this.manage_recipeTagInput.trim() !== '' && this.manage_recipeTagInput.trim() !== null) {
						this.manage_recipeTagHolder.push({
							value: this.manage_recipeTagInput.trim(),
							editMode: false,
							editModeButtonText: 'Edit'
						});
						this.manage_recipeTagInput = '';
					}
				},
				editTag: function (index) {
					if (!this.manage_recipeTagHolder[index].editMode) {
						this.manage_recipeTagHolder[index].editMode = true;
						this.manage_recipeTagHolder[index].editModeButtonText = 'Update'
						//If update button is being clicked
					} else {
						if (this.manage_recipeTagHolder[index].value.trim() === '' || this.manage_recipeTagHolder[index].value.trim() === null) {
							return;
						}
						this.manage_recipeTagHolder[index].editMode = false;
						this.manage_recipeTagHolder[index].editModeButtonText = 'Edit';
					}
				},
				deleteTag: function (index) {
					this.manage_recipeTagHolder.splice(index, 1);
				},
				autofillActiveTime: function () {
					this.manage_recipeActiveTime = (utils.isNumber(this.manage_recipePrepTime) && utils.isNumber(this.manage_recipeCookTime)) ? (parseInt(this.manage_recipePrepTime) + parseInt(this.manage_recipeCookTime)).toString() : 0;
				},
				addIngredient: function () {
					var ingredientValueBox = $('#manage_ing_value');
					ingredientValueBox.removeClass('is-invalid');
					if ((this.manage_recipeBlockIngredientAmount.trim() === '' || this.manage_recipeBlockIngredientAmount.trim() === null) && (this.manage_recipeBlockIngredientValue.trim() === '' || this.manage_recipeBlockIngredientValue.trim() === null)) {
						return;
					}
					if (this.manage_recipeBlockIngredientValue.trim() === '' || this.manage_recipeBlockIngredientValue.trim() === null) {
						$('#ingredient-invalid-feedback').text('Cannot be blank. Use this for ingredients that don\'t require an amount.');
						ingredientValueBox.addClass('is-invalid');
						return;
					}
					this.manage_recipeBlockIngredients.push({
						amount: this.manage_recipeBlockIngredientAmount.trim(),
						value: this.manage_recipeBlockIngredientValue.trim(),
						editMode: false,
						editModeButtonText: 'Edit'
					});
					this.manage_recipeBlockIngredientAmount = '';
					this.manage_recipeBlockIngredientValue = '';
				},
				editIngredient: function (index) {
					//If edit button is being clicked
					if (!this.manage_recipeBlockIngredients[index].editMode) {
						this.manage_recipeBlockIngredients[index].editMode = true;
						this.manage_recipeBlockIngredients[index].editModeButtonText = 'Update'
						//If update button is being clicked
					} else {
						if (this.manage_recipeBlockIngredients[index].value.trim() === '' || this.manage_recipeBlockIngredients[index].value.trim() === null) {
							return;
						}
						this.manage_recipeBlockIngredients[index].editMode = false;
						this.manage_recipeBlockIngredients[index].editModeButtonText = 'Edit';
					}
				},
				deleteIngredient: function (index) {
					this.manage_recipeBlockIngredients.splice(index, 1);
				},
				addStep: function () {
					var stepValueBox = $('#manage_step_value');
					stepValueBox.removeClass('is-invalid');
					if ((this.manage_recipeBlockStepValue.trim() === '' || this.manage_recipeBlockStepValue.trim() === null) && this.manage_recipeBlockSteps.length === 0) {
						$('#step-invalid-feedback').text('Blocks must contain at least one step.');
						stepValueBox.addClass('is-invalid');
						return;
					}
					this.manage_recipeBlockSteps.push({
						value: this.manage_recipeBlockStepValue.trim(),
						editMode: false,
						editModeButtonText: 'Edit'
					});
					this.manage_recipeBlockStepValue = '';
				},
				editStep: function (index) {
					//If edit button is being clicked
					if (!this.manage_recipeBlockSteps[index].editMode) {
						this.manage_recipeBlockSteps[index].editMode = true;
						this.manage_recipeBlockSteps[index].editModeButtonText = 'Update'
						//If update button is being clicked
					} else {
						if (this.manage_recipeBlockSteps[index].value.trim() === '' || this.manage_recipeBlockSteps[index].value.trim() === null) {
							return;
						}
						this.manage_recipeBlockSteps[index].editMode = false;
						this.manage_recipeBlockSteps[index].editModeButtonText = 'Edit';
					}
				},
				deleteStep: function (index) {
					this.manage_recipeBlockSteps.splice(index, 1);
				},
				toggleNutritionFacts: function () {
					this.nutritionFactsButtonExpandedText = this.nutritionFactsButtonExpandedText === 'Expand Nutrition Facts' ? 'Collapse Nutrition Facts' : 'Expand Nutrition Facts';
				},
				addBlock: function () {
					if (this.manage_recipeBlockSteps.length < 1) {
						$('#step-invalid-feedback').text('Blocks must contain at least one step.');
						$('#manage_step_value').addClass('is-invalid');
						return;
					}
					this.manage_recipeBlocks.push({
						header: this.manage_recipeBlockHeader,
						ingredients: this.manage_recipeBlockIngredients,
						steps: this.manage_recipeBlockSteps,
						nCalories: utils.isNumber(this.manage_nCalories) ? parseInt(this.manage_nCalories) : 0,
						nCarbohydrate: utils.isNumber(this.manage_nCarbohydrate) ? parseInt(this.manage_nCarbohydrate) : 0,
						nCholesterol: utils.isNumber(this.manage_nCholesterol) ? parseInt(this.manage_nCholesterol) : 0,
						nFat: utils.isNumber(this.manage_nFat) ? parseInt(this.manage_nFat) : 0,
						nFiber: utils.isNumber(this.manage_nFiber) ? parseInt(this.manage_nFiber) : 0,
						nProtein: utils.isNumber(this.manage_nProtein) ? parseInt(this.manage_nProtein) : 0,
						nSodium: utils.isNumber(this.manage_nSodium) ? parseInt(this.manage_nSodium) : 0,
						nSugars: utils.isNumber(this.manage_nSugars) ? parseInt(this.manage_nSugars) : 0
					});
					this.manage_recipeBlockHeader = '';
					this.manage_recipeBlockIngredients = [];
					this.manage_recipeBlockSteps = [];
					this.manage_nCalories = '';
					this.manage_nCarbohydrate = '';
					this.manage_nCholesterol = '';
					this.manage_nFat = '';
					this.manage_nFiber = '';
					this.manage_nProtein = '';
					this.manage_nSodium = '';
					this.manage_nSugars = '';
				},
				editBlock: function (index) {
					this.manage_recipeBlockHeader = this.manage_recipeBlocks[index].header;
					this.manage_recipeBlockIngredients = this.manage_recipeBlocks[index].ingredients;
					this.manage_recipeBlockSteps = this.manage_recipeBlocks[index].steps;

					this.manage_nCalories = this.manage_recipeBlocks[index].nCalories;
					this.manage_nCarbohydrate = this.manage_recipeBlocks[index].nCarbohydrate;
					this.manage_nCholesterol = this.manage_recipeBlocks[index].nCholesterol;
					this.manage_nFat = this.manage_recipeBlocks[index].nFat;
					this.manage_nFiber = this.manage_recipeBlocks[index].nFiber;
					this.manage_nProtein = this.manage_recipeBlocks[index].nProtein;
					this.manage_nSodium = this.manage_recipeBlocks[index].nSodium;
					this.manage_nSugars = this.manage_recipeBlocks[index].nSugars;

					this.deleteBlock(index);
				},
				deleteBlock: function (index) {
					this.manage_recipeBlocks.splice(index, 1);
				},
				submitManagedRecipe: function () {
					var self = this;
					var anyInvalid = false;
					var serializedRecipe = {};

					/* **** Clear all form valid classes **** */
					$('#manage_form_name').removeClass('is-valid');
					$('#manage_form_name').removeClass('is-invalid');

					$('.ql-container.ql-snow').removeClass('is-valid');
					$('.ql-container.ql-snow').removeClass('is-invalid');

					$('#manage_form_prep_time').removeClass('is-valid');
					$('#manage_form_prep_time').removeClass('is-invalid');

					$('#manage_form_cook_time').removeClass('is-valid');
					$('#manage_form_cook_time').removeClass('is-invalid');

					$('#manage_form_total_time').removeClass('is-valid');
					$('#manage_form_total_time').removeClass('is-invalid');

					$('#manage_form_active_time').removeClass('is-valid');
					$('#manage_form_active_time').removeClass('is-invalid');

					$('#manage_form_yield').removeClass('is-valid');
					$('#manage_form_yield').removeClass('is-invalid');

					/* **** Validate all form valid classes **** */
					//Check name
					if (utils.isString(this.manage_recipeName)) {
						$('#manage_form_name').addClass('is-valid');
						serializedRecipe.title = this.manage_recipeName.toString().trim();
					} else {
						$('#manage_form_name').addClass('is-invalid');
						anyInvalid = true;
					}

					//Check description
					if (utils.isBigString(this.quillContent)) {
						serializedRecipe.description = this.quillContent;
					} else {
						$('#editor').addClass('is-invalid');
						anyInvalid = true;
					}

					//Serialize tag array
					if (this.manage_recipeTagHolder.length > 0) {
						serializedRecipe.tags = _.uniq(_.pluck(this.manage_recipeTagHolder, 'value'), false);
					}

					//Check prep time
					if (utils.isNumber(this.manage_recipePrepTime)) {
						$('#manage_form_prep_time').addClass('is-valid');
						serializedRecipe.prepTime = parseInt(this.manage_recipePrepTime);
					} else {
						$('#manage_form_prep_time').addClass('is-invalid');
						anyInvalid = true;
					}

					//Check cook time
					if (utils.isNumber(this.manage_recipeCookTime)) {
						$('#manage_form_cook_time').addClass('is-valid');
						serializedRecipe.cookTime = parseInt(this.manage_recipeCookTime);
					} else {
						$('#manage_form_cook_time').addClass('is-invalid');
						anyInvalid = true;
					}

					//Check total time
					if (utils.isNumber(this.manage_recipeTotalTime)) {
						$('#manage_form_total_time').addClass('is-valid');
						serializedRecipe.totalTime = parseInt(this.manage_recipeTotalTime);
					} else {
						$('#manage_form_total_time').addClass('is-invalid');
						anyInvalid = true;
					}

					//Check active time
					if (utils.isNumber(this.manage_recipeActiveTime)) {
						$('#manage_form_active_time').addClass('is-valid');
						serializedRecipe.activeTime = parseInt(this.manage_recipeActiveTime);
					} else {
						$('#manage_form_active_time').addClass('is-invalid');
						anyInvalid = true;
					}

					if (utils.isString(this.manage_recipeYield.toString().trim())) {
						$('#manage_form_yield').addClass('is-valid');
						serializedRecipe.yield = this.manage_recipeYield.toString().trim();
					} else {
						$('#manage_form_yield').addClass('is-invalid');
						anyInvalid = true;
					}

					//Check if any blocks have been added
					if (this.manage_recipeBlocks.length < 1) {
						$('#step-invalid-feedback').text('Blocks must contain at least one step.');
						$('#manage_step_value').addClass('is-invalid');
						anyInvalid = true;
					}

					//Serialize recipe block for push to Firebase
					if (this.manage_recipeBlocks.length > 0) {
						serializedRecipe.blocks = [];
						for (var i = 0; i < this.manage_recipeBlocks.length; i++) {
							let o = {};
							o.header = this.manage_recipeBlocks[i].header;
							o.ingredients = _.map(this.manage_recipeBlocks[i].ingredients, function (row) {
								return _.omit(row, ['editMode', 'editModeButtonText']);
							});

							o.steps = _.map(this.manage_recipeBlocks[i].steps, function (row) {
								return _.omit(row, ['editMode', 'editModeButtonText']);
							});

							//Serialize nutrition facts
							o.nCalories = this.manage_recipeBlocks[i].nCalories;
							o.nCarbohydrate = this.manage_recipeBlocks[i].nCarbohydrate;
							o.nCholesterol = this.manage_recipeBlocks[i].nCholesterol;
							o.nFat = this.manage_recipeBlocks[i].nFat;
							o.nFiber = this.manage_recipeBlocks[i].nFiber;
							o.nProtein = this.manage_recipeBlocks[i].nProtein;
							o.nSodium = this.manage_recipeBlocks[i].nSodium;
							o.nSugars = this.manage_recipeBlocks[i].nSugars;

							serializedRecipe.blocks.push(o);
						}
					} else {
						anyInvalid = true;
					}

					if (anyInvalid) return;

					this.isRecipeSubmitDisabled = true;

					serializedRecipe.coverPhotoURL = null;
					serializedRecipe.docID = uuidv4();
					serializedRecipe.addDate = Date.now();

					if ($('.add-recipe-button').attr('data-ps-button-type') == 'add') {
						//Push serialized recipe into sorted position to cookbook
						if (this.cookbook.length > 0) {
							this.cookbook.splice(_.sortedIndex(this.cookbook, serializedRecipe, 'docID'), 0, serializedRecipe);
						} else {
							this.cookbook.push(serializedRecipe);
						}
					} else if ($('.add-recipe-button').attr('data-ps-button-type') == 'manage') {
						var docIDToUpdate = this.filteredCookbook[this.proto_index].docID;
						serializedRecipe.docID = docIDToUpdate;

						//Remove all references to this recipe from indices
						utils.removeIndices(this.index_times, this.filteredCookbook[this.proto_index].totalTime, docIDToUpdate);
						this.filteredCookbook[this.proto_index].tags.forEach(tag => {
							utils.removeIndices(this.index_tags, tag.toLowerCase(), docIDToUpdate);
						});
						this.filteredCookbook[this.proto_index].blocks.forEach(block => {
							block.ingredients.forEach(ingredient => {
								utils.removeIndices(this.index_ingredients, ingredient.value.toLowerCase(), docIDToUpdate);
							});
							utils.removeIndices(this.index_calories, block.nCalories, docIDToUpdate);
							utils.removeIndices(this.index_carbohydrate, block.nCarbohydrate, docIDToUpdate);
							utils.removeIndices(this.index_cholesterol, block.nCholesterol, docIDToUpdate);
							utils.removeIndices(this.index_fat, block.nFat, docIDToUpdate);
							utils.removeIndices(this.index_fiber, block.nFiber, docIDToUpdate);
							utils.removeIndices(this.index_protein, block.nProtein, docIDToUpdate);
							utils.removeIndices(this.index_sodium, block.nSodium, docIDToUpdate);
							utils.removeIndices(this.index_sugars, block.nSugars, docIDToUpdate);
						});
						//Replace old recipe in cookbook 
						if (this.cookbook.length > 0) {
							this.cookbook.splice(_.sortedIndex(this.cookbook, serializedRecipe, 'docID'), 1, serializedRecipe);
						} else {
							this.cookbook.push(serializedRecipe);
						}

						//Rebuild tags and ingredients array by doing the thing I'm avoiding
						this.cookbook.forEach(recipe => {
							recipe.tags.forEach(tag => {
								self.tagsArray = _.union(self.tagsArray, recipe.tags);
							});
							recipe.blocks.forEach(block => {
								//Ingredients
								block.ingredients.forEach(ingredient => {
									self.ingredientsArray = _.union(self.ingredientsArray, [utils.capitalizeFirstLetter(ingredient.value)]);
								});
							});
						});
					}

					//Merge tags to Explore pane
					this.tagsArray = _.union(Array.from(this.tagsArray), Array.from(_.pluck(this.manage_recipeTagHolder, 'value')));

					//Insert tags
					serializedRecipe.tags.forEach(tag => {
						this.index_tags = utils.insertSortedPosition(this.index_tags, serializedRecipe.docID, tag.toLowerCase(), 'value');
					});

					//Insert time
					this.index_times = utils.insertSortedPosition(this.index_times, serializedRecipe.docID, serializedRecipe.totalTime, 'value');

					serializedRecipe.blocks.forEach(block => {
						//Merge ingredients to Explore pane
						self.ingredientsArray = _.union(Array.from(self.ingredientsArray), block.ingredients.map(f => {
							return utils.capitalizeFirstLetter(f.value);
						}));
						//Insert ingredients
						block.ingredients.forEach(ingredient => {
							this.index_ingredients = utils.insertSortedPosition(this.index_ingredients, serializedRecipe.docID, ingredient.value.toLowerCase(), 'value');
						});
						//Insert nutrition facts
						this.index_calories = utils.insertSortedPosition(this.index_calories, serializedRecipe.docID, block.nCalories, 'value');
						this.index_carbohydrate = utils.insertSortedPosition(this.index_carbohydrate, serializedRecipe.docID, block.nCarbohydrate, 'value');
						this.index_cholesterol = utils.insertSortedPosition(this.index_cholesterol, serializedRecipe.docID, block.nCholesterol, 'value');
						this.index_fat = utils.insertSortedPosition(this.index_fat, serializedRecipe.docID, block.nFat, 'value');
						this.index_fiber = utils.insertSortedPosition(this.index_fiber, serializedRecipe.docID, block.nFiber, 'value');
						this.index_protein = utils.insertSortedPosition(this.index_protein, serializedRecipe.docID, block.nProtein, 'value');
						this.index_sodium = utils.insertSortedPosition(this.index_sodium, serializedRecipe.docID, block.nSodium, 'value');
						this.index_sugars = utils.insertSortedPosition(this.index_sugars, serializedRecipe.docID, block.nSugars, 'value');
					});

					this.updateFilters();

					this.db.collection('users/' + utils._UID + '/recipes').doc(serializedRecipe.docID).set(serializedRecipe).then(function () {
						self.cleanupManageRecipe();
						//Toggle offcanvas
						self.manageOffcanvas.hide();
					}).catch(function (error) {
						console.error(error);
					});
				},
				cleanupManageRecipe: function () {
					//Reset DOM
					$(this.$refs.refAddRecipeButton).attr('data-ps-button-type', 'add');

					//Reset manage recipe values
					this.manage_recipeName = '';
					this.manage_recipeTagInput = '';
					this.manage_recipeTagHolder = [];
					this.manage_recipePrepTime = '';
					this.manage_recipeCookTime = '';
					this.manage_recipeTotalTime = '';
					this.manage_recipeActiveTime = '';
					this.manage_recipeYield = '';
					this.manage_recipeBlocks = [];
					this.manage_recipeBlockIngredients = [];
					this.manage_recipeBlockSteps = [];
					this.manage_recipeBlockHeader = '';
					this.manage_recipeBlockIngredientAmount = '';
					this.manage_recipeBlockIngredientValue = '';
					this.manage_recipeBlockStepValue = '';
					this.quillInstance.setText('\n');

					/* **** Clear all form valid classes **** */
					$('#manage_form_name').removeClass('is-valid');
					$('.ql-container.ql-snow').removeClass('is-valid');
					$('#manage_form_prep_time').removeClass('is-valid');
					$('#manage_form_cook_time').removeClass('is-valid');
					$('#manage_form_total_time').removeClass('is-valid');
					$('#manage_form_active_time').removeClass('is-valid');
					$('#manage_form_yield').removeClass('is-valid');

					//Re-enable submit button
					this.isRecipeSubmitDisabled = true;
				},

				//Utility methods
				toggleFont: function () {
					var r = utils.getLocalStorage(utils.DYSLEXIC_FONT_SET) === 'true' ? 'false' : 'true';
					//Write to cloud
					this.db.collection('users').doc(utils._UID).set({
						dyslexicFontSet: r
					}).then(() => {
						console.log('Wrote new font settings to cloud');
					}).catch((error) => {
						console.error('Error writing cloud font preference: ', error);
					});
					//Write to local storage to prevent cloud syncing issues
					if (utils.getLocalStorage(utils.DYSLEXIC_FONT_SET) === 'true') {
						document.body.style.fontFamily = '"Montserrat", sans-serif';
						this.isDyslexicFontSet = 'false';
					} else {
						document.body.style.fontFamily = '"OpenDyslexic", sans-serif';
						this.isDyslexicFontSet = 'true';
					}
					utils.setLocalStorage(utils.DYSLEXIC_FONT_SET, this.isDyslexicFontSet);
				},
				stripeBillingPortal: function (event) {
					$(event.target).prop('disabled', true);
					goToPortal();
				},
				signOutApp: function () {
					firebase.auth().signOut().then(function () {
						window.location.replace('index.html');
					});
				},
				scrollStop: function () {
					document.body.addEventListener('touchmove', this.touchMove(), {
						passive: false
					});
				},
				scrollMove: function () {
					document.body.removeEventListener('touchmove', this.touchMove());
				},
				touchMove: function (event) {
					try {
						event.preventDefault();
					} catch (e) {
						//
					}
				},
			}
		});

		async function goToPortal() {
			const functionRef = firebase
				.app()
				.functions('us-central1')
				.httpsCallable('ext-firestore-stripe-subscriptions-createPortalLink');
			const {
				data
			} = await functionRef({
				returnUrl: window.location.origin
			});
			window.location.assign(data.url);
		}
	}
})(jQuery);