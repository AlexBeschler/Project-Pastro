var ProjectPastroUtils = function () {
    this.errorCollection = null;
    this._FIRSTNAME = '';
    this._PHOTO_URL = '';
    this._USER = null;
    this._UID = null;
    this._isMobile = /Android|iPhone|iPad|iPod|BlackBerry|Windows Phone/g.test(navigator.userAgent || navigator.vendor || window.opera);
    this._PRICE = 'price_1Im2dgCwcvKw4V4OHGN954pX';
    this._TAX_RATES = ['txr_1Im2egCwcvKw4V4O7Cf3wN4g'];
    this._SUCCESS_URL = 'https://pantryrecipes.app/app.html';
    this._CANCEL_URL = 'https://pantryrecipes.app/';
    //this._SUCCESS_URL = 'http://localhost:5000/app.html';
    //this._CANCEL_URL = 'http://localhost:5000/';
    this._STRIPE_CODE = 'pk_test_51IinkiCwcvKw4V4OGf5Yv6eCKrA3tSXGgUUvF6tPmdlpRmgoX4yq8NApouvHn5Q0BkVre82I9qKDECymsTct3MNx00ekEDzexj';
    
    //OptionsView variables
    this.TWELVE_HOUR_FORMAT_SET = 'is12HourFormatSet';
    this.TAGS_CHECKED = 'isTagsChecked';
    this.TIME_CHECKED = 'isTimeChecked';
    this.INGREDIENTS_CHECKED = 'isIngredientsChecked';
    this.DARK_MODE_SET = 'isDarkModeSet';
    this.LEVEL_FONT_SET = 'levelFontSize';
    this.DYSLEXIC_FONT_SET = 'isDyslexicFontSet';
    this.HIGH_CONTRAST_SET = 'isHighContrastModeSet';
    
    this.DISPLAY_STATES = {
        VIEW: "view",
        EDIT: "edit",
        LOADING: "loading"
    };
    this.ViewStackEnterAnimationDuration = 200;
    this.ViewStackExitAnimationDuration = 200;
    this.ViewStackAnimationDelayDuration = 5;

    this.init = function () {
        this.errorCollection = firebase.firestore().collection('errors');
    };

    //Firebase utils
    this.setProfilePhotoURL = function(str) {
        this._PHOTO_URL = str.replace('s96-c', 's492-c');
    };

    //JS utils
    this.deepClone = function (obj) {
        //Used from https://github.com/angus-c/just/tree/master/packages/collection-clone
        if (typeof obj == 'function') {
            return obj;
        }
        var result = Array.isArray(obj) ? [] : {};
        for (var key in obj) {
            // include prototype properties
            var value = obj[key];
            var type = {}.toString.call(value).slice(8, -1);
            if (type == 'Array' || type == 'Object') {
                result[key] = this.deepClone(value);
            } else if (type == 'Date') {
                result[key] = new Date(value.getTime());
            } else if (type == 'RegExp') {
                result[key] = RegExp(value.source, this.getRegExpFlags(value));
            } else {
                result[key] = value;
            }
        }
        return result;
    };
    this.isEmptyArray = function(array) {
        if (array.length === 0) {
            return true;
        }
        //Start with the assumption that array is completely empty
        var isEmpty = true;
        for (var i = 0; i < array.length; i++) {
            if (array[i] !== '') {
                isEmpty = false;
                break;
            }
        }
        return isEmpty;
    };

    this.getRegExpFlags = function (regExp) {
        //Used from https://github.com/angus-c/just/tree/master/packages/collection-clone
        if (typeof regExp.source.flags == 'string') {
            return regExp.source.flags;
        } else {
            var flags = [];
            regExp.global && flags.push('g');
            regExp.ignoreCase && flags.push('i');
            regExp.multiline && flags.push('m');
            regExp.sticky && flags.push('y');
            regExp.unicode && flags.push('u');
            return flags.join('');
        }
    };

    this.copyTextToClipboard = function (text) {
        if (!navigator.clipboard) {
            var textArea = document.createElement("textarea");
            textArea.value = text;

            // Avoid scrolling to bottom
            textArea.style.top = "0";
            textArea.style.left = "0";
            textArea.style.position = "fixed";

            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();

            try {
                var successful = document.execCommand('copy');
                var msg = successful ? 'successful' : 'unsuccessful';
                console.log('Fallback: Copying text command was ' + msg);
            } catch (err) {
                console.error('Fallback: Oops, unable to copy', err);
            }

            document.body.removeChild(textArea);
            return;
        }
        navigator.clipboard.writeText(text).then(function () {
            //Success
        }, function (err) {
            console.error('Async: Could not copy text: ', err);
        });
    };

    //DOM utils
    this.showLoading = function () {
        document.getElementById('login-container').style.visibility = 'hidden';
        document.getElementById('loading').style.visibility = 'visible';
        document.getElementById('appContent').style.visibility = 'hidden';
    };
    this.showLoginContainer = function () {
        document.getElementById('login-container').style.visibility = 'visible';
        document.getElementById('loading').style.visibility = 'hidden';
    };
    this.showCookbook = function () {
        document.getElementById('login-container').remove(); //No need for this anymore
        document.getElementById('loading').style.visibility = 'hidden';
        document.getElementById('appContent').style.visibility = 'visible';
    };
    this.remToPixels = function (rem) {
        return rem * parseFloat(getComputedStyle(document.documentElement).fontSize);
    };
    this.vwToPixels = function (vw) {
        return vw * (Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0) / 100);
    };

    //Local storage utils
    this.getLocalStorage = function (key) {
        var storage = window.localStorage;
        return storage.getItem(key);
    };
    this.setLocalStorage = function (key, value) {
        var storage = window.localStorage;
        storage.setItem(key, value);
    };
    //String and number utilities
    this.isNumber = function (toValidate) {
        return parseInt(toValidate) > 0 && parseInt(toValidate) < 9999 && /^\d+$/.test(parseInt(toValidate));
    };
    this.isString = function (toValidate) {
        return toValidate.trim().length > 0 && toValidate.trim().length < 82;
    };
    //Measure if string is at least one byte and less or equal to 9,999 bytes 
    this.isBigString = function (toValidate) {
        return (new Blob([toValidate]).size >= 1) && (new Blob([toValidate]).size <= 9999);
    };
    this.capitalizeFirstLetter = function (s) {
        return s.trim().charAt(0).toUpperCase() + s.slice(1);
    };
    this.isBlank = function (toValidate) {
        return parseInt(toValidate) === 0 || toValidate === '';
    };
    this.isEmpty = function (toValidate) {
        return (toValidate.length === 0 || !toValidate.trim());
    };
    this.isAllUppercase = function (s) {
        return s === s.toUpperCase();
    };
    this.checkMaximumFirebaseDocumentSize = function(doc) {
        return new Blob([doc]).size <= 1048576;
    };
    //FlexSearch utils
    this.queryNumericIndex = function (index, query) {
        var filterIDs = [];
        for (var i = 0; i < index.length; i++) {
            if (index[i].value <= query) {
                filterIDs.push(index[i].id);
            }
        }
        return _.uniq(filterIDs);
        /*
        queryResults.forEach(x => {
            var o = [];
            //Get indices of specified ingredients
            var qResults = index.search(x, {
                index: 'docID'
            });
            if (qResults.length === 0) {
                return;
            }
            qResults.forEach(q => {
                if (q.field === 'docID') {
                    q.result.forEach(result => {
                        o.push(result);
                    });
                }
            });
            //Push to filterIDs
            filterIDs = _.union(filterIDs, o);
        });
        return filterIDs;
        */
    };
    //FlexSearch utils
    this.queryAndParseFlexSearchResults = function (index, queryResults) {
        var filterIDs = [];
        queryResults.forEach(x => {
            var o = [];
            //Get indices of specified ingredients
            var qResults = index.search(x, {
                index: 'docID'
            });
            if (qResults.length === 0) {
                return;
            }
            qResults.forEach(q => {
                if (q.field === 'docID') {
                    q.result.forEach(result => {
                        o.push(result);
                    });
                }
            });
            //Push to filterIDs
            filterIDs = _.union(filterIDs, o);
        });
        return filterIDs;
    };
    //Crop data utilities
    this.getCropData = function(cropData, canvasData) {
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

        return {
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
    };
    //Error Reporting
    /*
        Usage:
        type: usually just the string 'error'. Allows room for 'warning'
        message: the error message
        description: allows developer context i.e. when the app is uploading offline, write 'user is offline'
    */
    this.reportError = function (type, message, description) {
        if (this.errorCollection === null)
            this.errorCollection = firebase.firestore().collection('errors');
        var docID = uuidv4();
        this.errorCollection.doc(docID).set({
            docID: docID,
            uid: this._UID,
            type: type,
            message: message,
            description: description,
            timestamp: Date.now()
        }).then(() => {
            return 0; //Dummy value
        });
    };
};