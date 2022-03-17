/*jshint esversion: 8 */
const functions = require('firebase-functions');
const admin = require('firebase-admin');

const cors = require('cors')({
	origin: true
});
const {
	v4: uuidv4
} = require('uuid');

const vision = require('@google-cloud/vision');
const ocrClient = new vision.ImageAnnotatorClient({
	keyFilename: './project-pastro-c95b1-cb36ad6fa145.json'
});

const stripe = require('stripe')('sk_test_51IinkiCwcvKw4V4OXjDc13g6UysjMtxc5OayoYdo6QJvfb4iiEVP2GGXVbzA2QOG4aDKCaDIhRH5lm6FupBCBt5Z00MGMgQdCG');

const XRegExp = require('xregexp');
const unicodeLettersNumbersPunctuationRegex = new XRegExp("[^\\p{N}\\p{L}\\p{P} ⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅚⅜⅝⅞¼½¾]", "g");
const sanitizeDash = new XRegExp("[-–—−]", "g");

const _ = require('underscore');

const jsdom = require('jsdom');
const {
	JSDOM
} = jsdom;


admin.initializeApp();

if (process.env.NODE_ENV === 'development') {
	firebase.functions().useFunctionsEmulator('http://localhost:5001');
}

//const config = functions.config();
const db = admin.firestore();

const ProjectPastroNLP = function () {
	this.ingredientObject = {
		amount: '',
		ingredient: ''
	};

	this.parseIngredient = function (str) {
		var r = this.cleanAndTokenize(str);
		if (r === null) {
			return {
				amount: '',
				ingredient: ''
			};
		}

		if (typeof r === 'string') {
			return {
				amount: '',
				ingredient: r
			};
		}

		this.ingredientObject = {
			amount: '',
			ingredient: ''
		};
		this.identifyEntities(r, 0);
		return this.ingredientObject;
	};

	this.cleanAndTokenize = function (str) {
		//Clean up data
		var t = XRegExp.replace(str, unicodeLettersNumbersPunctuationRegex, '');
		t = t.replace(/\s+/g, ' ').trim(); //Remove any additional whitespace and trim string and set to lowercase
		//Make sure there's a space between the dashes
		if (t.includes('-') || t.includes('–') || t.includes('—') || t.includes('−')) {
			t = XRegExp.replace(t, sanitizeDash, '-');
		}
		var r = t.split(' '); //Split by words

		//Make simple decisions
		if (r.length === 0) {
			return null;
		} //Blank
		if (r.length === 1) { //Send to ingredients
			return t;
		}

		//Check if the first 3 words contain a dash and if it has properly been separated with spaces
		let w = false;
		let l = r.length === 2 ? 2 : 3;
		var dashRegEx = /(?: - )/g;
		for (var i = 0; i < l; i++) {
			if (r[i].includes('-')) {
				if (!dashRegEx.test(r[i])) {
					t = t.slice(0, t.search(/\-/)) + ' - ' + t.slice(t.search(/\-/) + 1);
					w = true;
					break;
				}
			}
		}
		if (w) {
			r = t.split(' '); //Re-split sample with newly added isolated dash
		}
		return r;
	};

	this.identifyEntities = function (arr, offsetIndex) {
		//Use simple NLP to parse ingredients
		var firstWord = arr[0 + offsetIndex];
		var secondWord = arr[1 + offsetIndex];
		//Match the first word to the cardinal dictionary OR any string that contains a '/' and is 5 or less characters
		//A successful match means we've identified the first word to be cardinal
		if (_.contains(cardinal_dictionary, firstWord.toLowerCase()) || (firstWord.length <= 5 && firstWord.length >= 1 && firstWord.includes('/')) || (firstWord.length <= 5 && firstWord.length > 1 && firstWord.includes('.'))) {
			if (offsetIndex > 0) {
				let b = ' ' + firstWord;
				this.ingredientObject.amount += b;
			} else {
				this.ingredientObject.amount = firstWord;
			}

			if (_.contains(unit_dictionary, secondWord.toLowerCase())) {
				//Match the second word to units dictionary.
				//A successful match means we've identified the second word to be a unit of some sort, and we can finish up
				let u = ' ' + secondWord;
				this.ingredientObject.amount += u;
				//We don't know how long the array is, so this is a safer way of building the string
				this.ingredientObject.ingredient = this.strBuilder(arr, 1 + offsetIndex, arr.length);
			} else if (_.contains(cardinal_dictionary, secondWord.toLowerCase()) || (secondWord.length <= 5 && secondWord.length >= 1 && secondWord.includes('/')) || (secondWord.length <= 5 && secondWord.length > 1 && secondWord.includes('.'))) {
				if (offsetIndex < 4) { //Prevent exceeding maximum stack call size
					this.identifyEntities(arr, offsetIndex + 1);
				} //otherwise, simply guess the user is intentionally trying to crash the app and do nothing
			} else {
				var thirdWord = arr[2 + offsetIndex];
				//Check the compound units dictionary
				if (arr.length >= 3) {
					//A special exception for lines like "2 to 3 tbps fresh parsley" or "2 to 3 eggs"
					if (secondWord === 'to' || secondWord === '-') {
						var fourthWord = '';
						if (arr.length >= 4) {
							fourthWord = arr[3 + offsetIndex];
							if (_.contains(cardinal_dictionary, thirdWord.toLowerCase()) || (thirdWord.length <= 5 && thirdWord.length >= 1 && thirdWord.includes('/')) || (thirdWord.length <= 5 && thirdWord.length > 1 && thirdWord.includes('.'))) {
								let k = ' ' + secondWord + ' ' + thirdWord;
								this.ingredientObject.amount += k;
								//Now we look for unit
								if (_.contains(unit_dictionary, fourthWord.toLowerCase())) {
									let v = ' ' + fourthWord;
									this.ingredientObject.amount += v;
									//We don't know how long the array is, so this is a safer way of building the string
									this.ingredientObject.ingredient = this.strBuilder(arr, 3 + offsetIndex, arr.length);
								} else {
									//Make exception for compound units dictionary
									var fifthWord = '';
									if (arr.length >= 5) {
										fifthWord = arr[4 + offsetIndex];
										var query = fourthWord + ' ' + fifthWord;
										if (_.contains(unit_compound_dictionary, query.toLowerCase())) {
											//Add first, second, and third word to amount
											let u = ' ' + query;
											this.ingredientObject.amount += u;
											//We don't know how long the array is, so this is a safer way of building the string
											this.ingredientObject.ingredient = this.strBuilder(arr, 4 + offsetIndex, arr.length);
										} else {
											this.ingredientObject.ingredient = this.strBuilder(arr, 2 + offsetIndex, arr.length);
										}
									} else {
										//Not the special exception
										this.ingredientObject.ingredient = secondWord + ' ' + thirdWord + ' ' + fourthWord;
									}
								}
							} else {
								//Not sure what's going on, but ok
								this.ingredientObject.ingredient = secondWord + ' ' + thirdWord;
							}
						} else {
							//Not sure what's going on, but ok
							this.ingredientObject.ingredient = secondWord + ' ' + thirdWord;
						}
					} else {
						var query = secondWord + ' ' + thirdWord; //jshint ignore:line
						if (_.contains(unit_compound_dictionary, query.toLowerCase())) {
							//Add first, second, and third word to amount
							let u = ' ' + query;
							this.ingredientObject.amount += u;
							//We don't know how long the array is, so this is a safer way of building the string
							this.ingredientObject.ingredient = this.strBuilder(arr, 2 + offsetIndex, arr.length);
						} else {
							//This might be an instance of '3 eggs, beaten' or related ingredients
							//Just add the remaining array to the ingredients
							this.ingredientObject.ingredient = this.strBuilder(arr, 0 + offsetIndex, arr.length);
						}
					}
				} else {
					//This might be an instance of '3 eggs' or related ingredients
					//Just add the remaining string to the ingredients
					this.ingredientObject.ingredient = secondWord;
				}
			}
		} else {
			this.ingredientObject.ingredient = arr.join(' ').trim(); //Move everything to the ingredient
		}
	};

	this.strBuilder = function (arr, startIndex, endLength) {
		var s = '';
		for (var i = startIndex; i < endLength; i++) {
			if (i === startIndex) continue; //No need for this
			s += arr[i];
			if (i === endLength - 1) {
				continue; //No need for the trailing whitespace
			}
			s += ' ';
		}
		return s;
	};
};

function processOCR(res, compressParagraphs) {
	var blocks = res.pages[0].blocks;

	var paragraphs = [];
	var line = '';
	for (var i = 0; i < blocks.length; i++) {
		//Get current line from paragraph
		var paragraph = blocks[i].paragraphs[0]; //Each block seems to have only 1 paragraph
		paragraph.words.forEach(word => { //jshint ignore:line
			line += word.symbols.map(s => s.text).join('');
			line += ' ';
		});

		//Do lookahead vertices analysis
		if (i + 1 < blocks.length && compressParagraphs) {
			//We want to compare the top rectangle to the bottom rectangle, accounting for slope 
			// (because users don't take perfectly centered images).
			// If the 2 rectangles have 100 px or more space between them, arbitrarily decide
			// to call the 2nd rectangle a new paragraph

			//Get bounding box for current block
			var vertices1 = blocks[i].boundingBox.vertices;
			var vertices2 = blocks[i + 1].boundingBox.vertices;

			//Top box point 1
			var xTop1 = vertices1[3].x;
			var yTop1 = vertices1[3].y;
			//Top box point 2
			var xTop2 = vertices1[2].x;
			var yTop2 = vertices1[2].y;

			//Bottom box point 1
			var xBottom1 = vertices2[0].x;
			var yBottom1 = vertices2[0].y;
			//Bottom box point 2
			var xBottom2 = vertices2[1].x;
			var yBottom2 = vertices2[1].y;

			//Get slopes
			var slope1 = Math.abs((yTop2 - yTop1) / (xTop2 - xTop1));
			var slope2 = Math.abs((yBottom2 - yBottom1) / (xBottom2 - xBottom1));
			if ((yBottom1 / (1 + slope2)) - (yTop1 / (1 + slope1)) >= 100) {
				//It's a new paragraph
				paragraphs.push(naturalize(line.trim()));
				line = '';
			}
		} else {
			paragraphs.push(naturalize(line.trim()));
			line = '';
		}
	}

	return compressParagraphs ? paragraphs.join('\n') : paragraphs;
}

//Text may contain:
// All uppercase;
// Word-breaking hyphenations 
function naturalize(paragraph) {
	//Break up by sentence
	var sentences = paragraph.split('.');
	var result = '';
	sentences.forEach(sentence => {
		//If text is in all caps, only capitalize first letter
		if (sentence === sentence.toUpperCase()) {
			sentence = sentence.toLowerCase();
			sentence = sentence.trim().charAt(0).toUpperCase() + sentence.slice(1);
		}

		//Scans paragraph for "automatic hyphenation" dashes.
		//Identify if the context is an amount of something, otherwise remove it
		if (sentence.includes('-')) {
			let index = sentence.indexOf('-');
			//Get the word before the dash
			let stack = [];
			while (index >= 0 || sentence[index] === ' ') {
				stack.push(sentence[index]);
				index--;
			}
			let sample = [];
			for (var i = 0; i < stack.length; i++) {
				sample.push(stack.pop());
			}
			//Get the word after the dash. Keep in mind - with automated hyphens there's sometimes a space directly after
			index = sentence.indexOf('-');
			if (index + 1 < sentence.length) { //Just to make sure
				if (sentence[index + 1] === ' ') {
					index += 2;
				} else {
					index += 1;
				}
				do {
					sample.push(sentence[index]);
					index++;
				} while (index < sentence.length || sentence[index] === ' ');
				var nlp = new ProjectPastroNLP();
				var r = nlp.parseIngredient(sample.join(''));

				//Means we can remove the dash and space right after
				if (r.amount === '') {
					index = sentence.indexOf('-');
					sentence = sentence.replace(sentence.substring(index, index + 2), '');
				}
			}
		}

		result += sentence;
		result += '.';
	});
	//Remove last '.' at the end of the string
	result = result.substring(0, result.length - 1);
	return result;
}

exports.createAccount = functions.auth.user().onCreate((user) => {
	const uid = user.uid; //User id of new user
	return createAccount(uid);
});

async function createAccount(uid) {
	db.collection('users').doc(uid).set({
		is12HourFormatSet: true,
		isTagsChecked: true,
		isTimeChecked: true,
		isIngredientsChecked: true,
		isDarkModeSet: false,
		levelFontSize: 1,
		isDyslexicFontSet: false,
		isHighContrastModeSet: false
	}).then(function () {
		var helloWorldRecipe = db.collection('users/' + uid + '/recipes').doc('helloworld_recipe');
		helloWorldRecipe.set({
			'activeTime': 12,
			'addDate': Date.now(),
			'blocks': [{
				'header': 'Header 1',
				'nCalories': '0',
				'nCarbohydrate': '0',
				'nCholesterol': '0',
				'nFat': '0',
				'nFiber': '0',
				'nProtein': '0',
				'nSodium': '0',
				'nSugars': '0',
				'ingredients': [{
					'amount': 'amount 1',
					'value': 'value 1'
				}],
				'steps': [{
					'value': 'step 1'
				}]
			}],
			'cookTime': 12,
			'coverPhotoURL': null,
			'description': '<p>Hello World</p>',
			'docID': 'helloworld_recipe',
			'prepTime': 12,
			'tags': [
				'Hello World Tag 1',
				'Hello World Tag 2'
			],
			'title': 'Hello World Recipe',
			'totalTime': 12,
			'yield': '2 servings'
		}).then(function () {
			//Send onboard email?
			console.log('Wrote hello world recipe to user ' + uid);
		}).catch(function (error) {
			//Notify admins
			console.error('Error writing hello world recipe: ', error);
		});
	}).catch(function (error) {
		console.error('Error writing default font set: ', error);
	});
}

exports.shadowspear = functions.https.onRequest((req, res) => {
	cors(req, res, () => {
		visionImageAnnotator(req, res);
	});
});

async function visionImageAnnotator(req, res) {
	try {
		const [result] = await ocrClient.textDetection(req.body.fileLocation);
		const detections = result.fullTextAnnotation;
		var toSend = processOCR(detections, req.body.compressParagraphs);
		return res.status(200).send({
			recognizedText: toSend
		});
	} catch (error) {
		var docID = uuidv4();
		reportError(docID, 'Error', error.toString());
		return res.status(400).send({
			message: docID.toString()
		});
	}
}

/* Recipe Utilities */
/* 
async function deleteCollection(db, collectionPath, batchSize) {
	const collectionRef = db.collection(collectionPath);
	const query = collectionRef.orderBy('__name__').limit(batchSize);

	return new Promise((resolve, reject) => {
		deleteQueryBatch(db, query, resolve).catch(reject);
	});
}

async function deleteQueryBatch(db, query, resolve) {
	const snapshot = await query.get();

	const batchSize = snapshot.size;
	if (batchSize === 0) {
		// When there are no documents left, we are done
		resolve();
		return;
	}

	// Delete documents in a batch
	const batch = db.batch();
	snapshot.docs.forEach((doc) => {
		batch.delete(doc.ref);
	});
	await batch.commit();

	// Recurse on the next process tick, to avoid
	// exploding the stack.
	process.nextTick(() => {
		deleteQueryBatch(db, query, resolve);
	});
}
*/

/* 
 * Website parser
 */

exports.embercleave = functions.https.onRequest((req, res) => {
	
	
	
	//TODO: Check for an empty request
	
	
	
	cors(req, res, () => {
		var options = {
			headers: {
				Referer: req.body.url,
				'X-Requested-With': 'XMLHttpRequest'
			}
		};
		JSDOM.fromURL(req.body.url, options).then(dom => {
			parseHTML(dom).then((recipe) => {
				return res.status(200).send({
					response: recipe
				});
			}).catch((error) => {
				//
			});
		});
		/*
		.catch(function (error) {
			return res.status(201).send({
				error: error.toString()
			});
		});
		*/
	});
});

const parseHTML = function (dom) {
	return new Promise(function (resolve, reject) {
		var recipe = {};
		var html = dom.serialize();

		var parsedDOM = new JSDOM(html);

		//Get recipe name
		var name = parsedDOM.window.document.querySelector('head > title').innerHTML;
		//recipe.name = name;
		var token = '';
		if (name.includes('|')) {
			token = '|';
		} else if (name.includes('—')) {
			token = '—';
		} else if (name.includes('–')) {
			token = '–';
		} else if (name.includes('-')) {
			token = '-';
		}
		recipe.name = token !== '' ? name.split(token)[0].trim() : name.trim();

		//Get ingredients
		var body = parsedDOM.window.document.body;
		var sections = body.querySelectorAll('section');
		var articles = body.querySelectorAll('article');

		//if (domHas(sections, ingredientsWebScraperTerms)) {
			//recipe.ingredients = true;
		//} else {
			if (domHas(articles, ingredientsWebScraperTerms)) {
				recipe.ingredients = true;
			} else {
				recipe.ingredients = false;
			}
		//}

		recipe.dom = html;

		//Do steps here

		resolve(recipe);
	});
};

function domHas(DOM, textToSearch) {
	if (typeof DOM == 'undefined') return false;
	
	DOM.forEach(node => {
		if (allDescendants(node, textToSearch)) {
			return true;
		}
	});
}

function allDescendants(node, textToSearch) {
	for (var i = 0; i < node.childNodes.length; i++) {
		var child = node.childNodes[i];
		//Check innerHTML for the given text
		if (child.innerHTML != undefined && child.innerHTML !== 'undefined' && child.innerHTML !== null) {
			var res = false;
			textToSearch.forEach(t => { //jshint ignore:line
				if (child.innerHTML.trim().toLowerCase().includes(t.trim().toLowerCase())) {
					res = true;
				}
			});
			if (res) {
				//TODO: Call DOM parse for extracting ingredients
				return true;
			} else {
				allDescendants(child, textToSearch);
			}
		} else {
			allDescendants(child, textToSearch);
		}
	}
	return false;
}

exports.getAdminMetrics = functions.https.onRequest((req, res) => {
	cors(req, res, () => {
		getMetrics(req, res);
	});
});

async function getMetrics(req, res) {
	var stripeBalance = await getStripeBalance();
	return res.status(200).send({
		stripeBalance: stripeBalance
	});
}

async function getStripeBalance() {
	return new Promise((resolve, reject) => {
		stripe.balance.retrieve(function (error, balance) {
			resolve(balance);
		});
	});
}

//Notify admin of any Pastro errors
exports.notifyLoggedError = functions.firestore.document('errors/{docId}').onCreate((snap, context) => {
	const o = snap.data();
	console.log(o.type + ' reported for user \'' + o.uid + '\' in document ' + o.docID);
	return 0; //Dummy value
});

//Notify of any Functions errors
exports.notifyFunctionsError = functions.firestore.document('functions_errors/{docId}').onCreate((snap, context) => {
	const o = snap.data();
	console.log(o.type + ' reported: ' + o.message);
	return 0; //Dummy value
});

//Util functions
function reportError(docID, type, message) {
	var error = db.collection('functions_errors').doc(docID);
	error.set({
		type: type,
		message: message,
		timestamp: Date.now()
	}).then(function () {
		return 0;
	}).catch(function (error) {
		console.log(error);
		return -1;
	});
}

const cardinal_dictionary = [
	'one',
	'two',
	'three',
	'four',
	'five',
	'six',
	'seven',
	'eight',
	'nine',
	'ten',
	'50',
	'49',
	'48',
	'47',
	'46',
	'45',
	'44',
	'43',
	'42',
	'41',
	'40',
	'39',
	'38',
	'37',
	'36',
	'35',
	'34',
	'33',
	'32',
	'31',
	'30',
	'29',
	'28',
	'27',
	'26',
	'25',
	'24',
	'23',
	'22',
	'21',
	'20',
	'19',
	'18',
	'17',
	'16',
	'15',
	'14',
	'13',
	'12',
	'11',
	'10',
	'9',
	'8',
	'7',
	'6',
	'5',
	'4',
	'3',
	'2',
	'1'
];

const unit_dictionary = [
	'can',
	'cans',
	'cn',
	'cn.',
	'cups',
	'cup',
	'c',
	'c.',
	'teaspoons',
	'teaspoon',
	'ts',
	'tsp',
	'tps.',
	'tablespoons',
	'tablespoon',
	'tb',
	'tb.',
	'tbps',
	'tbps.',
	'packet',
	'packets',
	'pkt',
	'ptk.',
	'ptks',
	'ptks.',
	'ounces',
	'ounce',
	'oz',
	'oz.',
	'ozs',
	'ozs.',
	'pinches',
	'pinch',
	'pn',
	'pn.',
	'sticks',
	'stick',
	'dozen',
	'doz',
	'doz.',
	'sheet',
	'sheets',
	'pounds',
	'pound',
	'lbs',
	'lb',
	'lb.',
	'lbs',
	'lbs.',
	'quart',
	'quarts',
	'qt',
	'qt.',
	'qts',
	'qts.',
	'pint',
	'pints',
	'pt',
	'pt.',
	'pts',
	'pts.',
	'bunch',
	'bunches',
	'bch',
	'bch.',
	'bchs',
	'bchs.',
	'bn',
	'bn.',
	'bottle',
	'bottles',
	'btl',
	'btls',
	'btl.',
	'btls.',
	'centiliter',
	'centiliters',
	'c/l',
	'deciliter',
	'deciliters',
	'da/l',
	'di/l',
	'drop',
	'drops',
	'dp',
	'dp.',
	'dash',
	'dashes',
	'ds',
	'ds.',
	'gallon',
	'gallons',
	'gal',
	'gal.',
	'gal',
	'gal.',
	'gals',
	'gals.',
	'gals',
	'gals.',
	'gram',
	'grams',
	'g',
	'g.',
	'gm',
	'gm.',
	'gr',
	'gr.',
	'gms',
	'gms.',
	'milligram',
	'milligrams',
	'mg',
	'mg.',
	'milliliters',
	'mL',
	'ml',
	'ml.',
	'm/l',
	'hectoliter',
	'hectoliters',
	'h/l',
	'h/l.',
	'kilogram',
	'kilograms',
	'k',
	'k.',
	'kg',
	'kg.',
	'kgs',
	'kgs.',
	'kiloliter',
	'kiloliters',
	'k/l',
	'liter',
	'liters',
	'l',
	'l.',
	'stone',
	'stones',
	'st',
	'st.'
];

const unit_compound_dictionary = [
	'fluid ounce',
	'fluid ounces',
	'fluid oz',
	'fl oz',
	'fl. oz.',
	'fl. oz',
	'fl oz.'
];

const ingredientsWebScraperTerms = [
	'ingredient'
];