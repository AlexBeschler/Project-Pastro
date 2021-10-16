(function () {
	var utils = new ProjectPastroUtils();
	var nlp = new ProjectPastroNLP();
	nlp.init();

	window.addEventListener("load", function (event) {
		utils.init();

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
							let button = document.getElementById('paySubscriptionButton');
							button.disabled = true;
							button.textContent = 'Loading...';
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
						document.getElementById('loading-text').textContent = 'Hi ' + utils._FIRSTNAME;
						document.getElementById('loading-subtext').textContent = 'Loading your cookbook...';
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
											//Set local storage which will be read by Vue instance being mounted
											utils.setLocalStorage(utils.DYSLEXIC_FONT_SET, 'true');
										}
									}).catch((error) => {
										//Couldn't get default font set, rely on local storage
										if (utils.getLocalStorage(utils.DYSLEXIC_FONT_SET) === 'true') {
											document.body.style.fontFamily = '"OpenDyslexic", sans-serif';
										}
									});
								}).catch(function (error) {
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
		var sortedTimeIndex = new ProjectPastroRangeIndex();
		var sortedCalories = new ProjectPastroRangeIndex();
		var sortedCarbohydrate = new ProjectPastroRangeIndex();
		var sortedCholesterol = new ProjectPastroRangeIndex();
		var sortedFat = new ProjectPastroRangeIndex();
		var sortedFiber = new ProjectPastroRangeIndex();
		var sortedProtein = new ProjectPastroRangeIndex();
		var sortedSodium = new ProjectPastroRangeIndex();
		var sortedSugars = new ProjectPastroRangeIndex();

		var listOfIngredients = [];
		var listOfTags = [];

		const indexedRecipes = new FlexSearch.Document({
			document: {
				id: "id",
				index: ["docID", "title", "tags", "blocks[]:ingredients[]:value"]
			},
			tokenize: 'full'
		});
		var flexIndex = 0;

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

				//Inject id for FlexSearch during runtime
				recipe.id = flexIndex;
				flexIndex++;

				//Adds recipe to sorted position
				payload.push(recipe);

				//Index recipe titles
				indexedRecipes.add(recipe);

				///Build sorted indices and list of ingredients/tags
				//Tags
				listOfTags = _.union(listOfTags, recipe.tags);

				//Time
				sortedTimeIndex.add(docID, parseInt(recipe.totalTime));

				recipe.blocks.forEach(block => {
					//Ingredients
					block.ingredients.forEach(ingredient => {
						listOfIngredients = _.union(listOfIngredients, [utils.capitalizeFirstLetter(ingredient.value)]);
					});
					//Nutrition Facts
					sortedCalories.add(docID, parseInt(block.nCalories));
					sortedCarbohydrate.add(docID, parseInt(block.nCarbohydrate));
					sortedCholesterol.add(docID, parseInt(block.nCholesterol));
					sortedFat.add(docID, parseInt(block.nFat));
					sortedFiber.add(docID, parseInt(block.nFiber));
					sortedProtein.add(docID, parseInt(block.nProtein));
					sortedSodium.add(docID, parseInt(block.nSodium));
					sortedSugars.add(docID, parseInt(block.nSugars));
				});
			});
		}).then(function () {
			//utils._NANOBAR.go(100);
			appFunctionality(payload, sortedTimeIndex, sortedCalories, sortedCarbohydrate, sortedCholesterol, sortedFat, sortedFiber, sortedProtein, sortedSodium, sortedSugars, listOfIngredients, listOfTags, indexedRecipes, flexIndex);
		});
	}

	function appFunctionality(payload, sortedTimeIndex, sortedCalories, sortedCarbohydrate, sortedCholesterol, sortedFat, sortedFiber, sortedProtein, sortedSodium, sortedSugars, listOfIngredients, listOfTags, indexedRecipes, flexIndex) {
		//Load vue dependencies
		Vue.use('vue-slicksort');

		utils.showCookbook();

		//Bottom Sheet
		Vue.component('bottom-sheet', {
			template: '#bottom-sheet-template',
			props: ['filteredCookbook']
		});

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
			data: {
				//Utils
				db: null,
				cookbook: payload,
				filteredCookbook: payload,
				undo_length_long: 4750,
				undoObject: null,
				undoText: '',
				undoTimeOut: null,

				//Explore pane
				exploreOffcanvas: null,
				explorePaneOffcanvasType: '',
				displayTags: '',
				displayTime: '',
				displayIngredients: '',
				displayNutrition: '',

				explorePaneActive: true,
				searchPaneActive: false,
				optionsPaneActive: false,

				recipePaneCollapsed: true,

				filtApp: false,

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
				index_times: sortedTimeIndex,
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
				flexSearch: indexedRecipes,
				injectedSearchIndexID: flexIndex,

				//For use with manage recipes
				manageOffcanvas: null,
				isRecipeSubmitDisabled: false,
				manage_smartButtonText: '',
				manage_smartButtonProgress: {
					overview: 1,
					coverPhoto: 2,
					timeServings: 3,
					ingredients: 4,
					steps: 5,
					nutrition: 6
				},
				manage_activePane: 1,
				showStickySubmit: false,

				//Step 1
				manage_filePondCoverPhoto: null,
				manage_coverPhotoURL: '',
				manage_coverPhotoThumbnail: '',

				ocr_DescriptionFilePond: null,
				ocr_DescriptionCropperObject: null,
				ocr_DescriptionPondEditor: null,
				ocr_DescriptionEditMode: false,

				ocr_IngredientsFilePond: null,
				ocr_IngredientsCropperObject: null,
				ocr_IngredientsPondEditor: null,
				ocr_IngredientsEditMode: false,

				ocr_StepsFilePond: null,
				ocr_StepsCropperObject: null,
				ocr_StepsPondEditor: null,
				ocr_StepsEditMode: false,

				//Step 2
				manage_recipeTitle: '',
				manage_recipeName: '',
				//manage_recipeDescription: '',
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

				//Used for settings menu
				isDyslexicFontSet: '',
				userID: utils._UID,
				browserUtil: '',

				appContentHammerManager: null,
				touchInputHammerManager: null
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
			},
			mounted() {
				/* Disable back button from closing PWA */
				//Bug - when user reloads page it completely breaks this code
				window.history.pushState(null, null, document.URL);

				window.addEventListener('popstate', function () {
					history.pushState(null, null, document.URL);
				});

				this.initQuill();

				FilePond.registerPlugin(FilePondPluginImageTransform, FilePondPluginImageCrop, FilePondPluginImagePreview, FilePondPluginImageResize, FilePondPluginImageTransform, FilePondPluginImageEdit, FilePondPluginFileValidateType);

				var self = this;

				//On mobile, chrome/safari address bar is 60px and takes up part of the 100vh
				//Meaning if the UA is mobile we need to add an additional 60px to the height of offcanvas
				// to compensate. This is a broad check for mobile, instead of honing in on mobile
				// Safari and Chrome; I simply don't care.
				if (utils._isMobile) {
					document.getElementById('mobile-padding').style.height = '60px';
					this.browserUtil = 'Mobile browser';
				} else {
					this.browserUtil = 'Desktop browser';
				}

				this.$refs.manageRecipeView.addEventListener('hidden.bs.offcanvas', function () {
					self.$refs.undoContainer.style.display = 'none!important';
				});

				var ocrDescriptionButton = new QuillToolbarButton({
					icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="999999" class="bi bi-camera-fill" viewBox="0 0 16 16"><path d="M10.5 8.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"/><path d="M2 4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-1.172a2 2 0 0 1-1.414-.586l-.828-.828A2 2 0 0 0 9.172 2H6.828a2 2 0 0 0-1.414.586l-.828.828A2 2 0 0 1 3.172 4H2zm.5 2a.5.5 0 1 1 0-1 .5.5 0 0 1 0 1zm9 2.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0z"/></svg>`
				});
				ocrDescriptionButton.onClick = function (quill) {
					var bsCollapse = new bootstrap.Collapse(self.$refs.ocr_DescriptionFilePond);
					self.$refs.ocr_DescriptionFilePond.addEventListener('shown.bs.collapse', self.createDescriptionOCR_DOM());
				}
				ocrDescriptionButton.attach(this.quillInstance);

				this.ocr_DescriptionPondEditor = {
					open: (file, instructions) => {
						//If the user already clicked the crop button, don't let another instance be called
						if (self.ocr_DescriptionCropperObject !== null) {
							return;
						}
						var reader = new FileReader();
						reader.onloadend = function () {
							self.ocr_DescriptionEditMode = true;
							var image = new Image();
							image.src = reader.result;
							image.id = 'descriptionCropper';
							document.getElementById('ocrDescriptionCropWrapper').appendChild(image);
							self.ocr_DescriptionCropperObject = new Cropper(document.getElementById('descriptionCropper'));
						}
						reader.readAsDataURL(file);
					},

					onconfirm: (output, item) => {},

					oncancel: () => {},

					onclose: () => {}
				}

				this.ocr_IngredientsPondEditor = {
					open: (file, instructions) => {
						//If the user already clicked the crop button, don't let another instance be called
						if (self.ocr_IngredientsCropperObject !== null) {
							return;
						}
						var reader = new FileReader();
						reader.onloadend = function () {
							self.ocr_IngredientsEditMode = true;
							var image = new Image();
							image.src = reader.result;
							image.id = 'ingredientsCropper';
							document.getElementById('ocrIngredientsCropWrapper').appendChild(image);
							self.ocr_IngredientsCropperObject = new Cropper(document.getElementById('ingredientsCropper'));
						}
						reader.readAsDataURL(file);
					},

					onconfirm: (output, item) => {},

					oncancel: () => {},

					onclose: () => {}
				}

				this.ocr_StepsPondEditor = {
					open: (file, instructions) => {
						//If the user already clicked the crop button, don't let another instance be called
						if (self.ocr_StepsCropperObject !== null) {
							return;
						}
						var reader = new FileReader();
						reader.onloadend = function () {
							self.ocr_StepsEditMode = true;
							var image = new Image();
							image.src = reader.result;
							image.id = 'stepsCropper';
							document.getElementById('ocrStepsCropWrapper').appendChild(image);
							self.ocr_StepsCropperObject = new Cropper(document.getElementById('stepsCropper'));
						}
						reader.readAsDataURL(file);
					},

					onconfirm: (output, item) => {},

					oncancel: () => {},

					onclose: () => {}
				}
				
				//FilePond does not render unless browser 'sees' it. Click listener is to dynamically load FilePond instance
				this.$refs.manageCoverPhotoAccordionButton.addEventListener('shown.bs.collapse', this.createCoverPhoto_DOM);
				this.$refs.ocr_IngredientsFilePond.addEventListener('shown.bs.collapse', this.createIngredientsOCR_DOM);
				this.$refs.ocr_StepsFilePond.addEventListener('shown.bs.collapse', this.createStepsOCR_DOM);

				this.recipeOffcanvas = new bootstrap.Offcanvas(this.$refs.recipeView);
				this.deleteRecipeOffcanvas = new bootstrap.Offcanvas(this.$refs.recipeDeleteOffcanvas);

				this.$refs.manageRecipeView.addEventListener('hidden.bs.offcanvas', this.checkForCancelRecipe);

				

				//Load settings
				this.isDyslexicFontSet = utils.getLocalStorage(utils.DYSLEXIC_FONT_SET) === 'true';

				this.appContentHammerManager = new Hammer.Manager(document.getElementById('appContent'));
				this.appContentHammerManager.add(new Hammer.Swipe());
				this.appContentHammerManager.on('swipe', function (e) {
					//Vertical swipe
					if (e.offsetDirection === 8 || e.offsetDirection === 16) {
						self.clickedExpandChevron();
					}
				});

				this.touchInputHammerManager = new Hammer.Manager(document.getElementById('touch-input-layer'));
				this.touchInputHammerManager.add(new Hammer.Swipe());
				this.touchInputHammerManager.on('swipe', function (e) {
					if (e.offsetDirection === 8 || e.offsetDirection === 16) {
						self.clickedExpandChevron();
					}
				});
				document.body.classList.add('disable-scroll'); //Default view

				var tabEl = document.getElementById('pills-explore-tab');
				tabEl.addEventListener('hidden.bs.tab', function (event) {
					//Collapse Recipe Pane
					var r = document.getElementById('recipePane');
					r.classList.add('collapse');

					var s = document.getElementById('touch-input-layer');
					s.classList.add('touch-action-auto');

					var t = document.getElementById('appContent');
					t.classList.add('touch-action-auto');

					var u = document.getElementById('recipeRevealButton');
					u.classList.add('collapse-important');
				});
				tabEl.addEventListener('show.bs.tab', function (event) {
					//Show recipe Pane
					var r = document.getElementById('recipePane');
					r.classList.remove('collapse');

					var s = document.getElementById('touch-input-layer');
					s.classList.remove('touch-action-auto');

					var t = document.getElementById('appContent');
					t.classList.remove('touch-action-auto');

					var u = document.getElementById('recipeRevealButton');
					u.classList.remove('collapse-important');
				});

				//Add smart button listeners for ManageRecipe
				var smartButtonListeners = [
					this.$refs.manageOverviewAccordionButton,
					this.$refs.manageCoverPhotoAccordionButton,
					this.$refs.manageTimeServingsAccordionButton,
					this.$refs.manageSectionsAccordionButton,
				];
				smartButtonListeners.forEach(element => {
					element.addEventListener('shown.bs.collapse', function () {
						self.updateSmartButtonText();
					});
				});

				var smartTabListeners = [
					this.$refs.manageIngredientsTab,
					this.$refs.manageStepsTab,
					this.$refs.manageNutritionTab
				];
				smartTabListeners.forEach(element => {
					element.addEventListener('shown.bs.tab', function () {
						self.updateSmartButtonText();
					});
				});
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
				manage_recipeTagInput: function (b, a) {
					if (b.length >= (2 + a.length)) {
						this.pasteFromClipboard('tags');
						this.manage_recipeTagInput = '';
					}
				},
				manage_recipeBlockIngredientValue: function (b, a) {
					if (b.length >= (2 + a.length)) {
						this.pasteFromClipboard('ingredients');
						this.manage_recipeBlockIngredientValue = '';
					}
				},
				manage_recipeBlockStepValue: function (b, a) {
					if (!utils.isEmpty(b)) {
						this.$refs.addStepToBlockButton.classList.remove('button-no-outline');
						this.$refs.addStepToBlockButton.classList.add('btn-outline-success');
					} else {
						this.$refs.addStepToBlockButton.classList.remove('btn-outline-success');
						this.$refs.addStepToBlockButton.classList.add('button-no-outline');
					}
					if (b.length >= (2 + a.length)) {
						this.pasteFromClipboard('steps');
						this.manage_recipeBlockStepValue = '';
					}
				},
				model_search: function (b, a) {
					if (this.model_search === '') {
						this.filteredCookbook = this.cookbook;
						return;
					}
					this.filteredCookbook = [];
					var queryResults = this.flexSearch.search(this.model_search);
					if (queryResults.length === 0) {
						return;
					}
					//For future - change query[0] to something dynamic
					queryResults.forEach(queryResult => {
						if (queryResult.field === 'title') {
							queryResult.result.forEach(result => {
								this.filteredCookbook.push(this.cookbook[result]);
							});
						}
					});
				},
				isDyslexicFontSet: function (b, a) {
					this.isDyslexicFontSet ? document.body.style.fontFamily = '"OpenDyslexic", sans-serif' : document.body.style.fontFamily = '"Montserrat", sans-serif';
					//Write to local storage
					utils.setLocalStorage(utils.DYSLEXIC_FONT_SET, this.isDyslexicFontSet);
					//Write to cloud
					this.db.collection('users').doc(utils._UID).set({
						dyslexicFontSet: this.isDyslexicFontSet.toString()
					}).catch((error) => {
						console.error('Error writing cloud font preference: ', error);
					});
				}
			},
			methods: {
				navBarClicked: function () {
					var self = this;
					if (this.$refs.exploreRef.classList.contains('active')) {
						this.appContentHammerManager = new Hammer.Manager(document.getElementById('appContent'));
						this.appContentHammerManager.add(new Hammer.Swipe());
						this.appContentHammerManager.on('swipe', function (e) {
							//Vertical swipe
							if (e.offsetDirection === 8 || e.offsetDirection === 16) {
								self.clickedExpandChevron();
							}
						});

						this.touchInputHammerManager = new Hammer.Manager(document.getElementById('touch-input-layer'));
						this.touchInputHammerManager.add(new Hammer.Swipe());
						this.touchInputHammerManager.on('swipe', function (e) {
							if (e.offsetDirection === 8 || e.offsetDirection === 16) {
								self.clickedExpandChevron();
							}
						});
						document.body.classList.add('disable-scroll');
					} else {
						document.body.classList.remove('disable-scroll');
						if (this.appContentHammerManager !== null) {
							this.appContentHammerManager.destroy();
							this.appContentHammerManager = null;
						}
						if (this.touchInputHammerManager !== null) {
							this.touchInputHammerManager.destroy();
							this.touchInputHammerManager = null;
						}
					}
				},
				//Explore pane
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

					this.proto_coverPhotoURL = this.filteredCookbook[index].coverPhotoURL;

					this.recipeOffcanvas.show();
				},
				updateFilters: function () {
					var filterIDs = [];
					var filtersApplied = false;
					this.filteredCookbook = [];

					//Ranges come first
					//This is due to the fact that ranges are overly broad parameters and we want all possible
					// results added, later intersected by more narrow results
					if (this.finishByTimeInput !== '') {
						filtersApplied = true;
						var result = utils.queryAndParseFlexSearchResults(this.flexSearch, this.index_times.search(parseInt(this.finishByTimeInputInMinutes)));
						if (result != null) {
							filterIDs = _.union(filterIDs, result);
						}
					}
					if (this.totalRecipeTimeInput !== '') {
						filtersApplied = true;
						var result = utils.queryAndParseFlexSearchResults(this.flexSearch, this.index_times.search(parseInt(this.totalRecipeTimeInput)));
						if (result != null) {
							filterIDs = _.union(filterIDs, result);
						}
					}
					if (this.nCalories != '' && parseInt(this.nCalories) !== 0) {
						filtersApplied = true;
						var result = utils.queryAndParseFlexSearchResults(this.flexSearch, this.index_calories.search(parseInt(this.nCalories)));
						if (result != null) {
							filterIDs = _.union(filterIDs, result);
						}
					}
					if (this.nFat != '' && parseInt(this.nFat) !== 0) {
						filtersApplied = true;
						var result = utils.queryAndParseFlexSearchResults(this.flexSearch, this.index_fat.search(parseInt(this.nFat)));
						if (result != null) {
							filterIDs = _.union(filterIDs, result);
						}
					}
					if (this.nCholesterol != '' && parseInt(this.nCholesterol) !== 0) {
						filtersApplied = true;
						var result = utils.queryAndParseFlexSearchResults(this.flexSearch, this.index_cholesterol.search(parseInt(this.nCholesterol)));
						if (result != null) {
							filterIDs = _.union(filterIDs, result);
						}
					}
					if (this.nSodium != '' && parseInt(this.nSodium) !== 0) {
						filtersApplied = true;
						var result = utils.queryAndParseFlexSearchResults(this.flexSearch, this.index_sodium.search(parseInt(this.nSodium)));
						if (result != null) {
							filterIDs = _.union(filterIDs, result);
						}
					}
					if (this.nCarbohydrate != '' && parseInt(this.nCarbohydrate) !== 0) {
						filtersApplied = true;
						var result = utils.queryAndParseFlexSearchResults(this.flexSearch, this.index_carbohydrate.search(parseInt(this.nCarbohydrate)));
						if (result != null) {
							filterIDs = _.union(filterIDs, result);
						}
					}
					if (this.nFiber != '' && parseInt(this.nFiber) !== 0) {
						filtersApplied = true;
						var result = utils.queryAndParseFlexSearchResults(this.flexSearch, this.index_fiber.search(parseInt(this.nFiber)));
						if (result != null) {
							filterIDs = _.union(filterIDs, result);
						}
					}
					if (this.nSugars != '' && parseInt(this.nSugars) !== 0) {
						filtersApplied = true;
						var result = utils.queryAndParseFlexSearchResults(this.flexSearch, this.index_sugars.search(parseInt(this.nSugars)));
						if (result != null) {
							filterIDs = _.union(filterIDs, result);
						}
					}
					if (this.nProtein != '' && parseInt(this.nProtein) !== 0) {
						filtersApplied = true;
						var result = utils.queryAndParseFlexSearchResults(this.flexSearch, this.index_protein.search(parseInt(this.nProtein)));
						if (result != null) {
							filterIDs = _.union(filterIDs, result);
						}
					}

					//Exact matching parameters
					if (this.checkedTagsArray.length > 0) {
						filtersApplied = true;

						this.checkedTagsArray.forEach(checkedTag => {
							var o = [];
							//Get indices of specified tags
							var queryResults = this.flexSearch.search(checkedTag.toLowerCase());
							if (queryResults.length === 0) {
								return;
							}
							queryResults.forEach(queryResult => {
								if (queryResult.field === 'tags') {
									queryResult.result.forEach(result => {
										o.push(result);
									});
								}
							});
							//Push to filterIDs
							if (filterIDs.length < 1) {
								filterIDs = _.union(filterIDs, o);
							} else {
								filterIDs = _.intersection(filterIDs, o);
							}
						});
					}
					if (this.checkedIngredientsArray.length > 0) {
						filtersApplied = true;
						this.checkedIngredientsArray.forEach(checkedIngredient => {
							var o = [];
							//Get indices of specified ingredients
							var queryResults = this.flexSearch.search(checkedIngredient.toLowerCase(), {
								index: 'blocks[]:ingredients[]:value'
							});
							if (queryResults.length === 0) {
								return;
							}
							queryResults.forEach(queryResult => {
								if (queryResult.field === 'blocks[]:ingredients[]:value') {
									queryResult.result.forEach(result => {
										o.push(result);
									});
								}
							});
							//Push to filterIDs
							if (filterIDs.length < 1) {
								filterIDs = _.union(filterIDs, o);
							} else {
								filterIDs = _.intersection(filterIDs, o);
							}
						});
					}

					if (!filtersApplied) {
						this.filteredCookbook = this.cookbook;
						this.filtApp = false;
						return;
					};
					this.filtApp = true;
					this.filteredCookbook = [];
					filterIDs.forEach(id => {
						this.filteredCookbook.push(this.cookbook[id]);
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
				clickedExpandChevron: function () {
					//If the user tapped the button to show recipes
					if (this.recipePaneCollapsed) {
						this.recipePaneCollapsed = false;

					} else {
						this.recipePaneCollapsed = true;
					}
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

					this.manage_coverPhotoURL = this.filteredCookbook[this.proto_index].coverPhotoURL;

					this.filteredCookbook[this.proto_index].blocks.forEach(block => {
						var o = {};
						o.header = block.header;
						o.nCalories = block.nCalories;
						o.nCarbohydrate = block.nCarbohydrate;
						o.nCholesterol = block.nCholesterol;
						o.nFat = block.nFat;
						o.nFiber = block.nFiber;
						o.nProtein = block.nProtein;
						o.nSodium = block.nSodium;
						o.nSugars = block.nSugars;
						o.ingredients = [];
						o.steps = [];
						block.ingredients.forEach(ingredient => {
							o.ingredients.push({
								amount: ingredient.amount,
								editMode: false,
								editModeButtonText: 'Edit',
								value: ingredient.value
							});
						});
						block.steps.forEach(step => {
							o.steps.push({
								editMode: false,
								editModeButtonText: 'Edit',
								value: step.value
							});
						});
						this.manage_recipeBlocks.push(o);
					});
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
					this.$refs.addRecipeButton.dataset.psButtonType = 'manage';

					//Add listener
					this.$refs.recipeView.addEventListener('hidden.bs.offcanvas', this.recipeViewListener);

					this.recipeOffcanvas.hide();
				},
				checkForCancelRecipe: function () {
					//Check if the user closed out of an edit screen
					if (this.$refs.addRecipeButton.dataset.psButtonType == 'manage') {
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
					this.index_times.remove(docIDToDelete, this.filteredCookbook[this.proto_index].totalTime);

					this.flexSearch.remove(this.filteredCookbook[this.proto_index]);

					this.filteredCookbook[this.proto_index].blocks.forEach(block => {
						this.index_calories.remove(docIDToDelete, block.nCalories);
						this.index_carbohydrate.remove(docIDToDelete, block.nCarbohydrate);
						this.index_cholesterol.remove(docIDToDelete, block.nCholesterol);
						this.index_fat.remove(docIDToDelete, block.nFat);
						this.index_fiber.remove(docIDToDelete, block.nFiber);
						this.index_protein.remove(docIDToDelete, block.nProtein);
						this.index_sodium.remove(docIDToDelete, block.nSodium);
						this.index_sugars.remove(docIDToDelete, block.nSugars);
					});
					//Delete old recipe in cookbook
					this.cookbook.splice(this.proto_index, 1);

					//Rebuild tags and ingredients array by doing the thing I'm avoiding
					this.tagsArray = [];
					this.ingredientsArray = [];
					this.cookbook.forEach(recipe => {
						self.tagsArray = _.union(self.tagsArray, recipe.tags);
						recipe.blocks.forEach(block => {
							//Ingredients
							block.ingredients.forEach(ingredient => {
								self.ingredientsArray = _.union(self.ingredientsArray, [utils.capitalizeFirstLetter(ingredient.value)]);
							});
						});
					});

					//Execute cloud variables
					this.db.collection('users/' + utils._UID + '/recipes').doc(docIDToDelete).delete().then(() => {
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
					if (this.$refs.addRecipeButton.dataset.psButtonType == 'add') {
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
					this.$refs.undoContainer.style.display = 'inherit!important';

					this.updateSmartButtonText();

				},
				//Manage recipe methods
				//TODO: when the user clicks on the X button for FilePond, destroy CropperJS instance (if it exists)
				createDescriptionOCR_DOM: function () {
					var self = this;
					if (this.ocr_DescriptionFilePond !== null) {
						return;
					}
					this.ocr_DescriptionFilePond = FilePond.create(document.getElementById('ocrDescriptionFilePond'));
					this.ocr_DescriptionFilePond.setOptions({
						allowImageCrop: true,
						allowImageTransform: true,
						allowImageEdit: true,
						styleImageEditButtonEditItemPosition: 'bottom center',
						imageEditAllowEdit: true,
						imageEditEditor: this.ocr_DescriptionPondEditor,
						labelIdle: 'Drag & drop your file or <span class="filepond--label-action"> Browse </span>',
						server: {
							process: (fieldName, file, metadata, load, error, progress, abort, transfer, options) => {
								var fileEndingRegex = /(?:\.([^.]+))?$/;
								var fileType = fileEndingRegex.exec(file.name)[1];
								var fileName = uuidv4() + '.' + fileType;
								var metadata = {
									contentType: file.type,
								};

								var uploadTask = firebase.storage().ref().child('users/' + utils._UID + '/tempOCR/' + fileName).put(file, metadata);

								uploadTask.on('state_changed', (snapshot) => {
									progress(snapshot.bytesTransferred / snapshot.totalBytes);
								}, (error) => {
									console.log('Error uploading file: ' + e);
									error('Error uploading file: ' + e);
								}, () => {
									//Give user some sort of indications that something is going on behind the scenes
									self.quillInstance.setText('Loading...');

									//Perform upload to Firebase storage
									axios.post('http://localhost:5001/project-pastro-c95b1/us-central1/ocrTextDetection', {
										fileLocation: 'gs://project-pastro-c95b1.appspot.com/users/' + utils._UID + '/tempOCR/' + fileName,
										compressParagraphs: true
									}).then(res => {
										//Asynchronously delete temp OCR file
										firebase.storage().ref('users/' + utils._UID + '/tempOCR/' + fileName).delete().catch((error) => {
											utils.reportError('Error', error, 'Error with deleting temp OCR file ' + fileName);
										});

										try {
											self.ocr_DescriptionCropperObject.destroy();
										} catch (e) {
											//Instance may not exist yet 
										}

										self.quillInstance.setText(res.data.recognizedText);
										load('gs://project-pastro-c95b1.appspot.com/users/' + utils._UID + '/tempOCR/' + fileName);
									}).catch(err => {
										//console.log(err.response.data.message);
										utils.reportError('Error', err.toString(), 'Functions error reported. Doc ID: ' + err.response.data.message.toString());
									});
								});

								return {
									abort: () => {
										abort();
									},
								};
							}
						}
					});
				},
				createIngredientsOCR_DOM: function() {
					var self = this;
					if (this.ocr_IngredientsFilePond !== null) {
						return;
					}
					this.ocr_IngredientsFilePond = FilePond.create(document.getElementById('ocrIngredientsFilePond'));
					this.ocr_IngredientsFilePond.setOptions({
						allowImageCrop: true,
						allowImageTransform: true,
						allowImageEdit: true,
						styleImageEditButtonEditItemPosition: 'bottom center',
						imageEditAllowEdit: true,
						imageEditEditor: this.ocr_IngredientsPondEditor,
						labelIdle: 'Drag & drop your file or <span class="filepond--label-action"> Browse </span>',
						server: {
							process: (fieldName, file, metadata, load, error, progress, abort, transfer, options) => {
								var fileEndingRegex = /(?:\.([^.]+))?$/;
								var fileType = fileEndingRegex.exec(file.name)[1];
								var fileName = uuidv4() + '.' + fileType;
								var metadata = {
									contentType: file.type,
								};
					
								var uploadTask = firebase.storage().ref().child('users/' + utils._UID + '/tempOCR/' + fileName).put(file, metadata);
					
								uploadTask.on('state_changed', (snapshot) => {
									progress(snapshot.bytesTransferred / snapshot.totalBytes);
								}, (error) => {
									console.log('Error uploading file: ' + e);
									error('Error uploading file: ' + e);
								}, () => {
									//Perform upload to Firebase storage
									axios.post('http://localhost:5001/project-pastro-c95b1/us-central1/ocrTextDetection', {
										fileLocation: 'gs://project-pastro-c95b1.appspot.com/users/' + utils._UID + '/tempOCR/' + fileName,
										compressParagraphs: false
									}).then(res => {
										//Asynchronously delete temp OCR file
										firebase.storage().ref('users/' + utils._UID + '/tempOCR/' + fileName).delete().catch((error) => {
											utils.reportError('Error', error, 'Error with deleting temp OCR file ' + fileName);
										});
					
										try {
											self.ocr_IngredientsCropperObject.destroy();
										} catch (e) {
											//Instance may not exist yet 
										}

										//Clear the currently logged ingredients because the user has most likely done a crop
										// and we don't want duplicates
										self.manage_recipeBlockIngredients = [];
										res.data.recognizedText.forEach(ingredient => {
											self.$refs.manage_ing_amount.classList.remove('is-invalid');
											var s = nlp.parseIngredient(ingredient);
											self.manage_recipeBlockIngredients.push({
												amount: s.amount,
												value: s.ingredient,
												editMode: false,
												editModeButtonText: 'Edit'
											});
										});
					
										load('gs://project-pastro-c95b1.appspot.com/users/' + utils._UID + '/tempOCR/' + fileName);
									}).catch(err => {
										//console.log(err.response.data.message);
										utils.reportError('Error', err.toString(), 'Functions error reported. Doc ID: ' + err.response.data.message.toString());
									});
								});
					
								return {
									abort: () => {
										abort();
									},
								};
							}
						}
					});
				},
				createStepsOCR_DOM: function() {
					var self = this;
					if (this.ocr_StepsFilePond !== null) {
						return;
					}
					this.ocr_StepsFilePond = FilePond.create(document.getElementById('ocrStepsFilePond'));
					this.ocr_StepsFilePond.setOptions({
						allowImageCrop: true,
						allowImageTransform: true,
						allowImageEdit: true,
						styleImageEditButtonEditItemPosition: 'bottom center',
						imageEditAllowEdit: true,
						imageEditEditor: this.ocr_StepsPondEditor,
						labelIdle: 'Drag & drop your file or <span class="filepond--label-action"> Browse </span>',
						server: {
							process: (fieldName, file, metadata, load, error, progress, abort, transfer, options) => {
								var fileEndingRegex = /(?:\.([^.]+))?$/;
								var fileType = fileEndingRegex.exec(file.name)[1];
								var fileName = uuidv4() + '.' + fileType;
								var metadata = {
									contentType: file.type,
								};
					
								var uploadTask = firebase.storage().ref().child('users/' + utils._UID + '/tempOCR/' + fileName).put(file, metadata);
					
								uploadTask.on('state_changed', (snapshot) => {
									progress(snapshot.bytesTransferred / snapshot.totalBytes);
								}, (error) => {
									console.log('Error uploading file: ' + e);
									error('Error uploading file: ' + e);
								}, () => {
									//Perform upload to Firebase storage
									axios.post('http://localhost:5001/project-pastro-c95b1/us-central1/ocrTextDetection', {
										fileLocation: 'gs://project-pastro-c95b1.appspot.com/users/' + utils._UID + '/tempOCR/' + fileName,
										compressParagraphs: true
									}).then(res => {
										//Asynchronously delete temp OCR file
										firebase.storage().ref('users/' + utils._UID + '/tempOCR/' + fileName).delete().catch((error) => {
											utils.reportError('Error', error, 'Error with deleting temp OCR file ' + fileName);
										});
					
										try {
											self.ocr_StepsCropperObject.destroy();
										} catch (e) {
											//Instance may not exist yet 
										}

										//Clear the currently logged steps because the user has most likely done a crop
										// and we don't want duplicates
										self.manage_recipeBlockSteps = [];
										var s = res.data.recognizedText.split('\n');
										s.forEach(step => {
											self.manage_recipeBlockSteps.push({
												value: step,
												editMode: false,
												editModeButtonText: 'Edit'
											});
										});
					
										load('gs://project-pastro-c95b1.appspot.com/users/' + utils._UID + '/tempOCR/' + fileName);
									}).catch(err => {
										console.log(err.response.data);
										utils.reportError('Error', err.toString(), 'Functions error reported. Doc ID: ' + err.response.data.message.toString());
									});
								});
					
								return {
									abort: () => {
										abort();
									},
								};
							}
						}
					});
				},
				createCoverPhoto_DOM: function () {
					var self = this;
					if (this.manage_filePondCoverPhoto !== null) {
						return;
					}
					this.manage_filePondCoverPhoto = FilePond.create(document.getElementById('coverPhotoURLInput'));
					this.manage_filePondCoverPhoto.setOptions({
						labelIdle: 'Drag & drop your file or <span class="filepond--label-action"> Browse </span>',
						imageResizeMode: 'contain',
						imageCropAspectRatio: 1,
						imageResizeTargetWidth: 96,
						imageTransformVariantsIncludeOriginal: true,
						onpreparefile: (fileItem, outputFiles) => {
							var u = uuidv4();
							outputFiles.forEach(output => {
								var fileName = u;
								var isThumbnail = false;
								const img = new Image();
								img.onload = function() {
									if (img.width == 96) {
										fileName += '_thumb';
										isThumbnail = true;
									}
									var fileEndingRegex = /(?:\.([^.]+))?$/;
									var fileType = fileEndingRegex.exec(output.file.name)[1];
									fileName += '.';
									fileName += fileType;
									var metadata = {
										contentType: output.file.type,
									};
									uploadCoverPhoto({file: output.file, name: fileName, meta: metadata}).then(function(downloadURL) {
										console.log(downloadURL);
										if (isThumbnail) {
											self.manage_coverPhotoThumbnail = downloadURL;
										} else {
											self.manage_coverPhotoURL = downloadURL;
										}
									});
								}
								img.src = URL.createObjectURL(output.file);
							});
						}
					});
				},
				updateSmartButtonText: function () {
					//Check text to set for smart button
					if (this.$refs.manageOverviewAccordionButton.classList.contains('show')) {
						if (!this.showStickySubmit) {
							this.manage_smartButtonText = 'Cover Photo »';
						}
						this.manage_activePane = this.manage_smartButtonProgress.overview;
					}
					if (this.$refs.manageCoverPhotoAccordionButton.classList.contains('show')) {
						if (!this.showStickySubmit) {
							this.manage_smartButtonText = 'Time & Servings »';
						}
						this.manage_activePane = this.manage_smartButtonProgress.coverPhoto;
					}
					if (this.$refs.manageTimeServingsAccordionButton.classList.contains('show')) {
						if (!this.showStickySubmit) {
							this.manage_smartButtonText = 'Recipe Ingredients »';
						}
						this.manage_activePane = this.manage_smartButtonProgress.timeServings;
					}
					if (this.$refs.manageSectionsAccordionButton.classList.contains('show')) {
						//Bootstrap 5 has a bug related to nav tabs inside an accordion -
						// if the user expands other sections of the accordion, the "show" class of the active (hidden)
						// tab is removed automatically. We need to overcome this by finding the "active" class
						// and adding the "show" class to the corresponding nav tab content
						if (this.$refs.manageIngredientsTab.classList.contains('active')) {
							if (!this.$refs.manageIngredientsSectionButton.classList.contains('show')) {
								this.$refs.manageIngredientsSectionButton.classList.add('active');
								this.$refs.manageIngredientsSectionButton.classList.add('show');
							}
							if (!this.showStickySubmit) {
								this.manage_smartButtonText = 'Recipe Steps »';
							}
							this.manage_activePane = this.manage_smartButtonProgress.ingredients;
						}
						if (this.$refs.manageStepsTab.classList.contains('active')) {
							if (!this.$refs.manageStepsSectionButton.classList.contains('show')) {
								this.$refs.manageStepsSectionButton.classList.add('active');
								this.$refs.manageStepsSectionButton.classList.add('show');
							}
							if (!this.showStickySubmit) {
								this.manage_smartButtonText = 'Recipe Nutrition »';
							}
							this.manage_activePane = this.manage_smartButtonProgress.steps;
						}
						if (this.$refs.manageNutritionTab.classList.contains('active')) {
							if (!this.$refs.manageNutritionSectionButton.classList.contains('show')) {
								this.$refs.manageNutritionSectionButton.classList.add('active');
								this.$refs.manageNutritionSectionButton.classList.add('show');
							}
							this.manage_smartButtonText = 'Submit Recipe';
							this.manage_activePane = this.manage_smartButtonProgress.nutrition;
							this.showStickySubmit = true;
						}
					}
				},
				undoDeleteClicked: function () {
					this.undoObject.f(this);
					clearTimeout(this.undoTimeOut);
				},
				undoDeleteTimeOut: function () {
					if (!this.$refs.undoContainer.classList.contains('undo-collapsed')) {
						this.$refs.undoContainer.classList.add('undo-collapsed');
						this.undoObject = null;

					}
				},
				addTag: function () {
					if (utils.isString(this.manage_recipeTagInput)) {
						this.manage_recipeTagHolder.push({
							value: this.manage_recipeTagInput.trim(),
							editMode: false,
							editModeButtonText: 'Edit'
						});
						this.manage_recipeTagInput = '';
					}
				},
				handleCrop: function (type) {
					var self = this;
					var cropData = null;
					var canvasData = null;
					switch (type) {
						case 'description':
							cropData = this.ocr_DescriptionCropperObject.getData();
							canvasData = this.ocr_DescriptionCropperObject.getCanvasData();
							break;
						case 'ingredients':
							cropData = this.ocr_IngredientsCropperObject.getData();
							canvasData = this.ocr_IngredientsCropperObject.getCanvasData();
							break;
						case 'steps':
							cropData = this.ocr_StepsCropperObject.getData();
							canvasData = this.ocr_StepsCropperObject.getCanvasData();
						default:
							break;
					}

					//Ratio of selected crop area
					var cropAreaRatio = cropData.height / cropData.width;

					//Center point of crop area in percent
					var percentX = (cropData.x + cropData.width / 2) / canvasData.naturalWidth;
					var percentY = (cropData.y + cropData.height / 2) / canvasData.naturalHeight;

					//Calculate available space round image center position
					var cx = percentX > 0.5 ? 1 - percentX : percentX;
					var cy = percentY > 0.5 ? 1 - percentY : percentY;

					//Calculate image rectangle respecting space round image from crop area
					var width = canvasData.naturalWidth;
					var height = width * cropAreaRatio;

					if (height > canvasData.naturalHeight) {
						height = canvasData.naturalHeight;
						width = height / cropAreaRatio;
					}
					var rectWidth = cx * 2 * width;
					var rectHeight = cy * 2 * height;

					//Calculate zoom
					//If the crop rectangle is TALLER than wider, use Math.min
					//If the crop rectangle is WIDER than taller, use Math.max
					var zoom = 0.0;
					if (rectHeight / cropData.height > rectWidth / cropData.width) {
						zoom = Math.min(rectWidth / cropData.width, rectHeight / cropData.height);
					} else {
						zoom = Math.max(rectWidth / cropData.width, rectHeight / cropData.height);
					}
					//TODO: Cropper does not quite nail edges. If a taller crop rectangle shares a border
					// with the image, it seems to include superfluous detail.
					//Use https://github.com/pqina/filepond-plugin-image-edit/issues/1 as reference

					var payload = {
						data: {
							crop: {
								center: {
									x: percentX,
									y: percentY
								},
								flip: {
									horizontal: cropData.scaleX < 0,
									vertical: cropData.scaleY < 0
								},
								zoom: zoom,
								//There were some rotation issues with certain types of photos. Switched to 0 rotation
								rotation: 0,
								aspectRatio: cropAreaRatio
							}
						}
					};

					switch (type) {
						case 'description':
							self.ocr_DescriptionPondEditor.onconfirm(payload);
							self.ocr_DescriptionEditMode = false;
							self.ocr_DescriptionCropperObject.destroy();
							self.ocr_DescriptionCropperObject = null;
							document.getElementById('ocrDescriptionCropWrapper').innerHTML = "";
							break;
						case 'ingredients':
							self.ocr_IngredientsPondEditor.onconfirm(payload);
							self.ocr_IngredientsEditMode = false;
							self.ocr_IngredientsCropperObject.destroy();
							self.ocr_IngredientsCropperObject = null;
							document.getElementById('ocrIngredientsCropWrapper').innerHTML = "";
							break;
						case 'steps':
							self.ocr_StepsPondEditor.onconfirm(payload);
							self.ocr_StepsEditMode = false;
							self.ocr_StepsCropperObject.destroy();
							self.ocr_StepsCropperObject = null;
							document.getElementById('ocrStepsCropWrapper').innerHTML = "";
							break;
						default:
							break;
					}
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
											var s = nlp.parseIngredient(line);
											self.manage_recipeBlockIngredients.push({
												amount: s.amount,
												value: s.ingredient,
												editMode: false,
												editModeButtonText: 'Edit'
											});
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
					this.undoObject = {
						o: this.manage_recipeTagHolder[index],
						i: index,
						f: function (self) {
							self.manage_recipeTagHolder.splice(self.undoObject.i, 0, self.undoObject.o);
							self.$refs.undoContainer.classList.add('undo-collapsed');
						}
					};
					this.manage_recipeTagHolder.splice(index, 1);
					this.undoText = 'Tag deleted';

					this.$refs.undoContainer.classList.remove('undo-collapsed');

					this.undoTimeOut = setTimeout(this.undoDeleteTimeOut, this.undo_length_long);
				},
				autofillActiveTime: function () {
					this.manage_recipeActiveTime = (utils.isNumber(this.manage_recipePrepTime) && utils.isNumber(this.manage_recipeCookTime)) ? (parseInt(this.manage_recipePrepTime) + parseInt(this.manage_recipeCookTime)).toString() : 0;
				},
				addIngredient: function () {
					this.$refs.manage_ing_amount.classList.remove('is-invalid');
					if (!utils.isString(this.manage_recipeBlockIngredientValue)) return;
					var s = nlp.parseIngredient(this.manage_recipeBlockIngredientValue);
					this.manage_recipeBlockIngredients.push({
						amount: s.amount,
						value: s.ingredient,
						editMode: false,
						editModeButtonText: 'Edit'
					});

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
					this.undoObject = {
						o: this.manage_recipeBlockIngredients[index],
						i: index,
						f: function (self) {
							self.manage_recipeBlockIngredients.splice(self.undoObject.i, 0, self.undoObject.o);
							self.$refs.undoContainer.classList.add('undo-collapsed');
						}
					};
					this.manage_recipeBlockIngredients.splice(index, 1);
					this.undoText = 'Ingredient deleted';

					this.$refs.undoContainer.classList.remove('undo-collapsed');

					this.undoTimeOut = setTimeout(this.undoDeleteTimeOut, this.undo_length_long);
				},
				addStep: function () {
					this.$refs.manageStepRef.classList.remove('is-invalid');
					if ((this.manage_recipeBlockStepValue.trim() === '' || this.manage_recipeBlockStepValue.trim() === null) && this.manage_recipeBlockSteps.length === 0) {
						this.$refs.manageStepRef.classList.add('is-invalid');
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
					this.undoObject = {
						o: this.manage_recipeBlockSteps[index],
						i: index,
						f: function (self) {
							self.manage_recipeBlockSteps.splice(self.undoObject.i, 0, self.undoObject.o);
							self.$refs.undoContainer.classList.add('undo-collapsed');
						}
					};
					this.manage_recipeBlockSteps.splice(index, 1);
					this.undoText = 'Step deleted';

					this.$refs.undoContainer.classList.remove('undo-collapsed');

					this.undoTimeOut = setTimeout(this.undoDeleteTimeOut, this.undo_length_long);
				},
				addBlock: function () {
					this.$refs.manageStepRef.classList.remove('is-invalid');
					if (this.manage_recipeBlockSteps.length < 1) {
						this.$refs.manageStepRef.classList.add('is-invalid');
						return;
					}
					this.manage_recipeBlocks.push({
						header: {
							value: 'Recipe',
							editMode: false
						},
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
				editHeader: function (index) {
					//If edit button is being clicked
					if (!this.manage_recipeBlocks[index].header.editMode) {
						this.manage_recipeBlocks[index].header.editMode = true;
						//If update button is being clicked
					} else {
						if (this.manage_recipeBlocks[index].header.value.trim() === '' || this.manage_recipeBlocks[index].header.value.trim() === null) {
							return;
						}
						this.manage_recipeBlocks[index].header.editMode = false;
					}
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
					this.undoObject = {
						o: this.manage_recipeBlocks[index],
						i: index,
						f: function (self) {
							self.manage_recipeBlocks.splice(self.undoObject.i, 0, self.undoObject.o);
							self.$refs.undoContainer.classList.add('undo-collapsed');
						}
					};
					this.manage_recipeBlocks.splice(index, 1);
					this.undoText = 'Section deleted';

					this.$refs.undoContainer.classList.remove('undo-collapsed');

					this.undoTimeOut = setTimeout(this.undoDeleteTimeOut, this.undo_length_long);
				},
				submitManagedRecipe: function () {
					var self = this;
					if (this.manage_smartButtonText !== 'Submit Recipe') {
						//Activate smart button
						var el = null;
						var bs = null;

						switch (this.manage_activePane) {
							case this.manage_smartButtonProgress.overview:
								el = this.$refs.manageCoverPhotoAccordionButton;
								bs = new bootstrap.Collapse(el);
								break;
							case this.manage_smartButtonProgress.coverPhoto:
								el = this.$refs.manageTimeServingsAccordionButton;
								bs = new bootstrap.Collapse(el);
								break;
							case this.manage_smartButtonProgress.timeServings:
								el = this.$refs.manageSectionsAccordionButton;
								bs = new bootstrap.Collapse(el);
								break;
							case this.manage_smartButtonProgress.ingredients:
								el = this.$refs.manageStepsTab;
								bs = new bootstrap.Tab(el);
								bs.show();
								break;
							case this.manage_smartButtonProgress.steps:
								el = this.$refs.manageNutritionTab;
								bs = new bootstrap.Tab(el);
								bs.show();
								break;
							default:
								break;
						}
						return;
					}

					var anyInvalid = false;
					var serializedRecipe = {};

					//Clear all form invalid classes
					Array.prototype.slice.call(document.querySelectorAll('.is-invalid')).forEach(function (form) {
						form.classList.remove('is-invalid');
					});

					//Check name
					if (utils.isString(this.manage_recipeName)) {
						serializedRecipe.title = this.manage_recipeName.toString().trim();
					} else {
						this.$refs.recipeNameRef.classList.add('is-invalid');
						anyInvalid = true;
					}

					//Check description
					if (utils.isBigString(this.quillContent)) {
						serializedRecipe.description = this.quillContent;
					} else {
						this.$refs.recipeDescriptionRef.classList.add('is-invalid')
						anyInvalid = true;
					}

					//Serialize tag array
					if (this.manage_recipeTagHolder.length > 0) {
						serializedRecipe.tags = _.uniq(_.pluck(this.manage_recipeTagHolder, 'value'), false);
					}

					//Check prep time
					if (utils.isNumber(this.manage_recipePrepTime)) {
						serializedRecipe.prepTime = parseInt(this.manage_recipePrepTime);
					} else {
						this.$refs.recipePrepRef.classList.add('is-invalid');
						anyInvalid = true;
					}

					//Check cook time
					if (utils.isNumber(this.manage_recipeCookTime)) {
						serializedRecipe.cookTime = parseInt(this.manage_recipeCookTime);
					} else {
						this.$refs.recipeCookRef.classList.add('is-invalid');
						anyInvalid = true;
					}

					//Check total time
					if (utils.isNumber(this.manage_recipeTotalTime)) {
						serializedRecipe.totalTime = parseInt(this.manage_recipeTotalTime);
					} else {
						this.$refs.recipeTotalRef.classList.add('is-invalid');
						anyInvalid = true;
					}

					//Check active time
					if (utils.isNumber(this.manage_recipeActiveTime)) {
						serializedRecipe.activeTime = parseInt(this.manage_recipeActiveTime);
					} else {
						this.$refs.recipeActiveRef.classList.add('is-invalid');
						anyInvalid = true;
					}

					if (utils.isString(this.manage_recipeYield.toString().trim())) {
						serializedRecipe.yield = this.manage_recipeYield.toString().trim();
					} else {
						this.$refs.recipeYieldRef.classList.add('is-invalid');
						anyInvalid = true;
					}

					//Check if any blocks have been added
					if (this.manage_recipeBlocks.length < 1) {
						//The user probably didn't add a section. Check if there's any steps
						if (this.manage_recipeBlockSteps < 1) {
							this.$refs.manageStepRef.classList.add('is-invalid');
							anyInvalid = true;
						} else {
							//TODO: Package steps & ingredients to a section
						}
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

					return;

					if (anyInvalid) return;

					this.isRecipeSubmitDisabled = true;

					serializedRecipe.docID = uuidv4();
					serializedRecipe.addDate = Date.now();

					if (this.$refs.addRecipeButton.dataset.psButtonType == 'add') {
						this.manage_coverPhotoURL !== '' ? serializedRecipe.coverPhotoURL = this.manage_coverPhotoURL : serializedRecipe.coverPhotoURL = '';
						//Add runtime-injected ID for index
						serializedRecipe.id = this.injectedSearchIndexID;
						//Increase for next time
						this.injectedSearchIndexID++;
						//Push serialized recipe into sorted position to cookbook
						this.cookbook.push(serializedRecipe);
					} else if (this.$refs.addRecipeButton.dataset.psButtonType == 'manage') {
						serializedRecipe.coverPhotoURL = this.manage_coverPhotoURL;

						var docIDToUpdate = this.filteredCookbook[this.proto_index].docID;
						serializedRecipe.docID = docIDToUpdate;

						//Inherit same runtime ID
						serializedRecipe.id = this.filteredCookbook[this.proto_index].id;

						//Remove all references to this recipe from indices
						this.index_times.remove(docIDToUpdate, this.filteredCookbook[this.proto_index].totalTime);

						//Remove document from FlexSearch
						this.flexSearch.remove(this.filteredCookbook[this.proto_index]);

						this.filteredCookbook[this.proto_index].blocks.forEach(block => {
							this.index_calories.remove(docIDToUpdate, block.nCalories);
							this.index_carbohydrate.remove(docIDToUpdate, block.nCarbohydrate);
							this.index_cholesterol.remove(docIDToUpdate, block.nCholesterol);
							this.index_fat.remove(docIDToUpdate, block.nFat);
							this.index_fiber.remove(docIDToUpdate, block.nFiber);
							this.index_protein.remove(docIDToUpdate, block.nProtein);
							this.index_sodium.remove(docIDToUpdate, block.nSodium);
							this.index_sugars.remove(docIDToUpdate, block.nSugars);
						});
						//Replace old recipe in cookbook 
						if (this.cookbook.length > 0) {
							this.cookbook.splice(this.proto_index, 1, serializedRecipe);
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

					//Insert into index
					this.flexSearch.add(serializedRecipe);

					//Insert time
					this.index_times.add(serializedRecipe.docID, serializedRecipe.totalTime);

					serializedRecipe.blocks.forEach(block => {
						//Merge ingredients to Explore pane
						self.ingredientsArray = _.union(Array.from(self.ingredientsArray), block.ingredients.map(f => {
							return utils.capitalizeFirstLetter(f.value);
						}));
						//Insert nutrition facts
						this.index_calories.add(serializedRecipe.docID, parseInt(block.nCalories));
						this.index_carbohydrate.add(serializedRecipe.docID, parseInt(block.nCarbohydrate));
						this.index_cholesterol.add(serializedRecipe.docID, parseInt(block.nCholesterol));
						this.index_fat.add(serializedRecipe.docID, parseInt(block.nFat));
						this.index_fiber.add(serializedRecipe.docID, parseInt(block.nFiber));
						this.index_protein.add(serializedRecipe.docID, parseInt(block.nProtein));
						this.index_sodium.add(serializedRecipe.docID, parseInt(block.nSodium));
						this.index_sugars.add(serializedRecipe.docID, parseInt(block.nSugars));
					});

					this.updateFilters();

					//Destructure object before submitting to Firebase
					//delete keyword seems to modify object in RAM
					var {
						id,
						...sR
					} = serializedRecipe;

					this.db.collection('users/' + utils._UID + '/recipes').doc(serializedRecipe.docID).set(sR).then(function () {
						self.cleanupManageRecipe();
						//Toggle offcanvas
						self.manageOffcanvas.hide();
					}).catch(function (error) {
						console.error(error);
					});
				},
				cleanupManageRecipe: function () {
					//Reset DOM
					this.$refs.addRecipeButton.dataset.psButtonType = 'add';

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
					this.manage_recipeBlockIngredientValue = '';
					this.manage_recipeBlockStepValue = '';
					this.quillInstance.setText('\n');

					//Re-enable submit button
					this.isRecipeSubmitDisabled = false;
				},

				//Utility methods
				stripeBillingPortal: function (event) {
					event.target.disabled = true;
					event.target.textContent = 'Preparing your billing portal...';
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
					} catch (e) {}
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

		async function uploadCoverPhoto(a) {
			return new Promise((resolve, reject) => {
				var task = firebase.storage().ref().child('users/' + utils._UID + '/coverphotos/' + a.name).put(a.file, a.meta);
				task.on('state_changed', (snapshot) => {
					//progress(snapshot.bytesTransferred / snapshot.totalBytes);
				}, (error) => {
					reject(error);
				}, () => {
					task.snapshot.ref.getDownloadURL().then((downloadURL) => {
						resolve(downloadURL);
					}).catch(error => {
						reject(error);
					});
				});
			});
		}
	}
})();