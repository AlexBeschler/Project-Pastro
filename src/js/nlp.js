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
    this.unicodeLettersNumbersPunctuationRegex = null;
    
    this.init = function() {
        this.unicodeLettersNumbersPunctuationRegex = new XRegExp("[^\\p{N}\\p{L}\\p{P} ⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅚⅜⅝⅞¼½¾]","g");
    }
    this.parseIngredients = function (str) {
        var ingredientObject = {
            amount: '',
            ingredient: ''
        };
        var t = XRegExp.replace(str, this.unicodeLettersNumbersPunctuationRegex, '');
        t = t.replace(/\s+/g, ' ').trim().toLowerCase(); //Remove any additional whitespace and trim string and set to lowercase
        var r = t.split(' '); //Split by words
        if (r.length === 0) {} //Blank
        if (r.length === 1) { //Send to ingredients
            ingredientObject.ingredient = r[0];
        }
        if (r.length >= 2) {
            var firstWord = r[0];
            var secondWord = r[1];
            //Match the first word to the cardinal dictionary OR any string that contains a '/' and is 5 or less characters
            //A successful match means we've identified the first word to be cardinal
            if (_.contains(this.cardinal_dictionary, firstWord) || (firstWord.length <= 5 && firstWord.length >= 1 && firstWord.includes('/'))) {
                ingredientObject.amount = firstWord;
                if (_.contains(this.unit_dictionary, secondWord)) {
                    //Match the second word to units dictionary.
                    //A successful match means we've identified the second word to be a unit of some sort, and we can finish up
                    let u = ' ' + secondWord;
                    ingredientObject.amount += u;
                    //We don't know how long the array is, so this is a safer way of building the string
                    var q = '';
                    for (var i = 1; i < r.length; i++) {
                        if (i === 1) continue; //No need for this
                        q += r[i];
                        if (i === r.length - 1) continue; //No need for the trailing whitespace
                        q += ' ';
                    }
                    ingredientObject.ingredient = q;
                } else {
                    var thirdWord = r[2];
                    //Check the compound units dictionary
                    if (r.length >= 3) {
                        //A special exception for lines like "2 to 3 tbps fresh parsley" or "2 to 3 eggs"
                        if (secondWord === 'to') {
                            var fourthWord = '';
                            if (r.length >= 4) {
                                fourthWord = r[3];
                                if (_.contains(this.cardinal_dictionary, thirdWord) || (thirdWord.length <= 5 && thirdWord.length >= 1 && thirdWord.includes('/'))) {
                                    let k = ' ' + secondWord + ' ' + thirdWord;
                                    ingredientObject.amount += k;
                                    //Now we look for unit
                                    if (_.contains(this.unit_dictionary, fourthWord)) {
                                        let v = ' ' + fourthWord;
                                        ingredientObject.amount += v;
                                        //We don't know how long the array is, so this is a safer way of building the string
                                        var s = '';
                                        for (var i = 3; i < r.length; i++) {
                                            if (i === 3) continue; //No need for this
                                            s += r[i];
                                            if (i === r.length - 1) continue; //No need for the trailing whitespace
                                            s += ' ';
                                        }
                                        ingredientObject.ingredient = s;
                                    } else {
                                        //Make exception for compound units dictionary
                                        var fifthWord = '';
                                        if (r.length >= 5) {
                                            fifthWord = r[4];
                                            var query = fourthWord + ' ' + fifthWord;
                                            if (_.contains(this.unit_compound_dictionary, query)) {
                                                //Add first, second, and third word to amount
                                                let u = ' ' + query;
                                                ingredientObject.amount += u;
                                                //We don't know how long the array is, so this is a safer way of building the string
                                                var q = '';
                                                for (var i = 4; i < r.length; i++) {
                                                    if (i === 4) continue; //No need for this
                                                    q += r[i];
                                                    if (i === r.length - 1) {
                                                        continue; //No need for the trailing whitespace
                                                    }
                                                    q += ' ';
                                                }
                                                ingredientObject.ingredient = q;
                                            } else {
                                                var q = '';
                                                for (var i = 2; i < r.length; i++) {
                                                    if (i === 2) continue; //No need for this
                                                    q += r[i];
                                                    if (i === r.length - 1) {
                                                        continue; //No need for the trailing whitespace
                                                    }
                                                    q += ' ';
                                                }
                                                ingredientObject.ingredient = q;
                                            }
                                        } else {
                                            //Not the special exception
                                            ingredientObject.ingredient = secondWord + ' ' + thirdWord + ' ' + fourthWord;
                                        }
                                    }
                                } else {
                                    //Not sure what's going on, but ok
                                    ingredientObject.ingredient = secondWord + ' ' + thirdWord;
                                }
                            } else {
                                //Not sure what's going on, but ok
                                ingredientObject.ingredient = secondWord + ' ' + thirdWord;
                            }
                        } else {
                            var query = secondWord + ' ' + thirdWord;
                            if (_.contains(this.unit_compound_dictionary, query)) {
                                //Add first, second, and third word to amount
                                let u = ' ' + query;
                                ingredientObject.amount += u;
                                //We don't know how long the array is, so this is a safer way of building the string
                                var q = '';
                                for (var i = 2; i < r.length; i++) {
                                    if (i === 2) continue; //No need for this
                                    q += r[i];
                                    if (i === r.length - 1) {
                                        continue; //No need for the trailing whitespace
                                    }
                                    q += ' ';
                                }
                                ingredientObject.ingredient = q;
                            } else {
                                //This might be an instance of '3 eggs, beaten' or related ingredients
                                //Just add the remaining array to the ingredients
                                var q = '';
                                for (var i = 0; i < r.length; i++) {
                                    if (i === 0) continue; //No need for this
                                    q += r[i];
                                    if (i === r.length - 1) {
                                        continue; //No need for the trailing whitespace
                                    }
                                    q += ' ';
                                }
                                ingredientObject.ingredient = q;
                            }
                        }
                    } else {
                        //This might be an instance of '3 eggs' or related ingredients
                        //Just add the remaining string to the ingredients
                        ingredientObject.ingredient = secondWord;
                    }
                }
            } else {
                ingredientObject.ingredient = t; //Move everything to the ingredient
            }
        }
        return ingredientObject;
    }
}