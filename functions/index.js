const functions = require('firebase-functions');
const admin = require('firebase-admin');

const cors = require('cors')({
    origin: true
});
const axios = require('axios');

admin.initializeApp();

const config = functions.config();
const db = admin.firestore();

exports.createAccount = functions.auth.user().onCreate((user) => {
    const uid = user.uid; //User id of new user
    return createAccount(uid);
});

async function createAccount(uid) {
    db.collection('users').doc(uid).set({
        dyslexicFontSet: 'false'
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

//Notify admin of any application errors
exports.notifyLoggedError = functions.firestore.document('errors/{docId}').onCreate((snap, context) => {
    const o = snap.data();
    console.log(o.type + ' reported for user \'' + o.uid + '\' in document ' + o.docID);
});

exports.ocrTextDetection = functions.https.onRequest((req, res) => {
    cors(req, res, () => {
        const postPicture = async () => {
            try {
                const visionResponse = await axios.post('https://vision.googleapis.com/v1/images:annotate?key=' + config.pastro.cloud_vision_api_key, {
                    "requests": [{
                        "image": {
                            "content": req.body.payload
                        },
                        "features": [{
                            "type": "TEXT_DETECTION"
                        }]
                    }]
                });
                var annotationResponse = [];
                annotationResponse = visionResponse.data.responses[0].textAnnotations;
                /*
                //For debug purposes
                annotationResponse.forEach(element => {
                    console.log(element);
                });
                */
                return res.status(200).send({
                    recognizedText: annotationResponse[0]
                });
            } catch (error) {
                console.log('Error parsing OCR data');
                return res.status(400).send({
                    message: 'Check console'
                });
            }
        }
    });
});