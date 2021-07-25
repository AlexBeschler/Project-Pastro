var ProjectPastroUtils = function () {
    this._FIRSTNAME = '';
    this._USER = null;
    this._UID = null;
    this._PRICE = 'price_1Im2dgCwcvKw4V4OHGN954pX';
    this._TAX_RATES = ['txr_1Im2egCwcvKw4V4O7Cf3wN4g'];
    //this._SUCCESS_URL = 'https://project-pastro-c95b1.web.app/app.html';
    //this._CANCEL_URL = 'https://project-pastro-c95b1.web.app';
    this._SUCCESS_URL = 'http://localhost:5000/app.html';
    this._CANCEL_URL = 'http://localhost:5000/';
    this._STRIPE_CODE = 'pk_test_51IinkiCwcvKw4V4OGf5Yv6eCKrA3tSXGgUUvF6tPmdlpRmgoX4yq8NApouvHn5Q0BkVre82I9qKDECymsTct3MNx00ekEDzexj';
    this.DYSLEXIC_FONT_SET = 'isDyslexicFontSet';

    this.init = function () {
        //this._NANOBAR = new Nanobar();
    }

    this.showLoading = function () {
        $('#login-container').css('visibility', 'hidden');
        $('#loading').css('visibility', 'visible');
        $('#appContent').css('visibility', 'hidden');
    }
    this.showLoginContainer = function () {
        $('#login-container').css('visibility', 'visible');
        $('#loading').css('visibility', 'hidden');
    }
    this.showCookbook = function () {
        $('#login-container').remove(); //No need for this anymore
        $('#loading').css('visibility', 'hidden');
        $('#appContent').css('visibility', 'visible');
    }
    this.getLocalStorage = function (key) {
        var storage = window.localStorage;
        return storage.getItem(key);
    }
    this.setLocalStorage = function (key, value) {
        var storage = window.localStorage;
        storage.setItem(key, value);
    }
    //Utilities
    this.insertSortedPosition = function (array, docID, value, toSortBy) {
        var index = {
            docID: docID,
            value: value
        };
        if (array.length > 0) {
            array.splice(_.sortedIndex(array, index, toSortBy), 0, index);
        } else {
            array.push(index);
        }
        return array;
    }
    //Get recipe from cookbook using docID
    this.getRecipeFromID = function (list, toSearch) {
        var low = 0;
        var mid = 0;
        var high = list.length - 1;
        while (low <= high) {
            mid = Math.floor((low + high) / 2);

            if (list[mid].docID === toSearch) {
                return list[mid];
            } else if (list[mid].docID > toSearch) {
                high = mid - 1;
            } else {
                low = mid + 1;
            }
        }
    }
    this.removeIndices = function(index, criteria, docID) {
        criteria = criteria;
        var firstMatchIndex = -1;
        var lastMatchIndex = -1;
        var low = 0;
        var mid = 0;
        var high = index.length - 1;
        while (low <= high) {
            mid = Math.floor((low + high) / 2);

            if (index[mid].value === criteria) {
                lastMatchIndex = mid;
                firstMatchIndex = mid;
                while (lastMatchIndex + 1 < index.length && index[lastMatchIndex + 1].value === criteria) {
                    lastMatchIndex++;
                }
                while (firstMatchIndex - 1 >= 0 && index[firstMatchIndex - 1].value === criteria) {
                    firstMatchIndex--;
                }
                var range = {
                    low: firstMatchIndex,
                    high: lastMatchIndex
                };
                if (firstMatchIndex < 0) {
                    return index;
                }
                //Cycle through range to remove by docID
                while (range.low <= range.high) {
                    if (index[range.low].docID === docID) {
                        index.splice(range.low, 1);
                        //Knock the range high down since we spliced, and offset the low range
                        range.high--;
                        range.low--;
                    }
                    range.low++;
                }
                return index;
            } else if (index[mid].value > criteria) {
                high = mid - 1;
            } else {
                low = mid + 1;
            }
        }
        return index;
    }
    //Perform binary search for all document ids with the specified toSearch from the given list
    //Designed for list to contain duplicates, and list must be array of { docID: xx, value: yy }
    //Returns array of docIDs
    this.getDocIDsFromSortedList_Exact = function (list, toSearch) {
        var docIDs = [];
        var firstMatchIndex = -1;
        var lastMatchIndex = -1;
        var low = 0;
        var mid = 0;
        var high = list.length - 1;
        while (low <= high) {
            mid = Math.floor((low + high) / 2);

            if (list[mid].value === toSearch) {
                lastMatchIndex = mid;
                firstMatchIndex = mid;
                while (lastMatchIndex + 1 < list.length && list[lastMatchIndex + 1].value === toSearch) {
                    lastMatchIndex++;
                }
                while (firstMatchIndex - 1 >= 0 && list[firstMatchIndex - 1].value === toSearch) {
                    firstMatchIndex--;
                }
                var range = {
                    low: firstMatchIndex,
                    high: lastMatchIndex
                };
                if (range.low === range.high) {
                    docIDs.push(list[range.low].docID);
                } else {
                    var x = range.low;
                    while (x <= range.high) {
                        docIDs.push(list[x].docID);
                        x += 1;
                    }
                }
                return docIDs;
            } else if (list[mid].value > toSearch) {
                high = mid - 1;
            } else {
                low = mid + 1;
            }
        }
        return docIDs;
    }
    this.getDocIDsFromSortedList_Range = function (list, toSearch) {
        var docIDs = [];
        var left = 0;
        var right = list.length;
        var mid;

        while (left < right) {
            mid = (right + left) >> 1;

            // Check if key is present in array
            if (list[mid].value == toSearch) {

                // If duplicates are present it returns the position of last element
                while ((mid + 1) < list.length && list[mid + 1].value == toSearch) {
                    mid++;
                }
                break;
            }

            // If key is smaller, ignore right half
            else if (list[mid].value > toSearch)
                right = mid;

            // If key is greater, ignore left half
            else
                left = mid + 1;
        }

        // If key is not found in array then it will be before mid
        while (mid > -1 && list[mid].value > toSearch)
            mid--;

        if (mid == -1) {
            return docIDs;
        } else {
            while (mid >= 0) {
                docIDs.push(list[mid].docID);
                mid -= 1;
            }
        }
        return docIDs;
    }
    this.isNumber = function (toValidate) {
        return parseInt(toValidate) > 0 && parseInt(toValidate) < 9999 && /^\d+$/.test(parseInt(toValidate));
    }
    this.isString = function (toValidate) {
        return toValidate.trim().length > 0 && toValidate.trim().length < 82;
    }
    this.isBigString = function (toValidate) {
        return toValidate.trim().length > 0 & toValidate.trim().length < 9999;
    }
    this.capitalizeFirstLetter = function (s) {
        return s.trim().charAt(0).toUpperCase() + s.slice(1);
    }
    this.isBlank = function (toValidate) {
        return parseInt(toValidate) === 0 || toValidate === '';
    }
}