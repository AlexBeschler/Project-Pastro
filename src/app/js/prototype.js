/*jshint esversion: 8 */
(function () {
    window.addEventListener('load', function () {
        var utils = new ProjectPastroUtils();
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
                //Add recipe cover photo variables
                //Add recipe description notes
                addRecipe_recipeDescription: '',
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

                //Added Recipe Animation Controllers
                addRecipe_isUploading: false,
                addRecipe_isFinishedUploading: false,
            },
            components: {
                "tags-input": VoerroTagsInput
            },
            mounted() {
                //Prevent +, -, e from being able to be inserted into number text boxes
                this.$refs.addRecipe_recipePrepTimeRef.addEventListener('keypress', event => utils.checkForInvalidNumberCharacters(event));
                this.$refs.addRecipe_recipeCookTimeRef.addEventListener('keypress', event => utils.checkForInvalidNumberCharacters(event));
                this.$refs.addRecipe_recipeTotalTimeRef.addEventListener('keypress', event => utils.checkForInvalidNumberCharacters(event));
            },
            methods: {
                addRecipe_ToStepOne() {
                    //Show views
                    this.showStep1 = true;
                    this.showStep2 = false;
                    this.showStep3 = false;
                },
                addRecipe_ToStepTwo() {
                    //Assuming we're coming from Step 1
                    if (!utils.isString(this.addRecipe_recipeName)) {
                        this.$refs.addRecipe_recipeNameRef.classList.add('is-invalid');
                        return;
                    }
                    //Show views
                    this.showStep1 = false;
                    this.showStep2 = true;
                    this.showStep3 = false;
                },
                addRecipe_ToStepThree() {
                    //Cover photo not required
                    //Description not required
                    //Tags required
                    if (this.addRecipe_recipeTags.length < 1) {
                        this.$refs.addRecipe_recipeTagsRef.$el.classList.add('is-invalid');
                        //We need to manually add the Bootstrap invalid tooltip
                        //The reason is because vue-tags is a VueJS component and
                        // does not have a built-in API to inject HTML
                        //So we do it ourselves.
                        var invalidDOM = `<div class="invalid-tooltip" style="display: block;">Please enter at least 1 tag</div>`;
                        //Get the input of the tags Vue library
                        var addRecipeTagsInput = this.$refs.addRecipe_recipeTagsRef.$el.getElementsByTagName('input')[0];
                        //Insert the invalid information text box after the input tag in the DOM
                        addRecipeTagsInput.insertAdjacentHTML('afterend', invalidDOM);
                        return;
                    }
                    //Prep time has to be a number
                    if (!utils.isNumber(this.addRecipe_recipePrepTime)) {
                        console.log('Not a number');
                        return;
                    }
                    //Cook time has to be a number
                    //Total time has to be a number greater than 1
                    //Yield required, has to be string

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
                /* Add Recipe Lottie enter/exit animations */
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
                /* Add Recipe Content */
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
                }
            }
        });
    });
})();