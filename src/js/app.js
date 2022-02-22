/*jshint esversion: 8 */
(function () {
	var utils = new ProjectPastroUtils();
	var nlp = new ProjectPastroNLP();
	nlp.init();

	window.addEventListener("load", function (event) {
		//Progressive web app dependency
		if ("serviceWorker" in navigator) {
			navigator.serviceWorker.register("registerServiceWorker.js");
		}
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
						};
					},
					methods: {
						paySubscription: function () {
							console.log('User clicked make payment');
							//Disable button
							var button = document.getElementById('paySubscriptionButton');
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
		var payload = [];
		var listOfTags = [];
		var listOfIngredients = [];
		var firebaseTestUnit = [
			{
				"docID": "563ca5fb-1997-484e-b343-cec6c9d21251",
				"dateAdded": "1637381364589",
				"dateModified": "1637381387807",
				"favorite": false,
				"title": "Chocolate Cake",
				"description": "<p>What an easy chocolate cake! No mixer required for the batter, simply whisk the dry ingredients in one bowl and the wet ingredients in another bowl. Pour the wet ingredients into the dry ingredients (or vice versa, it doesn’t make any difference), add the hot coffee, then whisk everything together. The cake batter is thin. Divide between 2 9-inch cake pans. You can easily stretch it to 3 or 4 8-inch or 9-inch cakes if needed. Or make a quarter sheet cake using a 9×13 inch cake pan. See my recipe notes for details.</p>",
				"tags": [
					"Dessert",
					"Intermediate"
				],
				"prepTime": 15,
				"cookTime": 30,
				"totalTime": 120,
				"activeTime": 25,
				"yield": "24 slices",
				"coverPhotoURL": "https://via.placeholder.com/2048x2048.png",
				"thumbnail": "https://via.placeholder.com/64x64.png",
				"specialEquipment": [
					"Stand mixer",
					"Cake pans"
				],
				"notes": [
					"The cake batter will be very thin after adding the boiling water.",
					"Let the baked cake layers cool completely. Wrap them well with plastic wrap and then with foil. Put each layer into a freezer bag and freeze up to 2 months. To serve, thaw in the refrigerator overnight with wrapping intact. The next day, the layers are ready to fill and frost."
				],
				"sections": [
					{
						"title": "Cake",
						"ingredients": [
							{
								"amount": "2 cups",
								"value": "all-purpose flour"
							},
							{
								"amount": "2 cups",
								"value": "sugar"
							},
							{
								"amount": "3/4 cup",
								"value": "unsweetened cocoa powder"
							},
							{
								"amount": "2 teaspoons",
								"value": "baking powder"
							},
							{
								"amount": "1 1/2 teaspoons",
								"value": "baking soda"
							},
							{
								"amount": "1 teaspoon",
								"value": "salt"
							},
							{
								"amount": "1 teaspoon",
								"value": "espresso powder homemade or store-bought"
							},
							{
								"amount": "1 cup",
								"value": "buttermilk"
							},
							{
								"amount": "1/2 cup",
								"value": "canola oil"
							},
							{
								"amount": "2",
								"value": "large eggs"
							},
							{
								"amount": "2 teaspoons",
								"value": "vanilla extract"
							},
							{
								"amount": "1 cup",
								"value": "boiling water"
							}
						],
						"steps": [
							{
								"value": "Preheat oven to 350º F. Prepare two 9-inch cake pans by spraying with baking spray or buttering and lightly flouring.",
								"coverPhotoURL": "https://via.placeholder.com/1024x1024.png"
							},
							{
								"value": "Add flour, sugar, cocoa, baking powder, baking soda, salt and espresso powder to a large bowl or the bowl of a stand mixer. Whisk through to combine or, using your paddle attachment, stir through flour mixture until combined well.",
								"coverPhotoURL": "https://via.placeholder.com/2048x2048.png"
							},
							{
								"value": "Add milk, vegetable oil, eggs, and vanilla to flour mixture and mix together on medium speed until well combined. Reduce speed and carefully add boiling water to the cake batter until well combined.",
								"coverPhotoURL": "https://via.placeholder.com/2048x2048.png"
							},
							{
								"value": "Distribute cake batter evenly between the two prepared cake pans. Bake for 30-35 minutes, until a toothpick or cake tester inserted in the center of the chocolate cake comes out clean.",
								"coverPhotoURL": "https://via.placeholder.com/2048x2048.png"
							},
							{
								"value": "Remove from the oven and allow to cool for about 10 minutes, remove from the pan and cool completely.",
								"coverPhotoURL": "https://via.placeholder.com/2048x2048.png"
							}
						],
						"nFat": 1,
						"nCholesterol": 1,
						"nSodium": 1,
						"nTotalCarbs": 1,
						"nFiber": 1,
						"nSugar": 1,
						"nProtein": 1 
					},
					{
						"title": "Buttercream Frosting",
						"ingredients": [
							{
								"amount": "1½ cups",
								"value": "butter softened"
							},
							{
								"amount": "1 cup",
								"value": "unsweetened cocoa"
							},
							{
								"amount": "5 cups",
								"value": "confectioner’s sugar"
							},
							{
								"amount": "½ cup",
								"value": "milk"
							},
							{
								"amount": "2 teaspoons",
								"value": "vanilla extract"
							},
							{
								"amount": "½ teaspoon",
								"value": "espresso powder"
							}
						],
						"steps": [
							{
								"value": "Add cocoa to a large bowl or bowl of stand mixer. Whisk through to remove any lumps.",
								"coverPhotoURL": "https://via.placeholder.com/1024x1024.png"
							},
							{
								"value": "Cream together butter and cocoa powder until well-combined.",
								"coverPhotoURL": "https://via.placeholder.com/1024x1024.png"
							},
							{
								"value": "Add sugar and milk to cocoa mixture by adding 1 cup of sugar followed by about a tablespoon of milk. After each addition has been combined, turn mixer onto a high speed for about a minute. Repeat until all sugar and milk have been added.",
								"coverPhotoURL": "https://via.placeholder.com/1024x1024.png"
							},
							{
								"value": "Add vanilla extract and espresso powder and combine well.",
								"coverPhotoURL": "https://via.placeholder.com/1024x1024.png"
							},
							{
								"value": "If frosting appears too dry, add more milk, a tablespoon at a time until it reaches the right consistency. If it appears to wet and does not hold its form, add more confectioner’s sugar, a tablespoon at a time until it reaches the right consistency.",
								"coverPhotoURL": "https://via.placeholder.com/1024x1024.png"
							}
						],
						"nCalories": 12,
						"nFat": 1,
						"nCholesterol": 1,
						"nSodium": 1,
						"nTotalCarbs": 1,
						"nFiber": 1,
						"nSugar": 1,
						"nProtein": 1 
					}
				]
			},
			{
				"docID": "d43cd4d1-45f7-4a97-a572-3e119c67afa6",
				"dateAdded": "1637381406764",
				"dateModified": "1637381414039",
				"favorite": false,
				"title": "Thai Tea",
				"description": "<p>While it&apos;s easy to simply buy Thai tea mix and add milk or half-and-half, it&apos;s not nearly as satisfying. This recipe is one of the <em>best from-scratch</em> Thai teas you could ever have!</p>",
				"tags": [
					"Drink",
					"Thai",
					"Cold",
					"Easy"
				],
				"prepTime": 2,
				"cookTime": 6,
				"totalTime": 15,
				"activeTime": 10,
				"yield": "3 cups of Thai tea",
				"coverPhotoURL": "https://simpleparallax.b-cdn.net/images/paint_1.jpg",
				"thumbnail": "https://via.placeholder.com/64x64.png",
				"specialEquipment": [
					"Cheesecloth",
					"2x 4 cup beakers (or 2 containers with an easy-pour spout)",
					"Old towel that can get stained",
					"Scissors (if the tea bags have strings)"
				],
				"notes": [
					"The old towel is placed under the easy-pour beakers when pouring the liquid from the saucepan",
					"Vanilla bean is expensive but worth it! The final product is dependent on the ingredients being boiled with the water.",
					"Be warned that tumeric powder will stain any cloth it comes into contact with."
				],
				"sections": [
					{
						"title": "Thai Tea",
						"ingredients": [
							{
								"amount": "5 cups",
								"value": "water, filtered"
							},
							{
								"amount": "10",
								"value": "black tea bags"
							},
							{
								"amount": "4",
								"value": "star anise"
							},
							{
								"amount": "1 tsp",
								"value": "green cardamon seeds"
							},
							{
								"amount": "4",
								"value": "cinnamon sticks"
							},
							{
								"amount": "4 tsp",
								"value": "tumeric powder"
							},
							{
								"amount": "2",
								"value": "vanilla beans"
							},
							{
								"amount": "4 tsp",
								"value": "vanilla extract (not imitation flavoring)"
							},
							{
								"amount": "3 tbps",
								"value": "granulated white sugar"
							},
							{
								"amount": "2",
								"value": "fresh mint leaves (optional)"
							}
						],
						"steps": [
							{
								"value": "Put filtered water into a medium saucepan (~6 cups capacity or more) and bring to a boil.",
								"coverPhotoURL": "https://via.placeholder.com/1024x1024.png"
							},
							{
								"value": "While waiting, snip off the black tea bag strings with a pair of scissors and combine these with the star anise, cardamon seeds, cinnamon sticks, tumeric powder, and vanilla beans into a separate container and set aside.",
								"coverPhotoURL": "https://via.placeholder.com/1024x1024.png"
							},
							{
								"value": "When water is boiling bring water to lo simmer and put dry ingredients in all at once. Quickly add the vanilla extract. Stir until ingredients are combined, roughly 8 stirs.",
								"coverPhotoURL": "https://via.placeholder.com/1024x1024.png"
							},
							{
								"value": "Let sit for 6 minutes uncovered (the black tea bags could burst if saucepan is covered).",
								"coverPhotoURL": "https://via.placeholder.com/1024x1024.png"
							},
							{
								"value": "Afterwards, stir once again, about 8 stirs. Turn stove off.",
								"coverPhotoURL": "https://via.placeholder.com/1024x1024.png"
							},
							{
								"value": "Place a sieve over one of the kitchen beakers and the old towel underneath; the cloth is used for catching any spills that will occur. Pour the tea blend into the sieve and let it catch the large ingredients.",
								"coverPhotoURL": "https://via.placeholder.com/1024x1024.png"
							},
							{
								"value": "We must now filter the tumeric powder out of the tea - filtering twice will ensure almost all is removed. Fold the cheesecloth in half, then in half again (4 layers of cloth should be sufficient). Cover the top of the other empty beaker with one side of the cloth and pour the tea from the first beaker into the second, cheesecloth-covered beaker.",
								"coverPhotoURL": "https://via.placeholder.com/1024x1024.png"
							},
							{
								"value": "Clean the now-empty beaker of residual tumeric powder and cover with the cheesecloth. Repeat the filtering process with the other side of the cheesecloth.",
								"coverPhotoURL": "https://via.placeholder.com/1024x1024.png"
							},
							{
								"value": "After filtering twice, the tea should yield 3 cups.",
								"coverPhotoURL": "https://via.placeholder.com/1024x1024.png"
							},
							{
								"value": "Whisk the 3 tbps of granulated sugar into the tea (1 tbps per cup of tea)",
								"coverPhotoURL": "https://via.placeholder.com/1024x1024.png"
							},
							{
								"value": "Create and whisk in the Thai tea sweetener blend, detailed below.",
								"coverPhotoURL": "https://via.placeholder.com/1024x1024.png"
							},
							{
								"value": "Let sit in the refrigerator until chilled. Serve with 3 ice cubes and 2 fresh mint leaves. Enjoy!",
								"coverPhotoURL": "https://via.placeholder.com/1024x1024.png"
							}
						],
						"nCalories": 12,
						"nFat": 1,
						"nCholesterol": 1,
						"nSodium": 1,
						"nTotalCarbs": 1,
						"nFiber": 1,
						"nSugar": 1,
						"nProtein": 1 
					},
					{
						"title": "Thai Tea Sweetener Blend",
						"ingredients": [
							{
								"amount": "6 tbps",
								"value": "sweetened condensed milk"
							},
							{
								"amount": "3 tbps",
								"value": "evaporated milk"
							}
						],
						"steps": [
							{
								"value": "Pour ingredients into a cup. Using a fork whisk together ingredients until thoroughly blended, resembling a thick, sticky cream.",
								"coverPhotoURL": "https://via.placeholder.com/1024x1024.png"
							},
							{
								"value": "If your Thai tea recipe yielded an amount other than 3 cups, combine the condensed milk and evaporated milk using a 2:1 blend per cup of tea, 2 parts condensed milk, 1 part evaporated milk, using tbps as the measurement.",
								"coverPhotoURL": "https://via.placeholder.com/1024x1024.png"
							},	
						],
						"nCalories": 12,
						"nFat": 1,
						"nCholesterol": 1,
						"nSodium": 1,
						"nTotalCarbs": 1,
						"nFiber": 1,
						"nSugar": 1,
						"nProtein": 1 
					}
				]
			},
			{
				"docID": "8f182252-9135-4c21-917e-4945bddd9a0e",
				"dateAdded": "1637381426228",
				"dateModified": "1637381430447",
				"favorite": false,
				"title": "Hello World Recipe",
				"description": "<p>Hello World</p>",
				"tags": [
					"Dinner",
					"Quick"
				],
				"prepTime": 1,
				"cookTime": 3,
				"totalTime": 1,
				"activeTime": 5,
				"yield": "2 servings",
				"coverPhotoURL": "https://via.placeholder.com/1024x1024.png",
				"thumbnail": "https://via.placeholder.com/64x64.png",
				"specialEquipment": [
					"Rice cooker"
				],
				"notes": [
					"Make sure to mix well"
				],
				"sections": [
					{
						"title": "Hello World",
						"ingredients": [
							{
								"amount": "1 tbps",
								"value": "butter"
							},
							{
								"amount": "1 tsp",
								"value": "salt"
							}
						],
						"steps": [
							{
								"value": "Preheat the oven to 350°F.",
								"coverPhotoURL": "https://via.placeholder.com/1024x1024.png"
							},
							{
								"value": "Beat together the butter, sugar, and salt, first until combined, then until fluffy and lightened in color. For a visual of what this should look like, see our video, how to cream butter and sugar.",
								"coverPhotoURL": "https://via.placeholder.com/1024x1024.png"
							}
						],
						"nCalories": 12,
						"nFat": 1,
						"nCholesterol": 1,
						"nSodium": 1,
						"nTotalCarbs": 1,
						"nFiber": 1,
						"nSugar": 1,
						"nProtein": 1 
					},
					{
						"title": "Another hello world",
						"ingredients": [
							{
								"amount": "1 tub",
								"value": "frosting"
							},
							{
								"amount": "3 tsp",
								"value": "sugar"
							}
						],
						"steps": [
							{
								"value": "Add the eggs one at a time, beating well after each addition. Scrape the sides and bottom of the bowl once all the eggs have been added, and beat briefly to re-combine any residue.",
								"coverPhotoURL": "https://via.placeholder.com/1024x1024.png"
							},
							{
								"value": "Measure the flour by gently spooning it into a cup, then sweeping off any excess. Whisk the baking powder into the flour. Add the flour mixture to the batter in three parts alternately with the milk, starting and ending with the flour. The batter may look slightly curdled when you add the milk. That's OK; it'll smooth out as you add the flour. Mix until everything is well combined; the batter will look a bit rough, but shouldn't have any large lumps. Stir in the zest or lemon oil.",
								"coverPhotoURL": "https://via.placeholder.com/1024x1024.png"
							}
						],
						"nCalories": 12,
						"nFat": 1,
						"nCholesterol": 1,
						"nSodium": 1,
						"nTotalCarbs": 1,
						"nFiber": 1,
						"nSugar": 1,
						"nProtein": 1 
					}
				]
			},
			{
				"docID": "8a2a771f-3777-47b1-9cf6-8630e28c99db",
				"dateAdded": "1639627414",
				"dateModified": "1639627614",
				"favorite": false,
				"title": "Hello World Recipe",
				"description": "<p>Hello World</p>",
				"tags": [
					"Dinner",
					"Quick"
				],
				"prepTime": 1,
				"cookTime": 3,
				"totalTime": 1,
				"activeTime": 5,
				"yield": "2 servings",
				"coverPhotoURL": "https://via.placeholder.com/1024x1024.png",
				"thumbnail": "https://via.placeholder.com/64x64.png",
				"specialEquipment": [
					"Rice cooker"
				],
				"notes": [
					"Make sure to mix well"
				],
				"sections": [
					{
						"title": "Hello World",
						"ingredients": [
							{
								"amount": "1 tbps",
								"value": "butter"
							},
							{
								"amount": "1 tsp",
								"value": "salt"
							}
						],
						"steps": [
							{
								"value": "Preheat the oven to 350°F.",
								"coverPhotoURL": "https://via.placeholder.com/1024x1024.png"
							},
							{
								"value": "Beat together the butter, sugar, and salt, first until combined, then until fluffy and lightened in color. For a visual of what this should look like, see our video, how to cream butter and sugar.",
								"coverPhotoURL": "https://via.placeholder.com/1024x1024.png"
							}
						],
						"nCalories": 12,
						"nFat": 1,
						"nCholesterol": 1,
						"nSodium": 1,
						"nTotalCarbs": 1,
						"nFiber": 1,
						"nSugar": 1,
						"nProtein": 1 
					},
					{
						"title": "Another hello world",
						"ingredients": [
							{
								"amount": "1 tub",
								"value": "frosting"
							},
							{
								"amount": "3 tsp",
								"value": "sugar"
							}
						],
						"steps": [
							{
								"value": "Add the eggs one at a time, beating well after each addition. Scrape the sides and bottom of the bowl once all the eggs have been added, and beat briefly to re-combine any residue.",
								"coverPhotoURL": "https://via.placeholder.com/1024x1024.png"
							},
							{
								"value": "Measure the flour by gently spooning it into a cup, then sweeping off any excess. Whisk the baking powder into the flour. Add the flour mixture to the batter in three parts alternately with the milk, starting and ending with the flour. The batter may look slightly curdled when you add the milk. That's OK; it'll smooth out as you add the flour. Mix until everything is well combined; the batter will look a bit rough, but shouldn't have any large lumps. Stir in the zest or lemon oil.",
								"coverPhotoURL": "https://via.placeholder.com/1024x1024.png"
							}
						],
						"nCalories": 12,
						"nFat": 1,
						"nCholesterol": 1,
						"nSodium": 1,
						"nTotalCarbs": 1,
						"nFiber": 1,
						"nSugar": 1,
						"nProtein": 1 
					}
				]
			}
		];

		var firebaseTestFilterPresets = [
			{
				name: 'Dinner in 10 minutes',
				tags: '',
				time: '',
				ingredients: '',
				nutrition: ''
			},
			{
				name: 'Sweet Tooth!',
				tags: '',
				time: '',
				ingredients: '',
				nutrition: ''
			},
			{
				name: 'Healthy Lunch',
				tags: '',
				time: '',
				ingredients: '',
				nutrition: ''
			}
		];

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
		var flexIndex = 0;

		firebaseTestUnit.forEach(recipe => {
			//Inject id for FlexSearch during runtime
			recipe.id = flexIndex;
			
			//Adds recipe and indexes it
			payload.push(recipe);
			metaIndex.add(recipe);

			//Index numeric metadata
			numberMetaIndex.totalTime.push({
				id: flexIndex,
				value: recipe.totalTime
			});

			listOfTags = _.union(listOfTags, recipe.tags);

			recipe.sections.forEach(section => {
				//Ingredients
				section.ingredients.forEach(ingredient => {
					listOfIngredients = _.union(listOfIngredients, [utils.capitalizeFirstLetter(ingredient.value)]);
				});
			});

			flexIndex++;
		});

		appFunctionality(payload, firebaseTestFilterPresets, listOfIngredients, listOfTags, metaIndex, numberMetaIndex);
		//utils._NANOBAR.go(75);
		/*
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
		*/
	}

	function appFunctionality(payload, filterPresets, listOfIngredients, listOfTags, indexedRecipes, numberMetaIndex) {
		//Load vue dependencies
		Vue.use('vue-slicksort');

		utils.showCookbook();

		//** RecipeView component mixins **//

		//Special equipment
		Vue.component('recipeview-special-equipment-list', {
			mixins: [ContainerMixin],
			template: '#special-equipment-draggable-list-template'
		});
		Vue.component('recipeview-special-equipment-item', {
			mixins: [ElementMixin],
			props: ['equipment'],
			template: '#special-equipment-draggable-item-template'
		});
		//Notes
		Vue.component('recipe-notes-draggable-list', {
			mixins: [ContainerMixin],
			template: '#recipe-notes-draggable-list-template'
		});
		Vue.component('recipe-notes-draggable-item', {
			mixins: [ElementMixin],
			props: ['note'],
			template: '#recipe-notes-draggable-item-template'
		});
		//Ingredients
		Vue.component('recipe-ingredients-draggable-list', {
			mixins: [ContainerMixin],
			template: '#recipe-ingredients-draggable-list-template'
		});
		Vue.component('recipe-ingredients-draggable-item', {
			mixins: [ElementMixin],
			props: ['ingredient'],
			template: '#recipe-ingredients-draggable-item-template'
		});
		//Steps
		Vue.component('recipe-steps-draggable-list', {
			mixins: [ContainerMixin],
			template: '#recipe-steps-draggable-list-template'
		});
		Vue.component('recipe-steps-draggable-item', {
			mixins: [ElementMixin],
			props: ['step'],
			template: '#recipe-steps-draggable-item-template'
		});

		//** RecipeView component mixins **//
		//Manage tag component
		Vue.component('addrecipeview-tag-draggable-list', {
			mixins: [ContainerMixin],
			template: '#addrecipeview-tag-draggable-list-template'
		});

		Vue.component('addrecipeview-tag-draggable-item', {
			mixins: [ElementMixin],
			props: ['tag'],
			template: '#addrecipeview-tag-draggable-item-template'
		});

		/*
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
		*/

		var pastroApp = new Vue({
			el: '#appContent',
			data: {
				/** Utils **/
				//Firebase db utils
				db: null,
				storage: null,
				//Main app cookbook array
				cookbook: payload,

				/** App screen management **/
				//Views are added to this stack to help manage user navigation throughout the lifecycle of the app.
				//   Navigation forward adds to the stack, while moving backwards pops the stack.
				//   This stack is also used for the 'popstate' function - when the user clicks the back button
				//   of the browser. When this happens, the app will pop the ViewStack and move backwards,
				//   providing a seamless UX
				ViewStack: [],
				
				/** Home screen data **/
				headerText: '',
				headerTextAnimeObject: null,
                isHeaderTextHidden: false,
                searchButtonHeight: 1,
                searchBarExpanded: false,
				
				///Used for 'Explore' pane
				//Used for FilterView
				filteredCookbook: [],
				flexSearch: indexedRecipes,
				numericIndex: numberMetaIndex,
				searchQuery: '',
				searchResults_title: [],
				searchResults_sectionTitle: [],
				filterPresetsList: [],
				
				//Tag helpers
				tagModel: '',
				tagList: listOfTags,
				filteredTagList: listOfTags,
				checkedTagsArray: [],
				
				//Ingredient helpers
				ingredientModel: '',
				ingredientList: listOfIngredients,
				filteredIngredientList: listOfIngredients,
				checkedIngredientsArray: [],
				
				//Time helpers
				totalRecipeTimeInput: '',
				finishByTimeInput: '',
				finishByTimeInputInMinutes: '',

				/** Recipe View data **/
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
				ingredientsAddModel: '',
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
				//Step 2
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
				manage_recipeSections: [
					{
						"title": "",
						"ingredients": [],
						"steps": [],
						"nFat": 0,
						"nCholesterol": 0,
						"nSodium": 0,
						"nTotalCarbs": 0,
						"nFiber": 0,
						"nSugar": 0,
						"nProtein": 0 
					}
				],

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





















				

				//Explore pane

				//Recipe

				//All tags and ingredients in cookbook
				tagsArray: listOfTags,
				ingredientsArray: listOfIngredients,

				nCalories: null,
				nFat: null,
				nCholesterol: null,
				nSodium: null,
				nCarbohydrate: null,
				nFiber: null,
				nSugars: null,
				nProtein: null,

				//Indices

				//For use in search queries

				//For use with manage recipes
				manageOffcanvas: null,
				isRecipeSubmitDisabled: false,
				

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

				//Used for settings menu
				isDyslexicFontSet: '',
				userID: utils._UID,
				browserUtil: ''
			},
			created() {
				this.db = firebase.firestore();
			},
			mounted() {
				var self = this;
				/* Disable back button from closing PWA */
				//Bug - when user reloads page it completely breaks this code
				window.history.pushState(null, null, document.URL);

				window.addEventListener('popstate', function () {
					self.navigateBackward();
					history.pushState(null, null, document.URL);
				});

				this.storage = firebase.storage().ref();

				//this.initQuill();

				//FilePond.registerPlugin(FilePondPluginImageTransform, FilePondPluginImageCrop, FilePondPluginImagePreview, FilePondPluginImageResize, FilePondPluginImageTransform, FilePondPluginImageEdit, FilePondPluginFileValidateType);				

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

				//Set height of search text box
                this.searchButtonHeight = this.getAbsoluteHeight(this.$refs.searchBoxButton);

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
                greeting += utils._FIRSTNAME;
                this.headerText = greeting;

				this.headerTextAnimeObject = anime.timeline({});

				this.headerTextAnimeObject
				.add({
					targets: this.$refs.addRecipeButton,
					translateX: function(el, i, l) {
						var padding = utils.remToPixels(0.75);
						var rem = utils.remToPixels(1.575);
						var vw = utils.vwToPixels(1.5);
						var animationWidth = -(rem + vw + padding);
						return ['0', animationWidth];
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
				/*
				.add({
                    targets: this.$refs.headerText,
                    translateY: ['-25%', '0%'],
                    opacity: [0, 1],
                    delay: 250,
                    duration: 200,
                    easing: 'easeInOutQuad'
				
                })*/
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

				this.filterPresetsList = filterPresets;

				

				

				/*
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

				this.$refs.manageRecipeView.addEventListener('hidden.bs.offcanvas', this.checkForCancelRecipe);

				*/

				//Load settings
				this.isDyslexicFontSet = utils.getLocalStorage(utils.DYSLEXIC_FONT_SET) === 'true';

				/*
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
				*/

				//this.initRecipeViewQuill();

				this.toastInstance = new bootstrap.Toast(this.$refs.toastNotification);
				this.$refs.toastNotification.addEventListener('hidden.bs.toast', function() {
					self.toastHeader = '';
					self.toastBody = '';
				});
			},
			watch: {
				searchQuery: function(b, a) {
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
				ingredientModel: function(b, a) {
					if (b === '') {
						this.filteredIngredientList = []; //Clear the list
						this.filteredIngredientList = this.ingredientList; //Clone
						return;
					}
					this.updateFilteredIngredients(b);
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
				/*
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
				*/
			},
			methods: {
				/**** Button Helpers ****/
				clickedSettings: function() {
                    this.navigateForward(this.$refs.optionsView, null, null);
                },
				clickedSearchBar: function() {
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
                            complete: function(anim) {
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
                            complete: function(anim) {
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
                clickedCloseSearch: function() {
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
								begin: function(anim) {
									self.ViewStack[self.ViewStack.length - 1].classList.remove('d-none');
									self.ViewStack[self.ViewStack.length - 1].classList.add('d-block');
								}
							}, '-=5')
							.add({
								targets: this.$refs.searchBoxInput,
								opacity: [1, 0],
								duration: 100,
								easing: 'easeInOutQuad',
								complete: function(anim) {
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
								complete: function() {
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
				clickedMealPlan: function () {
                    console.log('Clicked meal plan');
                },
				clickedAddRecipe: function() {
					var self = this;
					this.navigateForward(this.$refs.addRecipeView, null, null).then(() => {
						if (self.quillAddRecipeViewInstance === null) {
							self.initAddRecipeViewQuill();
						}
					});
				},
				clickedClearTagFilters: function() {
					this.checkedTagsArray = [];
				},
				clickedClearTimeFilters: function() {
					this.totalRecipeTimeInput = '';
					this.finishByTimeInput = '';
				},
				clickedClearIngredientFilters: function() {
					this.checkedIngredientsArray = [];
				},
				clickedRecipeFromExplorePane: function(index) {
					this.selectRecipe(this.filteredCookbook[index]);
					this.navigateForward(this.$refs.recipeView, null, null);
				},
				clickedRecipeTitleFromSearch: function(index) {
					this.clickedCloseSearch();
					this.selectRecipe(this.searchResults_title[index]);
					this.navigateForward(this.$refs.recipeView, null, null);
				},
				clickedRecipeSectionFromSearch: function(index) {
					this.clickedCloseSearch();
					this.selectRecipe(this.searchResults_sectionTitle[index]);
					this.navigateForward(this.$refs.recipeView, null, null);
				},
				clickedStrikeListItem: function(element) {
					//Find parent element; consider the <li> the parent
					if (element.target.classList.contains('list-group-item')) { //We've got the parent
						element.target.classList.toggle('strike-list-item');
					} else {
						element.srcElement.parentNode.classList.toggle('strike-list-item');
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
				hideHeader: function() {
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
									complete: function() {
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
									complete: function() {
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
								complete: function() {
									resolve();
								}
							}, '+=' + utils.ViewStackAnimationDelayDuration);
	
						//Remove entrance animation for RecipeView
						self.$refs.recipeDetails.classList.remove('show-finished-viewstack');
					});
                },
				editRecipeTitleOnFinishedAnimation: function() {
					//If the app isn't editing
					if (this.detailsDisplayState === 'loading' || this.detailsDisplayState === 'view') return;

					this.$refs.recipeViewTitleInput.focus();
				},
				editRecipeDescriptionAfterAnimation: function(el) {
					if (this.quillRecipeViewInstance === null) {
						this.initRecipeViewQuill();
						this.quillRecipeViewInstance.clipboard.dangerouslyPasteHTML(this.selectedRecipe.description);
						this.quillRecipeViewContent = this.selectedRecipe.description;
					} else {
						this.quillRecipeViewInstance = null;
					}
				},
				/**** Methods ****/
				updateSearchQuery: function(query) {
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
				updateFilteredTags: function(query) {
					this.filteredTagList = [];
					var self = this;
					this.tagList.forEach(tag => {
						if (tag.toLowerCase().includes(query.toLowerCase())) {
							self.filteredTagList.push(tag);
						}
					});
				},
				//Used for when user is typing a query in the Filter By Ingredient search box 
				updateFilteredIngredients: function(query) {
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
					/*
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
					*/

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
						this.filteredCookbook = [];
						return;
					}
					
					this.filteredCookbook = [];
					filterIDs.forEach(id => {
						this.filteredCookbook.push(this.cookbook[id]);
					});
				},
				selectRecipe: function(recipe) {
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
					setTimeout(function() {
						self.$refs.recipeDetails.classList.add('show-finished-viewstack');
					}, timeout);
				},

				/**** RecipeView Methods ****/
				editRecipeDetailsRecipeView: function() {
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

					//TODO: Update to Firebase cloud services

					this.detailsDisplayState = utils.DISPLAY_STATES.VIEW;
				},
				createRecipeTagRecipeView: function() {
					this.tagDisplayState = utils.DISPLAY_STATES.EDIT;
					//this.$refs.tagInputRecipeView.focus();
				},
				addTagRecipeView: function() {
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

					//TODO: Update to Firebase cloud services

					this.tagDisplayState = utils.DISPLAY_STATES.VIEW;
					this.tagAddModel = '';
				},
				deleteRecipeTagRecipeView: function(index) {
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

					//TODO: Update to Firebase cloud services
				},
				editSpecialEquipmentRecipeView: function() {
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

					//TODO: Update to Firebase cloud services

					this.specialEquipmentDisplayState = utils.DISPLAY_STATES.VIEW;
				},
				deleteSpecialEquipmentRecipeView: function(index) {
					this.selectedRecipe.specialEquipment[index].isDeleted = true;
				},
				undoDeleteSpecialEquipmentRecipeView: function(index) {
					this.selectedRecipe.specialEquipment[index].isDeleted = false;
				},
				addSpecialEquipmentRecipeView: function() {
					if (!utils.isString(this.specialEquipmentAddModel)) {
						return false;
					}

					this.selectedRecipe.specialEquipment.push({
						value: this.specialEquipmentAddModel,
						isDeleted: false
					});
					this.specialEquipmentAddModel = '';
				},
				editRecipeNotesRecipeView: function() {
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

					//TODO: Update to Firebase cloud services

					this.notesDisplayState = utils.DISPLAY_STATES.VIEW;
				},
				deleteRecipeNotesRecipeView: function(index) {
					this.selectedRecipe.notes[index].isDeleted = true;
				},
				undoDeleteRecipeNotesRecipeView: function(index) {
					this.selectedRecipe.notes[index].isDeleted = false;
				},
				addRecipeNotesRecipeView: function() {
					if (!utils.isString(this.notesAddModel)) {
						return false;
					}

					this.selectedRecipe.notes.push({
						value: this.notesAddModel,
						isDeleted: false
					});
					this.notesAddModel = '';
				},
				editRecipeIngredientsRecipeView: function() {
					if (this.ingredientsDisplayState === utils.DISPLAY_STATES.VIEW) {
						this.ingredientsDisplayState = utils.DISPLAY_STATES.EDIT;
						return;
					}
					
					this.ingredientsDisplayState = utils.DISPLAY_STATES.LOADING;

					//Remove any deleted items, update interface
					var sections = [];
					for (var i = 0; i < this.selectedRecipe.sections.length; i++) {
						var section = utils.deepClone(this.selectedRecipe.sections[i]);
						section.ingredients = [];
						for (var j = 0; j < this.selectedRecipe.sections[i].ingredients.length; j++) {
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

					for (var i = 0; i < this.selectedRecipe.sections.length; i++) {
						serializedRecipe.sections[i].ingredients = [];
						for (var j = 0; j < this.selectedRecipe.sections[i].ingredients.length; j++) {
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

					//TODO: Update to Firebase cloud services

					this.ingredientsDisplayState = utils.DISPLAY_STATES.VIEW;
				},
				deleteRecipeIngredientsRecipeView: function(sectionIndex, ingredientIndex) {
					this.selectedRecipe.sections[sectionIndex].ingredients[ingredientIndex].isDeleted = true;
				},
				undoDeleteRecipeIngredientsRecipeView: function(sectionIndex, ingredientIndex) {
					this.selectedRecipe.sections[sectionIndex].ingredients[ingredientIndex].isDeleted = false;
				},
				addRecipeIngredientsRecipeView: function(sectionIndex) {
					if (!utils.isString(this.ingredientsAddModel)) {
						return false;
					}

					var ingredientObject = nlp.parseIngredient(this.ingredientsAddModel);
					this.selectedRecipe.sections[sectionIndex].ingredients.push({
						amount: ingredientObject.amount,
						isDeleted: false,
						value: ingredientObject.ingredient
					});
					this.ingredientsAddModel = '';
				},
				editRecipeStepsRecipeView: function() {
					if (this.stepsDisplayState === utils.DISPLAY_STATES.VIEW) {
						this.stepsDisplayState = utils.DISPLAY_STATES.EDIT;
						return;
					}
					
					this.stepsDisplayState = utils.DISPLAY_STATES.LOADING;

					//Remove any deleted items, update interface
					var sections = [];
					for (var i = 0; i < this.selectedRecipe.sections.length; i++) {
						var section = utils.deepClone(this.selectedRecipe.sections[i]);
						section.steps = [];
						for (var j = 0; j < this.selectedRecipe.sections[i].steps.length; j++) {
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
					for (var i = 0; i < this.selectedRecipe.sections.length; i++) {
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

					//TODO: Update to Firebase cloud services

					this.stepsDisplayState = utils.DISPLAY_STATES.VIEW;
				},
				deleteRecipeStepsRecipeView: function(sectionIndex, stepIndex) {
					this.selectedRecipe.sections[sectionIndex].steps[stepIndex].isDeleted = true;
				},
				undoDeleteRecipeStepsRecipeView: function(sectionIndex, stepIndex) {
					this.selectedRecipe.sections[sectionIndex].steps[stepIndex].isDeleted = false;
				},
				addRecipeStepsRecipeView: function(sectionIndex) {
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
				deleteRecipe: function() {
					var id = this.selectedRecipe.id;
					
					//Update flex index
					this.flexSearch.remove(id);
					//Set this recipe to a blank object to effectively remove it from the cookbook
					//The reason we don't splice is because the FlexSearch index is dependent on this recipe's position
					this.cookbook[id] = {};

					//TODO: Delete all shared recipes
					//Call delete recipe endpoint

					this.navigateBackward();
				},
				shareRecipe: function() {
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
					title.innerHTML = this.selectedRecipe.title + ' | Project Pastro';
					doc.head.append(title);
					
					doc.head.append(this.makeHeaderLink('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600&display=swap'));
					doc.head.append(this.makeHeaderLink('https://cdn.jsdelivr.net/npm/bootstrap@5.1.0/dist/css/bootstrap.min.css'));
					doc.head.append(this.makeHeaderLink('https://project-pastro-c95b1.web.app/css/app.css'));
					
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

					this.storage.child('users/' + utils._UID + '/recipes/' + this.selectedRecipe.docID + '/' + uuidv4() + '.html').putString(str).then((snapshot) => {
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
				},
				isRecipeViewInEditMode: function() {
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
				addSpecialEquipmentAddRecipeView: function() {
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
				undoDeleteSpecialEquipmentAddRecipeView: function(index) {
					this.manage_specialEquipmentHolder[index].isDeleted = false;
				},
				addNotesAddRecipeView: function() {
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
				undoDeleteNotesAddRecipeView: function(index) {
					this.manage_recipeNotesHolder[index].isDeleted = false;
				},
				addRecipeSectionAddRecipeView: function() {
					this.manage_recipeSections.push({
						"title": "",
						"ingredients": [],
						"steps": [],
						"nFat": 0,
						"nCholesterol": 0,
						"nSodium": 0,
						"nTotalCarbs": 0,
						"nFiber": 0,
						"nSugar": 0,
						"nProtein": 0 
					});
				},
				addIngredientsAddRecipeView: function(sectionIndex) {
					if (sectionIndex === -1) {
						var ingredient = nlp.parseIngredient(this.$refs.ingredientInputAddRecipeView.value);
						var x = {
							amount: ingredient.amount,
							value: ingredient.ingredient,
							isDeleted: false
						};
						this.manage_recipeSections[0].ingredients.push(x);
						this.$refs.ingredientInputAddRecipeView.value = '';
					} else {
						var ingredient = nlp.parseIngredient(this.$refs.ingredientInputAddRecipeView[sectionIndex].value);
						var x = {
							amount: ingredient.amount,
							value: ingredient.ingredient,
							isDeleted: false
						};
						this.manage_recipeSections[sectionIndex].ingredients.push(x);
						this.$refs.ingredientInputAddRecipeView[sectionIndex].value = '';
					}
					
				},
				deleteIngredientsAddRecipeView: function (sectionIndex, index) {
					this.manage_recipeSections[sectionIndex].ingredients[index].isDeleted = true;
				},
				undoDeleteIngredientsAddRecipeView: function(sectionIndex, index) {
					this.manage_recipeSections[sectionIndex].ingredients[index].isDeleted = false;
				},
				addStepsAddRecipeView: function (sectionIndex) {
					if (sectionIndex === -1) {
						if ((this.$refs.manageStepRef.value.trim() === '' || this.$refs.manageStepRef.value.trim() === null) && this.$refs.manageStepRef.value.length === 0) {
							this.$refs.manageStepRef.classList.add('is-invalid');
							return;
						}
						var x = {
							value: this.$refs.manageStepRef.value.trim(),
							isDeleted: false
						};
						this.manage_recipeSections[0].steps.push(x);
						this.$refs.manageStepRef.value = '';
					} else {
						if ((this.$refs.manageStepRef[sectionIndex].value.trim() === '' || this.$refs.manageStepRef[sectionIndex].value.trim() === null) && this.$refs.manageStepRef[sectionIndex].value.length === 0) {
							this.$refs.manageStepRef.classList.add('is-invalid');
							return;
						}
						var x = {
							value: this.$refs.manageStepRef[sectionIndex].value.trim(),
							isDeleted: false
						};
						this.manage_recipeSections[sectionIndex].steps.push(x);
						this.$refs.manageStepRef[sectionIndex].value = '';
					}
					
					
				},
				deleteStepsAddRecipeView: function (sectionIndex, index) {
					this.manage_recipeSections[sectionIndex].steps[index].isDeleted = true;
				},
				undoDeleteStepsAddRecipeView: function(sectionIndex, index) {
					this.manage_recipeSections[sectionIndex].steps[index].isDeleted = false;
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
						return zeroPad((nowHours + hours) % 24).toString() + ':' + zeroPad(futureMinutes).toString();
					} else {
						return zeroPad(nowHours % 24).toString() + ':' + zeroPad(futureMinutes).toString();
					}
				},
				//When user clicks the button to open their personal billing portal
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
				makeHeaderLink: function(link) {
					var header = document.createElement('link');
					header.rel = 'stylesheet';
					header.href = link;
					return header;
				},
				makeScriptLink: function(link) {
					var script = document.createElement('script');
					script.src = link;
					return script;
				},
				cleanAndPrepareForUpload: function(recipe) {
					//
				},

				/**** 3rd Party Methods & APIs ****/
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
						console.log('OCR clicked');
						//var bsCollapse = new bootstrap.Collapse(self.$refs.ocr_DescriptionFilePond);
						//self.$refs.ocr_DescriptionFilePond.addEventListener('shown.bs.collapse', self.createDescriptionOCR_DOM());
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
									self.quillInstance.setText('Loading...');

									//Perform upload to Firebase storage
									axios.post('http://localhost:5001/project-pastro-c95b1/us-central1/shadowspear', {
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
									axios.post('http://localhost:5001/project-pastro-c95b1/us-central1/shadowspear', {
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
									axios.post('http://localhost:5001/project-pastro-c95b1/us-central1/shadowspear', {
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
								};
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
							break;
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
				
				autofillActiveTime: function () {
					this.manage_recipeActiveTime = (utils.isNumber(this.manage_recipePrepTime) && utils.isNumber(this.manage_recipeCookTime)) ? (parseInt(this.manage_recipePrepTime) + parseInt(this.manage_recipeCookTime)).toString() : 0;
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
						this.$refs.recipeDescriptionRef.classList.add('is-invalid');
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
						/* jshint ignore:start */
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
						/* jshint ignore:end */
					} else {
						anyInvalid = true;
					}

					return;

					/* jshint ignore:start */
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
						//this.index_times.remove(docIDToUpdate, this.filteredCookbook[this.proto_index].totalTime);

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
					/* jshint ignore:end */
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