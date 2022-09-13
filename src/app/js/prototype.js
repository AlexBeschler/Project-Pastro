/*jshint esversion: 8 */
(function () {
    window.addEventListener('load', function () {
        new Vue({
            el: '#appContent',
            data: {
                /* Add Recipe View States */
                showStep1: true,
                showStep2: false,
                showStep3: false,
                showStep4: false,
                isUploading: false,
                isFinishedUploading: false,
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
            },
            components: {
                "tags-input": VoerroTagsInput
            },
            methods: {
                addRecipe_ToStepOne() {
                    this.showStep1 = true;
                    this.showStep2 = false;
                    this.showStep3 = false;
                },
                addRecipe_ToStepTwo() {
                    this.showStep1 = false;
                    this.showStep2 = true;
                    this.showStep3 = false;
                },
                addRecipe_ToStepThree() {
                    this.showStep1 = false;
                    this.showStep2 = false;
                    this.showStep3 = true;
                },
                clickedFinishAddRecipe() {
                    console.log('Uploading');
                    var self = this;
                    this.isUploading = true;
                    this.showStep1 = false;
                    this.showStep2 = false;
                    this.showStep3 = false;
                    this.showStep4 = true;
                    //Perform checks
                    setTimeout(function () {
                        console.log('Finish animation');
                        self.isUploading = false;
                        self.isFinishedUploading = true;
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
                }
            }
        });
    });
})();