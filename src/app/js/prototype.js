/*jshint esversion: 9 */
import {
    // The editor factory method
    appendEditor,

    // Import the default image reader and writer
    createDefaultImageReader,
    createDefaultImageWriter,

    // The method used to register the plugins
    setPlugins,

    // The plugins we want to use
    plugin_crop,
    plugin_resize,

    // The user interface and plugin locale objects
    locale_en_gb,
    plugin_crop_locale_en_gb,
    plugin_resize_locale_en_gb
} from '../vendor/pintura/pintura.js';

setPlugins(plugin_crop, plugin_resize);

(function () {
    window.addEventListener('load', function () {
        var utils = new ProjectPastroUtils();
        var nlp = new ProjectPastroNLP();
        nlp.init();

        //Load vue dependencies
		Vue.use('vue-slicksort');
		//List group draggables
		Vue.component('draggable-list-group', {
			mixins: [ContainerMixin],
			template: '#draggable-list-group-template'
		});
        Vue.component('addrecipeview-step-draggable-item', {
			mixins: [ElementMixin],
			props: ['step'],
			template: '#addrecipeview-step-draggable-item-template'
		});

        new Vue({
            el: '#appContent',
            data: {
                /* Add Recipe View States */
                showStep1: true,
                showStep2: false,
                showStep3: false,
                showStep4: false,
                //Add recipe name
                addRecipe_recipeName: '',
                //Add recipe tags
                addRecipe_recipeTags: [],
                //Add recipe prep time
                addRecipe_recipePrepTime: 0,
                //Add recipe cook time
                addRecipe_recipeCookTime: 0,
                //Add recipe total time
                addRecipe_recipeTotalTime: 0,
                //Add recipe yield time
                addRecipe_recipeYield: '',
                //Add recipe ingredients input
                addRecipe_recipeIngredientsInput: '',
                //Add recipe steps input
                addRecipe_recipeStepsInput: '',

                recipeIngredientBreakdown: [],
                recipeStepBreakdown: [],

                //Added Recipe Animation Controllers
                addRecipe_isUploading: false,
                addRecipe_isFinishedUploading: false,

                /* Pintura Variables */
                //Pintura photo edit result
                showPinturaCoverPhotoEditor: false,
                showPinturaCoverPhotoThumbnail: false,
                addRecipe_recipePinturaPhotoResult: null,

                /* Quill Variables */
                quillAddRecipeViewInstance: null,
                addRecipe_recipeDescription: null,
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
            },
            components: {
                "tags-input": VoerroTagsInput
            },
            mounted() {
                //Prevent +, -, e from being able to be inserted into number text boxes
                this.$refs.addRecipe_recipePrepTimeRef.addEventListener('keypress', event => utils.checkForInvalidNumberCharacters(event));
                this.$refs.addRecipe_recipeCookTimeRef.addEventListener('keypress', event => utils.checkForInvalidNumberCharacters(event));
                this.$refs.addRecipe_recipeTotalTimeRef.addEventListener('keypress', event => utils.checkForInvalidNumberCharacters(event));

                //Init Quill for AddRecipeView
                this.initAddRecipeViewQuill();
            },
            watch: {
            },
            methods: {
                /**** ADD_RECIPE VIEW CONTROLLER METHODS ****/
                addRecipe_ToStepOne() {
                    //Show views
                    this.showStep1 = true;
                    this.showStep2 = false;
                    this.showStep3 = false;
                },
                addRecipe_ToStepTwo() {
                    var self = this;

                    //Remove any potential error checks
                    this.$refs.addRecipe_recipeNameRef.classList.remove('is-invalid');

                    //Perform Step 1 validation checks
                    if (!utils.isString(this.addRecipe_recipeName)) {
                        this.$refs.addRecipe_recipeNameRef.classList.add('is-invalid');
                        return;
                    }

                    //Show views
                    this.showStep1 = false;
                    this.showStep2 = true;
                    this.showStep3 = false;

                    //Inflate step 2 view
                    if (this.$refs.coverPhotoInput.getAttribute('listener') !== 'true') {
                        this.$refs.coverPhotoInput.addEventListener('change', function () { //Create change event listener
                            self.showPinturaCoverPhotoThumbnail = false;
                            self.showPinturaCoverPhotoEditor = true;

                            const editor = appendEditor(self.$refs.coverPhotoPinturaEditor, {
                                imageReader: createDefaultImageReader(),
                                imageWriter: createDefaultImageWriter({
                                    mimeType: 'image/png',
                                    quality: 0.9,
                                    targetSize: {
                                        width: 2048,
                                        height: 2048,
                                        upscale: true,
                                    }
                                }),
                                locale: {
                                    ...locale_en_gb,
                                    ...plugin_crop_locale_en_gb,
                                    ...plugin_resize_locale_en_gb
                                },
                            });

                            editor.loadImage(this.files[0]);

                            editor.on('process', (res) => {
                                var result = URL.createObjectURL(res.dest);
                                //TODO: Upload 'result' to Firebase Storage and get downloadURL
                                self.$refs.coverPhotoPinturaResult.setAttribute('src', result);
                                self.addRecipe_recipePinturaPhotoResult = result;
                                self.showPinturaCoverPhotoEditor = false;
                                self.showPinturaCoverPhotoThumbnail = true;
                                self.$refs.coverPhotoInput.value = null;
                                editor.destroy();
                            });
                        }, false);
                    }
                },
                addRecipe_ToStepThree() {
                    var isError = false;
                    //Remove any potential error checks
                    this.$refs.addRecipe_recipeTagsRef.$el.classList.remove('is-invalid');
                    var node = document.getElementById('tag-invalid-input');
                    if (node != null) {
                        node.remove();
                    }
                    //document.getElementById('tag-invalid-input').remove();
                    this.$refs.addRecipe_recipeTotalTimeRef.classList.remove('is-invalid');
                    this.$refs.addRecipe_recipeYieldRef.classList.remove('is-invalid');

                    //Cover photo not required
                    //Description not required
                    //Tags required
                    if (this.addRecipe_recipeTags.length < 1) {
                        this.$refs.addRecipe_recipeTagsRef.$el.classList.add('is-invalid');
                        //We need to manually add the Bootstrap invalid tooltip
                        //The reason is because vue-tags is a VueJS component and
                        // does not have a built-in API to inject HTML
                        //So we do it ourselves.
                        var invalidDOM = `<div id="tag-invalid-input" class="invalid-tooltip" style="display: block;">Please enter at least 1 tag</div>`;
                        //Get the input of the tags Vue library
                        var addRecipeTagsInput = this.$refs.addRecipe_recipeTagsRef.$el.getElementsByTagName('input')[0];
                        //Insert the invalid information text box after the input tag in the DOM
                        addRecipeTagsInput.insertAdjacentHTML('afterend', invalidDOM);
                        isError = true;
                    }
                    //Prep time has to be a number
                    //Cook time has to be a number
                    //Total time has to be a number greater than 1
                    if (this.addRecipe_recipeTotalTime < 1) {
                        this.$refs.addRecipe_recipeTotalTimeRef.classList.add('is-invalid');
                        isError = true;
                    }
                    //Yield required, has to be string
                    if (!utils.isString(this.addRecipe_recipeYield)) {
                        this.$refs.addRecipe_recipeYieldRef.classList.add('is-invalid');
                        isError = true;
                    }
                    //If there's a user error, don't continue forward
                    if (isError) {
                        return;
                    }
                    //Show views
                    this.showStep1 = false;
                    this.showStep2 = false;
                    this.showStep3 = true;
                },
                clickedFinishAddRecipe() {
                    var self = this;
                    this.addRecipe_isUploading = true;
                    this.showStep1 = false;
                    this.showStep2 = false;
                    this.showStep3 = false;
                    this.showStep4 = true;
                    //Perform checks
                    setTimeout(function () {
                        self.addRecipe_isUploading = false;
                        self.addRecipe_isFinishedUploading = true;
                    }, 2000);
                },
                /**** ADD_RECIPE BUTTON HELPERS ****/
                addRecipe_clickedAddIngredients() {
                    this.addRecipe_recipeIngredientsInput.split('\n').forEach(ingredient => {
                        this.recipeIngredientBreakdown.push(nlp.parseIngredient(ingredient));
                    });
                    this.addRecipe_recipeIngredientsInput = '';
                },
                addRecipe_clickedAddSteps() {
                    this.addRecipe_recipeStepsInput.split('\n').forEach(step => {
                        this.recipeStepBreakdown.push({
                            value: step
                        });
                    });
                    this.addRecipe_recipeStepsInput = '';
                },
                /**** ANIMATION METHODS ****/
                enterAddRecipeLottieAnimation(el, done) {
                    anime({
                        targets: el,
                        translateX: [15, 0],
                        opacity: [0, 1],
                        easing: 'easeInOutSine',
                        duration: 105,
                        complete: done,
                    });
                },
                leaveAddRecipeLottieAnimation(el, done) {
                    anime({
                        targets: el,
                        translateX: [0, -15],
                        opacity: [1, 0],
                        easing: 'easeInOutSine',
                        duration: 105,
                        complete: done
                    });
                },
                enterAddRecipeContentAnimation(el, done) {
                    anime({
                        targets: el,
                        translateX: [30, 0],
                        opacity: [0, 1],
                        easing: 'easeInOutSine',
                        duration: 105,
                        complete: done,
                    });
                },
                leaveAddRecipeContentAnimation(el, done) {
                    anime({
                        targets: el,
                        translateX: [0, -30],
                        opacity: [1, 0],
                        easing: 'easeInOutSine',
                        duration: 105,
                        complete: done
                    });
                },
                enterUploadRecipeLottieAnimation(el, done) {
                    anime({
                        targets: el,
                        translateX: ['33vw', 0],
                        opacity: [0, 1],
                        easing: 'easeInOutSine',
                        duration: 105,
                        complete: done,
                    });
                },
                leaveUploadRecipeLottieAnimation(el, done) {
                    anime({
                        targets: el,
                        translateX: [0, '33vw'],
                        opacity: [1, 0],
                        easing: 'easeInOutSine',
                        duration: 105,
                        complete: done
                    });
                },
                enterFinishedAddRecipeUploadTextAnimation(el, done) {
                    return done;
                },
                leaveFinishedAddRecipeUploadTextAnimation(el, done) {
                    anime({
                        targets: el,
                        translateY: ['-50%', '0%'],
                        opacity: [0, 1],
                        duration: 200,
                        easing: 'easeInOutQuad',
                        complete: done
                    });
                },
                /**** 3rd PARTY LIBRARY METHODS ****/
                enterPinturaAnimation(el, done) {
                    anime({
                        targets: el,
                        translateY: [15, 0],
                        opacity: [0, 1],
                        easing: 'easeInOutSine',
                        duration: 105,
                        complete: done,
                    });
                },
                leavePinturaAnimation(el, done) {
                    anime({
                        targets: el,
                        translateY: [0, -15],
                        opacity: [1, 0],
                        easing: 'easeInOutSine',
                        duration: 105,
                        complete: done
                    });
                },
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
                        console.log('OCR button clicked');
                    };
                    ocrDescriptionButton.attach(this.quillAddRecipeViewInstance);
                },
                onAddRecipeViewQuillContentChange: function () {
                    this.setAddRecipeViewQuillContent();
                    this.$emit('input', this.addRecipe_recipeDescription);
                },
                setAddRecipeViewQuillContent: function () {
                    this.addRecipe_recipeDescription = this.quillAddRecipeViewInstance.getText().trim() ? this.quillAddRecipeViewInstance.root.innerHTML : '';
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
                /**** UTILITY METHODS ****/
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
            }
        });
    });
})();