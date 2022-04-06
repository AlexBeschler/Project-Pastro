/*jshint esversion: 8 */
(function () {
	var utils = new ProjectPastroUtils();
	var nlp = new ProjectPastroNLP();
	nlp.init();

	window.addEventListener('load', function() {
		//Progressive web app dependency
		if ("serviceWorker" in navigator) {
			navigator.serviceWorker.register("registerServiceWorker.js");
		}
		utils.init();

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

		//Load vue dependencies
		Vue.use('vue-slicksort');

		//** RecipeView component mixins **//

		//List group draggables
		Vue.component('draggable-list-group', {
			mixins: [ContainerMixin],
			template: '#draggable-list-group-template'
		});
		Vue.component('recipeview-special-equipment-item', {
			mixins: [ElementMixin],
			props: ['equipment'],
			template: '#special-equipment-draggable-item-template'
		});
		Vue.component('recipe-notes-draggable-item', {
			mixins: [ElementMixin],
			props: ['note'],
			template: '#recipe-notes-draggable-item-template'
		});
		Vue.component('recipe-ingredients-draggable-item', {
			mixins: [ElementMixin],
			props: ['ingredient'],
			template: '#recipe-ingredients-draggable-item-template'
		});
		Vue.component('recipe-steps-draggable-item', {
			mixins: [ElementMixin],
			props: ['step'],
			template: '#recipe-steps-draggable-item-template'
		});

		//** RecipeView component mixins **//
		Vue.component('addrecipeview-tag-draggable-item', {
			mixins: [ElementMixin],
			props: ['tag'],
			template: '#addrecipeview-tag-draggable-item-template'
		});

		Vue.component('reactive-svg', {
			props: ['iconcolor'],
			template: '#reactive-svg-template'
		});

		//SVG Icons
		Vue.component('arrow-left-short', {
			template: '#arrow-left-short-template'
		});
		Vue.component('arrow-up-right', {
			template: '#arrow-up-right-template'
		});
		Vue.component('calendar-range', {
			template: '#calendar-range-template'
		});
		Vue.component('camera-fill', {
			template: '#camera-fill-template'
		});
		Vue.component('check-lg', {
			template: '#check-lg-template'
		});
		Vue.component('chevron-bar-expand', {
			template: '#chevron-bar-expand-template'
		});
		Vue.component('edit', {
			template: '#edit-template'
		});
		Vue.component('egg', {
			template: '#egg-template'
		});
		Vue.component('gear', {
			template: '#gear-template'
		});
		Vue.component('info-circle', {
			template: '#info-circle-template'
		});
		Vue.component('journal-richtext', {
			template: '#journal-richtext-template'
		});
		Vue.component('lightning', {
			template: '#lightning-template'
		});
		Vue.component('plus', {
			template: '#plus-template'
		});
		Vue.component('search', {
			template: '#search-template'
		});
		Vue.component('share-fill', {
			template: '#share-fill-template'
		});
		Vue.component('stopwatch', {
			template: '#stopwatch-template'
		});
		Vue.component('tags', {
			template: '#tags-template'
		});
		Vue.component('trash', {
			template: '#trash-template'
		});
		Vue.component('x-lg', {
			template: '#x-lg-template'
		});

		new Vue({
			el: '#appContent',
			data: {
				/** Utils **/
				//Firebase db utils
				db: null,
				storage: null,
				firstname: '',
				//Main app cookbook array
				cookbook: [],
				userPhotoURL: '',

				/** App screen management **/
				//Views are added to this stack to help manage user navigation throughout the lifecycle of the app.
				//   Navigation forward adds to the stack, while moving backwards pops the stack.
				//   This stack is also used for the 'popstate' function - when the user clicks the back button
				//   of the browser. When this happens, the app will pop the ViewStack and move backwards,
				//   providing a seamless UX
				ViewStack: [],
				signin: true,
				paysubscription: false,
				showLoadingContainer: true,
				showLogInContainer: false,
				showAppContainer: false,

				/** Home screen data **/
				headerText: '',
				headerTextAnimeObject: null,
				isHeaderTextHidden: false,
				searchBarExpanded: false,

				///Used for 'Explore' pane
				//Used for FilterView
				filteredCookbook: [],
				flexSearch: null,
				numericIndex: [],
				searchQuery: '',
				searchResults_title: [],
				searchResults_sectionTitle: [],
				filterPresetsList: [],
				showCreateFilterPresetButton: false,
				editFilterPresetButtonText: 'Edit Presets',
				isEditingFilterPresets: false,

				//Tag helpers
				tagModel: '',
				tagList: [],
				filteredTagList: [],
				checkedTagsArray: [],

				//Ingredient helpers
				ingredientModel: '',
				ingredientList: [],
				filteredIngredientList: [],
				checkedIngredientsArray: [],

				//Time helpers
				totalRecipeTimeInput: '',
				finishByTimeInput: '',
				finishByTimeInputInMinutes: '',

				//All tags and ingredients in cookbook
				tagsArray: [],
				ingredientsArray: [],

				filterPresetNameModel: '',
				filterPresetNameIsInvalid: false,
				filterPresetNameFeedback: '',

				/** RecipeView data **/
				selectedRecipe: {},
				detailsDisplayState: 'view',
				tagDisplayState: 'view',
				specialEquipmentDisplayState: 'view',
				notesDisplayState: 'view',
				ingredientsDisplayState: 'view',
				stepsDisplayState: 'view',

				tagAddModel: '',
				specialEquipmentAddModel: '',
				notesAddModel: '',
				stepsAddModel: '',
				isSharing: false,

				/** AddRecipeView data **/
				manage_smartButtonText: 'Cover Photo »',
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
				manage_recipeTitle: '',
				manage_recipeName: '',
				manage_recipeTagInput: '',
				manage_recipeTagHolder: [],
				ocr_DescriptionFilePond: null,
				ocr_DescriptionCropperObject: null,
				ocr_DescriptionPondEditor: null,
				ocr_DescriptionEditMode: false,
				//Step 2
				manage_filePondCoverPhoto: null,
				manage_coverPhotoURL: '',
				manage_coverPhotoThumbnail: '',
				manage_specialEquipmentInput: '',
				manage_specialEquipmentHolder: [],
				manage_recipeNotesInput: '',
				manage_recipeNotesHolder: [],
				//Step 3
				manage_recipePrepTime: '',
				manage_recipeCookTime: '',
				manage_recipeTotalTime: '',
				manage_recipeActiveTime: '',
				manage_recipeYield: '',
				//Step 4
				manage_recipeSections: [{
					"title": "",
					"ingredients": [],
					"steps": [],
					"calories": 0,
					"fat": 0,
					"cholesterol": 0,
					"sodium": 0,
					"totalCarbs": 0,
					"fiber": 0,
					"sugar": 0,
					"protein": 0
				}],

				addIngredientModel: [],
				ingredientModelA: [],
				addStepModel: [],
				stepModelA: [],

				ocr_IngredientsFilePond: null,
				ocr_IngredientsCropperObject: null,
				ocr_IngredientsPondEditor: null,
				ocr_IngredientsEditMode: false,

				ocr_StepsFilePond: null,
				ocr_StepsCropperObject: null,
				ocr_StepsPondEditor: null,
				ocr_StepsEditMode: false,

				injectedFlexIndex: 0,

				isRecipeSubmitDisabled: false,

				/** OptionsView data **/
				//General
				is12HourFormatSet: false,
				//Explore
				isTagsChecked: false,
				isTimeChecked: false,
				isIngredientsChecked: false,
				//Accessibility
				isDarkModeSet: false,
				levelFontSize: '1',
				isDyslexicFontSet: false,
				isHighContrastModeSet: false,
				browserUtil: '',

				iconColor: '#000000',

				/** Utility data **/
				toastInstance: null,
				toastHeader: '',
				toastBody: '',

				/** 3rd Party & API data **/
				//Quill
				//RecipeView
				quillRecipeViewInstance: null,
				quillRecipeViewContent: null,
				//AddRecipeView
				quillAddRecipeViewInstance: null,
				quillAddRecipeViewContent: null,
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

				/** App Version **/
				version: 'Pantry Beta 3.0_01'
			},
			components: {
				'sign-in-layout': {
					template: '#sign-in-layout-template',
					methods: {
						signIn: function () {
							if (!firebase.auth().currentUser) {
								var provider = new firebase.auth.GoogleAuthProvider();
								firebase.auth().signInWithRedirect(provider);
							} else {
								firebase.auth().signOut().then(function () {
									window.location.replace('../index.html');
								});
							}
						}
					}
				},
				'purchase-subscription-layout': {
					template: '#purchase-subscription-layout-template',
					props: {
						firstname: String,
						db: Object
					},
					methods: {
						paySubscription: function () {
							//Disable button
							var button = document.getElementById('paySubscriptionButton');
							button.disabled = true;
							button.textContent = 'Loading...';
							this.db.collection('customers').doc(utils._UID).collection('checkout_sessions').add({
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
							if (!firebase.auth().currentUser) {
								var provider = new firebase.auth.GoogleAuthProvider();
								firebase.auth().signInWithRedirect(provider);
							} else {
								firebase.auth().signOut().then(function () {
									window.location.replace('../index.html');
								});
							}
						}
					}
				}
			},
			mounted() {
				var self = this;
				this.db = firebase.firestore();
				this.db.enablePersistence().then(function () {
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
							utils._UID = user.uid;
							self.userPhotoURL = user.photoURL;
							//Fix for when people's Google account name is all caps
							self.firstname = utils.capitalizeFirstLetter(user.displayName.substr(0, user.displayName.indexOf(' ')).toLowerCase());
							//Check if user is paying customer
							self.db.collection('customers').doc(user.uid).collection('subscriptions').where('status', '==', 'active').get().then(function (snapshot) {
								if (snapshot.empty) { //Customer is not actively subscribed
									self.signin = false;
									self.paysubscription = true;
									self.showLoadingContainer = false;
									self.showLogInContainer = true;
								} else {
									//Customer is actively subscribed
									self.db.collection('users').doc(utils._UID).get().then((doc) => {
										if (doc.data().is12HourFormatSet) {
											utils.setLocalStorage(utils.TWELVE_HOUR_FORMAT_SET, 'true');
										} else {
											utils.setLocalStorage(utils.TWELVE_HOUR_FORMAT_SET, 'false');
										}
										if (doc.data().isTagsChecked) {
											utils.setLocalStorage(utils.TAGS_CHECKED, 'true');
										} else {
											utils.setLocalStorage(utils.TAGS_CHECKED, 'false');
										}
										if (doc.data().isTimeChecked) {
											utils.setLocalStorage(utils.TIME_CHECKED, 'true');
										} else {
											utils.setLocalStorage(utils.TIME_CHECKED, 'false');
										}
										if (doc.data().isIngredientsChecked) {
											utils.setLocalStorage(utils.INGREDIENTS_CHECKED, 'true');
										} else {
											utils.setLocalStorage(utils.INGREDIENTS_CHECKED, 'false');
										}
										if (doc.data().isDarkModeSet) {
											//Turn night mode on
											utils.setLocalStorage(utils.DARK_MODE_SET, 'true');
										} else {
											utils.setLocalStorage(utils.DARK_MODE_SET, 'false');
										}
										switch (doc.data().levelFontSize) {
											case '1':
												utils.setLocalStorage(utils.LEVEL_FONT_SET, '1');
												break;
											case '2':
												utils.setLocalStorage(utils.LEVEL_FONT_SET, '2');
												break;
											case '3':
												utils.setLocalStorage(utils.LEVEL_FONT_SET, '3');
												break;
											case '4':
												utils.setLocalStorage(utils.LEVEL_FONT_SET, '4');
												break;
											default:
												utils.setLocalStorage(utils.LEVEL_FONT_SET, '1');
										}
										var dys_font = new FontFace('OpenDyslexic', 'url(../assets/fonts/OpenDyslexic-Regular.woff)');
										dys_font.load().then(function (loaded_face) {
											document.fonts.add(loaded_face);
											if (doc.data().isDyslexicFontSet) {
												//Set local storage which will be read by Vue instance being mounted
												utils.setLocalStorage(utils.DYSLEXIC_FONT_SET, 'true');
												document.body.style.fontFamily = '"OpenDyslexic", sans-serif';
											} else {
												utils.setLocalStorage(utils.DYSLEXIC_FONT_SET, 'false');
											}
										}).catch(function (error) {
											console.log(error);
											utils.setLocalStorage(utils.DYSLEXIC_FONT_SET, 'false');
										});
										if (doc.data().isHighContrastModeSet) {
											utils.setLocalStorage(utils.HIGH_CONTRAST_SET, 'true');
										} else {
											utils.setLocalStorage(utils.HIGH_CONTRAST_SET, 'false');
										}
				
										//Load settings
										self.is12HourFormatSet = (utils.getLocalStorage(utils.TWELVE_HOUR_FORMAT_SET) === 'true') ? true : false;
				
										self.isTagsChecked = (utils.getLocalStorage(utils.TAGS_CHECKED) === 'true') ? true : false;
										self.isTimeChecked = (utils.getLocalStorage(utils.TIME_CHECKED) === 'true') ? true : false;
										self.isIngredientsChecked = (utils.getLocalStorage(utils.INGREDIENTS_CHECKED) === 'true') ? true : false;
				
										self.isDarkModeSet = (utils.getLocalStorage(utils.DARK_MODE_SET) === 'true') ? true : false;
										self.levelFontSize = utils.getLocalStorage(utils.LEVEL_FONT_SET);
										self.isDyslexicFontSet = (utils.getLocalStorage(utils.DYSLEXIC_FONT_SET) === 'true') ? true : false;
										self.isHighContrastModeSet = (utils.getLocalStorage(utils.HIGH_CONTRAST_SET) === 'true') ? true : false;
				
										//Filter presets
										self.filterPresetsList = doc.data().filterPresets;
									}).then(() => {
										var flexIndex = 0;
										var cookbook = [], tags = [], ingredients = [];
										//Init cookbook meta index
										var metaIndex = new FlexSearch.Document({
											document: {
												id: "id",
												index: [
													"docID",
													"title",
													"tags",
													"sections[]:ingredients[]:value",
													"sections[]:title"
												]
											},
											tokenize: 'full'
										});
										//Init cookbook number meta index
										//Data structure:
										//  {
										//    docID: xx
										//    value: yy
										//  }
										var numberMetaIndex = {
											totalTime: [],
											calories: [],
											carbohydrate: [],
											cholesterol: [],
											fat: [],
											fiber: [],
											protein: [],
											sodium: [],
											sugars: []
										};
										self.db.collection("users/" + utils._UID + "/recipes").get().then(function (querySnapshot) {
											querySnapshot.forEach(function (doc) {
												var recipe = doc.data();

												//Inject id for FlexSearch during runtime
												recipe.id = flexIndex;
												
												//Adds recipe to sorted position
												cookbook.push(recipe);

												//Index recipe titles
												metaIndex.add(recipe);

												///Build sorted indices and list of ingredients/tags
												//Tags
												tags = _.union(tags, recipe.tags);

												//Time
												numberMetaIndex.totalTime.push({
													id: flexIndex,
													value: recipe.totalTime
												});

												recipe.sections.forEach(section => {
													//Ingredients
													section.ingredients.forEach(ingredient => {
														ingredients = _.union(ingredients, [utils.capitalizeFirstLetter(ingredient.value)]);
													});
												});

												flexIndex++;
											});
										}).then(function () {
											self.cookbook = cookbook;

											self.tagList = tags;
											self.filteredTagList = tags;
											self.tagsArray = tags;
											self.ingredientList = ingredients;
											self.filteredIngredientList = ingredients;
											self.ingredientsArray = ingredients;
											
											self.flexSearch = metaIndex;
											self.numericIndex = numberMetaIndex;
											self.injectedFlexIndex = flexIndex;
											self.initApp();
											self.showLoadingContainer = false;
											self.showAppContainer = true;
										}).catch((error) => {
											console.error(error);
										});
									}).catch((error) => {
										console.error(error);
									});
								}
							});
						} else { //User is not signed in 
							self.showLoadingContainer = false;
							self.showLogInContainer = true;
						}
					});
				}).catch((error) => {
					if (error.code == 'failed-precondition') {
						//Multiple tabs open
					} else if (error.code == 'unimplemented') {
						//Current browser doesn't support offline
					}
				});
			},
			watch: {
				searchQuery: function (b, a) {
					if (b.length > 1 && b.trim() !== '') {
						this.updateSearchQuery(b);
					} else {
						this.searchResults_title = [];
						this.searchResults_sectionTitle = [];
					}
				},
				checkedTagsArray: function (b, a) {
					this.updateFilters();
				},
				tagModel: function (b, a) {
					if (b === '') {
						this.filteredTagList = []; //Clear the list
						this.filteredTagList = this.tagList; //Clone
						return;
					}
					this.updateFilteredTags(b);
				},
				totalRecipeTimeInput: function (b, a) {
					if (this.finishByTimeInput != null || this.finishByTimeInput != '') {
						this.finishByTimeInput = '';
					}
					this.updateFilters();
				},
				finishByTimeInput: function (b, a) {
					if (this.totalRecipeTimeInput != null || this.totalRecipeTimeInput != '') {
						this.totalRecipeTimeInput = '';
					}

					try {
						var input = this.finishByTimeInput;
						var inputHours = parseInt(input.split(':')[0]);
						var inputMinutes = parseInt(input.split(':')[1]);
						var now = new Date(Date.now());
						var nowHours = parseInt(now.getHours());
						var nowMinutes = parseInt(now.getMinutes());

						this.getFilterTimeDuration(nowHours, nowMinutes, inputHours, inputMinutes);
					} catch (e) {
						console.error(e);
					}
					this.updateFilters();
				},
				checkedIngredientsArray: function (b, a) {
					this.updateFilters();
				},
				ingredientModel: function (b, a) {
					if (b === '') {
						this.filteredIngredientList = []; //Clear the list
						this.filteredIngredientList = this.ingredientList; //Clone
						return;
					}
					this.updateFilteredIngredients(b);
				},
				addIngredientModel: {
					handler: function (after, before) {
						if (utils.isEmptyArray(after)) {
							this.ingredientModelA = [];
							return;
						}
						var self = this;
						var pasteDetected = false;
						var k = 0;
						if (utils.isEmptyArray(this.ingredientModelA)) {
							for (var i = 0; i < after.length; i++) {
								if (typeof after[i] == 'undefined') {
									continue;
								}
								if (after[i].length >= 2) {
									pasteDetected = true;
									k = i;
								}
							}
						} else {
							for (var j = 0; j < this.ingredientModelA.length; j++) {
								if (typeof after[j] == 'undefined') {
									continue;
								}
								if (after[j].length >= (this.ingredientModelA[j].length + 2)) {
									pasteDetected = true;
									k = j;
								}
							}
						}
						if (pasteDetected) {
							//Do NLP stuff here
							navigator.clipboard.readText()
								.then(text => {
									//Split by newline character
									var lines = text.split('\n');
									lines.forEach(line => {
										if (!utils.isEmpty(line)) {
											var s = nlp.parseIngredient(line);
											self.manage_recipeSections[k].ingredients.push({
												amount: s.amount,
												value: s.ingredient,
												isDeleted: false
											});
										}
									});
								})
								.catch(err => {
									console.error('Failed to read clipboard contents: ', err);
								});
							this.ingredientModelA = utils.deepClone(after);
							this.addIngredientModel = [];
						} else {
							this.ingredientModelA = utils.deepClone(after);
						}
					},
					deep: true
				},
				addStepModel: {
					handler: function (after, before) {
						if (utils.isEmptyArray(after)) {
							this.stepModelA = [];
							return;
						}
						var self = this;
						var pasteDetected = false;
						var k = 0;
						if (utils.isEmptyArray(this.stepModelA)) {
							for (var i = 0; i < after.length; i++) {
								if (typeof after[i] == 'undefined') {
									continue;
								}
								if (after[i].length >= 2) {
									pasteDetected = true;
									k = i;
								}
							}
						} else {
							for (var j = 0; j < this.stepModelA.length; j++) {
								if (typeof after[j] == 'undefined') {
									continue;
								}
								if (after[j].length >= (this.stepModelA[j].length + 2)) {
									pasteDetected = true;
									k = j;
								}
							}
						}
						if (pasteDetected) {
							//Do NLP stuff here
							navigator.clipboard.readText()
								.then(text => {
									//Split by newline character
									var lines = text.split('\n');
									lines.forEach(line => {
										if (!utils.isEmpty(line)) {
											try {
												self.manage_recipeSections[k].steps.push({
													value: utils.capitalizeFirstLetter(line.trim()),
													isDeleted: false
												});
											} catch (e) {
												console.log(e);
											}
										}
									});
								})
								.catch(err => {
									console.error('Failed to read clipboard contents: ', err);
								});
							this.stepModelA = utils.deepClone(after);
							this.addStepModel = [];
						} else {
							this.stepModelA = utils.deepClone(after);
						}
					},
					deep: true
				},

				/** OptionsView **/
				is12HourFormatSet: function (b, a) {
					//Write to local storage
					utils.setLocalStorage(utils.TWELVE_HOUR_FORMAT_SET, this.is12HourFormatSet.toString());
					//Update cloud settings
					this.updateSetting({
						'is12HourFormatSet': this.is12HourFormatSet
					});
				},
				isTagsChecked: function (b, a) {
					//Write to local storage
					utils.setLocalStorage(utils.TAGS_CHECKED, this.isTagsChecked.toString());
					//Update cloud settings
					this.updateSetting({
						'isTagsChecked': this.isTagsChecked
					});
				},
				isTimeChecked: function (b, a) {
					//Write to local storage
					utils.setLocalStorage(utils.TIME_CHECKED, this.isTimeChecked.toString());
					//Update cloud settings
					this.updateSetting({
						'isTimeChecked': this.isTimeChecked
					});
				},
				isIngredientsChecked: function (b, a) {
					//Write to local storage
					utils.setLocalStorage(utils.INGREDIENTS_CHECKED, this.isIngredientsChecked.toString());
					//Update cloud settings
					this.updateSetting({
						'isIngredientsChecked': this.isIngredientsChecked
					});
				},
				isDarkModeSet: function (b, a) {
					document.body.classList.toggle('dark-theme');
					this.iconColor = (this.isDarkModeSet) ? '#eeeeee' : '#000000';
					//Write to local storage
					utils.setLocalStorage(utils.DARK_MODE_SET, this.isDarkModeSet.toString());
					//Update cloud settings
					this.updateSetting({
						'isDarkModeSet': this.isDarkModeSet
					});
				},
				levelFontSize: function (b, a) {
					document.body.classList.remove('font-increase-1');
					document.body.classList.remove('font-increase-2');
					document.body.classList.remove('font-increase-3');
					document.body.classList.remove('font-increase-4');
					switch (this.levelFontSize) {
						case '1':
							document.body.classList.add('font-increase-1');
							break;
						case '2':
							document.body.classList.add('font-increase-2');
							break;
						case '3':
							document.body.classList.add('font-increase-3');
							break;
						case '4':
							document.body.classList.add('font-increase-4');
							break;
						default:
							document.body.classList.add('font-increase-1');
					}
					//Write to local storage
					utils.setLocalStorage(utils.LEVEL_FONT_SET, this.levelFontSize);
					//Update cloud settings
					this.updateSetting({
						'levelFontSize': this.levelFontSize
					});
				},
				isDyslexicFontSet: function (b, a) {
					//Change setting
					this.isDyslexicFontSet ? document.body.style.fontFamily = '"OpenDyslexic", sans-serif' : document.body.style.fontFamily = '"Montserrat", sans-serif';
					//Write to local storage
					utils.setLocalStorage(utils.DYSLEXIC_FONT_SET, this.isDyslexicFontSet.toString());
					//Update cloud settings
					this.updateSetting({
						'isDyslexicFontSet': this.isDyslexicFontSet
					});
				},
				isHighContrastModeSet: function (b, a) {
					//Write to local storage
					utils.setLocalStorage(utils.HIGH_CONTRAST_SET, this.isHighContrastModeSet.toString());
					//Update cloud settings
					this.updateSetting({
						'isHighContrastModeSet': this.isHighContrastModeSet
					});
				},
			},
			methods: {
				/**** Init App ****/
				initApp: function () {
					var self = this;
					/* Disable back button from closing PWA */
					//Bug - when user reloads page it completely breaks this code
					window.history.pushState(null, null, document.URL);

					window.addEventListener('popstate', function () {
						self.navigateBackward();
						history.pushState(null, null, document.URL);
					});

					this.storage = firebase.storage().ref();

					FilePond.registerPlugin(FilePondPluginImageTransform, FilePondPluginImageCrop, FilePondPluginImagePreview, FilePondPluginImageResize, FilePondPluginImageTransform, FilePondPluginImageEdit, FilePondPluginFileValidateType);

					//On mobile, chrome/safari address bar is 60px and takes up part of the 100vh
					//Meaning if the UA is mobile we need to add an additional 60px to the height of offcanvas
					// to compensate. This is a broad check for mobile, instead of honing in on mobile
					// Safari and Chrome; I simply don't care.
					if (utils._isMobile) {
						//document.getElementById('mobile-padding').style.height = '60px';
						this.browserUtil = 'Mobile browser';
					} else {
						this.browserUtil = 'Desktop browser';
					}

					//Add the main menu to the view stack
					this.ViewStack.push(this.$refs.exploreMenuContainer);

					var greeting = 'Good ';
					var mHour = new Date().getHours();
					switch (mHour) {
						case 0:
						case 1:
						case 2:
						case 3:
						case 4:
							greeting += 'evening';
							break;
						case 5:
						case 6:
						case 7:
						case 8:
						case 9:
						case 10:
						case 11:
							greeting += 'morning';
							break;
						case 12:
						case 13:
						case 14:
						case 15:
						case 16:
							greeting += 'afternoon';
							break;
						case 17:
						case 18:
						case 19:
						case 20:
						case 21:
						case 22:
						case 23:
							greeting += 'evening';
							break;
					}
					greeting += ' ';
					greeting += this.firstname;
					this.headerText = greeting;

					this.headerTextAnimeObject = anime.timeline({});

					this.headerTextAnimeObject
						.add({
							targets: this.$refs.addRecipeButton,
							translateX: function (el, i, l) {
								return ['32px', '0px'];
							},
							opacity: {
								value: 1,
								duration: 250
							},
							rotate: [45, 0],
							delay: 250,
							duration: 450,
							easing: 'easeOutBack'
						})
						.add({
							targets: this.$refs.headerText,
							translateY: ['0%', '50%'],
							opacity: [1, 0],
							duration: 200,
							easing: 'easeInOutQuad',
							complete: function (anim) {
								self.headerText = 'Let\'s get started';
							}
						}, '+=575')
						.add({
							targets: this.$refs.headerText,
							translateY: ['-50%', '0%'],
							opacity: [0, 1],
							duration: 200,
							easing: 'easeInOutQuad'
						}, '+=30');

					anime({
						targets: this.$refs.explorePaneContent,
						translateY: ['5%', '0%'],
						opacity: [0, 1],
						duration: 250,
						delay: 250,
						easing: 'easeOutQuad'
					});

					//FilePond for cover photo
					this.$refs.manageCoverPhotoAccordionButton.addEventListener('shown.bs.collapse', this.createCoverPhoto_DOM);

					//Create OCR objects

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
							};
							reader.readAsDataURL(file);
						},

						onconfirm: (output, item) => {},

						oncancel: () => {},

						onclose: () => {}
					};

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
								image.id = 'IngredientsCropper';
								document.getElementById('ocrIngredientsCropWrapper').appendChild(image);
								self.ocr_IngredientsCropperObject = new Cropper(document.getElementById('ingredientsCropper'));
							};
							reader.readAsDataURL(file);
						},

						onconfirm: (output, item) => {},

						oncancel: () => {},

						onclose: () => {}
					};

					this.$refs.ocrIngredientsFilePondWrapperRef.addEventListener('shown.bs.collapse', this.createIngredientsOCR_DOM());

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
								image.id = 'StepsCropper';
								document.getElementById('ocrStepsCropWrapper').appendChild(image);
								self.ocr_StepsCropperObject = new Cropper(document.getElementById('StepsCropper'));
							};
							reader.readAsDataURL(file);
						},

						onconfirm: (output, item) => {},

						oncancel: () => {},

						onclose: () => {}
					};

					this.$refs.ocrStepsFilePondWrapperRef.addEventListener('shown.bs.collapse', this.createStepsOCR_DOM());

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
						//this.$refs.manageNutritionTab
					];
					smartTabListeners.forEach(element => {
						element.addEventListener('shown.bs.tab', function () {
							self.updateSmartButtonText();
						});
					});

					this.toastInstance = new bootstrap.Toast(this.$refs.toastNotification);
					this.$refs.toastNotification.addEventListener('hidden.bs.toast', function () {
						self.toastHeader = '';
						self.toastBody = '';
					});
				},

				/**** Button Helpers ****/
				clickedSettings: function () {
					this.navigateForward(this.$refs.optionsView, null, null);
				},
				clickedSearchBar: function () {
					if (this.searchBarExpanded) {
						this.clickedCloseSearch();
						return;
					}
					var self = this;

					//For Close Search 'X' icon - measure distance between current position and parent container left side
					const selectedEl = this.$refs.closeSearchButton;
					const searchBox = this.$refs.searchBoxButton;
					const initialSearchBoxLeft = searchBox.getBoundingClientRect().left;
					let actualSelectedElLeft = selectedEl.getBoundingClientRect().left;
					let selectedElPosition = (actualSelectedElLeft - initialSearchBoxLeft - utils.remToPixels(1.5));

					var timeline = anime.timeline({});
					timeline
						.add({
							targets: this.$refs.searchBoxButton,
							duration: 100,
							easing: 'easeInOutQuad',
						})
						.add({
							targets: document.getElementById('innerSearchButtonText'),
							translateY: ['0%', '-50%'],
							opacity: [1, 0],
							duration: 200,
							easing: 'easeInOutQuad',
						}, '-=100')
						.add({
							targets: document.getElementById('innerSearchButtonImg1'),
							translateX: ['0px', '-' + selectedElPosition + 'px'],
							opacity: [1, 0],
							duration: 200,
							easing: 'easeInOutQuad'
						}, '-=100')
						.add({
							targets: this.$refs.closeSearchButton,
							translateX: ['0px', '-' + selectedElPosition + 'px'],
							opacity: [0, 1],
							duration: 200,
							easing: 'easeInOutQuad'
						}, '-=200')
						.add({
							targets: this.ViewStack[this.ViewStack.length - 1],
							opacity: [1, 0],
							translateY: ['0rem', '-1rem'],
							duration: 100,
							easing: 'easeInOutQuad',
							complete: function (anim) {
								self.ViewStack[self.ViewStack.length - 1].classList.add('d-none');
							}
						}, '-=300')
						.add({
							targets: this.$refs.searchBoxInput,
							opacity: [0, 1],
							duration: 100,
							easing: 'easeInOutQuad',
							begin: function (anim) {
								self.$refs.searchBoxInput.classList.remove('d-none');
								self.$refs.searchBoxInput.classList.add('d-flex');
							},
							complete: function (anim) {
								self.$refs.searchBoxInput.focus();
							}
						}, '-=5')
						.add({
							targets: this.$refs.searchResultsContainer,
							opacity: [0, 1],
							duration: 150,
							translateY: ['0.5rem', '0rem'],
							easing: 'easeInOutQuad',
							begin: function (anim) {
								self.$refs.searchResultsContainer.classList.remove('d-none');
							},
						}, '-=5');

					this.hideHeader();
					this.searchBarExpanded = true;
				},
				clickedCloseSearch: function () {
					var self = this;
					return new Promise((resolve, reject) => {
						var timeline = anime.timeline({});
						timeline
							.add({
								targets: this.$refs.searchResultsContainer,
								opacity: [1, 0],
								duration: 150,
								translateY: ['0rem', '-0.5rem'],
								easing: 'easeInOutQuad',
								complete: function (anim) {
									self.$refs.searchResultsContainer.classList.add('d-none');
								}
							})
							.add({
								targets: this.ViewStack[this.ViewStack.length - 1],
								opacity: [0, 1],
								translateY: ['0%', '-1rem'],
								duration: 150,
								easing: 'easeInOutQuad',
								begin: function (anim) {
									self.ViewStack[self.ViewStack.length - 1].classList.remove('d-none');
									self.ViewStack[self.ViewStack.length - 1].classList.add('d-block');
								}
							}, '-=5')
							.add({
								targets: this.$refs.searchBoxInput,
								opacity: [1, 0],
								duration: 100,
								easing: 'easeInOutQuad',
								complete: function (anim) {
									self.$refs.searchBoxInput.classList.remove('d-flex');
									self.$refs.searchBoxInput.classList.add('d-none');
								}
							}, '-=150')
							.add({
								targets: document.getElementById('innerSearchButtonText'),
								translateY: ['50%', '0%'],
								opacity: [0, 1],
								duration: 200,
								easing: 'easeInOutQuad',
							}, '-=100')
							.add({
								targets: document.getElementById('innerSearchButtonImg2'),
								translateX: ['-175%', '0%'],
								opacity: [1, 0],
								duration: 200,
								easing: 'easeInOutQuad'
							}, '-=300')
							.add({
								targets: document.getElementById('innerSearchButtonImg1'),
								translateX: ['-175%', '0%'],
								opacity: [0, 1],
								duration: 200,
								easing: 'easeInOutQuad',
								complete: function () {
									self.searchBarExpanded = false;
									self.searchQuery = '';
									resolve();
								}
							}, '-=200');
					});
				},
				clickedBrowse: function () {
					this.navigateForward(this.$refs.filterRecipesContainer, this.$refs.fromFilterToHomeBackButtonImg, this.$refs.fromFilterToHomeBackButtonText);
				},
				clickedAddRecipe: function () {
					var self = this;
					this.navigateForward(this.$refs.addRecipeView, null, null).then(() => {
						if (self.quillAddRecipeViewInstance === null) {
							self.initAddRecipeViewQuill();
						}
					});
				},
				clickedClearTagFilters: function () {
					this.checkedTagsArray = [];
				},
				clickedClearTimeFilters: function () {
					this.totalRecipeTimeInput = '';
					this.finishByTimeInput = '';
				},
				clickedClearIngredientFilters: function () {
					this.checkedIngredientsArray = [];
				},
				clickedRecipeFromExplorePane: function (index) {
					this.selectRecipe(this.filteredCookbook[index]);
					this.navigateForward(this.$refs.recipeView, null, null);
				},
				clickedRecipeTitleFromSearch: function (index) {
					this.clickedCloseSearch();
					this.selectRecipe(this.searchResults_title[index]);
					this.navigateForward(this.$refs.recipeView, null, null);
				},
				clickedRecipeSectionFromSearch: function (index) {
					this.clickedCloseSearch();
					this.selectRecipe(this.searchResults_sectionTitle[index]);
					this.navigateForward(this.$refs.recipeView, null, null);
				},
				clickedStrikeListItem: function (element) {
					//Find parent element; consider the <li> the parent
					if (element.target.classList.contains('list-group-item')) { //We've got the parent
						element.target.classList.toggle('strike-list-item');
					} else {
						element.srcElement.parentNode.classList.toggle('strike-list-item');
					}
				},
				clickedFilterPreset: function (index) {
					//Allow the user to delete a preset
					// instead of clicking the filter
					if (this.isEditingFilterPresets) {
						return;
					}
					this.checkedTagsArray = [];
					this.totalRecipeTimeInput = '';
					this.finishByTimeInput = '';
					this.checkedIngredientsArray = [];

					//Load tags
					this.filterPresetsList[index].tags.forEach(tag => {
						//Check if tag exists
						let i = _.find(this.tagsArray, function (a) {
							return a === tag;
						});
						if (typeof i !== "undefined") {
							this.checkedTagsArray.push(tag);
						}
					});
					//Load times
					if (this.filterPresetsList[index].totalRecipeTime !== '') {
						this.totalRecipeTimeInput = this.filterPresetsList[index].totalRecipeTime;
					}
					if (this.filterPresetsList[index].finishByTime !== '') {
						this.finishByTimeInput = this.filterPresetsList[index].finishByTime;
					}
					//Load ingredients
					this.filterPresetsList[index].ingredients.forEach(ingredient => {
						//Check if tag exists
						let i = _.find(this.ingredientsArray, function (a) {
							return a === ingredient;
						});
						if (typeof i !== "undefined") {
							this.checkedIngredientsArray.push(ingredient);
						}
					});
					//Navigate forward
					this.clickedBrowse();
				},
				clickedEditFilterPreset: function () {
					if (this.isEditingFilterPresets) {
						this.isEditingFilterPresets = false;
						this.editFilterPresetButtonText = 'Edit Presets';
					} else {
						this.isEditingFilterPresets = true;
						this.editFilterPresetButtonText = 'Save';
					}
				},

				/**** Animation utilities ****/
				getAbsoluteHeight: function (el) {
					el = (typeof el === 'string') ? document.querySelector(el) : el;

					var styles = window.getComputedStyle(el);
					var margin = parseFloat(styles['marginTop']) + parseFloat(styles['marginBottom']); // jshint ignore:line

					return Math.ceil(el.offsetHeight + margin);
				},

				/**** Animation methods ****/
				hideHeader: function () {
					if (this.isHeaderTextHidden) {
						return;
					}

					this.headerTextAnimeObject.pause();

					var self = this;
					var headerTextHeight = this.getAbsoluteHeight(this.$refs.headerText);
					var h = '-' + headerTextHeight + 'px';

					var headerTextTimeline = anime.timeline({});
					headerTextTimeline
						.add({
							targets: this.$refs.headerText,
							translateY: ['0px', h],
							opacity: [1, 0],
							duration: 250,
							easing: 'easeInOutQuad',
							complete: function (anim) {
								self.isHeaderTextHidden = true;
							}
						})
						.add({
							targets: this.$refs.explorePaneContent,
							translateY: ['0px', h],
							duration: 250,
							easing: 'easeInOutQuad'
						}, '-=250');
				},
				navigateForward: function (navigateTo, backButtonImg, backButtonText) {
					var self = this;

					var forward = new Promise((resolve, reject) => {
						var timeline = anime.timeline({});
						var currentView = self.ViewStack[self.ViewStack.length - 1];
						if (backButtonImg === null) {
							timeline
								.add({
									targets: currentView,
									translateX: ['0%', '-50%'],
									opacity: [1, 0],
									duration: utils.ViewStackExitAnimationDuration,
									easing: 'easeInOutQuad',
									complete: function (anim) {
										currentView.classList.add('d-none');
									}
								})
								.add({
									targets: navigateTo,
									translateX: ['50%', '0%'],
									opacity: [0, 1],
									duration: utils.ViewStackEnterAnimationDuration,
									easing: 'easeInOutQuad',
									begin: function (anim) {
										navigateTo.classList.remove('d-none');
										navigateTo.classList.add('d-block');
									},
									complete: function () {
										resolve();
									}
								}, '+=' + utils.ViewStackAnimationDelayDuration);
						} else {
							timeline
								.add({
									targets: currentView,
									translateX: ['0%', '-50%'],
									opacity: [1, 0],
									duration: 200,
									easing: 'easeInOutQuad',
									complete: function (anim) {
										currentView.classList.add('d-none');
									}
								})
								.add({
									targets: navigateTo,
									translateX: ['50%', '0%'],
									opacity: [0, 1],
									duration: 200,
									easing: 'easeInOutQuad',
									begin: function (anim) {
										navigateTo.classList.remove('d-none');
										navigateTo.classList.add('d-block');
									}
								}, '+=5')
								.add({
									targets: backButtonText,
									translateX: ['-0.5rem', '0rem'],
									opacity: [0, 1],
									duration: 200,
									easing: 'easeInOutQuad',
									delay: 50
								})
								.add({
									targets: backButtonImg,
									opacity: [0, 1],
									duration: 200,
									easing: 'easeInOutQuad',
									delay: 200,
									complete: function () {
										resolve();
									}
								}, '-=250');
						}

						self.hideHeader();

						self.ViewStack.push(navigateTo);
					});

					if (this.searchBarExpanded) {
						this.clickedCloseSearch().then(() => {
							return forward;
						});
					} else {
						return forward;
					}
				},
				navigateBackward: function () {
					var self = this;
					return new Promise((resolve, reject) => {
						if (!self.isRecipeViewInEditMode()) {
							return;
						}

						if (self.ViewStack.length < 2) {
							return;
						}

						var currentView = self.ViewStack.pop();
						var previousView = self.ViewStack[self.ViewStack.length - 1];
						var timeline = anime.timeline({});
						timeline
							.add({
								targets: currentView,
								translateX: ['0%', '50%'],
								opacity: [1, 0],
								duration: utils.ViewStackExitAnimationDuration,
								easing: 'easeInOutQuad',
								complete: function (anim) {
									currentView.classList.add('d-none');
								}
							})
							.add({
								targets: previousView,
								translateX: ['-50%', '0%'],
								opacity: [0, 1],
								duration: utils.ViewStackEnterAnimationDuration,
								easing: 'easeInOutQuad',
								begin: function (anim) {
									previousView.classList.remove('d-none');
									previousView.classList.add('d-block');
								},
								complete: function () {
									resolve();
								}
							}, '+=' + utils.ViewStackAnimationDelayDuration);

						//Remove entrance animation for RecipeView
						self.$refs.recipeDetails.classList.remove('show-finished-viewstack');
					});
				},
				editRecipeTitleOnFinishedAnimation: function () {
					//If the app isn't editing
					if (this.detailsDisplayState === 'loading' || this.detailsDisplayState === 'view') return;

					this.$refs.recipeViewTitleInput.focus();
				},
				editRecipeDescriptionAfterAnimation: function (el) {
					if (this.quillRecipeViewInstance === null) {
						this.initRecipeViewQuill();
						this.quillRecipeViewInstance.clipboard.dangerouslyPasteHTML(this.selectedRecipe.description);
						this.quillRecipeViewContent = this.selectedRecipe.description;
					} else {
						this.quillRecipeViewInstance = null;
					}
				},
				/**** Methods ****/
				updateSearchQuery: function (query) {
					var queryResults = this.flexSearch.search(query.toLowerCase());
					if (queryResults.length === 0) {
						return;
					}
					var o = [];
					var p = [];
					queryResults.forEach(queryResult => {
						if (queryResult.field === 'title') {
							queryResult.result.forEach(result => {
								o.push(result);
							});
						}
						if (queryResult.field === 'sections[]:title') {
							queryResult.result.forEach(result => {
								p.push(result);
							});
						}
					});
					this.searchResults_title = [];
					this.searchResults_sectionTitle = [];
					o.forEach(id => {
						this.searchResults_title.push(this.cookbook[id]);
					});
					p.forEach(id => {
						this.searchResults_sectionTitle.push(this.cookbook[id]);
					});
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
					let x = (hours * 60) + minutes;
					this.finishByTimeInputInMinutes = x.toString();
					return t;
				},
				//Used for when user is typing a query in the Filter By Tag search box 
				updateFilteredTags: function (query) {
					this.filteredTagList = [];
					var self = this;
					this.tagList.forEach(tag => {
						if (tag.toLowerCase().includes(query.toLowerCase())) {
							self.filteredTagList.push(tag);
						}
					});
				},
				//Used for when user is typing a query in the Filter By Ingredient search box 
				updateFilteredIngredients: function (query) {
					this.filteredIngredientList = [];
					var self = this;
					this.ingredientList.forEach(ingredient => {
						if (ingredient.toLowerCase().includes(query.toLowerCase())) {
							self.filteredIngredientList.push(ingredient);
						}
					});
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
						let result = utils.queryNumericIndex(this.numericIndex.totalTime, parseInt(this.finishByTimeInputInMinutes));
						if (result.length >= 1) {
							filterIDs = _.union(filterIDs, result);
						}
					}
					if (this.totalRecipeTimeInput !== '') {
						filtersApplied = true;
						let result = utils.queryNumericIndex(this.numericIndex.totalTime, parseInt(this.totalRecipeTimeInput));
						if (result.length >= 1) {
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
								index: 'sections[]:ingredients[]:value'
							});
							if (queryResults.length === 0) {
								return;
							}
							queryResults.forEach(queryResult => {
								if (queryResult.field === 'sections[]:ingredients[]:value') {
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
						this.showCreateFilterPresetButton = false;
						this.filteredCookbook = [];
						return;
					}

					this.showCreateFilterPresetButton = true;
					this.filteredCookbook = [];
					filterIDs.forEach(id => {
						this.filteredCookbook.push(this.cookbook[id]);
					});
				},
				selectRecipe: function (recipe) {
					var r = JSON.parse(JSON.stringify(recipe)); //Create a deep copy so we can make edits

					//Perform data prep
					r.specialEquipment = [];
					recipe.specialEquipment.forEach(equipment => {
						r.specialEquipment.push({
							value: equipment,
							isDeleted: false
						});
					});
					r.notes = [];
					recipe.notes.forEach(note => {
						r.notes.push({
							value: note,
							isDeleted: false
						});
					});
					for (var i = 0; i < recipe.sections.length; i++) {
						r.sections[i].ingredients = [];
						r.sections[i].steps = [];
						recipe.sections[i].ingredients.forEach(ingredient => {
							r.sections[i].ingredients.push({
								amount: ingredient.amount,
								value: ingredient.value,
								isDeleted: false
							});
						});
						recipe.sections[i].steps.forEach(step => {
							r.sections[i].steps.push({
								value: step.value,
								coverPhotoURL: step.coverPhotoURL,
								isDeleted: false
							});
						});
					}

					this.selectedRecipe = r;

					var self = this;
					var timeout = utils.ViewStackEnterAnimationDuration + utils.ViewStackExitAnimationDuration + utils.ViewStackAnimationDelayDuration;
					setTimeout(function () {
						self.$refs.recipeDetails.classList.add('show-finished-viewstack');
					}, timeout);
				},

				/**** FilterView Methods ****/
				saveFilterPreset: function () {
					this.filterPresetNameIsInvalid = false;
					if (this.filterPresetNameModel.length < 1) {
						this.filterPresetNameFeedback = 'Your preset name is too short';
						this.filterPresetNameIsInvalid = true;
					}
					if (this.filterPresetNameModel.length > 12) {
						this.filterPresetNameFeedback = 'Your preset name is too long';
						this.filterPresetNameIsInvalid = true;
					}
					if (this.filterPresetNameIsInvalid) return;

					this.filterPresetsList.push({
						name: this.filterPresetNameModel,
						tags: this.checkedTagsArray,
						totalRecipeTime: this.totalRecipeTimeInput,
						finishByTime: this.finishByTimeInput,
						ingredients: this.checkedIngredientsArray
					});
					this.navigateBackward();
					//Add to Firebase
					this.db.collection('users').doc(utils._UID).update({
						filterPresets: this.filterPresetsList
					}).catch((error) => {
						console.error(error);
					});
				},
				deleteFilterPreset: function (index) {
					this.filterPresetsList.splice(index, 1);
					//Update Firebase
					this.db.collection('users').doc(utils._UID).update({
						filterPresets: this.filterPresetsList
					}).catch((error) => {
						console.error(error);
					});
				},

				/**** RecipeView Methods ****/
				editRecipeDetailsRecipeView: function () {
					if (this.detailsDisplayState === utils.DISPLAY_STATES.VIEW) {
						this.detailsDisplayState = utils.DISPLAY_STATES.EDIT;
						return;
					}

					//Verify details before allowing submit to Firebase
					//Verify title
					if (!utils.isString(this.selectedRecipe.title)) {
						this.$refs.recipeViewTitleInput.focus();
						return false;
					}
					//Verify description
					if (!utils.isBigString(this.quillRecipeViewContent)) {
						this.quillRecipeViewInstance.focus();
						return false;
					}
					//Verify recipe time metadata
					if (!utils.isNumber(this.selectedRecipe.activeTime)) {
						this.$refs.recipeViewActiveTime.focus();
						return false;
					}
					if (!utils.isNumber(this.selectedRecipe.prepTime)) {
						this.$refs.recipeViewPrepTime.focus();
						return false;
					}
					if (!utils.isNumber(this.selectedRecipe.cookTime)) {
						this.$refs.recipeViewCookTime.focus();
						return false;
					}
					if (!utils.isNumber(this.selectedRecipe.totalTime)) {
						this.$refs.recipeViewTotalTime.focus();
						return false;
					}
					//Verify yield
					if (!utils.isNumber(this.selectedRecipe.yield)) {
						this.$refs.recipeViewYield.focus();
						return false;
					}

					this.detailsDisplayState = utils.DISPLAY_STATES.LOADING;

					//Clean data
					var serializedRecipe = JSON.parse(JSON.stringify(this.selectedRecipe)); //Create deep copy to prevent unwanted changes

					//Overwrite data in cookbook
					this.cookbook[serializedRecipe.id] = serializedRecipe;

					//TODO: add filtered cookbook update

					//Re-index recipe in the indices
					//FIXME: this does not seem to correctly update the recipe title
					this.flexSearch.update({
						data: serializedRecipe
					});

					this.updateFirestoreRecipe(serializedRecipe.docID, {
						title: serializedRecipe.title,
						description: serializedRecipe.description,
						activeTime: serializedRecipe.activeTime,
						prepTime: serializedRecipe.prepTime,
						cookTime: serializedRecipe.cookTime,
						totalTime: serializedRecipe.totalTime,
						yield: serializedRecipe.yield
					});

					this.detailsDisplayState = utils.DISPLAY_STATES.VIEW;
				},
				createRecipeTagRecipeView: function () {
					this.tagDisplayState = utils.DISPLAY_STATES.EDIT;
					//this.$refs.tagInputRecipeView.focus();
				},
				addTagRecipeView: function () {
					if (!utils.isString(this.tagAddModel)) {
						return;
					}

					this.selectedRecipe.tags.push(this.tagAddModel);

					//Clean data
					var serializedRecipe = JSON.parse(JSON.stringify(this.selectedRecipe)); //Create deep copy to prevent unwanted changes

					//Overwrite data in cookbook
					this.cookbook[serializedRecipe.id] = serializedRecipe;

					//TODO: add filtered cookbook update

					//Re-index recipe in the indices
					//FIXME: this does not seem to correctly update the recipe title
					this.flexSearch.update({
						data: serializedRecipe
					});

					this.updateFirestoreRecipe(serializedRecipe.docID, {
						tags: serializedRecipe.tags,
					});

					this.tagDisplayState = utils.DISPLAY_STATES.VIEW;
					this.tagAddModel = '';
				},
				deleteRecipeTagRecipeView: function (index) {
					this.selectedRecipe.tags.splice(index, 1);

					//Clean data
					var serializedRecipe = JSON.parse(JSON.stringify(this.selectedRecipe)); //Create deep copy to prevent unwanted changes

					//Overwrite data in cookbook
					this.cookbook[serializedRecipe.id] = serializedRecipe;

					//TODO: add filtered cookbook update

					//Re-index recipe in the indices
					//FIXME: this does not seem to correctly update the recipe title
					this.flexSearch.update({
						data: serializedRecipe
					});

					this.updateFirestoreRecipe(serializedRecipe.docID, {
						tags: serializedRecipe.tags,
					});
				},
				editSpecialEquipmentRecipeView: function () {
					if (this.specialEquipmentDisplayState === utils.DISPLAY_STATES.VIEW) {
						this.specialEquipmentDisplayState = utils.DISPLAY_STATES.EDIT;
						return;
					}

					this.specialEquipmentDisplayState = utils.DISPLAY_STATES.LOADING;

					//Remove any deleted items
					var t = [];
					this.selectedRecipe.specialEquipment.forEach(element => {
						if (!element.isDeleted) {
							t.push(element);
						}
					});
					this.selectedRecipe.specialEquipment = t;

					//Clean data
					var serializedRecipe = JSON.parse(JSON.stringify(this.selectedRecipe)); //Create deep copy to prevent unwanted changes
					serializedRecipe.specialEquipment = _.pluck(serializedRecipe.specialEquipment, 'value');

					//Overwrite data in cookbook
					this.cookbook[serializedRecipe.id] = serializedRecipe;

					//Re-index recipe in the indices
					this.flexSearch.update({
						data: serializedRecipe
					});

					this.updateFirestoreRecipe(serializedRecipe.docID, {
						specialEquipment: serializedRecipe.specialEquipment,
					});

					this.specialEquipmentDisplayState = utils.DISPLAY_STATES.VIEW;
				},
				deleteSpecialEquipmentRecipeView: function (index) {
					this.selectedRecipe.specialEquipment[index].isDeleted = true;
				},
				undoDeleteSpecialEquipmentRecipeView: function (index) {
					this.selectedRecipe.specialEquipment[index].isDeleted = false;
				},
				addSpecialEquipmentRecipeView: function () {
					if (!utils.isString(this.specialEquipmentAddModel)) {
						return false;
					}

					this.selectedRecipe.specialEquipment.push({
						value: this.specialEquipmentAddModel,
						isDeleted: false
					});
					this.specialEquipmentAddModel = '';
				},
				editRecipeNotesRecipeView: function () {
					if (this.notesDisplayState === utils.DISPLAY_STATES.VIEW) {
						this.notesDisplayState = utils.DISPLAY_STATES.EDIT;
						return;
					}

					this.notesDisplayState = utils.DISPLAY_STATES.LOADING;

					//Remove any deleted items
					var t = [];
					this.selectedRecipe.notes.forEach(element => {
						if (!element.isDeleted) {
							t.push(element);
						}
					});
					this.selectedRecipe.notes = t;

					//Clean data
					var serializedRecipe = JSON.parse(JSON.stringify(this.selectedRecipe)); //Create deep copy to prevent unwanted changes
					serializedRecipe.notes = _.pluck(serializedRecipe.notes, 'value');

					//Overwrite data in cookbook
					this.cookbook[serializedRecipe.id] = serializedRecipe;

					//Re-index recipe in the indices
					this.flexSearch.update({
						data: serializedRecipe
					});

					this.updateFirestoreRecipe(serializedRecipe.docID, {
						notes: serializedRecipe.notes,
					});

					this.notesDisplayState = utils.DISPLAY_STATES.VIEW;
				},
				deleteRecipeNotesRecipeView: function (index) {
					this.selectedRecipe.notes[index].isDeleted = true;
				},
				undoDeleteRecipeNotesRecipeView: function (index) {
					this.selectedRecipe.notes[index].isDeleted = false;
				},
				addRecipeNotesRecipeView: function () {
					if (!utils.isString(this.notesAddModel)) {
						return false;
					}

					this.selectedRecipe.notes.push({
						value: this.notesAddModel,
						isDeleted: false
					});
					this.notesAddModel = '';
				},
				editRecipeIngredientsRecipeView: function () {
					if (this.ingredientsDisplayState === utils.DISPLAY_STATES.VIEW) {
						this.ingredientsDisplayState = utils.DISPLAY_STATES.EDIT;
						return;
					}

					this.ingredientsDisplayState = utils.DISPLAY_STATES.LOADING;

					//Remove any deleted items, update interface
					var sections = [];
					for (let i = 0; i < this.selectedRecipe.sections.length; i++) {
						var section = utils.deepClone(this.selectedRecipe.sections[i]);
						section.ingredients = [];
						for (let j = 0; j < this.selectedRecipe.sections[i].ingredients.length; j++) {
							if (!this.selectedRecipe.sections[i].ingredients[j].isDeleted) {
								section.ingredients.push(this.selectedRecipe.sections[i].ingredients[j]);
							}
						}
						sections.push(section);
					}
					this.selectedRecipe.sections = sections;

					//Clean data, serialize
					var serializedRecipe = JSON.parse(JSON.stringify(this.selectedRecipe));
					serializedRecipe.sections = utils.deepClone(this.selectedRecipe.sections); //Create deep copy to prevent unwanted changes

					for (let i = 0; i < this.selectedRecipe.sections.length; i++) {
						serializedRecipe.sections[i].ingredients = [];
						for (let j = 0; j < this.selectedRecipe.sections[i].ingredients.length; j++) {
							if (!this.selectedRecipe.sections[i].ingredients[j].isDeleted) {
								serializedRecipe.sections[i].ingredients.push({
									amount: this.selectedRecipe.sections[i].ingredients[j].amount,
									value: this.selectedRecipe.sections[i].ingredients[j].value
								});
							}
						}
					}

					//Overwrite data in cookbook
					this.cookbook[serializedRecipe.id] = serializedRecipe;

					//Re-index recipe in the indices
					this.flexSearch.update({
						data: serializedRecipe
					});

					this.updateFirestoreRecipe(serializedRecipe.docID, {
						sections: serializedRecipe.sections,
					});

					this.ingredientsDisplayState = utils.DISPLAY_STATES.VIEW;
				},
				deleteRecipeIngredientsRecipeView: function (sectionIndex, ingredientIndex) {
					this.selectedRecipe.sections[sectionIndex].ingredients[ingredientIndex].isDeleted = true;
				},
				undoDeleteRecipeIngredientsRecipeView: function (sectionIndex, ingredientIndex) {
					this.selectedRecipe.sections[sectionIndex].ingredients[ingredientIndex].isDeleted = false;
				},
				addRecipeIngredientsRecipeView: function (sectionIndex) {
					if (!utils.isString(this.$refs.recipeViewIngredientsInputs[sectionIndex].value)) {
						return false;
					}

					var ingredientObject = nlp.parseIngredient(this.$refs.recipeViewIngredientsInputs[sectionIndex].value);
					this.selectedRecipe.sections[sectionIndex].ingredients.push({
						amount: ingredientObject.amount,
						isDeleted: false,
						value: ingredientObject.ingredient
					});
					this.$refs.recipeViewIngredientsInputs[sectionIndex].value = '';
				},
				editRecipeStepsRecipeView: function () {
					if (this.stepsDisplayState === utils.DISPLAY_STATES.VIEW) {
						this.stepsDisplayState = utils.DISPLAY_STATES.EDIT;
						return;
					}

					this.stepsDisplayState = utils.DISPLAY_STATES.LOADING;

					//Remove any deleted items, update interface
					var sections = [];
					for (let i = 0; i < this.selectedRecipe.sections.length; i++) {
						var section = utils.deepClone(this.selectedRecipe.sections[i]);
						section.steps = [];
						for (let j = 0; j < this.selectedRecipe.sections[i].steps.length; j++) {
							if (!this.selectedRecipe.sections[i].steps[j].isDeleted) {
								section.steps.push(this.selectedRecipe.sections[i].steps[j]);
							}
						}
						sections.push(section);
					}
					this.selectedRecipe.sections = sections;

					//Clean data, serialize
					var serializedRecipe = JSON.parse(JSON.stringify(this.selectedRecipe));
					serializedRecipe.sections = utils.deepClone(this.selectedRecipe.sections); //Create deep copy to prevent unwanted changes
					for (let i = 0; i < this.selectedRecipe.sections.length; i++) {
						serializedRecipe.sections[i].steps = [];
						this.selectedRecipe.sections[i].steps.forEach(step => {
							serializedRecipe.sections[i].steps.push(step.value);
						});
					}

					//Overwrite data in cookbook
					this.cookbook[serializedRecipe.id] = serializedRecipe;

					//Re-index recipe in the indices
					this.flexSearch.update({
						data: serializedRecipe
					});

					this.updateFirestoreRecipe(serializedRecipe.docID, {
						sections: serializedRecipe.sections,
					});

					this.stepsDisplayState = utils.DISPLAY_STATES.VIEW;
				},
				deleteRecipeStepsRecipeView: function (sectionIndex, stepIndex) {
					this.selectedRecipe.sections[sectionIndex].steps[stepIndex].isDeleted = true;
				},
				undoDeleteRecipeStepsRecipeView: function (sectionIndex, stepIndex) {
					this.selectedRecipe.sections[sectionIndex].steps[stepIndex].isDeleted = false;
				},
				addRecipeStepsRecipeView: function (sectionIndex) {
					//Verify step
					if (!utils.isString(this.stepsAddModel)) {
						return false;
					}

					this.selectedRecipe.sections[sectionIndex].steps.push({
						coverPhotoURL: 'https://via.placeholder.com/1024x1024.png',
						isDeleted: false,
						value: this.stepsAddModel
					});
					this.stepsAddModel = '';
				},
				deleteRecipe: function () {
					var id = this.selectedRecipe.id;

					//Update flex index
					this.flexSearch.remove(id);
					//Set this recipe to a blank object to effectively remove it from the cookbook
					//The reason we don't splice is because the FlexSearch index is dependent on this recipe's position
					this.cookbook[id] = {};

					//TODO: Delete all shared recipes
					/*
					this.updateFirestoreRecipe(this.selectedRecipe.docID, {
						sections: serializedRecipe.sections,
					});
					*/
					//Delete shared recipes
					this.db.collection('users/' + utils._UID + '/recipes')
						.where('recipeID', '==', this.selectedRecipe.docID)
						.get()
						.then((querySnapshot) => {
							querySnapshot.forEach((doc) => {
								console.log(doc.data().sharedID);
							});
						});

					this.navigateBackward();
				},
				shareRecipe: function () {
					this.isSharing = true;

					var self = this;

					//Create HTML document of recipe to upload to Firebase
					var doc = document.implementation.createHTMLDocument();

					//Head
					var meta1 = document.createElement('meta');
					meta1.httpEquiv = "X-UA-Compatible";
					meta1.content = "IE=edge";
					doc.head.append(meta1);

					var meta2 = document.createElement('meta');
					meta2.name = 'viewport';
					meta2.content = 'width=device-width, initial-scale=1.0';
					doc.head.append(meta2);

					var title = document.createElement('title');
					title.innerHTML = this.selectedRecipe.title + ' | Pantry';
					doc.head.append(title);

					doc.head.append(this.makeHeaderLink('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600&display=swap'));
					doc.head.append(this.makeHeaderLink('https://cdn.jsdelivr.net/npm/bootstrap@5.1.0/dist/css/bootstrap.min.css'));
					doc.head.append(this.makeHeaderLink('https://pantryrecipes.app/css/app.css'));

					//Body
					var b = this.$refs.recipeView.cloneNode(true);
					doc.body.append(b);

					//Remove the app features from shared recipe
					doc.querySelectorAll('.remove-from-sharing').forEach(e => e.remove());

					doc.body.append(this.makeScriptLink('https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js'));
					doc.body.append(this.makeScriptLink('https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.1/anime.min.js'));

					var str = new XMLSerializer().serializeToString(doc);

					var metadata = {
						contentType: 'text/html',
					};

					var sharedID = uuidv4();

					this.db.collection('users/' + utils._UID + '/shared/').doc().set({
						recipeID: this.selectedRecipe.docID,
						sharedID: sharedID
					}).then(() => {
						this.storage.child('users/' + utils._UID + '/recipes/' + this.selectedRecipe.docID + '/' + sharedID + '.html').putString(str).then((snapshot) => {
							snapshot.ref.getDownloadURL().then((downloadURL) => {
								snapshot.ref.updateMetadata(metadata).then((m) => {
									utils.copyTextToClipboard(downloadURL);
									self.toastHeader = 'Link shared';
									self.toastBody = 'Link was copied to your clipboard!';
									self.toastInstance.show();
									self.isSharing = false;
								});
							});
						});
					}).catch((error) => {
						console.error(error);
					});
				},
				isRecipeViewInEditMode: function () {
					//Check if anything in RecipeView is still in edit mode or loading
					if (this.detailsDisplayState !== utils.DISPLAY_STATES.VIEW) {
						this.$refs.recipeViewTitleInput.focus();
						return false;
					}
					if (this.specialEquipmentDisplayState !== utils.DISPLAY_STATES.VIEW) {
						this.$refs.recipeViewSpecialEquipmentInput.focus();
						return false;
					}
					if (this.notesDisplayState !== utils.DISPLAY_STATES.VIEW) {
						this.$refs.recipeViewNotesInput.focus();
						return false;
					}
					if (this.ingredientsDisplayState !== utils.DISPLAY_STATES.VIEW) {
						this.$refs.recipeViewIngredientsInputs[0].focus();
						return false;
					}
					if (this.stepsDisplayState !== utils.DISPLAY_STATES.VIEW) {
						this.$refs.recipeViewStepInputs[0].focus();
						return false;
					}
					return true;
				},

				/**** AddRecipeView Methods ****/
				autofillActiveTime: function () {
					this.manage_recipeActiveTime = (utils.isNumber(this.manage_recipePrepTime) && utils.isNumber(this.manage_recipeCookTime)) ? (parseInt(this.manage_recipePrepTime) + parseInt(this.manage_recipeCookTime)).toString() : 0;
				},
				addTagAddRecipeView: function () {
					if (utils.isString(this.manage_recipeTagInput)) {
						this.manage_recipeTagHolder.push({
							value: this.manage_recipeTagInput.trim(),
							isDeleted: false
						});
						this.manage_recipeTagInput = '';
					}
				},
				deleteTagAddRecipeView: function (index) {
					this.manage_recipeTagHolder[index].isDeleted = true;
				},
				undoTagAddRecipeView: function (index) {
					this.manage_recipeTagHolder[index].isDeleted = false;
				},
				addSpecialEquipmentAddRecipeView: function () {
					if (utils.isString(this.manage_specialEquipmentInput)) {
						this.manage_specialEquipmentHolder.push({
							value: this.manage_specialEquipmentInput.trim(),
							isDeleted: false
						});
						this.manage_specialEquipmentInput = '';
					}
				},
				deleteSpecialEquipmentAddRecipeView: function (index) {
					this.manage_specialEquipmentHolder[index].isDeleted = true;
				},
				undoDeleteSpecialEquipmentAddRecipeView: function (index) {
					this.manage_specialEquipmentHolder[index].isDeleted = false;
				},
				addNotesAddRecipeView: function () {
					if (utils.isString(this.manage_recipeNotesInput)) {
						this.manage_recipeNotesHolder.push({
							value: this.manage_recipeNotesInput.trim(),
							isDeleted: false
						});
						this.manage_recipeNotesInput = '';
					}
				},
				deleteNotesAddRecipeView: function (index) {
					this.manage_recipeNotesHolder[index].isDeleted = true;
				},
				undoDeleteNotesAddRecipeView: function (index) {
					this.manage_recipeNotesHolder[index].isDeleted = false;
				},
				addRecipeSectionAddRecipeView: function () {
					this.manage_recipeSections.push({
						"title": "",
						"ingredients": [],
						"steps": [],
						"calories": 0,
						"fat": 0,
						"cholesterol": 0,
						"sodium": 0,
						"totalCarbs": 0,
						"fiber": 0,
						"sugar": 0,
						"protein": 0
					});
				},
				addIngredientsAddRecipeView: function (sectionIndex) {
					if (sectionIndex === -1) {
						let ingredient = nlp.parseIngredient(this.$refs.ingredientInputAddRecipeView.value);
						let x = {
							amount: ingredient.amount,
							value: ingredient.ingredient,
							isDeleted: false
						};
						this.manage_recipeSections[0].ingredients.push(x);
						this.addIngredientModel[0] = '';
					} else {
						let ingredient = nlp.parseIngredient(this.$refs.ingredientInputAddRecipeView[sectionIndex].value);
						let x = {
							amount: ingredient.amount,
							value: ingredient.ingredient,
							isDeleted: false
						};
						this.manage_recipeSections[sectionIndex].ingredients.push(x);
						this.addIngredientModel[sectionIndex] = '';
					}

				},
				deleteIngredientsAddRecipeView: function (sectionIndex, index) {
					this.manage_recipeSections[sectionIndex].ingredients[index].isDeleted = true;
				},
				undoDeleteIngredientsAddRecipeView: function (sectionIndex, index) {
					this.manage_recipeSections[sectionIndex].ingredients[index].isDeleted = false;
				},
				addStepsAddRecipeView: function (sectionIndex) {
					if (sectionIndex === -1) {
						if ((this.$refs.manageStepRef.value.trim() === '' || this.$refs.manageStepRef.value.trim() === null) && this.$refs.manageStepRef.value.length === 0) {
							this.$refs.manageStepRef.classList.add('is-invalid');
							return;
						}
						let x = {
							value: this.$refs.manageStepRef.value.trim(),
							coverPhotoURL: '',
							isDeleted: false
						};
						this.manage_recipeSections[0].steps.push(x);
						this.addStepModel[0] = '';
					} else {
						if ((this.$refs.manageStepRef[sectionIndex].value.trim() === '' || this.$refs.manageStepRef[sectionIndex].value.trim() === null) && this.$refs.manageStepRef[sectionIndex].value.length === 0) {
							this.$refs.manageStepRef.classList.add('is-invalid');
							return;
						}
						let x = {
							value: this.$refs.manageStepRef[sectionIndex].value.trim(),
							coverPhotoURL: '',
							isDeleted: false
						};
						this.manage_recipeSections[sectionIndex].steps.push(x);
						this.addStepModel[sectionIndex] = '';
					}


				},
				deleteStepsAddRecipeView: function (sectionIndex, index) {
					this.manage_recipeSections[sectionIndex].steps[index].isDeleted = true;
				},
				undoDeleteStepsAddRecipeView: function (sectionIndex, index) {
					this.manage_recipeSections[sectionIndex].steps[index].isDeleted = false;
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
							this.manage_smartButtonText = 'Submit Recipe';
							this.manage_activePane = this.manage_smartButtonProgress.steps;
							this.showStickySubmit = true;
						}
					}
				},
				submitManagedRecipe: function () {
					var self = this;
					if (!this.showStickySubmit) {
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
					if (utils.isBigString(this.quillAddRecipeViewContent)) {
						serializedRecipe.description = this.quillAddRecipeViewContent;
					} else {
						this.$refs.addRecipeViewEditor.classList.add('is-invalid');
						anyInvalid = true;
					}

					//Serialize tag array
					if (this.manage_recipeTagHolder.length > 0) {
						serializedRecipe.tags = _.uniq(_.pluck(this.manage_recipeTagHolder, 'value'), false);
					}

					//Check special equipment
					if (this.manage_specialEquipmentHolder.length > 0) {
						serializedRecipe.specialEquipment = _.uniq(_.pluck(this.manage_specialEquipmentHolder, 'value'), false);
					}

					//Check notes
					if (this.manage_recipeNotesHolder.length > 0) {
						serializedRecipe.notes = _.uniq(_.pluck(this.manage_recipeNotesHolder, 'value'), false);
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

					if (utils.isString(this.manage_recipeYield.toString())) {
						serializedRecipe.yield = this.manage_recipeYield.toString().trim();
					} else {
						this.$refs.recipeYieldRef.classList.add('is-invalid');
						anyInvalid = true;
					}

					//Serialize recipe sections
					if (this.manage_recipeSections.steps.length > 0) {
						serializedRecipe.sections = [];
						for (var i = 0; i < this.manage_recipeSections.length; i++) {
							let o = {};

							if (typeof this.manage_recipeSections.title === 'undefined') {
								o.title = 'Recipe';
							} else {
								o.title = this.manage_recipeSections.title;
							}

							o.calories = 0;
							o.fat = 0;
							o.cholesterol = 0;
							o.sodium = 0;
							o.totalCarbs = 0;
							o.fiber = 0;
							o.sugar = 0;
							o.protein = 0;

							o.ingredients = _.map(this.manage_recipeSections[i].ingredients, function (row) {
								return _.omit(row, ['isDeleted']);
							});

							o.steps = _.map(this.manage_recipeSections[i].steps, function (row) {
								return _.omit(row, ['isDeleted']);
							});

							serializedRecipe.sections.push(o);
						}
					} else {
						this.$refs.manageStepRef.classList.add('is-invalid');
						anyInvalid = true;
					}

					if (anyInvalid) return;

					this.isRecipeSubmitDisabled = true;

					serializedRecipe.docID = uuidv4().toString();
					let now = Date.now();
					serializedRecipe.dateAdded = now;
					serializedRecipe.dateModified = now;
					serializedRecipe.favorite = false;

					if (this.manage_coverPhotoURL === '') {
						serializedRecipe.coverPhotoURL = 'https://firebasestorage.googleapis.com/v0/b/project-pastro-c95b1.appspot.com/o/assets%2Fkaren-sewell-silverware-medium-unsplash.jpg?alt=media&token=ef21ab61-5730-47b8-8ed8-3b9b5b6fa757';
					} else {
						serializedRecipe.coverPhotoURL = this.manage_coverPhotoURL;
					}

					if (this.manage_coverPhotoThumbnail === '') {
						serializedRecipe.thumbnail = 'https://firebasestorage.googleapis.com/v0/b/project-pastro-c95b1.appspot.com/o/assets%2Fkaren-sewell-silverware-medium-unsplash_thumbnail.png?alt=media&token=a3e0019c-f553-4c85-97b7-f405ab31609c';
					} else {
						serializedRecipe.thumbnail = this.manage_coverPhotoThumbnail;
					}

					console.log(serializedRecipe);

					this.db.collection('users/' + utils._UID + '/recipes').doc(serializedRecipe.docID).set(serializedRecipe).then(function () {
						//Update flex index
						serializedRecipe.id = self.injectedFlexIndex;
						self.injectedFlexIndex = self.injectedFlexIndex + 1;

						//Push to cookbook array
						//Update tags & ingredients filters array

						self.isRecipeSubmitDisabled = false;

					}).catch(function (error) {
						console.error(error);
					});
				},

				/**** OptionsView Methods ****/
				updateSetting: function (update) {
					this.db.collection('users').doc(utils._UID).update(update)
						.catch((error) => {
							console.error(error);
						});
				},

				/**** Utilities ****/
				//used for displaying the ETA of the recipe
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
						let h = (nowHours + hours) % 24;
						let m = futureMinutes;

						if (this.is12HourFormatSet) {
							let z = (h >= 13) ? h - 12 : h;
							let rString = z.toString() + ':' + zeroPad(m).toString();
							if (h >= 13) {
								rString += ' pm';
							} else {
								rString += ' am';
							}
							return rString;
						} else {
							return zeroPad(h).toString() + ':' + zeroPad(m).toString();
						}
					} else {
						let h = nowHours % 24;
						let m = futureMinutes;

						if (this.is12HourFormatSet) {
							let z = (h >= 13) ? h - 12 : h;
							let rString = z.toString() + ':' + zeroPad(m).toString();
							if (h >= 13) {
								rString += ' pm';
							} else {
								rString += ' am';
							}
							return rString;
						} else {
							return zeroPad(h).toString() + ':' + zeroPad(m).toString();
						}
					}
				},
				calcButtonDimensions: function (rem, vw) {
					return utils.remToPixels(rem) + utils.vwToPixels(vw);
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
				makeHeaderLink: function (link) {
					var header = document.createElement('link');
					header.rel = 'stylesheet';
					header.href = link;
					return header;
				},
				makeScriptLink: function (link) {
					var script = document.createElement('script');
					script.src = link;
					return script;
				},

				/**** 3rd Party Methods & APIs ****/
				//When user clicks the button to open their personal billing portal
				stripeBillingPortal: function (event) {
					event.target.disabled = true;
					event.target.textContent = 'Preparing your billing portal...';
					goToPortal();
				},
				//RecipeView
				initRecipeViewQuill: function () {
					this.quillRecipeViewInstance = new Quill('#recipeViewEditor', {
						modules: {
							toolbar: this.toolbarOptions
						},
						theme: 'snow'
					});
					this.quillRecipeViewInstance.on('text-change', this.onRecipeViewQuillContentChange);
					//Apply GKeyboard fix
					this.quillRecipeViewInstance.on('editor-change', this.applyGoogleKeyboardFixToRecipeView);
					this.setRecipeViewQuillContent();
				},
				onRecipeViewQuillContentChange: function () {
					this.setRecipeViewQuillContent();
					this.$emit('input', this.quillRecipeViewContent);
				},
				setRecipeViewQuillContent: function () {
					this.quillRecipeViewContent = this.quillRecipeViewInstance.getText().trim() ? this.quillRecipeViewInstance.root.innerHTML : '';
				},
				applyGoogleKeyboardFixToRecipeView: function (eventName, ...args) {
					if (eventName === 'text-change') {
						/* jshint ignore:start */
						var ops = args[0]['ops'];
						var oldSelection = this.quillRecipeViewInstance.getSelection();
						//Fix for #3
						if (oldSelection === null || typeof oldSelection === 'undefined') {
							return;
						}
						var oldPosition = oldSelection.index;
						var oldSelectionLength = oldSelection.length;

						if (ops[0]["retain"] === undefined || !ops[1] || !ops[1]["insert"] || !ops[1]["insert"] || ops[1]["insert"] != "\n" || oldSelectionLength > 0) {
							return;
						}

						var self = this;
						setTimeout(function () {
							var newPosition = self.quillRecipeViewInstance.getSelection().index;
							if (newPosition === oldPosition) {
								self.quillRecipeViewInstance.setSelection(self.quillRecipeViewInstance.getSelection().index + 1, 0);
							}
						}, 15);
						/* jshint ignore:end */
					}
				},
				//AddRecipeView
				initAddRecipeViewQuill: function () {
					var self = this;
					this.quillAddRecipeViewInstance = new Quill('#addRecipeViewEditor', {
						modules: {
							toolbar: this.toolbarOptions
						},
						theme: 'snow'
					});
					this.quillAddRecipeViewInstance.on('text-change', this.onAddRecipeViewQuillContentChange);
					//Apply GKeyboard fix
					this.quillAddRecipeViewInstance.on('editor-change', this.applyGoogleKeyboardFixToAddRecipeView);
					this.setAddRecipeViewQuillContent();
					var ocrDescriptionButton = new QuillToolbarButton({
						icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="999999" class="bi bi-camera-fill" viewBox="0 0 16 16"><path d="M10.5 8.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"/><path d="M2 4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-1.172a2 2 0 0 1-1.414-.586l-.828-.828A2 2 0 0 0 9.172 2H6.828a2 2 0 0 0-1.414.586l-.828.828A2 2 0 0 1 3.172 4H2zm.5 2a.5.5 0 1 1 0-1 .5.5 0 0 1 0 1zm9 2.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0z"/></svg>`
					});
					ocrDescriptionButton.onClick = function (quill) {
						new bootstrap.Collapse(self.$refs.ocrDescriptionCollapse);
						self.$refs.ocrDescriptionCollapse.addEventListener('shown.bs.collapse', self.createDescriptionOCR_DOM());
					};
					ocrDescriptionButton.attach(this.quillAddRecipeViewInstance);
				},
				onAddRecipeViewQuillContentChange: function () {
					this.setAddRecipeViewQuillContent();
					this.$emit('input', this.quillAddRecipeViewContent);
				},
				setAddRecipeViewQuillContent: function () {
					this.quillAddRecipeViewContent = this.quillAddRecipeViewInstance.getText().trim() ? this.quillAddRecipeViewInstance.root.innerHTML : '';
				},
				applyGoogleKeyboardFixToAddRecipeView: function (eventName, ...args) {
					if (eventName === 'text-change') {
						/* jshint ignore:start */
						var ops = args[0]['ops'];
						var oldSelection = this.quillAddRecipeViewInstance.getSelection();
						//Fix for #3
						if (oldSelection === null || typeof oldSelection === 'undefined') {
							return;
						}
						var oldPosition = oldSelection.index;
						var oldSelectionLength = oldSelection.length;

						if (ops[0]["retain"] === undefined || !ops[1] || !ops[1]["insert"] || !ops[1]["insert"] || ops[1]["insert"] != "\n" || oldSelectionLength > 0) {
							return;
						}

						var self = this;
						setTimeout(function () {
							var newPosition = self.quillAddRecipeViewInstance.getSelection().index;
							if (newPosition === oldPosition) {
								self.quillAddRecipeViewInstance.setSelection(self.quillAddRecipeViewInstance.getSelection().index + 1, 0);
							}
						}, 15);
						/* jshint ignore:end */
					}
				},
				updateFirestoreRecipe: function(docID, change) {
					this.db.collection('users/' + utils._UID + '/recipes').doc(docID).update(change)
						.catch(function (error) {
							console.error(error);
						});
				},
				//Manage recipe methods
				//TODO: when the user clicks on the X button for FilePond, destroy CropperJS instance (if it exists)
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
							var u = uuidv4().toString();
							outputFiles.forEach(output => {
								var fileName = u;
								var isThumbnail = false;

								const img = new Image();
								img.onload = function () {
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

									uploadCoverPhoto({
										file: output.file,
										name: fileName,
										meta: metadata
									}).then(function (downloadURL) {
										console.log(downloadURL);
										if (isThumbnail) {
											self.manage_coverPhotoThumbnail = downloadURL;
										} else {
											self.manage_coverPhotoURL = downloadURL;
										}
									});

								};
								img.src = URL.createObjectURL(output.file);

							});
						}
					});
				},
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
								let meta = {
									contentType: file.type,
								};

								var uploadTask = firebase.storage().ref().child('users/' + utils._UID + '/tempOCR/' + fileName).put(file, meta);

								uploadTask.on('state_changed', (snapshot) => {
									progress(snapshot.bytesTransferred / snapshot.totalBytes);
								}, (error) => {
									console.log('Error uploading file: ' + e);
									error('Error uploading file: ' + e);
								}, () => {
									//Give user some sort of indications that something is going on behind the scenes
									self.quillAddRecipeViewInstance.setText('Loading...');

									//Perform upload to Firebase storage
									axios.post('https://us-central1-project-pastro-c95b1.cloudfunctions.net/shadowspear', {
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

										self.quillAddRecipeViewInstance.setText(res.data.recognizedText);
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
				handleDescriptionOCRCrop: function () {
					this.ocr_DescriptionPondEditor.onconfirm(utils.getCropData(this.ocr_DescriptionCropperObject.getData(), this.ocr_DescriptionCropperObject.getCanvasData()));
					this.ocr_DescriptionEditMode = false;
					this.ocr_DescriptionCropperObject.destroy();
					this.ocr_DescriptionCropperObject = null;
					document.getElementById('ocrDescriptionCropWrapper').innerHTML = "";
				},
				createIngredientsOCR_DOM: function () {
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
								let meta = {
									contentType: file.type,
								};

								var uploadTask = firebase.storage().ref().child('users/' + utils._UID + '/tempOCR/' + fileName).put(file, meta);

								uploadTask.on('state_changed', (snapshot) => {
									progress(snapshot.bytesTransferred / snapshot.totalBytes);
								}, (error) => {
									console.log('Error uploading file: ' + e);
									error('Error uploading file: ' + e);
								}, () => {
									//Perform upload to Firebase storage
									axios.post('https://us-central1-project-pastro-c95b1.cloudfunctions.net/shadowspear', {
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

										res.data.recognizedText.forEach(ingredient => {
											var s = nlp.parseIngredient(ingredient);
											self.manage_recipeSections[0].ingredients.push({
												amount: s.amount,
												value: s.ingredient,
												isDeleted: false
											});
										});
										load('gs://project-pastro-c95b1.appspot.com/users/' + utils._UID + '/tempOCR/' + fileName);
									}).catch(err => {
										utils.reportError('Error', err.toString(), 'Functions error reported.');
										console.log(err.toString());
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
				handleIngredientsOCRCrop: function () {
					this.ocr_IngredientsPondEditor.onconfirm(utils.getCropData(this.ocr_IngredientsCropperObject.getData(), this.ocr_IngredientsCropperObject.getCanvasData()));
					this.ocr_IngredientsEditMode = false;
					this.ocr_IngredientsCropperObject.destroy();
					this.ocr_IngredientsCropperObject = null;
					document.getElementById('ocrIngredientsCropWrapper').innerHTML = "";
				},
				createStepsOCR_DOM: function () {
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
								var meta = {
									contentType: file.type,
								};

								var uploadTask = firebase.storage().ref().child('users/' + utils._UID + '/tempOCR/' + fileName).put(file, meta);

								uploadTask.on('state_changed', (snapshot) => {
									progress(snapshot.bytesTransferred / snapshot.totalBytes);
								}, (error) => {
									console.log('Error uploading file: ' + e);
									error('Error uploading file: ' + e);
								}, () => {
									//Perform upload to Firebase storage
									axios.post('https://us-central1-project-pastro-c95b1.cloudfunctions.net/shadowspear', {
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

										var s = res.data.recognizedText.split('\n');
										s.forEach(step => {
											self.manage_recipeSections[0].steps.push({
												value: step,
												isDeleted: false
											});
										});

										load('gs://project-pastro-c95b1.appspot.com/users/' + utils._UID + '/tempOCR/' + fileName);
									}).catch(err => {
										console.log(err.response.data);
										utils.reportError('Error', err.toString(), 'Functions error reported.');
										console.log(err.toString());
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
				handleStepsOCRCrop: function () {
					this.ocr_StepsPondEditor.onconfirm(utils.getCropData(this.ocr_StepsCropperObject.getData(), this.ocr_StepsCropperObject.getCanvasData()));
					this.ocr_StepsEditMode = false;
					this.ocr_StepsCropperObject.destroy();
					this.ocr_StepsCropperObject = null;
					document.getElementById('ocrStepsCropWrapper').innerHTML = "";
				}
			}
		});
	});
})();