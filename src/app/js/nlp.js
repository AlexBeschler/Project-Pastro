/*jshint esversion: 9 */
var ProjectPastroNLP = function () {
    this.cardinal_dictionary = [
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
        'eleven',
        'twelve',
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
        '1',
        '1/2',
        '1/3',
        '1/4',
        '2/3',
        '3/4',
        '1/8' 
    ];
    this.unit_dictionary = [
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
        'tbsp',
        'tbsp.',
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
    this.unit_compound_dictionary = [
        'fluid ounce',
        'fluid ounces',
        'fluid oz',
        'fl oz',
        'fl. oz.',
        'fl. oz',
        'fl oz.'
    ];
    this.ingredientObject = {
        amount: '',
        ingredient: ''
    };
    this.unicodeLettersNumbersPunctuationRegex = null;
    this.sanitizeDash = null;

    this.init = function () {
        this.unicodeLettersNumbersPunctuationRegex = new XRegExp("[^\\p{N}\\p{L}\\p{P} ⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅚⅜⅝⅞¼½¾]", "g");
        this.sanitizeDash = new XRegExp("[-–—−]", "g");
    };
    this.parseIngredient = function (str) {
        if (!str) {
            return {
                amount: '',
                ingredient: ''
            };
        }
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
        var t = XRegExp.replace(str, this.unicodeLettersNumbersPunctuationRegex, '');
        t = t.replace(/\s+/g, ' ').trim(); //Remove any additional whitespace and trim string and set to lowercase
        //Make sure there's a space between the dashes
        if (t.includes('-') || t.includes('–') || t.includes('—') || t.includes('−')) {
            t = XRegExp.replace(t, this.sanitizeDash, '-');
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
        var w = false;
        var l = r.length === 2 ? 2 : 3;
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
        if (_.contains(this.cardinal_dictionary, firstWord.toLowerCase()) || (firstWord.length <= 5 && firstWord.length >= 1 && firstWord.includes('/')) || (firstWord.length <= 5 && firstWord.length > 1 && firstWord.includes('.'))) {
            if (offsetIndex > 0) {
                var b = ' ' + firstWord;
                this.ingredientObject.amount += b;
            } else {
                this.ingredientObject.amount = firstWord;
            }

            if (_.contains(this.unit_dictionary, secondWord.toLowerCase())) {
                //Match the second word to units dictionary.
                //A successful match means we've identified the second word to be a unit of some sort, and we can finish up
                var u = ' ' + secondWord;
                this.ingredientObject.amount += u;
                //We don't know how long the array is, so this is a safer way of building the string
                this.ingredientObject.ingredient = this.strBuilder(arr, 1 + offsetIndex, arr.length);
            } else if (_.contains(this.cardinal_dictionary, secondWord.toLowerCase()) || (secondWord.length <= 5 && secondWord.length >= 1 && secondWord.includes('/')) || (secondWord.length <= 5 && secondWord.length > 1 && secondWord.includes('.'))) {
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
                            if (_.contains(this.cardinal_dictionary, thirdWord.toLowerCase()) || (thirdWord.length <= 5 && thirdWord.length >= 1 && thirdWord.includes('/')) || (thirdWord.length <= 5 && thirdWord.length > 1 && thirdWord.includes('.'))) {
                                let k = ' ' + secondWord + ' ' + thirdWord;
                                this.ingredientObject.amount += k;
                                //Now we look for unit
                                if (_.contains(this.unit_dictionary, fourthWord.toLowerCase())) {
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
                                        if (_.contains(this.unit_compound_dictionary, query.toLowerCase())) {
                                            //Add first, second, and third word to amount
                                            var u = ' ' + query;
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
                        var query = secondWord + ' ' + thirdWord;
                        if (_.contains(this.unit_compound_dictionary, query.toLowerCase())) {
                            //Add first, second, and third word to amount
                            var u = ' ' + query;
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

    this.strBuilder = function(arr, startIndex, endLength) {
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