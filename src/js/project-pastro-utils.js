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
    this._IS_DYSLEXIC_FONT_SET = 'isDyslexicFontSet';

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
        return s.charAt(0).toUpperCase() + s.slice(1);
    }
    this.isBlank = function(toValidate) {
        return parseInt(toValidate) === 0 || toValidate === '';
    }
}