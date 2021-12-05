var ProjectPastroUtils = function () {
    this.errorCollection = null;
    this._FIRSTNAME = '';
    this._USER = null;
    this._UID = null;
    this._isMobile = /Android|iPhone|iPad|iPod|BlackBerry|Windows Phone/g.test(navigator.userAgent || navigator.vendor || window.opera);
    this._PRICE = 'price_1Im2dgCwcvKw4V4OHGN954pX';
    this._TAX_RATES = ['txr_1Im2egCwcvKw4V4O7Cf3wN4g'];
    //this._SUCCESS_URL = 'https://project-pastro-c95b1.web.app/app.html';
    //this._CANCEL_URL = 'https://project-pastro-c95b1.web.app';
    this._SUCCESS_URL = 'http://localhost:5000/app.html';
    this._CANCEL_URL = 'http://localhost:5000/';
    this._STRIPE_CODE = 'pk_test_51IinkiCwcvKw4V4OGf5Yv6eCKrA3tSXGgUUvF6tPmdlpRmgoX4yq8NApouvHn5Q0BkVre82I9qKDECymsTct3MNx00ekEDzexj';
    this.DYSLEXIC_FONT_SET = 'isDyslexicFontSet';
    this.DISPLAY_STATES = {
        VIEW: "view",
        EDIT: "edit",
        LOADING: "loading"
    };

    this.init = function () {
        this.errorCollection = firebase.firestore().collection('errors');
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
    this.isBigString = function (toValidate) {
        return toValidate.trim().length > 0 & toValidate.trim().length < 9999;
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