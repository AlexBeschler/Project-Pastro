(function ($) {
	var utils = new ProjectPastroUtils();
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
		//Prevent unintended back button clicking
		window.onbeforeunload = function () {
			return "Your work will be lost.";
		};

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

				//Step 1
				manage_filePondCoverPhoto: '',
				manage_coverPhotoURL: '',

				ocrNameFileBeforeCrop: null,
				ocrNameAndDescriptionInput: null,
				ocrNameAndDescriptionCropper: null,
				ocr_nameAndDescriptionEditMode: false,

				ocr_ingredientsInput: null,
				ocrIngredientsCropper: null,
				ocr_ingredientsEditMode: false,

				ocr_stepsInput: null,
				ocrStepsCropper: null,
				ocr_stepsEditMode: false,

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
				isDyslexicFontSet: '',
				userID: utils._UID
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
				this.initQuill();

				FilePond.registerPlugin(FilePondPluginImageTransform);
				FilePond.registerPlugin(FilePondPluginImagePreview);
				FilePond.registerPlugin(FilePondPluginImageEdit);
				var self = this;

				var filePondEditor = {
					// Called by FilePond to edit the image
					// - should open your image editor
					// - receives file object and image edit instructions      
					open: (file, instructions) => {
						var reader = new FileReader();
						reader.onloadend = function () {
							self.ocr_nameAndDescriptionEditMode = true;
							var image = new Image();
							image.src = reader.result;
							image.id = 'nameAndDescriptionCropper';
							document.getElementById('ocrNameAndDescriptionCropWrapper').appendChild(image);
							self.ocrNameAndDescriptionCropper = new Cropper(document.getElementById('nameAndDescriptionCropper'));
						}
						reader.readAsDataURL(file);
					},

					// Callback set by FilePond
					// - should be called by the editor when user confirms editing
					// - should receive output object, resulting edit information
					onconfirm: (output) => {},

					// Callback set by FilePond
					// - should be called by the editor when user cancels editing
					oncancel: () => {},

					// Callback set by FilePond
					// - should be called by the editor when user closes the editor
					onclose: () => {}
				}

				this.recipeOffcanvas = new bootstrap.Offcanvas(document.getElementById('recipeOffcanvas'));
				this.deleteRecipeOffcanvas = new bootstrap.Offcanvas(this.$refs.recipeDeleteOffcanvas);

				this.$refs.manageRecipeView.addEventListener('hidden.bs.offcanvas', this.checkForCancelRecipe);

				this.manage_filePondCoverPhoto = FilePond.create(document.getElementById('coverPhotoURLInput'));
				var self = this;
				this.manage_filePondCoverPhoto.setOptions({
					server: {
						process: (fieldName, file, metadata, load, error, progress, abort, transfer, options) => {
							console.log('Processing and uploading...');
							var photoID = uuidv4();
							var fileEndingRegex = /(?:\.([^.]+))?$/;
							var fileType = fileEndingRegex.exec(file.name)[1];
							var coverPhotoID = photoID + '.' + fileType;

							var uploadTask = firebase.storage().ref().child('users/' + utils._UID + '/coverphotos/' + coverPhotoID);
							uploadTask.put(file).then(function () {
								uploadTask.getDownloadURL().then((url) => {
									self.manage_coverPhotoURL = url;
									load();
								}).catch(function (e) {
									console.log('Error getting download URL: ' + e);
									error('Error getting download URL: ' + e);
								});
							}).catch(function (e) {
								console.log('Error uploading file: ' + e);
								error('Error uploading file: ' + e);
							});

							return {
								abort: () => {
									abort();
								},
							};
						}
					}
				});

				this.ocrNameAndDescriptionInput = FilePond.create(document.getElementById('ocrNameAndDescriptionInput'));
				this.ocrNameAndDescriptionInput.setOptions({
					allowImageEdit: true,
					styleImageEditButtonEditItemPosition: 'bottom center',
					imageEditAllowEdit: true,
					imageEditEditor: filePondEditor
				});

				this.ocr_ingredientsInput = FilePond.create(document.getElementById('ocrIngredientsInput'));
				this.ocr_stepsInput = FilePond.create(document.getElementById('ocrStepsInput'));

				//Load settings
				this.isDyslexicFontSet = utils.getLocalStorage(utils.DYSLEXIC_FONT_SET) === 'true';
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
					}).then(() => {
						console.log('Wrote new font settings to cloud');
					}).catch((error) => {
						console.error('Error writing cloud font preference: ', error);
					});
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
						return;
					};
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
					$('#addRecipeButton').attr('data-ps-button-type', 'manage');

					//Add listener
					this.$refs.recipeView.addEventListener('hidden.bs.offcanvas', this.recipeViewListener);

					this.recipeOffcanvas.hide();
				},
				checkForCancelRecipe: function () {
					//Check if the user closed out of an edit screen
					if ($('#addRecipeButton').attr('data-ps-button-type') == 'manage') {
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
					if ($('#addRecipeButton').attr('data-ps-button-type') == 'add') {
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
				handleOCR: function (type) {
					var self = this;
					this.ocrNameAndDescriptionCropper.getCroppedCanvas().toBlob((blob) => {
						var fileName = uuidv4();
						var fileType = '';
						try {
							fileType = blob.type.split('/')[1];
						} catch (e) {
							console.log(e);
						}
						if (fileType === '') {
							return;
						}
						firebase.storage().ref('users/' + utils._UID + '/tempOCR/' + fileName + '.' + fileType).put(blob).then((snapshot) => {
							axios
								.post('http://localhost:5001/project-pastro-c95b1/us-central1/ocrTextDetection', {
									fileLocation: 'gs://project-pastro-c95b1.appspot.com/users/' + utils._UID + '/tempOCR/' + fileName + '.' + fileType
								})
								.then(res => {
									//Asynchronously delete temp OCR file
									firebase.storage().ref('users/' + utils._UID + '/tempOCR/' + fileName + '.' + fileType).delete().catch((error) => {
										utils.reportError('Error', error, 'Error with deleting temp OCR file ' + fileName + '.' + fileType);
									});
									switch (type) {
										case 'nameAndDescription':
											self.ocr_nameAndDescriptionEditMode = false;
											self.ocrNameAndDescriptionCropper.destroy();
											var results = res.data.recognizedText[0].description.split('\n');
											console.log(results);
											if (results.length > 1) {
												self.manage_recipeName = utils.capitalizeFirstLetter(results[0].toLowerCase());
												var description = '';
												for (var i = 1; i < results.length; i++) {
													description += utils.capitalizeFirstLetter(results[i].toLowerCase());
												}
												self.quillInstance.setText(description);
											} else {
												self.manage_recipeName = utils.capitalizeFirstLetter(results[0].toLowerCase());
											}
									}
								})
								.catch(err => console.log(err));
						});
					});
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

					serializedRecipe.docID = uuidv4();
					serializedRecipe.addDate = Date.now();

					if ($('#addRecipeButton').attr('data-ps-button-type') == 'add') {
						this.manage_coverPhotoURL !== '' ? serializedRecipe.coverPhotoURL = this.manage_coverPhotoURL : serializedRecipe.coverPhotoURL = '';
						//Add runtime-injected ID for index
						serializedRecipe.id = this.injectedSearchIndexID;
						//Increase for next time
						this.injectedSearchIndexID++;
						//Push serialized recipe into sorted position to cookbook
						this.cookbook.push(serializedRecipe);
					} else if ($('#addRecipeButton').attr('data-ps-button-type') == 'manage') {
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
					$('#addRecipeButton').attr('data-ps-button-type', 'add');

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
					this.isRecipeSubmitDisabled = false;
				},

				//Utility methods
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