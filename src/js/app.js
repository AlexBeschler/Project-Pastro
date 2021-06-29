(function ($) {
	var utils = new ProjectPastroUtils();
	$(document).ready(function () {
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
										//$('#pills-normal-font').removeClass('active');
										//$('#pills-dyslexic-font').addClass('active');
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

		new Vue({
			el: '#appContent',
			vuetify: new Vuetify(),
			data: {
				//Utils
				db: null,
				cookbook: payload,

				//Explore pane
				displayTags: '',
				displayTime: '',
				displayIngredients: '',

				tagsArray: null,
				ingredientsArray: null,
				totalRecipeTimeInput: null,
				finishByTimeInput: null,

				checkedTagsArray: null,
				checkedIngredientsArray: null,

				//For use with manage recipes
				manage_recipeTitle: '',
				manage_recipeName: '',
				manage_recipeDescription: '',
				manage_recipeTagInput: '',
				manage_recipeTagHolder: [],
				manage_recipePrepTime: '',
				manage_recipeCookTime: '',
				manage_recipeTotalTime: '',
				manage_recipeActiveTime: '',
				//Step 3
				manage_recipeBlocks: [],
				manage_recipeBlockIngredients: [],
				manage_recipeBlockSteps: [],
				manage_recipeBlockHeader: '',
				manage_recipeBlockIngredientAmount: '',
				manage_recipeBlockIngredientValue: '',
				manage_recipeBlockStepValue: '',
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
				]
			},
			created() {
				var self = this;

				this.db = firebase.firestore();

				this.tagsArray = [];
				this.displayTime = 'takes any time';
				this.ingredientsArray = [];

				this.checkedTagsArray = [];
				this.checkedIngredientsArray = [];

				//TODO: Use underscore's sortBy function
				var zippedIngredients = [];
				payload.forEach(recipe => {
					//Tags
					self.tagsArray = _.uniq(_.union(self.tagsArray, recipe.tags), false);

					//Ingredients
					recipe.blocks.forEach(block => {
						let x = _.pluck(block.ingredients, 'value');
						x.forEach(ingredient => {
							zippedIngredients.push(utils.capitalizeFirstLetter(ingredient));
						})
					});
					self.ingredientsArray = _.uniq(zippedIngredients);
				});
			},
			mounted() {
				this.initQuill();
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
				},
				quillValue: function (newVal) {
					// Only update the content if it's changed from an external source
					// or else it'll act weird when you try to type anything
					if (newVal !== this.quillContent) {
						this.quillInstance.pasteHTML(newVal)
					}
				}
			},
			methods: {
				initQuill: function () {
					this.quillInstance = new Quill('#editor', {
						modules: {
							toolbar: this.toolbarOptions
						},
						theme: 'snow'
					});
					this.quillInstance.on('text-change', this.onQuillContentChange);
					this.setQuillContent();
				},
				onQuillContentChange: function () {
					this.setQuillContent();
					this.$emit('input', this.quillContent)
				},
				setQuillContent: function () {
					this.quillContent = this.quillInstance.getText().trim() ? this.quillInstance.root.innerHTML : ''
				},
				updateFilters: function () {
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
				clickedAddRecipe: function () {
					//Do button animation
					if ($('#addRecipeButton').attr('data-ps-button-type') == 'add') {
						this.manage_recipeTitle = 'Add Recipe';
					} else {
						this.manage_recipeTitle = 'Update Recipe';
					}
				},

				//Manage recipe methods
				pushToTagArray: function () {
					if (this.manage_recipeTagInput !== '' && this.manage_recipeTagInput !== null) {
						this.manage_recipeTagHolder.push(this.manage_recipeTagInput);
						this.manage_recipeTagInput = '';
					}
				},
				addIngredient: function () {
					var ingredientValueBox = $('#manage_ing_value');
					ingredientValueBox.removeClass('is-invalid');
					if ((this.manage_recipeBlockIngredientAmount === '' || this.manage_recipeBlockIngredientAmount === null) && (this.manage_recipeBlockIngredientValue === '' || this.manage_recipeBlockIngredientValue === null)) {
						return;
					}
					if (this.manage_recipeBlockIngredientValue === '' || this.manage_recipeBlockIngredientValue === null) {
						$('#ingredient-invalid-feedback').text('Cannot be blank. Use this for ingredients that don\'t require an amount.');
						ingredientValueBox.addClass('is-invalid');
						return;
					}
					this.manage_recipeBlockIngredients.push({
						amount: this.manage_recipeBlockIngredientAmount,
						value: this.manage_recipeBlockIngredientValue,
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
					if ((this.manage_recipeBlockStepValue === '' || this.manage_recipeBlockStepValue === null) && this.manage_recipeBlockSteps.length === 0) {
						$('#step-invalid-feedback').text('Blocks must contain at least one step.');
						stepValueBox.addClass('is-invalid');
						return;
					}
					this.manage_recipeBlockSteps.push({
						value: this.manage_recipeBlockStepValue,
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
						this.manage_recipeBlockSteps[index].editMode = false;
						this.manage_recipeBlockSteps[index].editModeButtonText = 'Edit';
					}
				},
				deleteStep: function (index) {
					this.manage_recipeBlockSteps.splice(index, 1);
				},
				addBlock: function () {
					this.manage_recipeBlocks.push({
						header: this.manage_recipeBlockHeader,
						ingredients: this.manage_recipeBlockIngredients,
						steps: this.manage_recipeBlockSteps
					});
					this.manage_recipeBlockHeader = '';
					this.manage_recipeBlockIngredients = [];
					this.manage_recipeBlockSteps = [];
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


					/* **** Validate all form valid classes **** */
					//Check name
					if (utils.isString(this.manage_recipeName)) {
						$('#manage_form_name').addClass('is-valid');
						serializedRecipe.title = this.manage_recipeName.toString();
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
						serializedRecipe.tags = Array.from(this.manage_recipeTagHolder);
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

					if (anyInvalid) return;

					//Merge tags to Explore pane
					this.tagsArray = _.union(Array.from(this.tagsArray), Array.from(this.manage_recipeTagHolder));

					//Serialize recipe block for push to Firebase
					if (this.manage_recipeBlocks.length > 0) {
						serializedRecipe.blocks = [];
						for (var i = 0; i < this.manage_recipeBlocks.length; i++) {
							let o = {};
							o.header = this.manage_recipeBlocks[i].header;
							o.ingredients = _.map(this.manage_recipeBlocks[i].ingredients, function (row) {
								console.log('Row: ' + row);
								return _.omit(row, ['editMode', 'editModeButtonText']);
							});
							//Merge ingredients to Explore pane
							self.ingredientsArray = _.union(Array.from(self.ingredientsArray), _.pluck(o.ingredients, 'value').map(f => {
								return utils.capitalizeFirstLetter(f);
							}));
							o.steps = _.map(this.manage_recipeBlocks[i].steps, function (row) {
								return _.omit(row, ['editMode', 'editModeButtonText']);
							});
							serializedRecipe.blocks.push(o);
						}
					} else {
						anyInvalid = true;
					}

					serializedRecipe.coverPhotoURL = null;
					serializedRecipe.docID = uuidv4();
					serializedRecipe.addDate = Date.now();

					//Push serialized recipe to cookbook
					this.cookbook.push(serializedRecipe);

					//If recipe is being added
					if ($('#addRecipeButton').attr('data-ps-button-type') == 'add') {
						this.db.collection('users/' + utils._UID + '/recipes').doc(serializedRecipe.docID).set(serializedRecipe).then(function () {
							self.cleanupManageRecipe();
						}).catch(function (error) {
							console.error(error);
						});
					} else {
						//
					}
				},
				cleanupManageRecipe: function () {
					//Reset manage recipe values
					this.manage_recipeName = '';
					this.manage_recipeTagInput = '';
					this.manage_recipeTagHolder = [];
					this.manage_recipePrepTime = '';
					this.manage_recipeCookTime = '';
					this.manage_recipeTotalTime = '';
					this.manage_recipeActiveTime = '';
					this.manage_recipeBlocks = [];
					this.manage_recipeBlockIngredients = [];
					this.manage_recipeBlockSteps = [];
					this.manage_recipeBlockHeader = '';
					this.manage_recipeBlockIngredientAmount = '';
					this.manage_recipeBlockIngredientValue = '';
					this.manage_recipeBlockStepValue = '';
					this.quillContent = this.quillInstance.setText('');

					//Toggle offcanvas
					var offcanvas = document.getElementById('manage-recipe-offcanvas');
					var bsOffcanvas = new bootstrap.Offcanvas(offcanvas);
					bsOffcanvas.toggle();
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
				}
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